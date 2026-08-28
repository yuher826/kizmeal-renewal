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

/* ── 구조 분석 ("양식 점검 결과" 화면용) ──
   python-pptx가 아니라 JSZip으로 읽은 XML 문자열을 정규식으로 훑는다.
   DOMParser는 브라우저 전용 API라 서버에서 못 돌기 때문에 안 쓴다 —
   위 checkNamesInSlide/parseThemeXml과 같은 방식을 그대로 따른 것뿐,
   새로운 제약이 아니다. */

const DAY_LABELS = ['월', '화', '수', '목', '금']

interface EmuBox {
  x: number
  y: number
  cx: number
  cy: number
}

export interface WideImageInfo {
  widthEmu: number
  leftEmu: number
  topEmu: number
  // 표 왼쪽 기준 "일(day)" 단위 위치 — 1일폭 = 표폭/5
  dayOffset: number
  dayWidthCount: number
  // 표 세로 범위를 5등분해 계산한 근사 주차(1~5). 실제 주 경계(행 높이
  // 합)와는 다를 수 있는 근사치 — "약 N주차"로만 쓸 것.
  weekIndexApprox: number
}

export interface SlideStructure {
  slide: string
  rowCount: number | null
  namesFound: Record<string, boolean>
  missing: string[]
  tableWidthEmu: number | null
  tableLeftEmu: number | null
  wideImages: WideImageInfo[]
}

export interface TemplateAnalysis {
  slideCount: number
  slides: SlideStructure[]
}

// <p:graphicFrame> 안 표의 위치·크기. 표는 a:xfrm이 아니라 p:xfrm을
// 직접 자식으로 둔다(도형·그림의 a:xfrm과 태그 자체가 다름).
function findTableBox(graphicFrameXml: string): EmuBox | null {
  const xfrm = graphicFrameXml.match(/<p:xfrm[^>]*>([\s\S]*?)<\/p:xfrm>/)
  if (!xfrm) return null
  const off = xfrm[1].match(/<a:off x="(-?\d+)" y="(-?\d+)"\/?>/)
  const ext = xfrm[1].match(/<a:ext cx="(-?\d+)" cy="(-?\d+)"\/?>/)
  if (!off || !ext) return null
  return { x: Number(off[1]), y: Number(off[2]), cx: Number(ext[1]), cy: Number(ext[2]) }
}

// <p:pic> 안 그림의 위치·크기. p:spPr 아래 a:xfrm에 들어있다.
function findPicBox(picXml: string): EmuBox | null {
  const xfrm = picXml.match(/<a:xfrm[^>]*>([\s\S]*?)<\/a:xfrm>/)
  if (!xfrm) return null
  const off = xfrm[1].match(/<a:off x="(-?\d+)" y="(-?\d+)"\/?>/)
  const ext = xfrm[1].match(/<a:ext cx="(-?\d+)" cy="(-?\d+)"\/?>/)
  if (!off || !ext) return null
  return { x: Number(off[1]), y: Number(off[2]), cx: Number(ext[1]), cy: Number(ext[2]) }
}

/**
 * pptx 슬라이드 하나에서 구조를 뽑는다 — 표 행 수, 이름표 4개, 표 폭
 * 대비 80% 이상인 가로 그림 목록(위치·폭만, 의미는 판정하지 않는다).
 * ★그룹(p:grpSp) 안 도형의 좌표는 슬라이드 절대좌표가 아니라 그룹 내부
 *   좌표계다(HANDOFF 2026-08-28 실측 — 알레르기 박스가 이 함정에 걸린
 *   사례). 방학·공휴일 그림은 실측상 전부 그룹 밖 최상위 p:pic이라 이
 *   함수는 그룹 안까지는 내려가지 않는다 — 그룹 안에 있는 그림이면
 *   좌표 계산이 틀어진다.
 */
function analyzeSlide(slideXml: string, slideName: string): SlideStructure {
  const namesFound = checkNamesInSlide(slideXml)
  const missing = REQUIRED_NAMES.filter((n) => !namesFound[n])

  let rowCount: number | null = null
  let tableBox: EmuBox | null = null
  const frameMatch = slideXml.match(/<p:graphicFrame>[\s\S]*?<\/p:graphicFrame>/)
  if (frameMatch && frameMatch[0].includes('<a:tbl>')) {
    rowCount = Array.from(frameMatch[0].matchAll(/<a:tr\b/g)).length
    tableBox = findTableBox(frameMatch[0])
  }

  const wideImages: WideImageInfo[] = []
  if (tableBox) {
    const dayWidth = tableBox.cx / 5
    for (const block of Array.from(slideXml.matchAll(/<p:pic>[\s\S]*?<\/p:pic>/g))) {
      const picBox = findPicBox(block[0])
      if (!picBox) continue
      if (picBox.cx < tableBox.cx * 0.8) continue // 80% 미만은 "큰 가로 그림"이 아님

      const weekIndexApprox = Math.min(5, Math.max(1,
        Math.ceil(((picBox.y - tableBox.y) / tableBox.cy) * 5) || 1,
      ))
      wideImages.push({
        widthEmu: picBox.cx,
        leftEmu: picBox.x,
        topEmu: picBox.y,
        dayOffset: (picBox.x - tableBox.x) / dayWidth,
        dayWidthCount: picBox.cx / dayWidth,
        weekIndexApprox,
      })
    }
  }

  return {
    slide: slideName,
    rowCount,
    namesFound,
    missing,
    tableWidthEmu: tableBox?.cx ?? null,
    tableLeftEmu: tableBox?.x ?? null,
    wideImages,
  }
}

export async function analyzeTemplate(zip: JSZip): Promise<TemplateAnalysis> {
  const slideFiles = zip.file(/^ppt\/slides\/slide\d+\.xml$/)
  const slides: SlideStructure[] = []
  if (slideFiles) {
    for (const f of slideFiles) {
      const xml = await f.async('string')
      slides.push(analyzeSlide(xml, f.name.split('/').pop() ?? f.name))
    }
  }
  return { slideCount: slides.length, slides }
}

// 가로 그림 하나를 "가로 그림 1개 (약 4주차 위치, 월~금 폭)" 형태의
// 사실 기술 문장으로 바꾼다. 요일 폭은 반올림한 근사치라 실제 크롭
// 비율(영양사 수작업 오차로 19.71% 등 제각각)과는 다를 수 있다.
// ★방학/추석/장식 같은 의미는 여기서 판정하지 않는다 — 그림 모양만
//   으로는 구분할 수 없다는 게 실측으로 확인됐다(9월 오판 사례).
export function describeWideImage(img: WideImageInfo): string {
  const startIdx = Math.min(4, Math.max(0, Math.round(img.dayOffset)))
  const spanCount = Math.min(5 - startIdx, Math.max(1, Math.round(img.dayWidthCount)))
  const endIdx = startIdx + spanCount - 1
  const dayLabel = spanCount >= 5
    ? '월~금'
    : startIdx === endIdx
      ? DAY_LABELS[startIdx]
      : `${DAY_LABELS[startIdx]}~${DAY_LABELS[endIdx]}`
  return `가로 그림 1개 (약 ${img.weekIndexApprox}주차 위치, ${dayLabel} 폭)`
}
