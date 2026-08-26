import type JSZip from 'jszip'
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getYearOptions } from '@/lib/diet-utils'
import { canManageTemplates, canDeleteTemplate } from '@/lib/roles'

// diet_templates.vacation_variant CHECK 제약과 동일해야 한다
const VACATION_VARIANTS = ['none', 'vacation_on', 'vacation_off'] as const
type VacationVariant = typeof VACATION_VARIANTS[number]

export interface StyleJson {
  headerColor: string
  accentColor: string
  sectionBgColor: string
  headerBgColor: string
  weekTitleColor: string
  weekBorderColor: string
  borderColor: string
  fontFamily: string
  rawColors: string[]
  rawFonts: string[]
}

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

interface AdminRow {
  id: string
  role: string
  can_manage_templates: boolean | null
}

// ★기존 checkAdmin()은 boolean만 반환했다. GET 응답에 호출자 권한(permissions)을
// 실어 보내고 POST에서 role/can_manage_templates로 게이트하려면 admin 행
// 자체가 필요해 반환 타입을 넓혔다 — GET의 "행이 없으면 403" 동작 자체는
// 그대로다(분기 추가 없음, 반환값만 넓어짐).
async function getAdmin(supabase: ReturnType<typeof makeSupabase>, userId: string): Promise<AdminRow | null> {
  const { data } = await supabase
    .from('admins')
    .select('id, role, can_manage_templates')
    .eq('auth_id', userId)
    .eq('is_active', true)
    .maybeSingle()
  return data ?? null
}

/* ── pptx XML 파싱 헬퍼 ── */
function extractHex(segment: string): string | null {
  const m = segment.match(/srgbClr[^>]*val="([0-9A-Fa-f]{6})"/)
  if (m) return m[1].toUpperCase()
  const s = segment.match(/sysClr[^>]*lastClr="([0-9A-Fa-f]{6})"/)
  return s ? s[1].toUpperCase() : null
}

function parseThemeXml(xml: string): { colors: Record<string, string>; fonts: string[] } {
  const SLOTS = ['dk1','dk2','lt1','lt2','accent1','accent2','accent3','accent4','accent5','accent6']
  const colors: Record<string, string> = {}

  for (const slot of SLOTS) {
    const re = new RegExp(`<a:${slot}[^>]*>([\\s\\S]*?)<\\/a:${slot}>`)
    const m = xml.match(re)
    if (m) {
      const hex = extractHex(m[1])
      if (hex) colors[slot] = hex
    }
  }

  // All srgbClr values as raw list
  const rawColors: string[] = Array.from(xml.matchAll(/srgbClr[^>]*val="([0-9A-Fa-f]{6})"/g)).map(m => m[1].toUpperCase())

  // Font names
  const fonts: string[] = Array.from(xml.matchAll(/typeface="([^"]+)"/g))
    .map(m => m[1])
    .filter(f => f && !f.startsWith('+') && f !== 'nil')
    .filter((v, i, a) => a.indexOf(v) === i)

  return { colors: { ...colors, _rawColors: rawColors.join(',') }, fonts }
}

function buildStyleJson(colors: Record<string, string>, fonts: string[]): StyleJson {
  const raw = (colors._rawColors || '').split(',').filter(Boolean)
  return {
    headerColor:    `#${colors.dk1     || '1B4332'}`,
    accentColor:    `#${colors.dk2     || '2D6A4F'}`,
    sectionBgColor: `#${colors.accent1 || 'E8F5E9'}`,
    headerBgColor:  `#${colors.accent2 || 'F8FDF8'}`,
    weekTitleColor: `#${colors.dk2     || '2D6A4F'}`,
    weekBorderColor:`#${colors.dk2     || '2D6A4F'}`,
    borderColor:    '#CCCCCC',
    fontFamily:     fonts.length ? `'${fonts[0]}', 'Malgun Gothic', sans-serif` : "'Noto Sans KR', 'Malgun Gothic', sans-serif",
    rawColors:      raw,
    rawFonts:       fonts,
  }
}

/* ── 이름표 검증 헬퍼 ── */
const REQUIRED_NAMES = ['MENU_TABLE', 'ALLERGY_BOX', 'ORIGIN_BOX', 'MATERIAL_BOX'] as const

interface SlideValidation {
  slide: string
  valid: boolean
  names_found: Record<string, boolean>
  missing: string[]
}

interface TemplateValidation {
  valid: boolean
  slide_count: number
  slides: SlideValidation[]
  summary: string
}

// 파이썬 find_shape_by_name과 동일 기준: cNvPr name에서 4개 이름표 확인
function checkNamesInSlide(slideXml: string): Record<string, boolean> {
  const foundNames = new Set<string>()
  const regex = /<[a-z]*:?cNvPr\b[^>]*\bname="([^"]*)"/g
  let m: RegExpExecArray | null
  while ((m = regex.exec(slideXml)) !== null) {
    foundNames.add(m[1])
  }
  const result: Record<string, boolean> = {}
  for (const name of REQUIRED_NAMES) {
    result[name] = foundNames.has(name)
  }
  return result
}

async function validateTemplateZip(zip: JSZip): Promise<TemplateValidation> {
  const slideFiles = zip.file(/^ppt\/slides\/slide\d+\.xml$/)
  const slides: SlideValidation[] = []
  let overallValid = true

  if (!slideFiles || slideFiles.length === 0) {
    return { valid: false, slide_count: 0, slides: [], summary: '슬라이드를 찾을 수 없습니다 (빈 PPTX).' }
  }

  for (const f of slideFiles) {
    const xml = await f.async('string')
    const namesFound = checkNamesInSlide(xml)
    const missing = REQUIRED_NAMES.filter((n) => !namesFound[n])
    const slideValid = missing.length === 0
    if (!slideValid) overallValid = false
    slides.push({
      slide: f.name.split('/').pop() ?? f.name,
      valid: slideValid,
      names_found: namesFound,
      missing,
    })
  }

  return {
    valid: overallValid,
    slide_count: slides.length,
    slides,
    summary: overallValid
      ? `검증 통과 — ${slides.length}개 슬라이드 모두 이름표 4개 정상`
      : '검증 실패 — 일부 슬라이드에 이름표 누락',
  }
}

/* ── GET: 템플릿 목록 ── */
export async function GET() {
  const supabase = makeSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '관리자 권한이 필요합니다' }, { status: 403 })
  const admin = await getAdmin(supabase, user.id)
  if (!admin) return NextResponse.json({ error: '관리자 권한이 필요합니다' }, { status: 403 })

  // 정렬: 연·월 내림차순(최신 달이 위) → 같은 (연,월) 안에서는 버전 내림차순.
  // year가 NULL인 레거시 행은 nullsFirst:false로 맨 뒤로 보낸다.
  const { data, error } = await supabase
    .from('diet_templates')
    .select('id, version, name, file_path, style_json, is_active, created_at, note, year, month, vacation_variant, validation_result')
    .order('year',    { ascending: false, nullsFirst: false })
    .order('month',   { ascending: false, nullsFirst: false })
    .order('version', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  // ★2차 방어선(UI)이 버튼 disabled 여부를 판단할 근거. 페이지가 admins를
  // 따로 조회하지 않도록 GET 응답에 호출자 권한을 함께 실어 보낸다.
  return NextResponse.json({
    templates: data || [],
    permissions: {
      canManage: canManageTemplates(admin),
      canDelete: canDeleteTemplate(admin),
    },
  })
}

/* ── POST: 새 템플릿 업로드 ── */
export async function POST(req: NextRequest) {
  const supabase = makeSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
  const admin = await getAdmin(supabase, user.id)
  if (!admin) return NextResponse.json({ error: '관리자 권한이 필요합니다' }, { status: 403 })
  // ★1차 방어선(API) — 템플릿 담당은 role이 아니라 배정(can_manage_templates)이다
  if (!canManageTemplates(admin)) {
    return NextResponse.json({ error: '템플릿 관리 담당자만 가능합니다' }, { status: 403 })
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: '파일 파싱 실패' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  const name = (formData.get('name') as string || '').trim()
  const note = (formData.get('note') as string || '').trim()
  const yearRaw            = (formData.get('year')  as string) || ''
  const monthRaw           = (formData.get('month') as string) || ''
  const vacationVariantRaw = (formData.get('vacation_variant') as string || '').trim()

  if (!file) return NextResponse.json({ error: 'pptx 파일이 없습니다' }, { status: 400 })
  if (!name) return NextResponse.json({ error: '템플릿 이름을 입력하세요' }, { status: 400 })

  // ── 연·월 필수 검증 ──────────────────────────────────────────────────
  // resolve_template_set()(pptx-server)이 항상 구체적 year/month로 필터링
  // 하므로, 연·월이 없는 템플릿은 업로드해도 영원히 사용되지 않는다
  // (v1이 그 상태 — 2026-08-24에야 발견됨). 같은 실수를 새로 만들지 않는다.
  // ★클라이언트 검증만 믿지 않는다 — 여기서 안 막으면 DB CHECK 제약
  //   (diet_templates_year_month_pair)에 걸려 Postgres 에러가 그대로
  //   500으로 튀어나와 실무자에게 알 수 없는 화면이 뜬다.
  if (!yearRaw || !monthRaw) {
    return NextResponse.json({ error: '연도와 월을 선택하세요' }, { status: 400 })
  }
  const year  = Number(yearRaw)
  const month = Number(monthRaw)

  // 연도 범위 — getYearOptions()를 인자 없이 호출해 "정상 범위"(작년~3년 후)를
  // 얻는다. 여기 submitted year를 인자로 넘기면 함수가 그 값을 범위에 강제로
  // 끼워넣어 검증이 항상 통과하는 함정이 있다(getYearOptions 자체 동작) —
  // 반드시 인자 없이 호출한 결과와 비교할 것.
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

  // 방학 구분 — 값이 없으면 'none'(무관/평월)으로 처리, 있으면 3종 중 하나여야 함
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

  // pptx 파싱 (JSZip)
  let validationResult: TemplateValidation = {
    valid: false, slide_count: 0, slides: [], summary: '검증 안 됨',
  }
  let styleJson: StyleJson = buildStyleJson({}, [])
  try {
    const JSZipModule = (await import('jszip')).default
    const buffer = await file.arrayBuffer()
    const zip = await JSZipModule.loadAsync(buffer)

    let themeXml = ''
    const themeFile = zip.file('ppt/theme/theme1.xml')
    if (themeFile) themeXml = await themeFile.async('string')
    else {
      // fallback: search for any theme xml
      const found = zip.file(/^ppt\/theme\/theme\d+\.xml$/)[0]
      if (found) themeXml = await found.async('string')
    }

    if (themeXml) {
      const { colors, fonts } = parseThemeXml(themeXml)
      styleJson = buildStyleJson(colors, fonts)
    }

    // 이름표 검증 (파이썬 문지기와 같은 기준, 업로드 즉시 피드백)
    validationResult = await validateTemplateZip(zip)
  } catch (parseErr) {
    console.error('pptx parse error:', parseErr)
    // 파싱 실패 시 기본 스타일 사용 - 업로드는 계속 진행
  }

  // Supabase Storage 업로드
  // 경로에 연/월/방학구분을 넣어 파일명만 보고도 Storage에서 추적 가능하게 함.
  // ★ASCII만 쓴다 — 한글을 key에 넣으면 Supabase Storage가 InvalidKey를
  //   던진다(HANDOFF 기록). Date.now()는 그대로 유지 — 같은 (연,월,variant)
  //   조합을 재업로드해도 경로가 겹치지 않게 한다.
  const monthPadded = String(month).padStart(2, '0')
  const storagePath = `diet-templates/v${nextVersion}_${year}-${monthPadded}_${vacationVariant}_${Date.now()}.pptx`
  const fileBuffer = await file.arrayBuffer()
  const { error: uploadErr } = await supabase.storage
    .from('diet-templates')
    .upload(storagePath, fileBuffer, { contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', upsert: false })

  if (uploadErr) {
    return NextResponse.json({ error: '파일 업로드 실패: ' + uploadErr.message }, { status: 500 })
  }

  // DB 저장 (is_active = false — 관리자가 확인 후 직접 활성화)
  const { data: tmpl, error: dbErr } = await supabase
    .from('diet_templates')
    .insert({
      version:           nextVersion,
      name,
      file_path:         storagePath,
      style_json:        styleJson,
      is_active:         false,
      created_by:        user.id,
      note:              note || null,
      validation_result: validationResult,
      year,
      month,
      vacation_variant:  vacationVariant,
    })
    .select()
    .single()

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

  return NextResponse.json({ template: tmpl, style_json: styleJson, validation_result: validationResult })
}
