import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { RESUBMIT_ROLES } from '@/lib/roles'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: adminRow } = await supabase
    .from('admins')
    .select('id, name, role')
    .eq('auth_id', user.id)
    .maybeSingle()

  if (!RESUBMIT_ROLES.includes(adminRow?.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let formData: FormData
  try { formData = await req.formData() } catch {
    return NextResponse.json({ error: '요청 형식 오류' }, { status: 400 })
  }

  const file          = formData.get('file') as File | null
  const branchId      = formData.get('branch_id') as string | null
  const weeklyMenuId  = formData.get('weekly_menu_id') as string | null
  const memo          = formData.get('memo') as string | null

  if (!file)         return NextResponse.json({ error: 'file 필요' }, { status: 400 })
  if (!branchId)     return NextResponse.json({ error: 'branch_id 필요' }, { status: 400 })
  if (!weeklyMenuId) return NextResponse.json({ error: 'weekly_menu_id 필요' }, { status: 400 })

  // .pptx 확장자 검증
  if (!file.name.toLowerCase().endsWith('.pptx')) {
    return NextResponse.json({ error: 'PPTX 파일만 업로드 가능합니다.' }, { status: 400 })
  }

  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const db = serviceKey ? createAdminClient(supabaseUrl, serviceKey) : supabase

  // 기존 diet_review_item 조회 (파일명 및 현재 상태 확인)
  const { data: reviewItem } = await db
    .from('diet_review_items')
    .select('id, review_status, pptx_url, memo_history, weekly_menu_id, branch_id')
    .eq('id', weeklyMenuId)
    .maybeSingle()

  if (!reviewItem) {
    return NextResponse.json({ error: '검토 항목을 찾을 수 없습니다.' }, { status: 404 })
  }

  // 기존 파일 경로 추출 (덮어쓰기)
  let storagePath: string
  if (reviewItem.pptx_url) {
    const url  = new URL(reviewItem.pptx_url)
    const path = url.pathname
    const idx  = path.indexOf('/object/public/')
    if (idx !== -1) {
      const afterPublic = path.slice(idx + '/object/public/'.length)
      const slashIdx    = afterPublic.indexOf('/')
      storagePath = slashIdx !== -1 ? afterPublic.slice(slashIdx + 1) : afterPublic
    } else {
      storagePath = `pptx/${weeklyMenuId}/${branchId}_resubmit_${Date.now()}.pptx`
    }
  } else {
    storagePath = `pptx/${weeklyMenuId}/${branchId}_resubmit_${Date.now()}.pptx`
  }

  // Supabase Storage 업로드 (덮어쓰기)
  const arrayBuffer = await file.arrayBuffer()
  const { error: uploadError } = await db.storage
    .from('diet-files')
    .upload(storagePath, arrayBuffer, {
      contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      upsert: true,
    })

  if (uploadError) {
    return NextResponse.json({ error: `파일 업로드 실패: ${uploadError.message}` }, { status: 500 })
  }

  // 공개 URL 생성
  const { data: urlData } = db.storage.from('diet-files').getPublicUrl(storagePath)
  const newPptxUrl = urlData.publicUrl

  const now = new Date().toISOString()

  // weekly_menus.pptx_url 업데이트 (브랜치별 메뉴)
  await db.from('weekly_menus')
    .update({ pptx_url: newPptxUrl, updated_at: now })
    .eq('id', reviewItem.weekly_menu_id)
    .eq('branch_id', branchId)

  // memo_history 추가
  const history = Array.isArray(reviewItem.memo_history) ? [...reviewItem.memo_history] : []
  history.push({
    by:     adminRow!.name ?? adminRow!.id,
    role:   adminRow!.role,
    action: 'resubmit',
    memo:   memo ?? undefined,
    at:     now,
  })

  // diet_review_items 업데이트
  const { data: updatedItem, error: updateError } = await db
    .from('diet_review_items')
    .update({
      review_status:  'resubmitted',
      pptx_url:       newPptxUrl,
      resubmitted_at: now,
      memo_history:   history,
      updated_at:     now,
    })
    .eq('id', reviewItem.id)
    .select()
    .single()

  if (updateError) {
    return NextResponse.json({ error: `DB 업데이트 실패: ${updateError.message}` }, { status: 500 })
  }

  // 매니저에게 재제출 알림
  await db.from('diet_notifications').insert({
    type:           'resubmitted_to_manager',
    title:          '식단표 재제출 알림',
    message:        `${adminRow!.name}이(가) 수정 후 재제출했습니다. 재검토를 진행해주세요.`,
    recipient_role: 'manager',
  })

  return NextResponse.json({ success: true, item: updatedItem, pptx_url: newPptxUrl })
}
