import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { UPLOAD_ROLES } from '@/lib/roles'
import {
  fetchHolidaysFromKasi,
  diffHolidays,
  inheritPolicy,
  monthRange,
  HolidayApiError,
  type Holiday,
  type StoredHoliday,
  type ClosurePolicy,
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
    .select('holiday_date, name, source, confirmed_at, confirmed_by, closure_policy')
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
    closurePolicy: r.closure_policy as StoredHoliday['closurePolicy'],
  }))

  const diff = diffHolidays(fromApi, stored)

  // 3. 분류가 필요한 공휴일에 대해 "작년엔 이렇게 하셨습니다" 제안을 만든다.
  //    별도 정책 테이블 없이 같은 이름의 과거 행을 거슬러 올라간다
  //    (add_holiday_closure_policy_260820.sql 설계 참고)
  const needPolicy = Array.from(
    new Set(
      diff.added.map(h => h.name).concat(diff.unclassified.map(h => h.name)),
    ),
  )
  const policySuggestions: Record<string, { policy: string; fromDate: string }> = {}

  if (needPolicy.length > 0) {
    const { data: hist } = await supabase
      .from('public_holidays')
      .select('holiday_date, name, closure_policy')
      .in('name', needPolicy)
      .not('closure_policy', 'is', null)
      .lt('holiday_date', from)
      .order('holiday_date', { ascending: false })

    const byName = new Map<string, Array<{ date: string; closurePolicy: ClosurePolicy | null }>>()
    for (const h of hist ?? []) {
      const name = h.name as string
      if (!byName.has(name)) byName.set(name, [])
      byName.get(name)!.push({
        date: h.holiday_date as string,
        closurePolicy: h.closure_policy as ClosurePolicy | null,
      })
    }

    for (const name of needPolicy) {
      const found = inheritPolicy(byName.get(name) ?? [], from)
      if (found) policySuggestions[name] = found
    }
  }

  // 4. 마지막 확인자 이름 (⑤ 결정 이력 표시용)
  //    confirmed_by는 admins.id → 이름을 붙여 내려준다
  const confirmerIds = Array.from(
    new Set((rows ?? []).map(r => r.confirmed_by).filter(Boolean) as string[]),
  )
  const confirmerNames: Record<string, string> = {}
  if (confirmerIds.length > 0) {
    const { data: admins } = await supabase
      .from('admins').select('id, name').in('id', confirmerIds)
    for (const a of admins ?? []) confirmerNames[a.id as string] = a.name as string
  }

  return NextResponse.json({
    year: ym.year,
    month: ym.month,
    fromApi,
    stored: stored.map((s, i) => ({
      ...s,
      confirmedByName: confirmerNames[(rows ?? [])[i]?.confirmed_by as string] ?? null,
    })),
    diff,
    policySuggestions,
  })
}

/**
 * POST /api/diet-automation/holidays
 *
 * 그 달의 최종 공휴일 목록을 저장한다. 멱등 — 두 번 보내도 결과가 같다.
 *
 * ★mode 두 가지 (⑤ 결정 이력 ↔ ⑥ 변경없음 표시 충돌을 푸는 지점)
 *
 *   'confirm' (기본) — 사람이 팝업에서 확정한 경우.
 *       name/source/closure_policy/confirmed_by/confirmed_at 전부를
 *       upsert하고, 목록에서 빠진 API 수집분을 삭제한다.
 *
 *   'sync' — diff가 없어 팝업을 띄우지 않았고, "확인했다"는 사실만 남기는 경우.
 *       **좁은 UPDATE로 synced_at/updated_at 딱 두 컬럼만 건드린다.**
 *       holidays 배열의 date만 쓰고 나머지 필드(name/source/closurePolicy)는
 *       이 모드에서 아예 읽지 않는다 — payload에 뭐가 들어있든 무관하게
 *       다른 컬럼은 절대 안 바뀐다. 삭제도 하지 않는다.
 *
 *       ⚠️ 실물 검증 중 발견된 사고(2026-08-20): 이전엔 confirm과 같은
 *       upsert row 조립 함수를 공유하며 confirmed_by/at만 조건부로 뺐는데,
 *       프론트가 closurePolicy 필드를 빠뜨린 sync payload를 보내는 바람에
 *       이미 분류돼 있던 값이 null로 덮였다. "넘긴 컬럼만 건드린다"를
 *       프론트 payload 구성에 의존하면 같은 사고가 반복된다 — 그래서
 *       구조 자체를 좁은 UPDATE로 바꿔 서버가 보장한다.
 *
 * body: {
 *   year, month,
 *   mode?: 'confirm' | 'sync',
 *   holidays: [{
 *     date: 'YYYY-MM-DD',
 *     name: string,                                    // confirm 모드만 사용
 *     source?: 'kasi_api' | 'manual',                   // confirm 모드만 사용
 *     closurePolicy?: 'all_closed' | 'all_operating' | null  // confirm 모드만 사용
 *   }]
 * }
 */
export async function POST(req: NextRequest) {
  const auth = await requireUploadRole()
  if ('error' in auth) return auth.error
  const { supabase, adminId } = auth

  let body: { year?: unknown; month?: unknown; holidays?: unknown; mode?: unknown }
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

  const mode = body.mode === 'sync' ? 'sync' : 'confirm'
  const { from, to } = monthRange(ym.year, ym.month)
  const now = new Date().toISOString()

  // 날짜 형식 + 해당 월 소속 검증은 두 모드가 공유한다.
  // (DB에는 year/month 컬럼이 없어 범위를 강제할 CHECK가 없으므로 앱이 지킨다)
  const dates: string[] = []
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
    dates.push(date)
  }

  // ════════════════════════════════════════════════════════════════
  // sync 모드 — "변경 없음"을 전제로 도는 자동 호출.
  //
  // ★일부러 upsert 대신 좁은 UPDATE를 쓴다. 애초에 confirm과 같은 upsert
  //   row 조립 함수를 공유했다가, 프론트가 closurePolicy 필드를 빠뜨린
  //   payload를 보내는 바람에 이미 분류돼 있던 값이 null로 덮인 사고가
  //   실물 검증 중 재현됐다(2026-08-20). "넘긴 컬럼만 건드린다"를
  //   프론트 payload 구성에 의존하면 다음에도 같은 사고가 난다 —
  //   그래서 서버가 synced_at/updated_at **딱 두 컬럼만** 쓰도록 구조로
  //   막는다. name/source/closure_policy/confirmed_*는 이 경로에서
  //   절대 손대지 않는다(입력값이 무엇이든 무관).
  //   삭제도 하지 않는다 — sync는 원래 삭제할 게 없는 경로다.
  // ════════════════════════════════════════════════════════════════
  if (mode === 'sync') {
    if (dates.length > 0) {
      const { error: syncErr } = await supabase
        .from('public_holidays')
        .update({ synced_at: now, updated_at: now })
        .in('holiday_date', dates)

      if (syncErr) {
        return NextResponse.json(
          { error: `공휴일 동기화 중 오류: ${syncErr.message}` },
          { status: 500 },
        )
      }
    }
    return NextResponse.json({
      success: true, mode, year: ym.year, month: ym.month,
      saved: dates.length, deleted: 0,
    })
  }

  // ════════════════════════════════════════════════════════════════
  // confirm 모드 — 사람이 팝업에서 확정. 값 전체를 upsert하고 삭제도 한다.
  // ════════════════════════════════════════════════════════════════
  const VALID_POLICIES = ['all_closed', 'all_operating']
  const rows: Array<Record<string, unknown>> = []
  for (const raw of body.holidays as Array<Record<string, unknown>>) {
    const date = String(raw?.date ?? '').trim()

    // closurePolicy는 null 허용 — 팝업에서 일부를 안 정하고 저장할 수 있다.
    // 그 경우 다음 조회에서 unclassified로 다시 잡혀 스스로 복구된다
    const rawPolicy = raw?.closurePolicy
    if (
      rawPolicy != null &&
      !VALID_POLICIES.includes(String(rawPolicy))
    ) {
      return NextResponse.json(
        { error: `closurePolicy 값이 올바르지 않습니다: ${String(rawPolicy)}` },
        { status: 400 },
      )
    }

    rows.push({
      holiday_date: date,
      name: String(raw?.name ?? '').trim() || '공휴일',
      source: raw?.source === 'manual' ? 'manual' : 'kasi_api',
      closure_policy: rawPolicy == null ? null : String(rawPolicy),
      synced_at: now,
      updated_at: now,
      confirmed_by: adminId,
      confirmed_at: now,
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
  const keepDates = new Set(dates)
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
    mode,
    year: ym.year,
    month: ym.month,
    saved: rows.length,
    deleted: toDelete.length,
  })
}
