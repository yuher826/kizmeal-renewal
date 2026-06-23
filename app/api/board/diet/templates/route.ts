import type JSZip from 'jszip'
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

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

async function checkAdmin(supabase: ReturnType<typeof makeSupabase>): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { data } = await supabase.from('admins').select('id').eq('auth_id', user.id).eq('is_active', true).maybeSingle()
  return !!data
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
  if (!(await checkAdmin(supabase))) {
    return NextResponse.json({ error: '관리자 권한이 필요합니다' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('diet_templates')
    .select('id, version, name, file_path, style_json, is_active, created_at, note')
    .order('version', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ templates: data || [] })
}

/* ── POST: 새 템플릿 업로드 ── */
export async function POST(req: NextRequest) {
  const supabase = makeSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
  if (!(await checkAdmin(supabase))) return NextResponse.json({ error: '관리자 권한이 필요합니다' }, { status: 403 })

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: '파일 파싱 실패' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  const name = (formData.get('name') as string || '').trim()
  const note = (formData.get('note') as string || '').trim()

  if (!file) return NextResponse.json({ error: 'pptx 파일이 없습니다' }, { status: 400 })
  if (!name) return NextResponse.json({ error: '템플릿 이름을 입력하세요' }, { status: 400 })

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
  const storagePath = `diet-templates/v${nextVersion}_${Date.now()}.pptx`
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
    })
    .select()
    .single()

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

  return NextResponse.json({ template: tmpl, style_json: styleJson, validation_result: validationResult })
}
