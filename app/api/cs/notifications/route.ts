import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { canHandleCs } from '@/lib/roles'

// cs_notifications — CS 담당자별 알림 데이터(배지·목록용). 기존 팝업·소리
// (lib/useNotifier.ts)와 병행 동작하며, 그쪽은 건드리지 않는다.

function getAdminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) {
    console.warn('[cs/notifications] SUPABASE_SERVICE_ROLE_KEY 미설정 — 알림 생성 스킵')
    return null
  }
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// ── POST: 알림 생성 (CS 담당자 전원에게 1행씩) ──────────────────────
// ★cs_notifications엔 일부러 INSERT 정책을 만들지 않았다 — 이 API가 유일한
//   생성 경로다("내 알림을 내가 만드는 게 아니라 시스템이 만들어 주는 것").
//   그래서 서비스 롤로 쓰되, 최소한 로그인 세션은 요구해 완전 익명 호출은 막는다.
export async function POST(request: Request) {
  try {
    const authClient = createServerClient()
    const { data: { user } } = await authClient.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const body = await request.json()
    const { kind, inquiryId, messageId, branchName, preview } = body as {
      kind?: 'new_inquiry' | 'new_message'
      inquiryId?: string
      messageId?: string
      branchName?: string
      preview?: string
    }

    if (!inquiryId || (kind !== 'new_inquiry' && kind !== 'new_message')) {
      return NextResponse.json(
        { error: "kind('new_inquiry'|'new_message')와 inquiryId는 필수입니다" },
        { status: 400 }
      )
    }

    const adminClient = getAdminClient()
    if (!adminClient) {
      return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY 필요' }, { status: 400 })
    }

    // 배정자(assignee) 개념 없음(A안) — CS 담당자 "전원"에게 보낸다.
    // ★판정은 lib/roles.ts의 canHandleCs를 그대로 재사용한다(새 함수 금지).
    const { data: activeAdmins } = await adminClient
      .from('admins')
      .select('id, role, can_handle_cs')
      .eq('is_active', true)

    const recipients = (activeAdmins || []).filter(a => canHandleCs(a))

    for (const admin of recipients) {
      const { error } = await adminClient.from('cs_notifications').insert({
        admin_id: admin.id,
        inquiry_id: inquiryId,
        message_id: messageId || null,
        kind,
        branch_name: branchName || null,
        preview: preview || null,
      })
      // 같은 이벤트가 중복 호출돼도 DB unique 인덱스가 막아준다.
      // 23505(unique_violation)는 정상 상황이므로 조용히 무시하고, 그 외 에러만 기록한다.
      if (error && error.code !== '23505') {
        console.error('[cs/notifications] insert 실패:', admin.id, error.message)
      }
    }

    return NextResponse.json({ success: true, count: recipients.length })
  } catch (e) {
    console.error('[cs/notifications] POST 예외:', e)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}

// ── GET: 내 안 읽은 알림 목록 (최신순, 최대 50건) ───────────────────
// 쿠키 클라이언트 — RLS가 admin_id 기준으로 본인 것만 반환한다고 가정.
export async function GET() {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('cs_notifications')
    .select('id, inquiry_id, message_id, kind, branch_name, preview, created_at')
    .is('read_at', null)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
  return NextResponse.json({ notifications: data || [] })
}

// ── PATCH: 읽음 처리 ────────────────────────────────────────────────
// { ids: string[] } → 지정한 알림들만 / { inquiryId } → 그 문의의 내 알림 전부
export async function PATCH(request: Request) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
  }

  const body = await request.json()
  const { ids, inquiryId } = body as { ids?: string[]; inquiryId?: string }
  const readAt = new Date().toISOString()

  if (Array.isArray(ids) && ids.length > 0) {
    const { error } = await supabase.from('cs_notifications').update({ read_at: readAt }).in('id', ids)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ success: true })
  }

  if (inquiryId) {
    const { error } = await supabase.from('cs_notifications').update({ read_at: readAt }).eq('inquiry_id', inquiryId)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'ids 또는 inquiryId가 필요합니다' }, { status: 400 })
}
