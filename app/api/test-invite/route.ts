import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })

    const { data: adminData } = await supabase
      .from('admins')
      .select('role')
      .eq('auth_id', user.id)
      .maybeSingle()

    if (!adminData || adminData.role !== 'super_admin') {
      return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 })
    }

    const body = await request.json()
    const { email } = body
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'email 필드가 필요합니다' }, { status: 400 })
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
    const supabaseAdmin = getSupabaseAdmin()
    const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email.trim(), {
      redirectTo: `${siteUrl}/board/auth/callback`,
    })

    if (error) {
      console.error('[test-invite] 초대 오류:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      user_id: data.user.id,
      email: data.user.email,
      invited_at: data.user.invited_at,
    })
  } catch (err) {
    console.error('[test-invite] 예외:', err)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}
