import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { BRANCH_ACCOUNT_ROLES } from '@/lib/roles'

async function getAdmin(supabase: ReturnType<typeof createClient>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('admins').select('id, role').eq('auth_id', user.id).maybeSingle()
  return data
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient()
    const admin = await getAdmin(supabase)
    if (!admin) return NextResponse.json({ error: '접근 권한이 없습니다' }, { status: 403 })
    if (!BRANCH_ACCOUNT_ROLES.includes(admin.role ?? '')) {
      return NextResponse.json({ error: '원 담당자 계정 관리 권한이 없습니다' }, { status: 403 })
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: '서버 설정 오류. 관리자에게 문의하세요.' }, { status: 500 })
    }

    const body = await request.json()
    const { newEmail } = body as { newEmail: string }

    if (!newEmail?.trim()) {
      return NextResponse.json({ error: '이메일을 입력해주세요' }, { status: 400 })
    }

    const { data: bp } = await supabase
      .from('branch_profiles')
      .select('branch_id')
      .eq('id', params.id)
      .maybeSingle()

    if (!bp?.branch_id) {
      return NextResponse.json({ error: '계정 정보를 찾을 수 없습니다' }, { status: 404 })
    }

    const { data: branch } = await supabase
      .from('branches')
      .select('auth_id')
      .eq('id', bp.branch_id)
      .maybeSingle()

    if (!branch?.auth_id) {
      return NextResponse.json({ error: '연결된 계정이 없습니다' }, { status: 404 })
    }

    const supabaseAdmin = getSupabaseAdmin()
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
      branch.auth_id,
      { email: newEmail.trim() }
    )

    if (authError) {
      console.error('[account/email PUT] auth 오류:', authError)
      return NextResponse.json({ error: '이메일 변경에 실패했습니다' }, { status: 500 })
    }

    await supabase
      .from('branches')
      .update({ email: newEmail.trim() })
      .eq('id', bp.branch_id)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[account/email PUT] 예외:', err)
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 })
  }
}
