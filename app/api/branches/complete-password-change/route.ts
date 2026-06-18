import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export async function POST() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const supabaseAdmin = getSupabaseAdmin()
  const { error } = await supabaseAdmin
    .from('branches')
    .update({ must_change_password: false })
    .eq('auth_id', user.id)

  if (error) {
    console.error('[complete-password-change] branches 업데이트 실패:', error)
    return NextResponse.json({ error: '업데이트 실패' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
