import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function GET() {
  try {
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })

    const { data: adminData } = await supabase
      .from('admins').select('id').eq('auth_id', user.id).maybeSingle()
    if (!adminData) return NextResponse.json({ error: '접근 권한이 없습니다' }, { status: 403 })

    const { data, error } = await supabase
      .from('parent_notices')
      .select('*')
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ notices: data })
  } catch {
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })

    const { data: adminData } = await supabase
      .from('admins').select('id').eq('auth_id', user.id).maybeSingle()
    if (!adminData) return NextResponse.json({ error: '접근 권한이 없습니다' }, { status: 403 })

    const body = await request.json()
    const { title, content, is_pinned, attachment_url } = body
    if (!title?.trim()) return NextResponse.json({ error: '제목을 입력해주세요' }, { status: 400 })
    const { data, error } = await supabase
      .from('parent_notices')
      .insert({
        title: title.trim(),
        content: content ?? null,
        is_pinned: !!is_pinned,
        attachment_url: attachment_url ?? null,
        branch_id: null,
        // ⚠️ created_by를 adminData.id로 채우지 않았다 — parent_notices.created_by가
        // admins.id를 참조하는지 auth.users.id를 참조하는지 이 세션에서 확인할
        // 수단(psql 연결·SQL 실행 RPC)이 없었다. 잘못된 FK를 넣는 것보다
        // null이 낫다(spec_board_notices_auth.md 참고). 확인 후 채울 것.
        created_by: null,
      })
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ notice: data })
  } catch {
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })

    const { data: adminData } = await supabase
      .from('admins').select('id').eq('auth_id', user.id).maybeSingle()
    if (!adminData) return NextResponse.json({ error: '접근 권한이 없습니다' }, { status: 403 })

    const body = await request.json()
    const { id, is_pinned } = body
    if (!id) return NextResponse.json({ error: 'id가 필요합니다' }, { status: 400 })
    const { error } = await supabase
      .from('parent_notices')
      .update({ is_pinned: !!is_pinned })
      .eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })

    const { data: adminData } = await supabase
      .from('admins').select('id').eq('auth_id', user.id).maybeSingle()
    if (!adminData) return NextResponse.json({ error: '접근 권한이 없습니다' }, { status: 403 })

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id가 필요합니다' }, { status: 400 })
    const { error: readsError } = await supabase
      .from('parent_notice_reads')
      .delete()
      .eq('notice_id', id)
    if (readsError) return NextResponse.json({ error: readsError.message }, { status: 500 })
    const { error } = await supabase
      .from('parent_notices')
      .delete()
      .eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}
