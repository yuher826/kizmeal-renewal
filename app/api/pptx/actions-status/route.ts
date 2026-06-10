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
  const generated  = list.filter(r => r.status === 'generated').length
  const error      = list.filter(r => r.status === 'error').length
  const generating = list.filter(r => r.status === 'generating').length
  const total      = 49

  return NextResponse.json({
    total,
    generated,
    error,
    generating,
    is_complete: generated + error >= total,
  })
}
