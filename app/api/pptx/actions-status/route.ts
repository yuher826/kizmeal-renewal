import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const year  = Number(searchParams.get('year'))
  const month = Number(searchParams.get('month'))

  if (!year || !month) {
    return NextResponse.json({ error: 'year, month 파라미터가 필요합니다.' }, { status: 400 })
  }

  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const dbClient    = serviceKey ? createAdminClient(supabaseUrl, serviceKey) : supabase

  const { data: rows } = await dbClient
    .from('weekly_menus')
    .select('status')
    .eq('year', year)
    .eq('month', month)
    .eq('diet_type', 'CK')
    .not('branch_id', 'is', null)

  const list       = rows ?? []
  const generated  = list.filter(r => ['generation_complete','approved','deployed'].includes(r.status)).length
  const error      = list.filter(r => r.status === 'error').length
  const generating = list.filter(r => r.status === 'generating').length

  // 활성 계약원 수를 DB에서 조회 (하드코딩 49 대신)
  // 생성 대상 = active AND short_code 있음 AND contract_type != temporary
  // (pptx-server/branch_filters.py 의 is_eligible_for_pptx 와 같은 규칙)
  // neq 금지 — NULL 행이 함께 탈락한다. or(is.null, neq) 로 쓸 것.
  const { count: branchCount } = await dbClient
    .from('branch_profiles')
    .select('*', { count: 'exact', head: true })
    .eq('contract_status', 'active')
    .not('short_code', 'is', null)
    .neq('short_code', '')
    .or('contract_type.is.null,contract_type.neq.temporary')
  const total = branchCount ?? (list.length > 0 ? list.length : 49)

  return NextResponse.json({
    total,
    generated,
    error,
    generating,
    is_complete: generated + error >= total,
  })
}
