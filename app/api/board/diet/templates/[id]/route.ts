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

export async function DELETE(
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

  // 활성 템플릿은 삭제 불가
  const { data: tmpl } = await supabase
    .from('diet_templates').select('is_active, file_path').eq('id', id).single()
  if (!tmpl) return NextResponse.json({ error: '템플릿을 찾을 수 없습니다' }, { status: 404 })
  if (tmpl.is_active) {
    return NextResponse.json({ error: '현재 활성화된 템플릿은 삭제할 수 없습니다. 다른 버전을 활성화한 후 삭제하세요.' }, { status: 400 })
  }

  // Storage에서도 삭제
  if (tmpl.file_path) {
    await supabase.storage.from('diet-templates').remove([tmpl.file_path])
  }

  const { error } = await supabase.from('diet_templates').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
