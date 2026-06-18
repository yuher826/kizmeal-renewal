import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import type { BranchAccountInfo } from '@/types/erp'

async function getAdmin(supabase: ReturnType<typeof createClient>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('admins').select('id, role').eq('auth_id', user.id).maybeSingle()
  return data
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient()
    const admin = await getAdmin(supabase)
    if (!admin) return NextResponse.json({ error: '접근 권한이 없습니다' }, { status: 403 })

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: '서버 설정 오류. 관리자에게 문의하세요.' }, { status: 500 })
    }

    const { data: bp } = await supabase
      .from('branch_profiles')
      .select('branch_id')
      .eq('id', params.id)
      .maybeSingle()

    if (!bp?.branch_id) {
      const result: BranchAccountInfo = { exists: false, email: null, kos_id: null, status: null, last_login_at: null, created_at: null, auth_user_id: null }
      return NextResponse.json(result)
    }

    const { data: branch } = await supabase
      .from('branches')
      .select('auth_id, email, kos_id, last_login_at, created_at')
      .eq('id', bp.branch_id)
      .maybeSingle()

    if (!branch?.auth_id) {
      const result: BranchAccountInfo = {
        exists: false,
        email: branch?.email ?? null,
        kos_id: branch?.kos_id ?? null,
        status: null,
        last_login_at: null,
        created_at: null,
        auth_user_id: null,
      }
      return NextResponse.json(result)
    }

    const supabaseAdmin = getSupabaseAdmin()
    const { data: { user: authUser } } = await supabaseAdmin.auth.admin.getUserById(branch.auth_id)

    let status: BranchAccountInfo['status'] = 'active'
    if (!authUser?.email_confirmed_at) {
      status = 'pending'
    } else if (authUser.banned_until && new Date(authUser.banned_until) > new Date()) {
      status = 'inactive'
    }

    const result: BranchAccountInfo = {
      exists: true,
      email: branch.email ?? authUser?.email ?? null,
      kos_id: branch.kos_id ?? null,
      status,
      last_login_at: branch.last_login_at ?? null,
      created_at: branch.created_at ?? null,
      auth_user_id: branch.auth_id,
    }
    return NextResponse.json(result)
  } catch (err) {
    console.error('[account GET] 예외:', err)
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 })
  }
}

export async function POST(
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
    const { email, kos_id } = body as { email: string; kos_id?: string }

    if (!email?.trim()) {
      return NextResponse.json({ error: '이메일을 입력해주세요' }, { status: 400 })
    }

    const { data: bp } = await supabase
      .from('branch_profiles')
      .select('branch_id')
      .eq('id', params.id)
      .maybeSingle()

    if (bp?.branch_id) {
      const { data: existingBranch } = await supabase
        .from('branches')
        .select('auth_id')
        .eq('id', bp.branch_id)
        .maybeSingle()
      if (existingBranch?.auth_id) {
        return NextResponse.json({ error: '이미 계정이 있습니다' }, { status: 409 })
      }
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
    const supabaseAdmin = getSupabaseAdmin()
    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email.trim(),
      { redirectTo: `${siteUrl}/board/auth/callback` }
    )

    if (inviteError || !inviteData.user) {
      console.error('[account POST] 초대 오류:', inviteError)
      return NextResponse.json({ error: '초대 이메일 발송에 실패했습니다' }, { status: 500 })
    }

    if (bp?.branch_id) {
      await supabase
        .from('branches')
        .update({ email: email.trim(), kos_id: kos_id?.trim() ?? null, auth_id: inviteData.user.id })
        .eq('id', bp.branch_id)
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: newBranch } = await (supabase.from('branches') as any)
        .insert({ email: email.trim(), kos_id: kos_id?.trim() ?? null, auth_id: inviteData.user.id })
        .select('id')
        .single()
      if (newBranch?.id) {
        await supabase
          .from('branch_profiles')
          .update({ branch_id: newBranch.id })
          .eq('id', params.id)
      }
    }

    return NextResponse.json({ success: true, email: email.trim() }, { status: 201 })
  } catch (err) {
    console.error('[account POST] 예외:', err)
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 })
  }
}
