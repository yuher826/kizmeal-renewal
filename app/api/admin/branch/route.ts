import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { sendAdminAccountEmail } from '@/lib/email'
import { ROLES, ADMIN_CREATE_ROLES, MANAGER_CREATABLE_ROLES, MANAGER_FORCED_SCOPE } from '@/lib/roles'
import { randomInt } from 'crypto'

// 유효한 관리자 역할/접근범위 목록 (lib/roles.ts 상수 재사용)
const VALID_ADMIN_ROLES = Object.values(ROLES) as string[]
const VALID_SCOPES = ['erp_only', 'board_only', 'both']

// 임시 비밀번호 서버 생성 (crypto 기반 16자, 대문자·소문자·숫자·특수문자 각 1자 이상 보장)
function generateTempPassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ'   // 혼동 문자(I,O) 제외
  const lower = 'abcdefghijkmnpqrstuvwxyz'   // 혼동 문자(l) 제외
  const digits = '23456789'                  // 혼동 문자(0,1) 제외
  const special = '!@#$%^&*'
  const all = upper + lower + digits + special
  const chars = [
    upper[randomInt(upper.length)],
    lower[randomInt(lower.length)],
    digits[randomInt(digits.length)],
    special[randomInt(special.length)],
  ]
  for (let i = chars.length; i < 16; i++) chars.push(all[randomInt(all.length)])
  // Fisher-Yates 셔플 (crypto randomInt)
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join('')
}

function getAdminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) {
    console.warn('[branch/route] SUPABASE_SERVICE_ROLE_KEY 미설정 — Auth 기능 제한됨')
    return null
  }
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export async function POST(request: Request) {
  try {
    // ── 인증 검사: 로그인 세션 + admins 등록 여부 확인 ─────────
    const authClient = createServerClient()
    const { data: { user } } = await authClient.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const { data: requesterAdmin } = await authClient
      .from('admins')
      .select('id, name, role, is_active')
      .eq('auth_id', user.id)
      .maybeSingle()

    if (!requesterAdmin) {
      return NextResponse.json({ error: '접근 권한이 없습니다' }, { status: 403 })
    }

    // 비활성 관리자 차단
    if (requesterAdmin.is_active === false) {
      return NextResponse.json({ error: '비활성화된 계정입니다' }, { status: 403 })
    }

    const body = await request.json()
    const { action } = body
    const adminClient = getAdminClient()

    // ── [종료된 기능] 지점 생성 / 비밀번호 초기화 ──────────────
    // 평문 임시 비밀번호를 이메일 본문에 넣어 보내던 레거시 경로 — 보안상 제거됨.
    // 대체 경로: /erp/branches/new (프로파일 등록) → 원 상세 "담당자 계정"의
    // 초대 이메일(inviteUserByEmail) / 비밀번호 초기화(resetPasswordForEmail).
    if (action === 'create' || action === 'reset-password') {
      return NextResponse.json(
        { error: '이 기능은 종료되었습니다. 원 프로파일 → 담당자 계정에서 초대 이메일·비밀번호 초기화를 사용하세요.' },
        { status: 410 }
      )
    }

    // ── 지점 비활성화 ──────────────────────────────────────────
    if (action === 'deactivate') {
      const { branchId, authId, actorId, actorName } = body

      if (adminClient && authId) {
        const { error } = await adminClient.auth.admin.updateUserById(authId, {
          ban_duration: '876000h',
        })
        if (error) console.error('[branch/route] Auth 차단 실패:', error.message)
      } else if (!adminClient) {
        console.warn('[branch/route] service role 없음 — Auth 차단 스킵')
      }

      const supabase = adminClient || createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )

      await supabase
        .from('branches')
        .update({ status: 'inactive', is_active: false })
        .eq('id', branchId)

      if (actorId) {
        try {
          await supabase.from('audit_logs').insert({
            actor_id: actorId,
            actor_type: 'admin',
            actor_name: actorName || '관리자',
            action: 'branch_deactivated',
            target_type: 'branch',
            target_id: branchId,
          })
        } catch { /* audit log 실패는 무시 */ }
      }

      return NextResponse.json({ success: true })
    }

    // ── 지점 상태 변경 ─────────────────────────────────────────
    if (action === 'update-status') {
      const { branchId, status } = body
      const supabase = adminClient || createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      const { error } = await supabase.from('branches').update({ status }).eq('id', branchId)
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json({ success: true })
    }

    // ── 관리자 계정 생성 (super_admin + manager) ───────────────
    if (action === 'create-admin') {
      if (!ADMIN_CREATE_ROLES.includes(requesterAdmin.role)) {
        return NextResponse.json({ error: '관리자 계정을 생성할 권한이 없습니다' }, { status: 403 })
      }
      if (!adminClient) {
        return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY 필요' }, { status: 400 })
      }

      const { name, email, role, department, phone, access_scope } = body
      if (!name?.trim() || !email?.trim() || !role) {
        return NextResponse.json({ error: '이름·이메일·역할은 필수입니다' }, { status: 400 })
      }
      if (!VALID_ADMIN_ROLES.includes(role)) {
        return NextResponse.json({ error: '유효하지 않은 역할입니다' }, { status: 400 })
      }

      // 매니저 제약: 하위 역할(super_admin·manager 제외)만 생성 가능 + 접근범위 erp_only 강제
      // (요청자 role 기준 서버 강제 — 클라이언트 전달값에 의존하지 않음)
      const isManagerRequester = requesterAdmin.role === ROLES.MANAGER
      if (isManagerRequester && !MANAGER_CREATABLE_ROLES.includes(role)) {
        return NextResponse.json({ error: '매니저는 상위 역할(슈퍼관리자·매니저) 계정을 생성할 수 없습니다' }, { status: 403 })
      }
      const scope = isManagerRequester ? MANAGER_FORCED_SCOPE : (access_scope || 'both')
      if (!VALID_SCOPES.includes(scope)) {
        return NextResponse.json({ error: '유효하지 않은 접근범위입니다' }, { status: 400 })
      }

      // 이메일 중복 사전 체크
      const { data: dup } = await adminClient
        .from('admins').select('id').eq('email', email.trim()).maybeSingle()
      if (dup) {
        return NextResponse.json({ error: '이미 등록된 이메일입니다' }, { status: 409 })
      }

      // 임시 비밀번호는 서버에서만 생성 (클라이언트 전달값 무시)
      const tempPassword = generateTempPassword()

      // 순서: Auth 먼저 → admins. Auth 실패 시 admins 미생성으로 안전
      const { data: authUser, error: authError } = await adminClient.auth.admin.createUser({
        email: email.trim(),
        password: tempPassword,
        email_confirm: true,
      })
      if (authError) {
        return NextResponse.json({ error: `Auth 계정 생성 실패: ${authError.message}` }, { status: 400 })
      }

      const { data: newAdmin, error: adminError } = await adminClient.from('admins').insert({
        auth_id: authUser.user.id,
        name: name.trim(),
        email: email.trim(),
        role,
        department: department?.trim() || null,
        phone: phone?.trim() || null,
        access_scope: scope,
        is_active: true,
      }).select().single()

      if (adminError) {
        // 반쪽 상태 방지: admins INSERT 실패 시 방금 만든 Auth 계정 롤백
        await adminClient.auth.admin.deleteUser(authUser.user.id)
        return NextResponse.json({ error: `관리자 등록 실패: ${adminError.message}` }, { status: 400 })
      }

      // audit 기록 (기존 deactivate 패턴 재사용)
      try {
        await adminClient.from('audit_logs').insert({
          actor_id: requesterAdmin.id,
          actor_type: 'admin',
          actor_name: requesterAdmin.name,
          action: 'admin_created',
          target_type: 'admin',
          target_id: newAdmin.id,
          detail: { email: email.trim(), role, access_scope: scope },
        })
      } catch { /* audit 실패는 무시 */ }

      // 계정 안내 메일 (임시 비밀번호 미포함 — 화면 1회 표시분을 직접 전달)
      let emailSent = false
      try {
        await sendAdminAccountEmail(email.trim(), name.trim())
        emailSent = true
      } catch (e) {
        console.error('[branch/route] 관리자 안내 메일 발송 실패:', e)
      }

      return NextResponse.json({ success: true, admin: newAdmin, tempPassword, emailSent })
    }

    // ── 관리자 정보 수정 (super_admin 전용) ───────────────────
    if (action === 'update-admin') {
      if (requesterAdmin.role !== 'super_admin') {
        return NextResponse.json({ error: '슈퍼관리자만 관리자 정보를 수정할 수 있습니다' }, { status: 403 })
      }
      if (!adminClient) {
        return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY 필요' }, { status: 400 })
      }

      const { adminId, updates } = body
      if (!adminId || !updates || typeof updates !== 'object') {
        return NextResponse.json({ error: 'adminId와 updates가 필요합니다' }, { status: 400 })
      }

      // 수정 허용 필드 화이트리스트 — email은 명시적 제외 (Auth와 어긋남 방지)
      const ALLOWED_FIELDS = [
        'name', 'role', 'access_scope', 'department', 'phone', 'is_active',
        'can_manage_templates', 'can_handle_cs', 'can_write_notices',
      ]
      const filtered: Record<string, unknown> = {}
      for (const f of ALLOWED_FIELDS) if (f in updates) filtered[f] = updates[f]
      if (Object.keys(filtered).length === 0) {
        return NextResponse.json({ error: '수정할 필드가 없습니다' }, { status: 400 })
      }
      if ('role' in filtered && !VALID_ADMIN_ROLES.includes(filtered.role as string)) {
        return NextResponse.json({ error: '유효하지 않은 역할입니다' }, { status: 400 })
      }
      if ('access_scope' in filtered && !VALID_SCOPES.includes(filtered.access_scope as string)) {
        return NextResponse.json({ error: '유효하지 않은 접근범위입니다' }, { status: 400 })
      }
      // 플래그 3개는 boolean인지만 확인한다 — 어떤 역할이 어떤 플래그를 가질
      // 수 있는지는 검증하지 않는다(staff든 영양사든 배정받을 수 있는 게
      // 설계 의도). 문자열 "false"가 그대로 들어가 DB에서 true가 되는
      // 사고를 막는 용도.
      for (const flag of ['can_manage_templates', 'can_handle_cs', 'can_write_notices']) {
        if (flag in filtered && typeof filtered[flag] !== 'boolean') {
          return NextResponse.json({ error: `${flag}는 boolean이어야 합니다` }, { status: 400 })
        }
      }

      const { data: target } = await adminClient
        .from('admins').select('*').eq('id', adminId).maybeSingle()
      if (!target) {
        return NextResponse.json({ error: '대상 관리자를 찾을 수 없습니다' }, { status: 404 })
      }

      // 자기 자신 비활성화 차단
      if (filtered.is_active === false && target.auth_id === user.id) {
        return NextResponse.json({ error: '자기 자신은 비활성화할 수 없습니다' }, { status: 400 })
      }

      // 최후의 super_admin 보호: 활성 super_admin이 1명뿐이면 역할 변경·비활성화 차단
      const demoting = 'role' in filtered && filtered.role !== 'super_admin'
      const deactivatingTarget = filtered.is_active === false
      if (target.role === 'super_admin' && target.is_active && (demoting || deactivatingTarget)) {
        const { count } = await adminClient
          .from('admins')
          .select('id', { count: 'exact', head: true })
          .eq('role', 'super_admin')
          .eq('is_active', true)
        if ((count ?? 0) <= 1) {
          return NextResponse.json({ error: '마지막 슈퍼관리자는 변경할 수 없습니다' }, { status: 400 })
        }
      }

      const { data: updated, error: updateError } = await adminClient
        .from('admins').update(filtered).eq('id', adminId).select().single()
      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 400 })
      }

      // audit 기록 — 변경된 필드의 전/후 값
      try {
        const before: Record<string, unknown> = {}
        const after: Record<string, unknown> = {}
        for (const f of Object.keys(filtered)) { before[f] = target[f]; after[f] = updated[f] }
        await adminClient.from('audit_logs').insert({
          actor_id: requesterAdmin.id,
          actor_type: 'admin',
          actor_name: requesterAdmin.name,
          action: 'admin_updated',
          target_type: 'admin',
          target_id: adminId,
          detail: { before, after },
        })
      } catch { /* audit 실패는 무시 */ }

      return NextResponse.json({ success: true, admin: updated })
    }

    return NextResponse.json({ error: '알 수 없는 action' }, { status: 400 })
  } catch (e) {
    console.error('[branch/route] 예외:', e)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}
