import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

function makeSupabase() {
  const store = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (n: string) => store.get(n)?.value,
        set: (n: string, v: string, o: CookieOptions) => { try { store.set({ name: n, value: v, ...o }) } catch {} },
        remove: (n: string, o: CookieOptions) => { try { store.set({ name: n, value: '', ...o }) } catch {} },
      },
    }
  )
}

export async function PATCH(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = makeSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })

  const { data: admin } = await supabase
    .from('admins').select('id').eq('auth_id', user.id).eq('is_active', true).maybeSingle()
  if (!admin) return NextResponse.json({ error: '관리자 권한이 필요합니다' }, { status: 403 })

  const { id } = params
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  // is_active = true 설정 → 트리거가 나머지를 false로 변경
  const { error } = await supabase
    .from('diet_templates')
    .update({ is_active: true })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
