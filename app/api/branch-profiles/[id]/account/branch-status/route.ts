import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

// 원 운영 상태(branches.status) — check-contract-expiry cron이 이 값 그대로 읽으므로
// 레거시(app/api/admin/branch/route.ts)와 동일한 값 집합을 유지해야 함
const VALID_STATUSES = ['new', 'active', 'vacation', 'expired', 'inactive'] as const
type BranchOpStatus = (typeof VALID_STATUSES)[number]

async function getAdmin(supabase: ReturnType<typeof createClient>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('admins').select('id, name').eq('auth_id', user.id).maybeSingle()
  return data
}

// 현재 원 운영 상태 조회 (UI 표시용)
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient()
    const admin = await getAdmin(supabase)
    if (!admin) return NextResponse.json({ error: '접근 권한이 없습니다' }, { status: 403 })

    const { data: bp } = await supabase
      .from('branch_profiles')
      .select('branch_id')
      .eq('id', params.id)
      .maybeSingle()

    if (!bp?.branch_id) {
      return NextResponse.json({ exists: false, status: null, is_active: null })
    }

    const { data: branch } = await supabase
      .from('branches')
      .select('status, is_active')
      .eq('id', bp.branch_id)
      .maybeSingle()

    return NextResponse.json({
      exists:    !!branch,
      status:    branch?.status ?? null,
      is_active: branch?.is_active ?? null,
    })
  } catch (err) {
    console.error('[branch-status GET] 예외:', err)
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient()
    const admin = await getAdmin(supabase)
    if (!admin) return NextResponse.json({ error: '접근 권한이 없습니다' }, { status: 403 })

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: '서버 설정 오류. 관리자에게 문의하세요.' }, { status: 500 })
    }

    const body = await request.json()
    const { action } = body as { action: 'deactivate' | 'update-status'; status?: string }

    if (action !== 'deactivate' && action !== 'update-status') {
      return NextResponse.json({ error: '잘못된 요청입니다' }, { status: 400 })
    }

    const { data: bp } = await supabase
      .from('branch_profiles')
      .select('branch_id')
      .eq('id', params.id)
      .maybeSingle()

    if (!bp?.branch_id) {
      return NextResponse.json({ error: '연결된 원 계정이 없습니다' }, { status: 404 })
    }

    const { data: branch } = await supabase
      .from('branches')
      .select('status, is_active, auth_id')
      .eq('id', bp.branch_id)
      .maybeSingle()

    if (!branch) {
      return NextResponse.json({ error: '원 정보를 찾을 수 없습니다' }, { status: 404 })
    }

    const supabaseAdmin = getSupabaseAdmin()

    // ── 비활성화: Auth 계정 차단 + status/is_active 갱신 (레거시 admin/branch:deactivate와 동일) ──
    if (action === 'deactivate') {
      if (branch.auth_id) {
        const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(branch.auth_id, {
          ban_duration: '876000h',
        })
        if (authError) console.error('[branch-status PUT] Auth 차단 실패:', authError.message)
      }

      const { error } = await supabaseAdmin
        .from('branches')
        .update({ status: 'inactive', is_active: false })
        .eq('id', bp.branch_id)

      if (error) {
        console.error('[branch-status PUT] 오류:', error)
        return NextResponse.json({ error: '처리에 실패했습니다' }, { status: 500 })
      }

      try {
        await supabaseAdmin.from('audit_logs').insert({
          actor_id:    admin.id,
          actor_type:  'admin',
          actor_name:  admin.name ?? '관리자',
          action:      'branch_deactivated',
          target_type: 'branch',
          target_id:   bp.branch_id,
        })
      } catch { /* audit 실패는 무시 */ }

      return NextResponse.json({ success: true, status: 'inactive', is_active: false })
    }

    // ── 상태 변경: status만 갱신 (레거시 admin/branch:update-status와 동일) ──
    const { status } = body as { status?: string }
    if (!status || !VALID_STATUSES.includes(status as BranchOpStatus)) {
      return NextResponse.json({ error: '유효하지 않은 상태값입니다' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('branches')
      .update({ status })
      .eq('id', bp.branch_id)

    if (error) {
      console.error('[branch-status PUT] 오류:', error)
      return NextResponse.json({ error: '처리에 실패했습니다' }, { status: 500 })
    }

    try {
      await supabaseAdmin.from('audit_logs').insert({
        actor_id:    admin.id,
        actor_type:  'admin',
        actor_name:  admin.name ?? '관리자',
        action:      'branch_status_changed',
        target_type: 'branch',
        target_id:   bp.branch_id,
        detail:      { from: branch.status, to: status },
      })
    } catch { /* audit 실패는 무시 */ }

    return NextResponse.json({ success: true, status })
  } catch (err) {
    console.error('[branch-status PUT] 예외:', err)
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 })
  }
}
