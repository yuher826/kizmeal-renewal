import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { UPLOAD_ROLES } from '@/lib/roles'
import { filterEligibleBranches } from '@/lib/pptx-eligibility'

/**
 * 원별 방학 양식(O/X) 배정 — HANDOFF "④ 원별 방학 양식 선택" / 착수 순서 8번
 *
 * 디자이너는 방학 있는 달에만 방학O·방학X 공용 양식 2벌을 준다(그 외 달엔
 * 양식이 1벌뿐). 어느 원이 O/X인지는 디자이너가 모르는 우리 쪽 정보라
 * 배정표를 우리가 갖고 있어야 한다(HANDOFF 발견③).
 *
 * ★판정 신호: `diet_templates`에 그 연·월로 `vacation_variant`가
 *   'vacation_on'/'vacation_off'인 행이 있는가. 달을 하드코딩(7·8월 등)하지
 *   않는 이유 — 방학 시기는 CK 사업장 사정에 따라 달라지고(HANDOFF: 봄은
 *   거의 없음, 겨울 O/X는 아직 미확인), 코드가 추측하면 원칙이 깨진다
 *   (`gen_form.py --holiday`/`closure_policy` 설계와 동일한 원칙 — 사람이
 *   표시한 것을 코드가 읽는다). 디자이너가 O/X 두 벌을 준 달 = 그 신호.
 *
 * ⚠️ 2026-08-24 시점: `diet_templates.year`/`month`/`vacation_variant`를
 *   채우는 UI가 아직 없다(템플릿 관리 화면이 여전히 "전역 active 1개"
 *   구식 모델 — 별개 미완성 작업, 이 기능 범위 밖). 그래서 이 판정은
 *   당장은 항상 false를 돌려주지만, 그 UI가 채워지는 순간 하드코딩 없이
 *   바로 동작한다.
 *
 * 저장 대상은 `branch_monthly_vacation`(원별·연월). 프리필 우선순위:
 *   1) 이번 라운드에 이미 결정된 값
 *   2) 전년도 동일 월의 그 원 결정(방학은 학기 단위로 거의 고정 — 이름
 *      매칭이 필요한 공휴일과 달리 그냥 연도만 -1해서 같은 월을 본다)
 *   3) 기본값 `has_vacation=false`(방학X) — `branch_profiles`엔 방학
 *      기본정책 컬럼이 없어서, `template_resolver.py`가 미배정 원을
 *      방학X로 보수 처리하는 것과 동일하게 맞춘다(UI·파이프라인 불일치 방지)
 *
 * 대상 원은 PPTX 생성 파이프라인과 동일 기준(임시계약 제외) — 오늘 만든
 * `holidays/branches/route.ts`와 같은 논리.
 */

/** 인증 + 권한 확인 (holidays/branches/route.ts와 동일 패턴) */
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

type AssignmentSource = 'default' | 'carried_over' | 'manual'

interface AssignmentCell {
  hasVacation:    boolean
  source:         AssignmentSource
  decidedByName?: string | null
  decidedAt?:     string | null
}

/**
 * GET /api/diet-automation/vacation?year=2026&month=8
 *
 * 응답:
 *   {
 *     year, month,
 *     vacationAvailable: boolean,   // 그 연월에 방학O/X 템플릿이 둘 다(또는 하나라도) 있는가
 *     branches: [{ id, shortCode, branchFullName, groupTag, sortOrder }],
 *     assignments: { [branchProfileId]: AssignmentCell }
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

  // 1. 판정 — 이 연월에 방학 양식(O/X)이 실제로 있는가
  const { data: variantRows, error: variantErr } = await supabase
    .from('diet_templates')
    .select('id')
    .eq('year', ym.year)
    .eq('month', ym.month)
    .in('vacation_variant', ['vacation_on', 'vacation_off'])
    .limit(1)

  if (variantErr) {
    return NextResponse.json({ error: `템플릿 조회 중 오류: ${variantErr.message}` }, { status: 500 })
  }

  const vacationAvailable = (variantRows ?? []).length > 0
  if (!vacationAvailable) {
    return NextResponse.json({ year: ym.year, month: ym.month, vacationAvailable: false, branches: [], assignments: {} })
  }

  // 2. 대상 원 — PPTX 생성 자격과 동일 기준(임시계약 제외)
  const { data: profiles, error: profErr } = await supabase
    .from('branch_profiles')
    .select('id, short_code, branch_full_name, group_tag, sort_order, contract_type')
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
    id:             p.id as string,
    shortCode:      p.short_code as string | null,
    branchFullName: p.branch_full_name as string | null,
    groupTag:       p.group_tag as string | null,
    sortOrder:      p.sort_order as number | null,
  }))
  const branchIds = branches.map(b => b.id)

  // 3. 이번 라운드에 이미 결정된 값 (branch_monthly_vacation)
  const { data: existingRows, error: existErr } = await supabase
    .from('branch_monthly_vacation')
    .select('branch_profile_id, has_vacation, source, decided_by, decided_at')
    .eq('year', ym.year)
    .eq('month', ym.month)
    .in('branch_profile_id', branchIds)

  if (existErr) {
    return NextResponse.json({ error: `원별 배정값 조회 중 오류: ${existErr.message}` }, { status: 500 })
  }

  const deciderIds = Array.from(
    new Set((existingRows ?? []).map(r => r.decided_by).filter(Boolean) as string[]),
  )
  const deciderNames: Record<string, string> = {}
  if (deciderIds.length > 0) {
    const { data: admins } = await supabase.from('admins').select('id, name').in('id', deciderIds)
    for (const a of admins ?? []) deciderNames[a.id as string] = a.name as string
  }

  const existingByBranch = new Map(
    (existingRows ?? []).map(r => [
      r.branch_profile_id as string,
      {
        hasVacation:   Boolean(r.has_vacation),
        source:        r.source as AssignmentSource,
        decidedByName: r.decided_by ? (deciderNames[r.decided_by as string] ?? null) : null,
        decidedAt:     r.decided_at as string | null,
      } satisfies AssignmentCell,
    ]),
  )

  // 4. 전년도 승계값 — 같은 월(year-1)의 그 원 결정을 그대로 가져온다.
  //    방학은 공휴일과 달리 "이름"이 없어 그냥 연도만 -1해서 같은 월을 찾으면 된다.
  const { data: priorRows } = await supabase
    .from('branch_monthly_vacation')
    .select('branch_profile_id, has_vacation')
    .eq('year', ym.year - 1)
    .eq('month', ym.month)
    .in('branch_profile_id', branchIds)

  const carriedOverByBranch = new Map<string, AssignmentCell>(
    (priorRows ?? []).map(r => [
      r.branch_profile_id as string,
      { hasVacation: Boolean(r.has_vacation), source: 'carried_over' } satisfies AssignmentCell,
    ]),
  )

  // 5. 최종 조합 — 이번 라운드 결정 > 전년도 승계 > 기본값(방학X)
  const assignments: Record<string, AssignmentCell> = {}
  for (const b of branches) {
    assignments[b.id] =
      existingByBranch.get(b.id) ??
      carriedOverByBranch.get(b.id) ??
      { hasVacation: false, source: 'default' }
  }

  return NextResponse.json({ year: ym.year, month: ym.month, vacationAvailable: true, branches, assignments })
}

/**
 * POST /api/diet-automation/vacation
 *
 * 그 달 대상 원 전체의 최종 배정을 저장한다(부분 아님 — 팝업이 화면에 표시한
 * 셀 전체를 매번 보낸다. holidays/branches/route.ts POST와 동일 원칙).
 * 전부 source='manual'로 저장.
 *
 * body: {
 *   year, month,
 *   entries: [{ branchProfileId: string, hasVacation: boolean }]
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

  // 이 연월에 방학 양식(O/X)이 실제로 있을 때만 저장 허용 — 팝업이 보여준 적
  // 없는 달(오분류·조작된 요청)을 그대로 저장하지 않기 위한 방어.
  // holidays/branches/route.ts POST의 날짜 화이트리스트 검증과 같은 목적
  const { data: variantRows, error: variantErr } = await supabase
    .from('diet_templates')
    .select('id')
    .eq('year', ym.year)
    .eq('month', ym.month)
    .in('vacation_variant', ['vacation_on', 'vacation_off'])
    .limit(1)

  if (variantErr) {
    return NextResponse.json({ error: `템플릿 조회 중 오류: ${variantErr.message}` }, { status: 500 })
  }
  if ((variantRows ?? []).length === 0) {
    return NextResponse.json(
      { error: `${ym.year}년 ${ym.month}월은 방학 양식(O/X) 대상이 아닙니다.` },
      { status: 400 },
    )
  }

  const now = new Date().toISOString()
  const rows: Array<Record<string, unknown>> = []
  for (const raw of body.entries as Array<Record<string, unknown>>) {
    const branchProfileId = String(raw?.branchProfileId ?? '').trim()
    if (!branchProfileId) {
      return NextResponse.json({ error: 'branchProfileId가 비어 있는 항목이 있습니다.' }, { status: 400 })
    }

    rows.push({
      year:              ym.year,
      month:             ym.month,
      branch_profile_id: branchProfileId,
      has_vacation:       Boolean(raw?.hasVacation),
      source:             'manual',
      decided_by:         adminId,
      decided_at:         now,
      updated_at:         now,
    })
  }

  if (rows.length > 0) {
    const { error: upsertErr } = await supabase
      .from('branch_monthly_vacation')
      .upsert(rows, { onConflict: 'year,month,branch_profile_id' })

    if (upsertErr) {
      return NextResponse.json({ error: `방학 배정 저장 중 오류: ${upsertErr.message}` }, { status: 500 })
    }
  }

  return NextResponse.json({ success: true, year: ym.year, month: ym.month, saved: rows.length })
}
