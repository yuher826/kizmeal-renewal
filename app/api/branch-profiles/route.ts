import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import type { BranchProfileRow } from '@/types/branch-profile'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function calcComplete(p: any): boolean {
  return !!(
    p.short_code &&
    p.file_format &&
    p.distribution_emails && p.distribution_emails.length > 0 &&
    p.slide_count != null
  )
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
        'group_tag, contract_status, diet_type, file_format, ' +
        'slide_count, distribution_emails, review_required, ' +
        'contract_start_date, contract_renew_date, updated_at'
      )
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
      diet_type:           p.diet_type,
      file_format:         p.file_format,
      slide_count:         p.slide_count,
      distribution_emails: p.distribution_emails,
      review_required:     p.review_required,
      contract_start_date: p.contract_start_date,
      renew_date:          p.contract_renew_date ?? null,
      updated_at:          p.updated_at,
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
      .from('admins').select('id').eq('auth_id', user.id).maybeSingle()
    if (!adminData) return NextResponse.json({ error: '접근 권한이 없습니다' }, { status: 403 })

    const body = await request.json()

    if (body.short_code) {
      const { data: exists } = await supabase
        .from('branch_profiles').select('id').eq('short_code', body.short_code).maybeSingle()
      if (exists) return NextResponse.json({ error: '이미 사용 중인 약칭입니다' }, { status: 409 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const insertData: any = {
      branch_id:           body.branch_id ?? null,
      short_code:          body.short_code ?? null,
      display_name:        body.display_name ?? null,
      branch_full_name:    body.branch_full_name ?? null,
      group_tag:           body.group_tag ?? null,
      diet_type:           body.diet_type ?? null,
      contract_status:     body.contract_status ?? 'active',
      contract_start_date: body.contract_start_date ?? null,
      contract_renew_date: body.renew_date ?? null,
      diet_plan_type:      body.diet_plan_type ?? 'CK',
      file_format:         body.file_format ?? null,
      slide_count:         body.slide_count ?? null,
      slide_type:          body.slide_type ?? null,
      needs_english:       body.needs_english ?? false,
      english_name:        body.english_name ?? null,
      english_code:        body.english_code ?? null,
      pptx_template_id:    body.pptx_template_id ?? null,
      snack_morning:       body.snack_morning ?? false,
      snack_afternoon:     body.snack_afternoon ?? false,
      snack_afterschool:   body.snack_afterschool ?? false,
      snack_childcare:     body.snack_childcare ?? false,
      snack_teacher_extra: body.snack_teacher_extra ?? false,
      has_dessert_fruit:   body.has_dessert_fruit ?? false,
      has_birthday_snack:  body.has_birthday_snack ?? false,
      has_health_booklet:  body.has_health_booklet ?? false,
      has_yonder:          body.has_yonder ?? false,
      yonder_name:         body.yonder_name ?? null,
      distribution_emails: body.distribution_emails ?? [],
      review_required:     body.review_required ?? false,
      is_elan:             body.is_elan ?? false,
      is_ingpa:            body.is_ingpa ?? false,
      is_table_15row:      body.is_table_15row ?? false,
      direct_delivery:     body.direct_delivery ?? false,
      special_note:        body.special_notes ?? null,
      memo:                body.memo ?? null,
      nutritionist_name:   body.nutritionist_name ?? null,
      nutritionist_email:  body.nutritionist_email ?? null,
    }

    const { data: created, error: createError } = await supabase
      .from('branch_profiles').insert(insertData).select().single()

    if (createError) {
      console.error('[branch-profiles POST] 오류:', createError)
      return NextResponse.json({ error: '등록 중 오류가 발생했습니다' }, { status: 500 })
    }

    return NextResponse.json(created, { status: 201 })
  } catch (err) {
    console.error('[branch-profiles POST] 예외:', err)
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 })
  }
}
