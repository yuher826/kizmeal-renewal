import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import type { BranchProfileRow } from '@/types/branch-profile'

export async function GET() {
  try {
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const { data: adminData } = await supabase
      .from('admins')
      .select('id')
      .eq('auth_id', user.id)
      .maybeSingle()

    if (!adminData) {
      return NextResponse.json({ error: '접근 권한이 없습니다' }, { status: 403 })
    }

    // branch_profiles 조회
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
      console.error('[branch-profiles] 조회 오류:', profilesError)
      return NextResponse.json({ error: '데이터 조회 중 오류가 발생했습니다' }, { status: 500 })
    }

    // 이번 달 배포 현황 조회
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 1

    const { data: deployed } = await supabase
      .from('weekly_menus')
      .select('branch_id')
      .eq('year', year)
      .eq('month', month)
      .not('pptx_url', 'is', null)

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
    }))

    return NextResponse.json(rows)
  } catch (err) {
    console.error('[branch-profiles] 예외:', err)
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 })
  }
}
