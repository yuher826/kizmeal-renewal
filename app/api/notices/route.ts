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

    const { data: notices, error } = await supabase
      .from('parent_notices')
      .select('id, title, content, branch_id, is_pinned, is_popup, popup_until, created_at')
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[notices GET] 오류:', error)
      return NextResponse.json({ error: '조회 중 오류가 발생했습니다' }, { status: 500 })
    }

    // branch_id → 원 이름 매핑 (전체 공지는 branch_id가 null이라 조인 없이 처리)
    const branchIds = Array.from(
      new Set((notices ?? []).map(n => n.branch_id).filter((id): id is string => !!id))
    )
    let branchNameMap: Record<string, string> = {}
    if (branchIds.length > 0) {
      const { data: branchRows } = await supabase
        .from('branches')
        .select('id, name')
        .in('id', branchIds)
      branchNameMap = Object.fromEntries((branchRows ?? []).map(b => [b.id, b.name]))
    }

    const result = (notices ?? []).map(n => ({
      ...n,
      target_label: n.branch_id ? (branchNameMap[n.branch_id] ?? '알 수 없는 원') : '전체 원',
    }))

    return NextResponse.json({ notices: result })
  } catch (err) {
    console.error('[notices GET] 예외:', err)
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })

    const { data: adminData } = await supabase
      .from('admins').select('id, role').eq('auth_id', user.id).maybeSingle()
    if (!adminData) return NextResponse.json({ error: '접근 권한이 없습니다' }, { status: 403 })

    const body = await request.json()
    const { title, content, target_type, branch_ids, is_popup, popup_until } = body

    if (!title?.trim()) return NextResponse.json({ error: '제목을 입력해주세요' }, { status: 400 })
    if (!content?.trim()) return NextResponse.json({ error: '내용을 입력해주세요' }, { status: 400 })

    const isAll = target_type !== 'specific'
    const popupFields = { is_popup: !!is_popup, popup_until: popup_until ?? null }

    if (isAll) {
      // 전체 원: branch_id = null 단건 삽입
      const { data, error } = await supabase
        .from('parent_notices')
        .insert({ title: title.trim(), content: content.trim(), branch_id: null, is_pinned: false, ...popupFields })
        .select('id')
        .single()

      if (error) {
        console.error('[notices POST] 전체 공지 오류:', error)
        return NextResponse.json({ error: '저장 중 오류가 발생했습니다' }, { status: 500 })
      }
      return NextResponse.json({ success: true, id: data.id }, { status: 201 })
    }

    // 특정 원 선택: 선택된 원마다 각각 삽입
    // ★branch_ids는 branches.id여야 한다(호출부: /erp/notices/new에서
    // branch_profiles.branch_id를 보냄). branch_profiles.id를 잘못 보내면
    // parent_notices.branch_id(branches(id) 참조) FK 위반 또는 어떤 계정에도
    // 안 보이는 유령 공지가 된다.
    if (!Array.isArray(branch_ids) || branch_ids.length === 0) {
      return NextResponse.json({ error: '원을 1개 이상 선택해주세요' }, { status: 400 })
    }

    const rows = branch_ids.map((bid: string) => ({
      title:     title.trim(),
      content:   content.trim(),
      branch_id: bid,
      is_pinned: false,
      ...popupFields,
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

// 팝업 끄기 등 단건 필드 수정용 (지금은 is_popup만 지원 — 예: 폭설 상황 종료 시 바로 끄기)
export async function PATCH(request: NextRequest) {
  try {
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })

    const { data: adminData } = await supabase
      .from('admins').select('id').eq('auth_id', user.id).maybeSingle()
    if (!adminData) return NextResponse.json({ error: '접근 권한이 없습니다' }, { status: 403 })

    const { id, is_popup } = await request.json()
    if (!id) return NextResponse.json({ error: 'id가 필요합니다' }, { status: 400 })

    const { error } = await supabase
      .from('parent_notices')
      .update({ is_popup: !!is_popup })
      .eq('id', id)

    if (error) {
      console.error('[notices PATCH] 오류:', error)
      return NextResponse.json({ error: '수정 중 오류가 발생했습니다' }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[notices PATCH] 예외:', err)
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 })
  }
}
