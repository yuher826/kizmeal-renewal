import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { canHandleCs } from '@/lib/roles'

// 이어받기 — 다른 사람이 잡은 문의의 담당자를 요청자로 바꾸고, 대화창에 내부
// 기록을 남기고, 원래 담당자(활성 계정만)에게 cs_notifications 알림을 보낸다.
// 담당자 변경·내부 기록·알림을 한곳에서 처리해, 화면 쪽에서 세 가지를
// 순서대로 호출하다 일부만 성공하는 상태를 만들지 않는다.

function getAdminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) {
    console.warn('[cs/takeover] SUPABASE_SERVICE_ROLE_KEY 미설정 — 알림 생성 스킵')
    return null
  }
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const inquiryId = params.id

  try {
    const supabase = createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const { data: requester } = await supabase
      .from('admins')
      .select('id, name, role, can_handle_cs, is_active')
      .eq('auth_id', user.id)
      .maybeSingle()

    if (!requester || requester.is_active === false || !canHandleCs(requester)) {
      return NextResponse.json({ error: '이 작업을 할 권한이 없습니다' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const { expectedAssigneeId } = body as { expectedAssigneeId?: string }

    if (!expectedAssigneeId) {
      return NextResponse.json(
        { error: '담당자가 없는 문의는 답변하면 자동으로 지정됩니다' },
        { status: 400 }
      )
    }
    if (expectedAssigneeId === requester.id) {
      return NextResponse.json({ error: '이미 본인이 담당 중인 문의입니다' }, { status: 400 })
    }

    // ★조건부 UPDATE(쿠키 클라이언트, RLS 적용) — 요청자가 화면에서 본 현재
    //   담당자와 DB의 현재 담당자가 같을 때만 바꾼다. 0행이면 그 사이 누군가
    //   먼저 바꿨다는 뜻이라 덮어쓰지 않는다.
    const { data: updated, error: updateErr } = await supabase
      .from('inquiries')
      .update({ assigned_admin_id: requester.id })
      .eq('id', inquiryId)
      .eq('assigned_admin_id', expectedAssigneeId)
      .select('id, title, branches(name)')

    if (updateErr) {
      console.error('[cs/takeover] 담당자 변경 실패:', updateErr.message)
      return NextResponse.json({ error: '이어받기에 실패했습니다' }, { status: 500 })
    }
    if (!updated || updated.length === 0) {
      return NextResponse.json({ error: '그 사이 담당자가 바뀌었습니다' }, { status: 409 })
    }

    const inquiryRow = updated[0] as unknown as {
      id: string
      title: string | null
      branches: { name: string } | { name: string }[] | null
    }
    const branch = Array.isArray(inquiryRow.branches) ? inquiryRow.branches[0] : inquiryRow.branches
    const branchName = branch?.name || '고객사'
    const title = inquiryRow.title || '문의'

    // 담당자 변경은 이미 끝났다 — 아래 기록·알림이 실패해도 되돌리지 않는다
    // (담당자 변경이 본질이고, 기록·알림은 부수 효과).
    const adminClient = getAdminClient()

    // 이전 담당자 정보(활성 여부 확인용) — 서비스 롤로 조회해 RLS 필터에
    // 좌우되지 않는다(비활성 계정도 이름은 읽어야 내부 기록에 쓸 수 있다).
    let prevAdmin: { id: string; name: string; is_active: boolean } | null = null
    if (adminClient) {
      const { data } = await adminClient
        .from('admins')
        .select('id, name, is_active')
        .eq('id', expectedAssigneeId)
        .maybeSingle()
      prevAdmin = data
    }

    const prevName = prevAdmin?.name || '이전 담당자'
    let noteMessageId: string | null = null
    try {
      const { data: noteMsg, error: noteErr } = await supabase
        .from('messages')
        .insert({
          inquiry_id: inquiryId,
          sender_type: 'system',
          content: `🔄 ${requester.name}님이 ${prevName}님에게서 이어받았습니다`,
          is_internal: true,
        })
        .select('id')
        .single()
      if (noteErr) throw noteErr
      noteMessageId = noteMsg?.id ?? null
    } catch (e) {
      console.error('[cs/takeover] 내부 기록 생성 실패:', e)
    }

    if (prevAdmin?.is_active && adminClient && noteMessageId) {
      const { error: notifyErr } = await adminClient.from('cs_notifications').insert({
        admin_id: prevAdmin.id,
        inquiry_id: inquiryId,
        // ★unique 인덱스가 (admin_id, inquiry_id, COALESCE(message_id, 0000…))라
        //   message_id가 비어 있으면 같은 문의의 new_inquiry 알림과 충돌해
        //   조용히 누락된다 — 반드시 채운다.
        message_id: noteMessageId,
        kind: 'takeover',
        branch_name: branchName,
        preview: `${requester.name}님이 이어받았습니다 · ${title}`,
      })
      if (notifyErr && notifyErr.code !== '23505') {
        console.error('[cs/takeover] 알림 생성 실패:', notifyErr.message)
      }
    }

    return NextResponse.json({ assignee: { id: requester.id, name: requester.name } })
  } catch (e) {
    console.error('[cs/takeover] POST 예외:', e)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}
