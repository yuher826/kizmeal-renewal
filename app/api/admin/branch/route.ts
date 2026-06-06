import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendBranchAccountEmail, sendBranchPasswordResetEmail } from '@/lib/email'

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
    const body = await request.json()
    const { action } = body
    const adminClient = getAdminClient()

    // ── 지점 생성 ──────────────────────────────────────────────
    if (action === 'create') {
      const { branchData, email, tempPassword, managerName } = body

      let authId: string | null = null

      if (adminClient) {
        const { data: authUser, error: authError } = await adminClient.auth.admin.createUser({
          email,
          password: tempPassword,
          email_confirm: true,
        })
        if (authError) return NextResponse.json({ error: authError.message }, { status: 400 })
        authId = authUser.user.id
      }

      const supabase = adminClient || createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )

      const defaultMealConfig = {
        간식: { 오전: false, 오후: true, 방과후: false, 돌봄: false, 기타: [] },
        특이사항: '',
        pptx슬라이드: 1,
        알레르기아이: [],
        식단확인: { 마지막확인: null, 확인횟수: 0 },
      }

      const { data: branch, error: branchError } = await supabase
        .from('branches')
        .insert({
          ...branchData,
          email,
          auth_id: authId,
          must_change_password: true,
          is_active: true,
          status: 'new',
          meal_config: branchData.meal_config ?? defaultMealConfig,
        })
        .select()
        .single()

      if (branchError) return NextResponse.json({ error: branchError.message }, { status: 400 })

      await supabase.from('branch_profiles').upsert({
        branch_id: branch.id,
        diet_plan_type: branchData.diet_type === 'catering' ? 'CONSIGNMENT' : 'CK',
        snack_morning: branchData.meal_config?.['오전'] || false,
        snack_afternoon: branchData.meal_config?.['오후'] || false,
        snack_afterschool: branchData.meal_config?.['방과후'] || false,
        snack_childcare: branchData.meal_config?.['돌봄'] || false,
        snack_teacher_extra: false,
        custom_snack_slots: [],
        nutritionist_name: '',
        nutritionist_email: '',
        distribution_email: '',
        special_notes: '',
        allergy_children: [],
      }, { onConflict: 'branch_id' })

      let emailSent = false
      try {
        await sendBranchAccountEmail(email, branchData.name, managerName, tempPassword)
        emailSent = true
      } catch (e) {
        console.error('[branch/route] 이메일 발송 실패:', e)
      }

      return NextResponse.json({ success: true, branch, emailSent })
    }

    // ── 비밀번호 초기화 ────────────────────────────────────────
    if (action === 'reset-password') {
      const { branchId, authId, email, branchName, newPassword } = body

      if (adminClient && authId) {
        const { error } = await adminClient.auth.admin.updateUserById(authId, {
          password: newPassword,
        })
        if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      } else if (!adminClient) {
        console.warn('[branch/route] service role 없음 — Auth 비밀번호 변경 스킵')
      }

      const supabase = adminClient || createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      await supabase
        .from('branches')
        .update({ must_change_password: true })
        .eq('id', branchId)

      let emailSent = false
      try {
        await sendBranchPasswordResetEmail(email, branchName, newPassword)
        emailSent = true
      } catch (e) {
        console.error('[branch/route] 이메일 발송 실패:', e)
      }

      return NextResponse.json({ success: true, emailSent })
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

    // ── 관리자 계정 생성 ───────────────────────────────────────
    if (action === 'create-admin') {
      const { name, email, role, tempPassword } = body

      if (!adminClient) {
        return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY 필요' }, { status: 400 })
      }

      const { data: authUser, error: authError } = await adminClient.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
      })
      if (authError) return NextResponse.json({ error: authError.message }, { status: 400 })

      const { error: adminError } = await adminClient.from('admins').insert({
        auth_id: authUser.user.id,
        name,
        email,
        role,
        is_active: true,
      })
      if (adminError) return NextResponse.json({ error: adminError.message }, { status: 400 })

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: '알 수 없는 action' }, { status: 400 })
  } catch (e) {
    console.error('[branch/route] 예외:', e)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}
