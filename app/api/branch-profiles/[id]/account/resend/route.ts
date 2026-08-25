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

export async function POST(
  _request: NextRequest,
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
      .select('auth_id, email')
      .eq('id', bp.branch_id)
      .maybeSingle()

    if (!branch?.email) {
      return NextResponse.json({ error: '이메일 정보가 없습니다' }, { status: 404 })
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
    const supabaseAdmin = getSupabaseAdmin()

    const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      branch.email,
      { redirectTo: `${siteUrl}/board/auth/callback` }
    )

    if (!inviteError) {
      return NextResponse.json({ success: true })
    }

    // 이미 가입/확정된 계정이면 invite가 실패하므로 recovery 메일로 재발송.
    // generateLink는 메일을 보내지 않으므로 실제 발송되는 resetPasswordForEmail을 쓰고,
    // redirectTo를 지정해 링크가 홈페이지가 아니라 /board/auth/callback으로 오게 한다.
    const { error: recoverError } = await supabase.auth.resetPasswordForEmail(
      branch.email,
      { redirectTo: `${siteUrl}/board/auth/callback` }
    )

    if (recoverError) {
      console.error('[account/resend POST] 재발송 오류:', recoverError)
      return NextResponse.json({ error: '재발송에 실패했습니다' }, { status: 500 })
    }

    return NextResponse.json({ success: true, fallback: true })
  } catch (err) {
    console.error('[account/resend POST] 예외:', err)
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 })
  }
}
