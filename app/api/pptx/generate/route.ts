import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export const maxDuration = 300

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: admin } = await supabase
    .from('admins').select('role').eq('auth_id', user.id).maybeSingle()

  if (!['super_admin', 'manager'].includes(admin?.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: { weekly_menu_id?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '요청 형식 오류' }, { status: 400 })
  }

  const { weekly_menu_id } = body
  if (!weekly_menu_id) {
    return NextResponse.json({ error: 'weekly_menu_id 필드가 필요합니다.' }, { status: 400 })
  }

  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const dbClient    = serviceKey ? createAdminClient(supabaseUrl, serviceKey) : supabase

  // weekly_menus 레코드 조회
  const { data: menuRow } = await dbClient
    .from('weekly_menus')
    .select('id, year, month, week_num, menu_data, status')
    .eq('id', weekly_menu_id)
    .maybeSingle()

  if (!menuRow?.menu_data) {
    return NextResponse.json({ error: '먼저 엑셀을 업로드해주세요.' }, { status: 400 })
  }

  // status → 'generating'
  await dbClient
    .from('weekly_menus')
    .update({ status: 'generating' })
    .eq('id', menuRow.id)

  const pptxServerUrl = (process.env.PPTX_SERVER_URL || 'https://kizmeal-pptx-server.onrender.com').replace(/\/$/, '')

  // Storage 버킷 'diet-files' 존재 확인 (경고 전용, 진행 차단 안 함)
  try {
    const { data: buckets } = await dbClient.storage.listBuckets()
    const hasBucket = (buckets ?? []).some((b: { name: string }) => b.name === 'diet-files')
    if (!hasBucket) {
      console.warn('[pptx/generate] Supabase Storage 버킷 "diet-files" 없음 — Render 업로드 실패 가능')
    }
  } catch {
    // 버킷 조회 실패 시 계속 진행
  }

  // Render wake-up 폴링 (최대 14회 × 5초 = 70초)
  let serverReady = false
  for (let i = 0; i < 14; i++) {
    try {
      const healthRes = await fetch(`${pptxServerUrl}/health`, {
        signal: AbortSignal.timeout(5000),
      })
      if (healthRes.ok) {
        serverReady = true
        break
      }
    } catch {
      // 재시도
    }
    if (i < 13) await new Promise(r => setTimeout(r, 5000))
  }

  if (!serverReady) {
    await dbClient
      .from('weekly_menus')
      .update({ status: 'error' })
      .eq('id', menuRow.id)
    return NextResponse.json(
      { error: 'Render 서버 준비 시간 초과. 잠시 후 다시 시도해주세요.' },
      { status: 503 },
    )
  }

  // PPTX 생성 요청
  try {
    const genRes = await fetch(`${pptxServerUrl}/generate-from-json`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        menu_data: menuRow.menu_data,
        year:      menuRow.year,
        month:     menuRow.month,
        week_num:  menuRow.week_num ?? null,
      }),
      signal: AbortSignal.timeout(600_000),
    })

    if (!genRes.ok) {
      const errText = await genRes.text()
      await dbClient
        .from('weekly_menus')
        .update({ status: 'error' })
        .eq('id', menuRow.id)
      return NextResponse.json({ error: `PPTX 서버 오류: ${errText}` }, { status: 500 })
    }

    const genData = await genRes.json()

    await dbClient
      .from('weekly_menus')
      .update({
        status: 'generated',
        generation_results: {
          generated_at: new Date().toISOString(),
          succeeded:    genData.succeeded ?? 0,
          failed:       genData.failed    ?? 0,
          results:      genData.results   ?? [],
        },
      })
      .eq('id', menuRow.id)

    // generation_complete 알림 삽입 (타입 제약 미적용 시 무시)
    try {
      await dbClient.from('diet_notifications').insert({
        type:           'generation_complete',
        title:          `${menuRow.year}년 ${menuRow.month}월 식단표 PPTX 생성 완료`,
        message:        `${genData.succeeded ?? 0}개원 생성 성공${(genData.failed ?? 0) > 0 ? `, ${genData.failed}개 실패` : ''}`,
        recipient_role: 'super_admin',
        weekly_menu_id: menuRow.id,
        year:           menuRow.year,
        month:          menuRow.month,
      })
    } catch {
      // generation_complete 타입 미등록 시 무시
    }

    return NextResponse.json({
      success:   genData.success,
      job_id:    genData.job_id,
      total:     genData.total,
      succeeded: genData.succeeded,
      failed:    genData.failed,
      results:   genData.results ?? [],
    })
  } catch (err) {
    await dbClient
      .from('weekly_menus')
      .update({ status: 'error' })
      .eq('id', menuRow.id)
    return NextResponse.json({ error: `PPTX 생성 오류: ${err}` }, { status: 500 })
  }
}
