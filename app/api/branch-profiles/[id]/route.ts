import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import type { BranchProfileDetail } from '@/types/branch-profile'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function calcComplete(p: any): boolean {
  return !!(
    p.short_code &&
    p.file_format &&
    p.distribution_emails && p.distribution_emails.length > 0 &&
    p.slide_count != null
  )
}

// 빈 문자열은 null로 변환 (date/uuid/숫자 컬럼에 ''가 들어가면 DB 에러 발생)
function emptyToNull(v: unknown) {
  return v === '' ? null : v
}

// DB에 NOT NULL + 기본값이 있는 컬럼 — null을 명시적으로 넣으면 기본값이 무시되고
// NOT NULL 위반이 발생하므로, 값이 없을 땐 키 자체를 지워 DB 기본값이 적용되게 함
// (PUT에서는 키를 지우면 SET 절에서 빠져 기존 값이 그대로 유지됨)
const DB_DEFAULT_COLUMNS = ['slide_count', 'diet_plan_type', 'contract_status'] as const
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function stripEmptyDefaultColumns(data: Record<string, any>) {
  for (const key of DB_DEFAULT_COLUMNS) {
    if (data[key] === null) delete data[key]
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })

    const { data: adminData } = await supabase
      .from('admins').select('id').eq('auth_id', user.id).maybeSingle()
    if (!adminData) return NextResponse.json({ error: '접근 권한이 없습니다' }, { status: 403 })

    const { data: raw, error } = await supabase
      .from('branch_profiles')
      .select('*')
      .eq('id', params.id)
      .maybeSingle()

    if (error) {
      console.error('[branch-profiles/[id] GET] 오류:', error)
      return NextResponse.json({ error: '조회 중 오류가 발생했습니다' }, { status: 500 })
    }
    if (!raw) return NextResponse.json({ error: 'not found' }, { status: 404 })

    // 이번 달 배포 현황
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 1

    const { data: deployed } = await supabase
      .from('weekly_menus').select('branch_id')
      .eq('year', year).eq('month', month)
      .eq('branch_id', raw.branch_id)
      .not('pptx_url', 'is', null)
      .limit(1)

    // 최근 메뉴 이력 (최대 12건)
    const { data: menus } = await supabase
      .from('weekly_menus')
      .select('year, month, week_num, pptx_url, pdf_url, created_at')
      .eq('branch_id', raw.branch_id)
      .order('year', { ascending: false })
      .order('month', { ascending: false })
      .limit(12)

    const profile: BranchProfileDetail = {
      id:                  raw.id,
      branch_id:           raw.branch_id,
      short_code:          raw.short_code,
      display_name:        raw.display_name,
      branch_full_name:    raw.branch_full_name,
      group_tag:           raw.group_tag,
      contract_status:     raw.contract_status,
      contract_type:       raw.contract_type,
      diet_type:           raw.diet_type,
      file_format:         raw.file_format,
      slide_count:         raw.slide_count,
      distribution_emails: raw.distribution_emails,
      review_required:     raw.review_required,
      contract_start_date: raw.contract_start_date,
      renew_date:          raw.contract_renew_date ?? null,
      updated_at:          raw.updated_at,
      sort_order:          raw.sort_order ?? null,
      this_month_deployed: (deployed?.length ?? 0) > 0,
      is_profile_complete: calcComplete(raw),
      diet_plan_type:      raw.diet_plan_type,
      brand_id:            raw.brand_id ?? null,
      owner_name:          raw.owner_name ?? null,
      kos_id:              raw.kos_id ?? null,
      snack_morning:       raw.snack_morning,
      snack_afternoon:     raw.snack_afternoon,
      snack_afterschool:   raw.snack_afterschool,
      snack_childcare:     raw.snack_childcare,
      snack_teacher_extra: raw.snack_teacher_extra,
      has_dessert_fruit:   raw.has_dessert_fruit,
      has_birthday_snack:  raw.has_birthday_snack,
      has_health_booklet:  raw.has_health_booklet,
      has_yonder:          raw.has_yonder,
      yonder_name:         raw.yonder_name,
      needs_english:       raw.needs_english,
      english_name:        raw.english_name,
      english_code:        raw.english_code,
      is_elan:             raw.is_elan,
      is_ingpa:            raw.is_ingpa,
      is_table_15row:      raw.is_table_15row,
      direct_delivery:     raw.direct_delivery,
      slide_type:          raw.slide_type,
      pptx_template_id:    raw.pptx_template_id,
      special_notes:       raw.special_note ?? null,
      memo:                raw.memo,
      nutritionist_name:   raw.nutritionist_name,
      nutritionist_email:  raw.nutritionist_email,
      distribution_email:  raw.distribution_email ?? null,
      recent_menus:        menus ?? [],
    }

    return NextResponse.json(profile)
  } catch (err) {
    console.error('[branch-profiles/[id] GET] 예외:', err)
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })

    const { data: adminData } = await supabase
      .from('admins').select('role').eq('auth_id', user.id).maybeSingle()
    if (!adminData) return NextResponse.json({ error: '접근 권한이 없습니다' }, { status: 403 })
    if (adminData.role !== 'super_admin')
      return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 })

    const { data: current, error: selectError } = await supabase
      .from('branch_profiles')
      .select('contract_status')
      .eq('id', params.id)
      .maybeSingle()

    if (selectError || !current)
      return NextResponse.json({ error: '원을 찾을 수 없습니다' }, { status: 404 })

    const newStatus = current.contract_status === 'active' ? 'inactive' : 'active'

    const { error: updateError } = await supabase
      .from('branch_profiles')
      .update({ contract_status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', params.id)

    if (updateError) {
      console.error('[branch-profiles/[id] DELETE] 오류:', updateError)
      return NextResponse.json({ error: '처리 중 오류가 발생했습니다' }, { status: 500 })
    }

    return NextResponse.json({ success: true, newStatus })
  } catch (err) {
    console.error('[branch-profiles/[id] DELETE] 예외:', err)
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })

    const { data: adminData } = await supabase
      .from('admins').select('id').eq('auth_id', user.id).maybeSingle()
    if (!adminData) return NextResponse.json({ error: '접근 권한이 없습니다' }, { status: 403 })

    const body = await request.json()

    if (body.short_code) {
      const { data: exists } = await supabase
        .from('branch_profiles')
        .select('id')
        .eq('short_code', body.short_code)
        .neq('id', params.id)
        .maybeSingle()
      if (exists) return NextResponse.json({ error: '이미 사용 중인 약칭입니다' }, { status: 409 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {
      short_code:          emptyToNull(body.short_code),
      display_name:        emptyToNull(body.display_name),
      branch_full_name:    emptyToNull(body.branch_full_name),
      group_tag:           emptyToNull(body.group_tag),
      brand_id:            emptyToNull(body.brand_id),
      owner_name:          emptyToNull(body.owner_name),
      kos_id:              emptyToNull(body.kos_id),
      contract_type:       emptyToNull(body.contract_type),
      diet_type:           emptyToNull(body.diet_type),
      contract_status:     emptyToNull(body.contract_status),
      contract_start_date: emptyToNull(body.contract_start_date),
      contract_renew_date: emptyToNull(body.renew_date),
      diet_plan_type:      emptyToNull(body.diet_plan_type),
      file_format:         emptyToNull(body.file_format),
      slide_count:         emptyToNull(body.slide_count),
      slide_type:          emptyToNull(body.slide_type),
      needs_english:       body.needs_english ?? false,
      english_name:        emptyToNull(body.english_name),
      english_code:        emptyToNull(body.english_code),
      pptx_template_id:    emptyToNull(body.pptx_template_id),
      snack_morning:       body.snack_morning ?? false,
      snack_afternoon:     body.snack_afternoon ?? false,
      snack_afterschool:   body.snack_afterschool ?? false,
      snack_childcare:     body.snack_childcare ?? false,
      snack_teacher_extra: body.snack_teacher_extra ?? false,
      has_dessert_fruit:   body.has_dessert_fruit ?? false,
      has_birthday_snack:  body.has_birthday_snack ?? false,
      has_health_booklet:  body.has_health_booklet ?? false,
      has_yonder:          body.has_yonder ?? false,
      yonder_name:         emptyToNull(body.yonder_name),
      distribution_emails: body.distribution_emails ?? [],
      review_required:     body.review_required ?? false,
      is_elan:             body.is_elan ?? false,
      is_ingpa:            body.is_ingpa ?? false,
      is_table_15row:      body.is_table_15row ?? false,
      direct_delivery:     body.direct_delivery ?? false,
      special_note:        emptyToNull(body.special_notes),
      memo:                emptyToNull(body.memo),
      nutritionist_name:   emptyToNull(body.nutritionist_name),
      nutritionist_email:  emptyToNull(body.nutritionist_email),
      updated_at:          new Date().toISOString(),
    }
    stripEmptyDefaultColumns(updateData)

    const { data: updated, error: updateError } = await supabase
      .from('branch_profiles')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single()

    if (updateError) {
      console.error('[branch-profiles/[id] PUT] 오류:', updateError)
      return NextResponse.json(
        { error: `저장 중 오류가 발생했습니다 (${updateError.code}: ${updateError.message})` },
        { status: 500 }
      )
    }

    return NextResponse.json(updated)
  } catch (err) {
    console.error('[branch-profiles/[id] PUT] 예외:', err)
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 })
  }
}
