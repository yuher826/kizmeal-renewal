import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function POST() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: admin } = await supabase
    .from('admins').select('role').eq('auth_id', user.id).maybeSingle()
  if (admin?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1

  const { error: deleteError } = await adminClient
    .from('weekly_menus')
    .delete()
    .eq('year', year)
    .eq('month', month)
    .not('branch_id', 'is', null)

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  const { error: updateError } = await adminClient
    .from('weekly_menus')
    .update({ status: 'draft' })
    .eq('year', year)
    .eq('month', month)
    .eq('diet_type', 'CK')
    .is('branch_id', null)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, message: '초기화 완료' })
}
