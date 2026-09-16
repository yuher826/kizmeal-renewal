import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase-server'

function getServiceClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) return null
  return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// 고객사 화면 전용 — 이 문의에 등장한 발신자의 이름만 돌려준다.
// admins 테이블은 RLS로 고객사에 계속 닫아두고, 서버가 소속을 확인한 뒤
// 서비스 롤로 이름만 뽑아 내려주는 통로다.
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })

    const { data: inquiry } = await supabase
      .from('inquiries').select('id, branch_id').eq('id', id).maybeSingle()
    if (!inquiry) return NextResponse.json({ error: '문의를 찾을 수 없습니다' }, { status: 404 })

    // 요청자가 이 문의가 속한 원 소속(마스터 또는 멤버)인지 서버에서 검증.
    // ★이 검증을 건너뛰면 남의 원 문의 발신자를 조회할 수 있다.
    const [{ data: asMaster }, { data: asMember }] = await Promise.all([
      supabase.from('branches').select('id')
        .eq('auth_id', user.id).eq('id', inquiry.branch_id).maybeSingle(),
      supabase.from('branch_members').select('id')
        .eq('auth_id', user.id).eq('branch_id', inquiry.branch_id).eq('is_active', true).maybeSingle(),
    ])
    if (!asMaster && !asMember) {
      return NextResponse.json({ error: '접근 권한이 없습니다' }, { status: 403 })
    }

    const serviceClient = getServiceClient()
    if (!serviceClient) {
      return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY 필요' }, { status: 500 })
    }

    const { data: msgs } = await serviceClient
      .from('messages')
      .select('sender_id')
      .eq('inquiry_id', id)
      .eq('is_internal', false)
    const senderIds = Array.from(new Set((msgs || []).map(m => m.sender_id).filter(Boolean))) as string[]
    if (senderIds.length === 0) return NextResponse.json({ senders: {} })

    // admins는 is_active 필터를 걸지 않는다 — 퇴사자가 쓴 옛 메시지의 이름을
    // 잃으면 안 된다(InquiryDetailPanel.tsx의 senderNameMap과 같은 이유).
    const [{ data: admins }, { data: members }, { data: branches }] = await Promise.all([
      serviceClient.from('admins').select('auth_id, name').in('auth_id', senderIds),
      serviceClient.from('branch_members').select('auth_id, name, role').in('auth_id', senderIds),
      serviceClient.from('branches').select('auth_id, name').in('auth_id', senderIds),
    ])

    // name·role만 반환한다 — email·역할코드·플래그 등은 절대 내보내지 않는다.
    // admins가 가장 신뢰할 수 있는 출처라 마지막에 덮어써, sender_type이
    // 잘못 기록된 행(실측: branch인데 sender_id가 admin auth_id인 경우)도
    // 실제 계정 기준으로 올바르게 해석된다.
    const senders: Record<string, { name: string; role?: string }> = {}
    for (const b of branches || []) senders[b.auth_id] = { name: b.name }
    for (const m of members || []) senders[m.auth_id] = { name: m.name, role: m.role }
    for (const a of admins || []) senders[a.auth_id] = { name: a.name }

    return NextResponse.json({ senders })
  } catch (e) {
    console.error('[inquiries/senders/route] 예외:', e)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}
