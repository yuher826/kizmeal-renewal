import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { UPLOAD_ROLES } from '@/lib/roles'
import {
  fetchHolidaysFromKasi,
  diffHolidays,
  monthRange,
  HolidayApiError,
  type Holiday,
  type StoredHoliday,
} from '@/lib/holidays'

/**
 * 월별 공휴일 diff 감지 / 확정 저장
 *
 * 설계(HANDOFF 설계 결정 4 — 월별 diff 감지):
 *   매달 폼 생성 시점에 해당 월을 API로 재조회 → 저장값과 diff →
 *   변경이 있을 때만 팝업을 띄운다. 평소엔 diff가 없어 팝업이 안 뜨므로
 *   "확인만 하면 되는" UX가 유지된다.
 *
 *   연초 1회 수집 방식은 임시공휴일·재보궐선거가 사후 지정되고 API 데이터도
 *   "앞으로 약 1년치"만 수기 입력되는 탓에 원리적으로 성립하지 않아 폐기했다.
 */

/** 인증 + 권한 확인. 통과하면 supabase 클라이언트와 admin 행을 돌려준다 */
async function requireUploadRole() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const { data: admin } = await supabase
    .from('admins')
    .select('id, role')
    .eq('auth_id', user.id)
    .maybeSingle()

  if (!UPLOAD_ROLES.includes(admin?.role ?? '')) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  return { supabase, adminId: admin!.id as string }
}

/** year/month 파싱 + 검증 */
function parseYearMonth(year: unknown, month: unknown) {
  const y = Number(year)
  const m = Number(month)
  if (!y || !m || m < 1 || m > 12) return null
  return { year: y, month: m }
}

/**
 * GET /api/diet-automation/holidays?year=2026&month=9
 *
 * 특일정보 API를 재조회해 DB 저장값과 비교한다. 저장은 하지 않는다.
 *
 * 응답:
 *   {
 *     year, month,
 *     fromApi: Holiday[],      // API가 준 것
 *     stored:  StoredHoliday[],// DB에 있는 것
 *     diff: { added, removed, renamed, unchangedCount, hasChanges }
 *   }
 */
export async function GET(req: NextRequest) {
  const auth = await requireUploadRole()
  if ('error' in auth) return auth.error
  const { supabase } = auth

  const { searchParams } = new URL(req.url)
  const ym = parseYearMonth(searchParams.get('year'), searchParams.get('month'))
  if (!ym) {
    return NextResponse.json(
      { error: 'year, month 파라미터가 유효하지 않습니다.' },
      { status: 400 },
    )
  }

  // 1. 특일정보 API 조회
  let fromApi: Holiday[]
  try {
    fromApi = await fetchHolidaysFromKasi(ym.year, ym.month)
  } catch (e) {
    // API 장애로 폼 생성 전체가 막히면 안 된다 → 502로 알리되 메시지는 그대로 노출
    const msg = e instanceof HolidayApiError ? e.message : '공휴일 조회에 실패했습니다.'
    return NextResponse.json({ error: msg }, { status: 502 })
  }

  // 2. DB 저장값 조회
  const { from, to } = monthRange(ym.year, ym.month)
  const { data: rows, error: dbErr } = await supabase
    .from('public_holidays')
    .select('holiday_date, name, source, confirmed_at')
    .gte('holiday_date', from)
    .lte('holiday_date', to)
    .order('holiday_date')

  if (dbErr) {
    return NextResponse.json(
      { error: `공휴일 조회 중 오류: ${dbErr.message}` },
      { status: 500 },
    )
  }

  const stored: StoredHoliday[] = (rows ?? []).map(r => ({
    date: r.holiday_date as string,
    name: r.name as string,
    source: r.source as StoredHoliday['source'],
    confirmedAt: r.confirmed_at as string | null,
  }))

  return NextResponse.json({
    year: ym.year,
    month: ym.month,
    fromApi,
    stored,
    diff: diffHolidays(fromApi, stored),
  })
}

/**
 * POST /api/diet-automation/holidays
 *
 * 팝업에서 사람이 확인한 **그 달의 최종 공휴일 목록**을 저장한다.
 * 멱등 — 같은 목록을 두 번 보내도 결과가 같다.
 *
 * body: {
 *   year, month,
 *   holidays: [{ date: 'YYYY-MM-DD', name: string, source?: 'kasi_api'|'manual' }]
 * }
 */
export async function POST(req: NextRequest) {
  const auth = await requireUploadRole()
  if ('error' in auth) return auth.error
  const { supabase, adminId } = auth

  let body: { year?: unknown; month?: unknown; holidays?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '요청 본문이 JSON이 아닙니다.' }, { status: 400 })
  }

  const ym = parseYearMonth(body.year, body.month)
  if (!ym) {
    return NextResponse.json(
      { error: 'year, month 값이 유효하지 않습니다.' },
      { status: 400 },
    )
  }
  if (!Array.isArray(body.holidays)) {
    return NextResponse.json({ error: 'holidays 배열이 필요합니다.' }, { status: 400 })
  }

  const { from, to } = monthRange(ym.year, ym.month)
  const now = new Date().toISOString()

  // 입력 검증 — 날짜 형식과 해당 월 소속을 여기서 막는다.
  // (DB에는 year/month 컬럼이 없어 범위를 강제할 CHECK가 없으므로 앱이 지킨다)
  const rows: Array<Record<string, unknown>> = []
  for (const raw of body.holidays as Array<Record<string, unknown>>) {
    const date = String(raw?.date ?? '').trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { error: `날짜 형식이 잘못되었습니다: ${date}` },
        { status: 400 },
      )
    }
    if (date < from || date > to) {
      return NextResponse.json(
        { error: `${ym.year}년 ${ym.month}월 범위를 벗어난 날짜입니다: ${date}` },
        { status: 400 },
      )
    }
    const source = raw?.source === 'manual' ? 'manual' : 'kasi_api'
    rows.push({
      holiday_date: date,
      name: String(raw?.name ?? '').trim() || '공휴일',
      source,
      synced_at: now,
      confirmed_by: adminId,
      confirmed_at: now,
      updated_at: now,
    })
  }

  // 1. 확정 목록 upsert (holiday_date 유니크 기준)
  if (rows.length > 0) {
    const { error: upsertErr } = await supabase
      .from('public_holidays')
      .upsert(rows, { onConflict: 'holiday_date' })

    if (upsertErr) {
      return NextResponse.json(
        { error: `공휴일 저장 중 오류: ${upsertErr.message}` },
        { status: 500 },
      )
    }
  }

  // 2. 확정 목록에서 빠진 API 수집분 삭제 (= 지정 취소된 공휴일)
  //    ★ source='manual'은 지우지 않는다 — API가 아직 안 올린 임시공휴일을
  //      사람이 넣어둔 것이라, API에 없다는 이유로 지우면 탈출구가 무의미해진다
  const keepDates = new Set(rows.map(r => r.holiday_date as string))
  const { data: existing, error: fetchErr } = await supabase
    .from('public_holidays')
    .select('holiday_date, source')
    .gte('holiday_date', from)
    .lte('holiday_date', to)

  if (fetchErr) {
    return NextResponse.json(
      { error: `기존 공휴일 조회 중 오류: ${fetchErr.message}` },
      { status: 500 },
    )
  }

  const toDelete = (existing ?? [])
    .filter(r => r.source === 'kasi_api' && !keepDates.has(r.holiday_date as string))
    .map(r => r.holiday_date as string)

  if (toDelete.length > 0) {
    // branch_holiday_operations는 holiday_date FK ON DELETE CASCADE라
    // 해당 날짜의 원별 결정값도 같이 정리된다
    const { error: delErr } = await supabase
      .from('public_holidays')
      .delete()
      .in('holiday_date', toDelete)

    if (delErr) {
      return NextResponse.json(
        { error: `공휴일 삭제 중 오류: ${delErr.message}` },
        { status: 500 },
      )
    }
  }

  return NextResponse.json({
    success: true,
    year: ym.year,
    month: ym.month,
    saved: rows.length,
    deleted: toDelete.length,
  })
}
