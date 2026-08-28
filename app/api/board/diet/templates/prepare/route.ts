import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getYearOptions } from '@/lib/diet-utils'
import { canManageTemplates } from '@/lib/roles'

// diet_templates.vacation_variant CHECK 제약과 동일해야 한다
const VACATION_VARIANTS = ['none', 'vacation_on', 'vacation_off'] as const
type VacationVariant = typeof VACATION_VARIANTS[number]

function makeSupabase() {
  const store = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (n: string) => store.get(n)?.value,
        set: (n: string, v: string, o: CookieOptions) => { try { store.set({ name: n, value: v, ...o }) } catch {} },
        remove: (n: string, o: CookieOptions) => { try { store.set({ name: n, value: '', ...o }) } catch {} },
      },
    }
  )
}

/* ── POST: 업로드 경로 발급 (브라우저 직접 업로드 1단계) ──
   파일 자체는 받지 않는다. Vercel 서버리스 함수의 요청 본문 상한(4.5MB)에
   8MB대 pptx가 413으로 막히는 문제(HANDOFF 참고)를 피하려고, 파일은
   브라우저가 Supabase Storage로 바로 올리고 이 함수는 권한 확인 + 경로
   발급만 한다. */
export async function POST(req: NextRequest) {
  const supabase = makeSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })

  // ★role만 select하면 can_manage_templates가 undefined가 되어 담당
  //   영양사까지 403이 난다 — 반드시 두 컬럼을 함께 넓혀서 조회한다
  const { data: admin } = await supabase
    .from('admins').select('id, role, can_manage_templates').eq('auth_id', user.id).eq('is_active', true).maybeSingle()
  if (!admin) return NextResponse.json({ error: '관리자 권한이 필요합니다' }, { status: 403 })
  // ★1차 방어선(API) — 템플릿 담당은 role이 아니라 배정(can_manage_templates)이다
  if (!canManageTemplates(admin)) {
    return NextResponse.json({ error: '템플릿 관리 담당자만 가능합니다' }, { status: 403 })
  }

  let body: { year?: number; month?: number; vacationVariant?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '요청 본문 파싱 실패' }, { status: 400 })
  }

  const year  = body.year
  const month = body.month
  const vacationVariantRaw = (body.vacationVariant || '').trim()

  // ── 연·월 필수 검증 (기존 멀티파트 POST와 동일한 기준) ─────────────────
  // resolve_template_set()(pptx-server)이 항상 구체적 year/month로 필터링
  // 하므로, 연·월이 없는 템플릿은 업로드해도 영원히 사용되지 않는다.
  if (!year || !month) {
    return NextResponse.json({ error: '연도와 월을 선택하세요' }, { status: 400 })
  }
  // ★getYearOptions()를 인자 없이 호출해 "정상 범위"(작년~3년 후)를 얻는다.
  //   submitted year를 인자로 넘기면 함수가 그 값을 범위에 강제로 끼워넣어
  //   검증이 항상 통과하는 함정이 있다 — 반드시 인자 없이 호출한 결과와 비교.
  const validYears = getYearOptions()
  if (!Number.isInteger(year) || !validYears.includes(year)) {
    return NextResponse.json(
      { error: `연도는 ${validYears[0]}~${validYears[validYears.length - 1]} 사이여야 합니다` },
      { status: 400 },
    )
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: '월은 1~12 사이여야 합니다' }, { status: 400 })
  }

  let vacationVariant: VacationVariant = 'none'
  if (vacationVariantRaw) {
    if (!VACATION_VARIANTS.includes(vacationVariantRaw as VacationVariant)) {
      return NextResponse.json({ error: '방학 구분 값이 올바르지 않습니다' }, { status: 400 })
    }
    vacationVariant = vacationVariantRaw as VacationVariant
  }

  // 현재 최대 버전 조회
  const { data: maxRow } = await supabase
    .from('diet_templates')
    .select('version')
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle()
  const nextVersion = (maxRow?.version || 0) + 1

  // Storage 업로드 경로.
  // ★기존(멀티파트 POST) 경로 규칙과 100% 동일하게 유지한다. 버킷명
  //   ('diet-templates')이 경로 앞에 다시 중복돼 있지만(버킷 안에
  //   "diet-templates/" 폴더) 기존 파일이 이미 그 자리에 있으므로
  //   ★절대 고치지 말 것★ — 고치면 기존 템플릿을 못 찾는다.
  // ASCII만 쓴다 — 한글을 key에 넣으면 Supabase Storage가 InvalidKey를
  // 던진다(HANDOFF 기록). Date.now()는 같은 (연,월,variant) 조합을
  // 재업로드해도 경로가 겹치지 않게 한다.
  const monthPadded = String(month).padStart(2, '0')
  const storagePath = `diet-templates/v${nextVersion}_${year}-${monthPadded}_${vacationVariant}_${Date.now()}.pptx`

  return NextResponse.json({ storagePath, version: nextVersion })
}
