import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function GET() {
  try {
    const supabase = getAdminClient()
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
    const body = await request.json()
    const { title, content, is_pinned, attachment_url } = body
    if (!title?.trim()) return NextResponse.json({ error: '제목을 입력해주세요' }, { status: 400 })
    const supabase = getAdminClient()
    const { data, error } = await supabase
      .from('parent_notices')
      .insert({
        title: title.trim(),
        content: content ?? null,
        is_pinned: !!is_pinned,
        attachment_url: attachment_url ?? null,
        branch_id: null,
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
    const body = await request.json()
    const { id, is_pinned } = body
    if (!id) return NextResponse.json({ error: 'id가 필요합니다' }, { status: 400 })
    const supabase = getAdminClient()
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
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id가 필요합니다' }, { status: 400 })
    const supabase = getAdminClient()
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
