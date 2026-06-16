import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: adminRow } = await supabase
    .from('admins')
    .select('id, name, role')
    .eq('auth_id', user.id)
    .maybeSingle()

  if (!adminRow) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: {
    type:            string
    year?:           number
    month?:          number
    weekly_menu_id?: string
    branch_names?:   string[]
    count?:          number
  }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: '요청 형식 오류' }, { status: 400 })
  }

  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const db = serviceKey ? createAdminClient(supabaseUrl, serviceKey) : supabase

  const { type, year, month, weekly_menu_id, branch_names, count } = body
  const period = (year && month) ? `${year}년 ${month}월 ` : ''

  switch (type) {
    case 'correction_to_nutritionist':
      await db.from('diet_notifications').insert({
        type,
        title:          `${period}식단표 수정 요청`,
        message:        `${adminRow.name}이(가) 수정을 요청했습니다. 확인 후 수정 파일을 재제출해주세요.`,
        recipient_role: 'nutritionist_ck', // 위탁 영양사 알림은 추후 별도 구현 예정
        weekly_menu_id: weekly_menu_id ?? null,
        year:           year ?? null,
        month:          month ?? null,
      })
      break

    case 'approved_to_nutritionist':
      await db.from('diet_notifications').insert({
        type,
        title:          `${period}식단표 승인 완료`,
        message:        `${adminRow.name}이(가) 식단표를 승인했습니다. 배포를 진행해주세요.`,
        recipient_role: 'nutritionist_ck', // 위탁 영양사 알림은 추후 별도 구현 예정
        weekly_menu_id: weekly_menu_id ?? null,
        year:           year ?? null,
        month:          month ?? null,
      })
      break

    case 'resubmitted_to_manager': {
      // role IN ('manager','super_admin') 전원
      const { data: managers } = await db
        .from('admins')
        .select('id')
        .in('role', ['manager', 'super_admin'])
        .eq('is_active', true)

      const notifications = (managers ?? []).map((m: { id: string }) => ({
        type,
        title:          `${period}식단표 재제출 알림`,
        message:        `${adminRow.name}이(가) 수정 후 재제출했습니다. 재검토를 진행해주세요.`,
        recipient_role: 'manager',
        recipient_id:   m.id,
        weekly_menu_id: weekly_menu_id ?? null,
        year:           year ?? null,
        month:          month ?? null,
      }))
      if (notifications.length > 0) {
        await db.from('diet_notifications').insert(notifications)
      }
      break
    }

    case 'deployed_complete': {
      const deployedCount = count ?? branch_names?.length ?? 0
      const branchList    = branch_names?.length ? branch_names.slice(0, 3).join(', ') + (branch_names.length > 3 ? ` 외 ${branch_names.length - 3}개원` : '') : `${deployedCount}개원`

      const { data: managers } = await db
        .from('admins')
        .select('id')
        .in('role', ['manager', 'super_admin'])
        .eq('is_active', true)

      const notifications = (managers ?? []).map((m: { id: string }) => ({
        type,
        title:          `${period}식단표 배포 완료`,
        message:        `${branchList} 배포가 완료되었습니다. (총 ${deployedCount}개원)`,
        recipient_role: 'manager',
        recipient_id:   m.id,
        weekly_menu_id: weekly_menu_id ?? null,
        year:           year ?? null,
        month:          month ?? null,
      }))
      if (notifications.length > 0) {
        await db.from('diet_notifications').insert(notifications)
      }
      break
    }

    case 'emergency_deploy': {
      const branchList = branch_names?.length ? branch_names.join(', ') : '(원 미확인)'
      const { data: managers } = await db
        .from('admins')
        .select('id')
        .in('role', ['manager', 'super_admin'])
        .eq('is_active', true)

      const notifications = (managers ?? []).map((m: { id: string }) => ({
        type,
        title:          `${period}비상 배포 실행`,
        message:        `${adminRow.name}(super_admin)이(가) 비상 배포를 실행했습니다. 대상: ${branchList}`,
        recipient_role: 'manager',
        recipient_id:   m.id,
        year:           year ?? null,
        month:          month ?? null,
      }))
      if (notifications.length > 0) {
        await db.from('diet_notifications').insert(notifications)
      }
      break
    }

    // 하위호환 타입
    case 'generation_complete':
      await db.from('diet_notifications').insert({
        type,
        title:          `${period}식단표 생성 완료`,
        message:        '식단표 생성이 완료되었습니다. 검토를 진행해주세요.',
        recipient_role: 'manager',
        weekly_menu_id: weekly_menu_id ?? null,
        year:           year ?? null,
        month:          month ?? null,
      })
      break

    default:
      return NextResponse.json({ error: `알 수 없는 type: ${type}` }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
