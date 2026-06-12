import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })

    const { data: adminData } = await supabase
      .from('admins').select('id, role').eq('auth_id', user.id).maybeSingle()
    if (!adminData) return NextResponse.json({ error: '접근 권한이 없습니다' }, { status: 403 })

    const body = await request.json()
    const { title, content, target_type, branch_ids } = body

    if (!title?.trim()) return NextResponse.json({ error: '제목을 입력해주세요' }, { status: 400 })
    if (!content?.trim()) return NextResponse.json({ error: '내용을 입력해주세요' }, { status: 400 })

    const isAll = target_type !== 'specific'

    if (isAll) {
      // 전체 원: branch_id = null 단건 삽입
      const { data, error } = await supabase
        .from('parent_notices')
        .insert({ title: title.trim(), content: content.trim(), branch_id: null, is_pinned: false })
        .select('id')
        .single()

      if (error) {
        console.error('[notices POST] 전체 공지 오류:', error)
        return NextResponse.json({ error: '저장 중 오류가 발생했습니다' }, { status: 500 })
      }
      return NextResponse.json({ success: true, id: data.id }, { status: 201 })
    }

    // 특정 원 선택: 선택된 원마다 각각 삽입
    if (!Array.isArray(branch_ids) || branch_ids.length === 0) {
      return NextResponse.json({ error: '원을 1개 이상 선택해주세요' }, { status: 400 })
    }

    const rows = branch_ids.map((bid: string) => ({
      title:     title.trim(),
      content:   content.trim(),
      branch_id: bid,
      is_pinned: false,
    }))

    const { error: insertError } = await supabase.from('parent_notices').insert(rows)

    if (insertError) {
      console.error('[notices POST] 특정 원 공지 오류:', insertError)
      return NextResponse.json({ error: '저장 중 오류가 발생했습니다' }, { status: 500 })
    }

    return NextResponse.json({ success: true }, { status: 201 })
  } catch (err) {
    console.error('[notices POST] 예외:', err)
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 })
  }
}
