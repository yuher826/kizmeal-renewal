import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { UPLOAD_ROLES } from '@/lib/roles'
import { filterEligibleBranches } from '@/lib/pptx-eligibility'
import { monthRange } from '@/lib/holidays'

/**
 * 원별 공휴일 운영 예외 — ② 원별 아코디언 (2단 필터의 2단계)
 *
 * 1단계(`/api/diet-automation/holidays`)에서 '전 원 휴무'로 분류된 날짜만
 * 대상이 된다. 그 날짜들에 대해 원별로 "정말 쉬는지 / 예외로 운영하는지"를
 * 확인·저장한다. 저장 대상은 `branch_holiday_operations`(원별·날짜별).
 *
 * 프리필 우선순위 (HANDOFF 설계 결정 3):
 *   1) 이미 이번 라운드에 결정된 값(branch_holiday_operations 행이 있음)
 *   2) 전년도 동일 이름 공휴일에 그 원이 어떻게 했는지(carried_over)
 *   3) 원별 기본 정책(branch_profiles.operates_on_holidays)
 *
 * 대상 원은 PPTX 생성 파이프라인과 동일 기준(임시계약 제외)으로 좁힌다 —
 * 이 화면의 소비자가 결국 PPTX 생성기이므로 대상이 다르면 의미가 없다.
 */

/** 인증 + 권한 확인 (holidays/route.ts의 requireUploadRole()과 동일 패턴) */
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

function parseYearMonth(year: unknown, month: unknown) {
  const y = Number(year)
  const m = Number(month)
  if (!y || !m || m < 1 || m > 12) return null
  return { year: y, month: m }
}

type OperationSource = 'default' | 'carried_over' | 'manual'

interface OperationCell {
  isOperating:    boolean
  source:         OperationSource
  decidedByName?: string | null
  decidedAt?:     string | null
}

/**
 * 이름이 같은 이전(더 이른) 공휴일 날짜를 찾는다.
 * '작년 동일 공휴일' 승계 — lib/holidays.ts의 inheritPolicy()와 같은 발상이지만
 * 여기서는 정책값이 아니라 "그 날짜"가 필요하다(그 날짜의 원별 결정을 그대로 가져올 것이므로).
 */
async function findPriorHolidayDate(
  supabase: ReturnType<typeof createClient>,
  name: string,
  before: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('public_holidays')
    .select('holiday_date')
    .eq('name', name)
    .eq('closure_policy', 'all_closed')
    .lt('holiday_date', before)
    .order('holiday_date', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data?.holiday_date as string | undefined) ?? null
}

/**
 * GET /api/diet-automation/holidays/branches?year=2026&month=12
 *
 * 응답:
 *   {
 *     year, month,
 *     closedDates: [{ date, name }],   // '전 원 휴무'로 분류된 날짜만(대상 없으면 빈 배열)
 *     branches: [{ id, shortCode, branchFullName, groupTag, sortOrder, operatesOnHolidaysDefault }],
 *     operations: { [date]: { [branchProfileId]: OperationCell } }
 *   }
 */
export async function GET(req: NextRequest) {
  const auth = await requireUploadRole()
  if ('error' in auth) return auth.error
  const { supabase } = auth

  const { searchParams } = new URL(req.url)
  const ym = parseYearMonth(searchParams.get('year'), searchParams.get('month'))
  if (!ym) {
    return NextResponse.json({ error: 'year, month 파라미터가 유효하지 않습니다.' }, { status: 400 })
  }

  const { from, to } = monthRange(ym.year, ym.month)

  // 1. '전 원 휴무'로 분류된 날짜만 대상
  const { data: closedRows, error: closedErr } = await supabase
    .from('public_holidays')
    .select('holiday_date, name')
    .gte('holiday_date', from)
    .lte('holiday_date', to)
    .eq('closure_policy', 'all_closed')
    .order('holiday_date')

  if (closedErr) {
    return NextResponse.json({ error: `공휴일 조회 중 오류: ${closedErr.message}` }, { status: 500 })
  }

  const closedDates = (closedRows ?? []).map(r => ({
    date: r.holiday_date as string,
    name: r.name as string,
  }))

  if (closedDates.length === 0) {
    return NextResponse.json({ year: ym.year, month: ym.month, closedDates: [], branches: [], operations: {} })
  }

  // 2. 대상 원 — PPTX 생성 자격과 동일 기준(임시계약 제외)
  const { data: profiles, error: profErr } = await supabase
    .from('branch_profiles')
    .select('id, short_code, branch_full_name, group_tag, sort_order, operates_on_holidays, contract_type')
    .order('sort_order', { ascending: true, nullsFirst: false })
    .order('group_tag', { ascending: true, nullsFirst: false })
    .order('short_code', { ascending: true })

  if (profErr) {
    return NextResponse.json({ error: `원 목록 조회 중 오류: ${profErr.message}` }, { status: 500 })
  }

  let eligible: typeof profiles
  try {
    eligible = filterEligibleBranches(profiles ?? [])
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '대상 원 목록이 비어 있습니다.' },
      { status: 500 },
    )
  }

  const branches = eligible.map(p => ({
    id:                         p.id as string,
    shortCode:                  p.short_code as string | null,
    branchFullName:             p.branch_full_name as string | null,
    groupTag:                   p.group_tag as string | null,
    sortOrder:                  p.sort_order as number | null,
    operatesOnHolidaysDefault:  Boolean(p.operates_on_holidays),
  }))
  const branchIds = branches.map(b => b.id)

  // 3. 이번 라운드에 이미 결정된 값 (branch_holiday_operations)
  const dates = closedDates.map(c => c.date)
  const { data: existingRows, error: existErr } = await supabase
    .from('branch_holiday_operations')
    .select('holiday_date, branch_profile_id, is_operating, source, decided_by, decided_at')
    .in('holiday_date', dates)
    .in('branch_profile_id', branchIds)

  if (existErr) {
    return NextResponse.json({ error: `원별 결정값 조회 중 오류: ${existErr.message}` }, { status: 500 })
  }

  // decided_by 이름 붙이기 (⑤ 결정 이력과 동일한 방식)
  const deciderIds = Array.from(
    new Set((existingRows ?? []).map(r => r.decided_by).filter(Boolean) as string[]),
  )
  const deciderNames: Record<string, string> = {}
  if (deciderIds.length > 0) {
    const { data: admins } = await supabase.from('admins').select('id, name').in('id', deciderIds)
    for (const a of admins ?? []) deciderNames[a.id as string] = a.name as string
  }

  const existingByKey = new Map(
    (existingRows ?? []).map(r => [
      `${r.holiday_date}::${r.branch_profile_id}`,
      {
        isOperating:   Boolean(r.is_operating),
        source:        r.source as OperationSource,
        decidedByName: r.decided_by ? (deciderNames[r.decided_by as string] ?? null) : null,
        decidedAt:     r.decided_at as string | null,
      } satisfies OperationCell,
    ]),
  )

  // 4. 전년도 승계값 — 날짜별로 매칭되는 과거 날짜를 찾아 그 날짜의 원별 결정을 그대로 가져온다.
  //    closedDates가 보통 한 달에 1~3건뿐이라 날짜별 순차 조회로도 충분하다.
  const carriedOverByKey = new Map<string, OperationCell>()
  for (const c of closedDates) {
    const priorDate = await findPriorHolidayDate(supabase, c.name, from)
    if (!priorDate) continue

    const { data: priorRows } = await supabase
      .from('branch_holiday_operations')
      .select('branch_profile_id, is_operating')
      .eq('holiday_date', priorDate)
      .in('branch_profile_id', branchIds)

    for (const r of priorRows ?? []) {
      carriedOverByKey.set(`${c.date}::${r.branch_profile_id}`, {
        isOperating: Boolean(r.is_operating),
        source:      'carried_over',
      })
    }
  }

  // 5. 최종 조합 — 이번 라운드 결정 > 전년도 승계 > 원별 기본 정책
  const operations: Record<string, Record<string, OperationCell>> = {}
  for (const c of closedDates) {
    operations[c.date] = {}
    for (const b of branches) {
      const key = `${c.date}::${b.id}`
      operations[c.date][b.id] =
        existingByKey.get(key) ??
        carriedOverByKey.get(key) ??
        { isOperating: b.operatesOnHolidaysDefault, source: 'default' }
    }
  }

  return NextResponse.json({ year: ym.year, month: ym.month, closedDates, branches, operations })
}

/**
 * POST /api/diet-automation/holidays/branches
 *
 * 그 달의 '전 원 휴무' 날짜 × 대상 원 전체의 최종 결정을 저장한다(부분 아님 —
 * 팝업이 화면에 표시한 셀 전체를 매번 보낸다. holidays/route.ts confirm 모드와
 * 동일한 원칙). 전부 source='manual'로 저장 — 사람이 이 화면에서 확정한 값이므로.
 *
 * body: {
 *   year, month,
 *   entries: [{ date: 'YYYY-MM-DD', branchProfileId: string, isOperating: boolean }]
 * }
 */
export async function POST(req: NextRequest) {
  const auth = await requireUploadRole()
  if ('error' in auth) return auth.error
  const { supabase, adminId } = auth

  let body: { year?: unknown; month?: unknown; entries?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '요청 본문이 JSON이 아닙니다.' }, { status: 400 })
  }

  const ym = parseYearMonth(body.year, body.month)
  if (!ym) {
    return NextResponse.json({ error: 'year, month 값이 유효하지 않습니다.' }, { status: 400 })
  }
  if (!Array.isArray(body.entries)) {
    return NextResponse.json({ error: 'entries 배열이 필요합니다.' }, { status: 400 })
  }

  const { from, to } = monthRange(ym.year, ym.month)

  // 이 달의 '전 원 휴무' 날짜만 허용 — 팝업이 보여준 적 없는 날짜(오분류·조작된 요청)를
  // 그대로 저장하지 않기 위한 방어. holidays/route.ts POST의 월 범위 검증과 같은 목적
  const { data: closedRows, error: closedErr } = await supabase
    .from('public_holidays')
    .select('holiday_date')
    .gte('holiday_date', from)
    .lte('holiday_date', to)
    .eq('closure_policy', 'all_closed')

  if (closedErr) {
    return NextResponse.json({ error: `공휴일 조회 중 오류: ${closedErr.message}` }, { status: 500 })
  }
  const allowedDates = new Set((closedRows ?? []).map(r => r.holiday_date as string))

  const now = new Date().toISOString()
  const rows: Array<Record<string, unknown>> = []
  for (const raw of body.entries as Array<Record<string, unknown>>) {
    const date = String(raw?.date ?? '').trim()
    const branchProfileId = String(raw?.branchProfileId ?? '').trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: `날짜 형식이 잘못되었습니다: ${date}` }, { status: 400 })
    }
    if (!allowedDates.has(date)) {
      return NextResponse.json(
        { error: `${ym.year}년 ${ym.month}월 '전 원 휴무' 대상이 아닌 날짜입니다: ${date}` },
        { status: 400 },
      )
    }
    if (!branchProfileId) {
      return NextResponse.json({ error: 'branchProfileId가 비어 있는 항목이 있습니다.' }, { status: 400 })
    }

    rows.push({
      holiday_date:      date,
      branch_profile_id: branchProfileId,
      is_operating:       Boolean(raw?.isOperating),
      source:             'manual',
      decided_by:         adminId,
      decided_at:         now,
      updated_at:         now,
    })
  }

  if (rows.length > 0) {
    const { error: upsertErr } = await supabase
      .from('branch_holiday_operations')
      .upsert(rows, { onConflict: 'holiday_date,branch_profile_id' })

    if (upsertErr) {
      return NextResponse.json({ error: `원별 예외 저장 중 오류: ${upsertErr.message}` }, { status: 500 })
    }
  }

  return NextResponse.json({ success: true, year: ym.year, month: ym.month, saved: rows.length })
}
