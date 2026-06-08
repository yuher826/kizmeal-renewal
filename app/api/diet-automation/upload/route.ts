import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { createClient } from '@/lib/supabase-server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

// ── 화이트리스트 ───────────────────────────────────────────────────────
const VALID_BRANCHES = [
  '목동E','노원E','쌍문E','성북E','송파E','강동E',
  '일산P','정발P','송도P','송파P','분당P','수지P','수지P별관',
  '영통P','중계P','목동P','광명P','덕양P','위례P','하남P',
  '광교P','대치P','운정P','동탄P','강동P',
  '분당R','서초R','평촌R','강동R','동작R','강남R','성동R',
  '분당MB','강남MB','광명SLP','광교SLP',
  '미사알티','송파알티','위례알티','광교알티',
  '엘란','럭스','하남랜','송파랜','잉파','KPI','프랜시스',
  '찰리1호','찰리2호',
]
const BRAND_CODES = ['P','E','R','SLP','MB','알티']

const REQUIRED_SHEETS = [
  '1주차','2주차','3주차','4주차','5주차',
  '🍱 도시락·대체식 요청','📋 원별 참조표',
]

// ── 검증 정규식 ────────────────────────────────────────────────────────
const LUNCH_NUTRITION_RE = /\d+[Kk][Cc][Aa][Ll]\(탄\d+단\d+지\d+\)/
const SNACK_NUTRITION_RE = /\d+[Kk][Cc][Aa][Ll]/
const DAY_KR = ['일','월','화','수','목','금','토']

// ── 타입 ───────────────────────────────────────────────────────────────
type DayLunch = {
  bap: string; guk: string
  banchan1: string; banchan2: string; banchan3: string
  banchan4: string; banchan5: string
  nutrition: string; special: string; exception: string
}
type Snack = { menu: string; nutrition: string; special: string; exception: string }
type CareSnack = { menu: string; nutrition: string }

type ExcelDayData = {
  date: string
  is_holiday: boolean
  is_birthday: boolean
  lunch: DayLunch
  morning_snack: Snack
  birthday_snack: string
  afternoon_snack: Snack
  care_snack: CareSnack
}

type ParsedWeek = {
  week_num: number
  is_skipped: boolean
  days: ExcelDayData[]
}

type DosirakItem = {
  date: string
  branch_name: string
  type: string
  menu: string
  note: string
}

type ValidationIssue = { location: string; message: string; suggestion: string }

// ── 빈 구조체 ─────────────────────────────────────────────────────────
function emptyDay(date: string, is_holiday: boolean, is_birthday: boolean): ExcelDayData {
  return {
    date, is_holiday, is_birthday,
    lunch: { bap:'', guk:'', banchan1:'', banchan2:'', banchan3:'', banchan4:'', banchan5:'', nutrition:'', special:'', exception:'' },
    morning_snack: { menu:'', nutrition:'', special:'', exception:'' },
    birthday_snack: '',
    afternoon_snack: { menu:'', nutrition:'', special:'', exception:'' },
    care_snack: { menu:'', nutrition:'' },
  }
}

// ── Excel serial → day number ─────────────────────────────────────────
function excelSerialToDay(serial: number): number {
  const jsDate = new Date((serial - 25569) * 86400 * 1000)
  return jsDate.getUTCDate()
}

// ── 날짜 헤더 파싱 ────────────────────────────────────────────────────
function parseDateCell(
  raw: unknown,
  year: number,
  month: number,
): { date: string; is_holiday: boolean; is_birthday: boolean } | null {
  let str: string
  if (typeof raw === 'number') {
    const day = excelSerialToDay(raw)
    str = `${month}/${day}`
  } else {
    str = String(raw ?? '').trim()
  }

  if (!str || str.includes('해당없음')) return null

  const is_holiday = str.includes('공휴일')
  const is_birthday = str.includes('🎂')

  // "6/2" 또는 "6월2일" 형식
  const match = str.match(/(\d+)[\/월](\d+)/)
  if (match) {
    const day = parseInt(match[2])
    return {
      date: `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`,
      is_holiday,
      is_birthday,
    }
  }
  return null
}

// ── 주차 시트 파싱 ────────────────────────────────────────────────────
function parseWeekSheet(
  sheet: XLSX.WorkSheet,
  weekNum: number,
  year: number,
  month: number,
): ParsedWeek {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' })
  if (rows.length < 3) return { week_num: weekNum, is_skipped: true, days: [] }

  const dateRow = rows[2] as unknown[]
  const rawDates = [dateRow[1], dateRow[2], dateRow[3], dateRow[4], dateRow[5]]

  // 5주차 해당없음 판단 (B열 첫 번째 셀)
  if (String(rawDates[0] ?? '').trim().includes('해당없음')) {
    return { week_num: weekNum, is_skipped: true, days: [] }
  }

  const dateInfos = rawDates.map(r => parseDateCell(r, year, month))

  // 날짜별 빈 구조체 초기화
  const dayMap: Record<string, ExcelDayData> = {}
  dateInfos.forEach(d => {
    if (d) dayMap[d.date] = emptyDay(d.date, d.is_holiday, d.is_birthday)
  })

  // 데이터 행 파싱 (row 3~)
  type Section = 'lunch' | 'morning_snack' | 'afternoon_snack' | 'care_snack'
  let section: Section = 'lunch'

  for (let ri = 3; ri < rows.length; ri++) {
    const row = rows[ri] as unknown[]
    const label = String(row[0] ?? '').trim()
    if (!label) continue

    // 섹션 업데이트
    if (label === '밥') section = 'lunch'
    else if (label === '오전간식') section = 'morning_snack'
    else if (label === '오후간식') section = 'afternoon_snack'
    else if (label === '돌봄간식') section = 'care_snack'

    for (let col = 0; col < 5; col++) {
      const info = dateInfos[col]
      if (!info) continue
      const day = dayMap[info.date]
      if (!day) continue
      const val = String(row[col + 1] ?? '').trim()

      switch (label) {
        case '밥':       day.lunch.bap      = val; break
        case '국':       day.lunch.guk      = val; break
        case '반찬1':    day.lunch.banchan1 = val; break
        case '반찬2':    day.lunch.banchan2 = val; break
        case '반찬3':    day.lunch.banchan3 = val; break
        case '반찬4':    day.lunch.banchan4 = val; break
        case '반찬5':    day.lunch.banchan5 = val; break
        case '영양구성':
          if      (section === 'lunch')          day.lunch.nutrition           = val
          else if (section === 'morning_snack')  day.morning_snack.nutrition   = val
          else if (section === 'afternoon_snack')day.afternoon_snack.nutrition = val
          else if (section === 'care_snack')     day.care_snack.nutrition      = val
          break
        case '원별특이사항':
          if      (section === 'lunch')          day.lunch.special           = val
          else if (section === 'morning_snack')  day.morning_snack.special   = val
          else if (section === 'afternoon_snack')day.afternoon_snack.special = val
          break
        case '예외규칙':
          if      (section === 'lunch')          day.lunch.exception           = val
          else if (section === 'morning_snack')  day.morning_snack.exception   = val
          else if (section === 'afternoon_snack')day.afternoon_snack.exception = val
          break
        case '생일간식':  day.birthday_snack        = val; break
        case '오전간식':  day.morning_snack.menu    = val; break
        case '오후간식':  day.afternoon_snack.menu  = val; break
        case '돌봄간식':  day.care_snack.menu       = val; break
      }
    }
  }

  return { week_num: weekNum, is_skipped: false, days: Object.values(dayMap) }
}

// ── 도시락 시트 파싱 ──────────────────────────────────────────────────
function parseDosirakSheet(sheet: XLSX.WorkSheet): DosirakItem[] {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' })
  const items: DosirakItem[] = []
  for (let i = 3; i < rows.length; i++) {
    const row = rows[i] as unknown[]
    const date       = String(row[0] ?? '').trim()
    const branchName = String(row[1] ?? '').trim()
    const type       = String(row[2] ?? '').trim()
    const menu       = String(row[3] ?? '').trim()
    const note       = String(row[4] ?? '').trim()
    if (!date && !branchName && !menu) continue
    items.push({ date, branch_name: branchName, type, menu, note })
  }
  return items
}

// ── 대괄호 내용 추출 ──────────────────────────────────────────────────
function extractBrackets(value: string): string[] {
  const results: string[] = []
  const re = /\[([^\]]+)\]/g
  let m: RegExpExecArray | null
  while ((m = re.exec(value)) !== null) results.push(m[1])
  return results
}

// ── 원명 유사 추천 ────────────────────────────────────────────────────
function suggestBranchName(input: string): string {
  const byInclusion = VALID_BRANCHES.find(b =>
    b.includes(input) || (input.length > 1 && b.includes(input.slice(0, -1)))
  )
  if (byInclusion) return `혹시 [${byInclusion}] 인가요?`
  const byFirstChar = VALID_BRANCHES.find(b => b[0] === input[0])
  if (byFirstChar) return `혹시 [${byFirstChar}] 인가요?`
  return '원별 참조표에서 정확한 원명 확인 바랍니다'
}

// ── 도시락 날짜 정규화 (N/N → YYYY-MM-DD) ─────────────────────────────
function normalizeDosirakDate(raw: string, year: number): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  const m = raw.match(/(\d+)[\/월](\d+)/)
  if (m) {
    return `${year}-${String(parseInt(m[1])).padStart(2,'0')}-${String(parseInt(m[2])).padStart(2,'0')}`
  }
  return raw
}

// ── 10가지 검증 규칙 ──────────────────────────────────────────────────
function runValidations(
  weeks: ParsedWeek[],
  dosirak: DosirakItem[],
): { errors: ValidationIssue[]; warnings: ValidationIssue[] } {
  const errors: ValidationIssue[] = []
  const warnings: ValidationIssue[] = []

  for (const week of weeks) {
    if (week.is_skipped) continue
    const weekLabel = `${week.week_num}주차`

    for (const day of week.days) {
      const dt = new Date(day.date + 'T12:00:00')
      const dayName = `${weekLabel} ${DAY_KR[dt.getDay()]}요일`

      // ── 규칙5: 공휴일 중식 입력 금지 ─────────────────────────
      if (day.is_holiday) {
        const filled = [day.lunch.bap, day.lunch.guk, day.lunch.banchan1].some(v => v.trim())
        if (filled) {
          errors.push({
            location: `${dayName} (공휴일)`,
            message: '공휴일 열에 중식이 입력되어 있습니다',
            suggestion: '공휴일 열 중식(밥~영양구성)은 비워주세요',
          })
        }
        continue
      }

      // ── 규칙10: 밥 필수 ───────────────────────────────────────
      if (!day.lunch.bap.trim()) {
        errors.push({
          location: dayName,
          message: '밥이 입력되지 않았습니다',
          suggestion: '밥 행에 메뉴를 입력해주세요',
        })
      }

      // ── 규칙3: 알러지 원문자 범위 (①~⑲ = 0x2460~0x2472) ────
      // Enclosed Alphanumerics 범위(0x2460~0x24FF)만 검사 — 한글 등 일반 문자 스킵
      const allMenuText = [
        day.lunch.bap, day.lunch.guk,
        day.lunch.banchan1, day.lunch.banchan2, day.lunch.banchan3,
        day.lunch.banchan4, day.lunch.banchan5,
        day.morning_snack.menu, day.afternoon_snack.menu, day.care_snack.menu,
      ].join('')
      for (const char of allMenuText) {
        const code = char.charCodeAt(0)
        if (code >= 0x2460 && code <= 0x24FF && code >= 0x2473) { // ⑳ 이상 원문자
          errors.push({
            location: `${dayName} 메뉴`,
            message: `알러지 번호 범위 초과: '${char}' (⑳ 이상 사용 불가)`,
            suggestion: '알러지 번호는 ①~⑲ (1~19번)만 유효합니다',
          })
          break
        }
      }

      // ── 규칙4: 영양구성 형식 ──────────────────────────────────
      if (day.lunch.nutrition.trim() && !LUNCH_NUTRITION_RE.test(day.lunch.nutrition)) {
        errors.push({
          location: `${dayName} 중식 영양구성`,
          message: `형식 오류: "${day.lunch.nutrition}"`,
          suggestion: '예시: 466Kcal(탄59단16지23)',
        })
      }
      const snackPairs: [string, { nutrition: string }][] = [
        ['오전간식', day.morning_snack],
        ['오후간식', day.afternoon_snack],
        ['돌봄간식', day.care_snack],
      ]
      for (const [lbl, snack] of snackPairs) {
        if (snack.nutrition.trim() && !SNACK_NUTRITION_RE.test(snack.nutrition)) {
          errors.push({
            location: `${dayName} ${lbl} 영양구성`,
            message: `형식 오류: "${snack.nutrition}"`,
            suggestion: '예시: 130Kcal',
          })
        }
      }

      // ── 규칙1,2: 대괄호 형식 + 원명 유효성 ──────────────────
      const bracketFields = [
        { lbl: '중식 원별특이사항',    val: day.lunch.special },
        { lbl: '중식 예외규칙',        val: day.lunch.exception },
        { lbl: '오전간식 원별특이사항',val: day.morning_snack.special },
        { lbl: '오전간식 예외규칙',    val: day.morning_snack.exception },
        { lbl: '오후간식 원별특이사항',val: day.afternoon_snack.special },
        { lbl: '오후간식 예외규칙',    val: day.afternoon_snack.exception },
      ]
      for (const { lbl, val } of bracketFields) {
        if (!val.trim()) continue
        const opens  = (val.match(/\[/g) || []).length
        const closes = (val.match(/\]/g) || []).length
        if (opens !== closes) {
          errors.push({
            location: `${dayName} ${lbl}`,
            message: '대괄호 짝이 맞지 않습니다',
            suggestion: '[ 와 ] 개수를 확인해주세요',
          })
          continue
        }
        for (const content of extractBrackets(val)) {
          if (content === '후식과일') continue
          if (!content.includes('-')) {
            errors.push({
              location: `${dayName} ${lbl}`,
              message: `[${content}] 형식 오류: 대시(-)가 없습니다`,
              suggestion: '[원명-메뉴명] 또는 [원명-메뉴명X] 형식으로 입력',
            })
            continue
          }
          const namePart  = content.split('-')[0]
          const nameList  = namePart.split(',').map(n => n.trim()).filter(Boolean)
          for (const name of nameList) {
            if (!VALID_BRANCHES.includes(name) && !BRAND_CODES.includes(name)) {
              errors.push({
                location: `${dayName} ${lbl}`,
                message: `인식할 수 없는 원명: ${name}`,
                suggestion: suggestBranchName(name),
              })
            }
          }
        }
      }

      // ── 규칙6: 동탄P 오전간식 경고 (WARNING) ─────────────────
      if (
        day.morning_snack.special.includes('동탄P') &&
        !day.morning_snack.special.includes('유기농우유')
      ) {
        warnings.push({
          location: `${dayName} 오전간식 원별특이사항`,
          message: '동탄POLY 오전간식은 항상 유기농우유 고정입니다. 확인해주세요.',
          suggestion: '',
        })
      }

      // ── 규칙7: 생일간식 위치 — 비어있으면 스킵, 값 있을 때만 검증
      if (day.birthday_snack.trim()) {
        if (!day.is_birthday) {
          errors.push({
            location: `${dayName} 생일간식`,
            message: '생일간식이 입력되었으나 생일주 표시(🎂)가 없습니다',
            suggestion: '생일간식은 생일주 금요일(🎂 표시된 열)에만 입력 가능합니다',
          })
        }
      }
    }
  }

  // ── 규칙8: 5주차 경고 ─────────────────────────────────────────────
  const week5 = weeks.find(w => w.week_num === 5)
  if (week5 && !week5.is_skipped && week5.days.length > 0) {
    const allEmpty = week5.days.every(d => !d.lunch.bap.trim())
    if (allEmpty) {
      warnings.push({
        location: '5주차',
        message: '5주차 데이터가 비어있습니다',
        suggestion: "해당없는 달이면 날짜 헤더에 '해당없음'을 입력해주세요",
      })
    }
  }

  // ── 규칙9: 도시락 원명 + 메뉴 검증 ──────────────────────────────
  dosirak.forEach((item, idx) => {
    const rowLabel = `도시락 시트 ${idx + 4}행`
    if (item.branch_name && !VALID_BRANCHES.includes(item.branch_name)) {
      errors.push({
        location: rowLabel,
        message: `원명 '${item.branch_name}'을 인식할 수 없습니다`,
        suggestion: suggestBranchName(item.branch_name),
      })
    }
    if (item.branch_name && !item.menu.trim()) {
      errors.push({
        location: rowLabel,
        message: '메뉴 내용이 비어있습니다',
        suggestion: '메뉴 내용을 입력해주세요',
      })
    }
  })

  return { errors, warnings }
}

// ── 도시락 날짜를 이용한 주차 연결 ────────────────────────────────────
function countDosirakPerWeek(
  weeks: ParsedWeek[],
  dosirak: DosirakItem[],
  year: number,
): Map<number, number> {
  const counts = new Map<number, number>()
  weeks.forEach(w => counts.set(w.week_num, 0))

  for (const item of dosirak) {
    const normalized = normalizeDosirakDate(item.date, year)
    for (const week of weeks) {
      if (week.is_skipped) continue
      if (week.days.some(d => d.date === normalized)) {
        counts.set(week.week_num, (counts.get(week.week_num) ?? 0) + 1)
        break
      }
    }
  }
  return counts
}

// ── POST Handler ──────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  // 인증 확인
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: admin } = await supabase
    .from('admins').select('role').eq('auth_id', user.id).maybeSingle()

  const allowed = ['super_admin', 'manager', 'nutritionist_ck']
  if (!allowed.includes(admin?.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // FormData 파싱
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: '파일 형식 오류' }, { status: 400 })
  }

  const file  = formData.get('file')  as File | null
  const year  = parseInt(formData.get('year')  as string || '0')
  const month = parseInt(formData.get('month') as string || '0')

  if (!file || !year || !month) {
    return NextResponse.json({ error: '필수 파라미터 누락' }, { status: 400 })
  }

  // xlsx 파싱
  let workbook: XLSX.WorkBook
  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    workbook = XLSX.read(buffer, { type: 'buffer' })
  } catch {
    return NextResponse.json({
      success: false, year, month,
      summary: { total_weeks:0, total_days:0, holiday_days:0, dosirak_count:0 },
      weeks: [], errors: [{ location:'파일', message:'xlsx 파일을 읽을 수 없습니다', suggestion:'올바른 xlsx 파일인지 확인해주세요' }], warnings: [],
    })
  }

  // Step 1: 시트 구조 검증
  const sheetNames = workbook.SheetNames
  for (const required of REQUIRED_SHEETS) {
    if (!sheetNames.includes(required)) {
      return NextResponse.json({
        success: false, year, month,
        summary: { total_weeks:0, total_days:0, holiday_days:0, dosirak_count:0 },
        weeks: [],
        errors: [{
          location: '시트 구조',
          message: `'${required}' 시트가 없습니다`,
          suggestion: '올바른 기준폼 파일인지 확인해주세요',
        }],
        warnings: [],
      })
    }
  }

  // Step 2: 주차 시트 파싱
  const weeks: ParsedWeek[] = []
  for (let w = 1; w <= 5; w++) {
    weeks.push(parseWeekSheet(workbook.Sheets[`${w}주차`], w, year, month))
  }

  // Step 3: 도시락 시트 파싱
  const dosirak = parseDosirakSheet(workbook.Sheets['🍱 도시락·대체식 요청'])

  // Step 4: 검증
  const { errors, warnings } = runValidations(weeks, dosirak)

  // 요약 계산
  const dosirakPerWeek = countDosirakPerWeek(weeks, dosirak, year)
  const activeWeeks    = weeks.filter(w => !w.is_skipped)
  const totalDays      = activeWeeks.reduce((s, w) => s + w.days.filter(d => !d.is_holiday).length, 0)
  const holidayDays    = activeWeeks.reduce((s, w) => s + w.days.filter(d =>  d.is_holiday).length, 0)
  const weekSummaries  = weeks.map(w => ({
    week_num:      w.week_num,
    day_count:     w.days.filter(d => !d.is_holiday).length,
    dosirak_count: dosirakPerWeek.get(w.week_num) ?? 0,
    is_skipped:    w.is_skipped,
  }))

  const result = {
    success: errors.length === 0,
    year, month,
    summary: {
      total_weeks:   activeWeeks.length,
      total_days:    totalDays,
      holiday_days:  holidayDays,
      dosirak_count: dosirak.length,
    },
    weeks: weekSummaries,
    errors,
    warnings,
  }

  // Step 5: DB 저장 (오류 0건인 경우만)
  if (errors.length === 0) {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const url        = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const dbClient   = serviceKey ? createAdminClient(url, serviceKey) : supabase

    // 기존 데이터 삭제
    await dbClient
      .from('weekly_menus')
      .delete()
      .eq('year', year).eq('month', month).eq('diet_type', 'CK').is('branch_id', null)

    // 신규 삽입
    const { error: insertError } = await dbClient
      .from('weekly_menus')
      .insert({
        year,
        month,
        diet_type:  'CK',
        branch_id:  null,
        week_num:   null,
        status:     'draft',
        menu_data: {
          source:  'excel_upload',
          year,
          month,
          weeks:   weeks.reduce((acc, w) => { acc[w.week_num] = w; return acc }, {} as Record<number, ParsedWeek>),
          dosirak,
        },
        updated_at: new Date().toISOString(),
      })

    if (insertError) {
      console.error('DB insert error:', {
        code:    insertError.code,
        message: insertError.message,
        details: insertError.details,
        hint:    insertError.hint,
      })
      return NextResponse.json({
        ...result,
        success: false,
        errors: [{
          location:   'DB 저장',
          message:    insertError.message || 'DB 저장 오류',
          suggestion: '관리자에게 문의해주세요',
        }],
      })
    }
  }

  return NextResponse.json(result)
}
