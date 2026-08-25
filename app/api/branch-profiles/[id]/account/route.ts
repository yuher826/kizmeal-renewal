import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { BRANCH_ACCOUNT_ROLES } from '@/lib/roles'
import type { BranchAccountInfo } from '@/types/erp'

async function getAdmin(supabase: ReturnType<typeof createClient>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('admins').select('id, name, role').eq('auth_id', user.id).maybeSingle()
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
    // 원 담당자 계정 초대는 쓰기 작업 — role 확인. GET(조회)은 읽기 전용
    // 역할(director 등)도 되어야 하므로 게이트를 걸지 않는다(위 GET 참고).
    if (!BRANCH_ACCOUNT_ROLES.includes(admin.role ?? '')) {
      return NextResponse.json({ error: '원 담당자 계정 관리 권한이 없습니다' }, { status: 403 })
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: '서버 설정 오류. 관리자에게 문의하세요.' }, { status: 500 })
    }

    const body = await request.json()
    const { email } = body as { email: string }

    if (!email?.trim()) {
      return NextResponse.json({ error: '이메일을 입력해주세요' }, { status: 400 })
    }

    const { data: bp } = await supabase
      .from('branch_profiles')
      .select('branch_id, brand_id, owner_name, kos_id, branch_full_name, contract_type')
      .eq('id', params.id)
      .maybeSingle()

    if (!bp) return NextResponse.json({ error: '프로파일을 찾을 수 없습니다' }, { status: 404 })

    const supabaseAdmin = getSupabaseAdmin()

    // 케이스 ③ — 이 프로파일에 이미 연결된 계정이 있음
    if (bp.branch_id) {
      const { data: existingBranch } = await supabase
        .from('branches').select('auth_id').eq('id', bp.branch_id).maybeSingle()
      if (existingBranch?.auth_id) {
        return NextResponse.json({ error: '이미 연결된 계정입니다' }, { status: 409 })
      }
    }

    // 신규 branches 생성이 필요한 경우(branch_id 없음) — 기본정보 누락 방지
    if (!bp.branch_id) {
      const missing: string[] = []
      if (!bp.brand_id) missing.push('브랜드')
      if (!bp.owner_name?.trim()) missing.push('대표자명')
      if (!bp.kos_id?.trim()) missing.push('원코드')
      if (!bp.branch_full_name?.trim()) missing.push('원 전체명')
      if (missing.length > 0) {
        return NextResponse.json(
          { error: `기본정보를 먼저 입력하세요 (누락: ${missing.join(', ')})` },
          { status: 400 }
        )
      }
      // kos_id 중복 사전 체크 (branches.kos_id UNIQUE 제약 — branch_id 있는 UPDATE 경로는 해당 없음)
      const { data: dupKos } = await supabaseAdmin
        .from('branches').select('id').eq('kos_id', bp.kos_id).maybeSingle()
      if (dupKos) {
        return NextResponse.json({ error: '이미 사용 중인 원코드입니다' }, { status: 409 })
      }
    }

    // 이메일 기준으로 Auth 계정 존재 여부 조회 (getUserByEmail 미제공 — listUsers 후 클라이언트 필터링)
    const { data: usersPage } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
    const existingAuthUser = usersPage?.users.find(
      u => u.email?.toLowerCase() === email.trim().toLowerCase()
    )

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
    let authUserId: string
    let mode: 'invited' | 'relinked'

    if (!existingAuthUser) {
      // 케이스 ① — Auth에 없음 → 신규 초대
      const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
        email.trim(),
        { redirectTo: `${siteUrl}/board/auth/callback` }
      )
      if (inviteError || !inviteData.user) {
        console.error('[account POST] 초대 오류:', inviteError)
        return NextResponse.json({ error: '초대 이메일 발송에 실패했습니다' }, { status: 500 })
      }
      authUserId = inviteData.user.id
      mode = 'invited'
    } else {
      // 케이스 ② — Auth에는 있으나 이 프로파일엔 연결 안 됨(고아) → 재연결
      // 다른 branches 행이 이미 이 Auth 계정을 쓰고 있으면 오연결 방지
      const { data: usedElsewhere } = await supabaseAdmin
        .from('branches').select('id').eq('auth_id', existingAuthUser.id).maybeSingle()
      if (usedElsewhere) {
        return NextResponse.json({ error: '이 이메일은 이미 다른 원에 연결되어 있습니다' }, { status: 409 })
      }
      // branches.email과 Auth email 불일치 시 자동 처리 금지
      if (existingAuthUser.email?.toLowerCase() !== email.trim().toLowerCase()) {
        return NextResponse.json({ error: '이메일 불일치 — 확인 필요' }, { status: 409 })
      }
      authUserId = existingAuthUser.id
      mode = 'relinked'
    }

    if (bp.branch_id) {
      await supabaseAdmin
        .from('branches')
        .update({ email: email.trim(), auth_id: authUserId })
        .eq('id', bp.branch_id)
    } else {
      const { data: newBranch, error: branchError } = await supabaseAdmin
        .from('branches')
        .insert({
          brand_id:      bp.brand_id,
          kos_id:        bp.kos_id,
          name:          bp.branch_full_name,
          owner_name:    bp.owner_name,
          email:         email.trim(),
          auth_id:       authUserId,
          contract_type: bp.contract_type ?? 'permanent',
        })
        .select('id')
        .single()

      if (branchError) {
        console.error('[account POST] branches 생성 오류:', branchError)
        return NextResponse.json({ error: `계정 연결 실패: ${branchError.message}` }, { status: 500 })
      }
      await supabaseAdmin.from('branch_profiles').update({ branch_id: newBranch.id }).eq('id', params.id)
    }

    // 케이스 ② 재연결이면 초대 메일 대신 비밀번호 재설정 메일 발송
    if (mode === 'relinked') {
      await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${siteUrl}/board/auth/callback` })
    }

    // audit 기록 (기존 admin_created/admin_updated와 동일 패턴)
    try {
      await supabaseAdmin.from('audit_logs').insert({
        actor_id:    admin.id,
        actor_type:  'admin',
        actor_name:  admin.name ?? '관리자',
        action:      mode === 'relinked' ? 'branch_relinked' : 'branch_invited',
        target_type: 'branch_profile',
        target_id:   params.id,
        detail:      { email: email.trim() },
      })
    } catch { /* audit 실패는 무시 */ }

    return NextResponse.json({ success: true, email: email.trim(), mode }, { status: 201 })
  } catch (err) {
    console.error('[account POST] 예외:', err)
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 })
  }
}
