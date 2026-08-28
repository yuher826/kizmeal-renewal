// pptx 템플릿 검증·스타일 추출 공용 모듈.
// ★서버(app/api/board/diet/templates/route.ts)와 브라우저(직접 업로드
//   페이지)가 함께 import한다 — JSZip이 넘겨주는 zip 객체와 XML 문자열만
//   다루고 fs·Buffer·process 등 Node 전용 API는 쓰지 않는다.
import type JSZip from 'jszip'

/* ── 스타일 추출 ── */
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

// 화면(미리보기·점검 결과 카드)에서 style_json이 비어 있을 때 쓰는 기본값.
// route.ts POST의 buildStyleJson()이 쓰는 fallback 리터럴과는 별개다 —
// 저건 "pptx에서 못 뽑았을 때 DB에 무엇을 저장할지"이고, 이건 "화면에
// 무엇을 보여줄지"라 관심사가 다르다(값은 실질적으로 같다).
export const DEFAULT_STYLE: StyleJson = {
  headerColor: '#1B4332', accentColor: '#2D6A4F',
  sectionBgColor: '#E8F5E9', headerBgColor: '#F8FDF8',
  weekTitleColor: '#2D6A4F', weekBorderColor: '#2D6A4F',
  borderColor: '#ccc', fontFamily: "'Malgun Gothic', sans-serif",
  rawColors: [], rawFonts: [],
}

function extractHex(segment: string): string | null {
  const m = segment.match(/srgbClr[^>]*val="([0-9A-Fa-f]{6})"/)
  if (m) return m[1].toUpperCase()
  const s = segment.match(/sysClr[^>]*lastClr="([0-9A-Fa-f]{6})"/)
  return s ? s[1].toUpperCase() : null
}

export function parseThemeXml(xml: string): { colors: Record<string, string>; fonts: string[] } {
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

export function buildStyleJson(colors: Record<string, string>, fonts: string[]): StyleJson {
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

/* ── 이름표 검증 ── */
export const REQUIRED_NAMES = ['MENU_TABLE', 'ALLERGY_BOX', 'ORIGIN_BOX', 'MATERIAL_BOX'] as const

export interface SlideValidation {
  slide: string
  valid: boolean
  names_found: Record<string, boolean>
  missing: string[]
}

export interface TemplateValidation {
  valid: boolean
  slide_count: number
  slides: SlideValidation[]
  summary: string
}

// 파이썬 find_shape_by_name과 동일 기준: cNvPr name에서 4개 이름표 확인
export function checkNamesInSlide(slideXml: string): Record<string, boolean> {
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

export async function validateTemplateZip(zip: JSZip): Promise<TemplateValidation> {
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
