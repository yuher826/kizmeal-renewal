import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      if (!error) {
        return NextResponse.redirect(`${origin}/board/change-password`)
      }
    } catch (e) {
      console.error('[auth/callback] 세션 교환 실패:', e)
    }
  }

  return NextResponse.redirect(`${origin}/board/login?error=invite_failed`)
}
