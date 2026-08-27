import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import type { BranchProfileRow } from '@/types/branch-profile'
import { BRANCH_PROFILE_CREATE_ROLES } from '@/lib/roles'

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
const DB_DEFAULT_COLUMNS = ['slide_count', 'diet_plan_type', 'contract_status'] as const
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function stripEmptyDefaultColumns(data: Record<string, any>) {
  for (const key of DB_DEFAULT_COLUMNS) {
    if (data[key] === null) delete data[key]
  }
}

export async function GET() {
  try {
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })

    const { data: adminData } = await supabase
      .from('admins').select('id').eq('auth_id', user.id).maybeSingle()
    if (!adminData) return NextResponse.json({ error: '접근 권한이 없습니다' }, { status: 403 })

    const { data: profilesRaw, error: profilesError } = await supabase
      .from('branch_profiles')
      .select(
        'id, branch_id, short_code, display_name, branch_full_name, ' +
        'group_tag, contract_status, contract_type, diet_type, file_format, ' +
        'slide_count, distribution_emails, review_required, ' +
        'contract_start_date, contract_renew_date, updated_at, sort_order'
      )
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('group_tag', { ascending: true, nullsFirst: false })
      .order('short_code', { ascending: true })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const profiles = profilesRaw as any[]

    if (profilesError) {
      console.error('[branch-profiles GET] 오류:', profilesError)
      return NextResponse.json({ error: '데이터 조회 중 오류가 발생했습니다' }, { status: 500 })
    }

    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 1

    const { data: deployed } = await supabase
      .from('weekly_menus').select('branch_id')
      .eq('year', year).eq('month', month).not('pptx_url', 'is', null)

    const deployedBranchIds = new Set(deployed?.map(r => r.branch_id) ?? [])

    const rows: BranchProfileRow[] = (profiles ?? []).map(p => ({
      id:                  p.id,
      branch_id:           p.branch_id,
      short_code:          p.short_code,
      display_name:        p.display_name,
      branch_full_name:    p.branch_full_name,
      group_tag:           p.group_tag,
      contract_status:     p.contract_status,
      contract_type:       p.contract_type,
      diet_type:           p.diet_type,
      file_format:         p.file_format,
      slide_count:         p.slide_count,
      distribution_emails: p.distribution_emails,
      review_required:     p.review_required,
      contract_start_date: p.contract_start_date,
      renew_date:          p.contract_renew_date ?? null,
      updated_at:          p.updated_at,
      sort_order:          p.sort_order ?? null,
      this_month_deployed: deployedBranchIds.has(p.branch_id),
      is_profile_complete: calcComplete(p),
    }))

    return NextResponse.json(rows)
  } catch (err) {
    console.error('[branch-profiles GET] 예외:', err)
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })

    const { data: adminData } = await supabase
      .from('admins').select('id, role, name').eq('auth_id', user.id).maybeSingle()
    if (!adminData) return NextResponse.json({ error: '접근 권한이 없습니다' }, { status: 403 })
    if (!BRANCH_PROFILE_CREATE_ROLES.includes(adminData.role ?? ''))
      return NextResponse.json({ error: '원 등록 권한이 없습니다' }, { status: 403 })

    const body = await request.json()

    if (body.short_code) {
      const { data: exists } = await supabase
        .from('branch_profiles').select('id').eq('short_code', body.short_code).maybeSingle()
      if (exists) return NextResponse.json({ error: '이미 사용 중인 약칭입니다' }, { status: 409 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const insertData: any = {
      branch_id:           emptyToNull(body.branch_id),
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
    }
    stripEmptyDefaultColumns(insertData)

    const { data: created, error: createError } = await supabase
      .from('branch_profiles').insert(insertData).select().single()

    if (createError) {
      console.error('[branch-profiles POST] 오류:', createError)
      return NextResponse.json(
        { error: `등록 중 오류가 발생했습니다 (${createError.code}: ${createError.message})` },
        { status: 500 }
      )
    }

    // 감사 기록 (기존 admin_created/admin_updated와 동일 패턴)
    // detail에는 식별용 두 필드만 남긴다 — 나머지 필드는 남기지 않음
    try {
      const supabaseAdmin = getSupabaseAdmin()
      await supabaseAdmin.from('audit_logs').insert({
        actor_id:    adminData.id,
        actor_type:  'admin',
        actor_name:  adminData.name ?? '관리자',
        action:      'branch_profile_created',
        target_type: 'branch_profile',
        target_id:   created.id,
        detail:      { short_code: created.short_code, display_name: created.display_name },
      })
    } catch { /* audit 실패는 무시 */ }

    return NextResponse.json(created, { status: 201 })
  } catch (err) {
    console.error('[branch-profiles POST] 예외:', err)
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 })
  }
}
