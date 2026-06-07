import {
  DayMenuInput, MonthlyMenuData,
  ValidationError, MonthlyValidationResult,
} from './types'

// 2026년 공휴일
const HOLIDAYS_2026: Record<string, string> = {
  '2026-01-01': '신정',
  '2026-02-17': '설날연휴',
  '2026-02-18': '설날',
  '2026-02-19': '설날연휴',
  '2026-03-01': '삼일절',
  '2026-05-05': '어린이날',
  '2026-05-25': '부처님오신날',
  '2026-06-06': '현충일',
  '2026-08-15': '광복절',
  '2026-09-24': '추석연휴',
  '2026-09-25': '추석',
  '2026-09-26': '추석연휴',
  '2026-10-03': '개천절',
  '2026-10-09': '한글날',
  '2026-12-25': '크리스마스',
}

// 해당 월 영업일 목록 (주말+공휴일 제외)
export function getBusinessDays(year: number, month: number): string[] {
  const days: string[] = []
  const daysInMonth = new Date(year, month, 0).getDate()
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month - 1, d)
    const dow = date.getDay()
    if (dow === 0 || dow === 6) continue
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    if (HOLIDAYS_2026[dateStr]) continue
    days.push(dateStr)
  }
  return days
}

const INVALID_CHARS = /[<>"'\\]/
const MAX_MENU_LEN = 22

interface BranchSnackConfig {
  snack_am?: boolean
  snack_pm?: boolean
  snack_care?: boolean
}

// 하루치 검증
export function validateDay(
  day: DayMenuInput,
  branchProfile?: BranchSnackConfig,
): ValidationError[] {
  const errors: ValidationError[] = []
  const d = day.date

  if (day.is_holiday || day.is_self_closed) return []

  // V01: 밥 필수
  if (!day.rice.value.trim())
    errors.push({ code: 'V01', date: d, field: 'rice', message: '밥을 입력해주세요' })

  // V02: 반찬 최소 2개
  const sides = [day.side1, day.side2, day.side3].filter(s => s?.value?.trim())
  if (sides.length < 2)
    errors.push({ code: 'V02', date: d, field: 'side', message: `반찬 최소 2개 필요 (현재 ${sides.length}개)` })

  // V03: 국 (is_empty 허용)
  if (!day.soup.is_empty && !day.soup.value.trim())
    errors.push({ code: 'V03', date: d, field: 'soup', message: '국/찌개 입력 또는 [국없음] 체크' })

  // V04: 오전간식
  if (branchProfile?.snack_am !== false && !day.snack_am.value.trim())
    errors.push({ code: 'V04', date: d, field: 'snack_am', message: '오전간식을 입력해주세요' })

  // V05: 오후간식
  if (branchProfile?.snack_pm !== false && !day.snack_pm.value.trim())
    errors.push({ code: 'V05', date: d, field: 'snack_pm', message: '오후간식을 입력해주세요' })

  // V06: 알레르기 번호 범위 (1~19)
  const allAllergens = [
    ...day.rice.allergens, ...day.soup.allergens,
    ...day.side1.allergens, ...(day.side2?.allergens ?? []),
    ...(day.side3?.allergens ?? []), ...day.kimchi.allergens,
    ...day.snack_am.allergens, ...day.snack_pm.allergens,
  ]
  if (allAllergens.some(n => n < 1 || n > 19))
    errors.push({ code: 'V06', date: d, message: '알레르기 번호는 1~19만 가능합니다' })

  // V07: 메뉴명 글자수 제한
  const menuItems = [day.rice, day.soup, day.side1, day.side2, day.side3, day.kimchi].filter(Boolean)
  const longMenus = menuItems.filter(m => m!.value.length > MAX_MENU_LEN)
  if (longMenus.length > 0)
    errors.push({ code: 'V07', date: d, message: `메뉴명 ${MAX_MENU_LEN}자 초과 (PPTX 셀 넘침 방지)` })

  // V08: 특수문자 제한
  const allValues = [
    day.rice.value, day.soup.value,
    day.side1.value, day.side2?.value ?? '', day.side3?.value ?? '',
    day.kimchi.value, day.snack_am.value, day.snack_pm.value,
  ]
  if (allValues.some(v => INVALID_CHARS.test(v)))
    errors.push({ code: 'V08', date: d, message: "특수문자 < > \" ' \\ 는 입력 불가합니다" })

  // V11: 소풍 시 도시락 메뉴 필수
  if (day.is_picnic && !day.picnic_menu?.trim())
    errors.push({ code: 'V11', date: d, field: 'picnic_menu', message: '소풍 체크 시 도시락 메뉴 입력 필요' })

  // V12: 칼로리 확인
  if (!day.calories || day.calories <= 0 || isNaN(day.calories))
    errors.push({ code: 'V12', date: d, field: 'calories', message: '칼로리를 입력해주세요' })

  return errors
}

// 월 전체 검증
export function validateMonth(
  data: MonthlyMenuData,
  branchProfile?: BranchSnackConfig,
): MonthlyValidationResult {
  const errors: ValidationError[] = []
  const warnings: string[] = []

  const businessDays = getBusinessDays(data.year, data.month)
  const inputDates = Object.keys(data.days)

  // V09: 영업일 미입력
  const missingDates = businessDays.filter(d => {
    const day = data.days[d]
    return !day || (!day.is_holiday && !day.is_self_closed && !day.rice?.value?.trim())
  })
  if (missingDates.length > 0)
    errors.push({
      code: 'V09',
      message: `미입력 날짜 ${missingDates.length}개: ${missingDates.slice(0, 3).join(', ')}${missingDates.length > 3 ? ' 외' : ''}`,
    })

  // V10: 중복 날짜
  const dateCounts: Record<string, number> = {}
  inputDates.forEach(d => { dateCounts[d] = (dateCounts[d] ?? 0) + 1 })
  const duplicates = Object.entries(dateCounts).filter(([, c]) => c > 1)
  if (duplicates.length > 0)
    errors.push({ code: 'V10', message: `중복 날짜: ${duplicates.map(([d]) => d).join(', ')}` })

  // V13: 날짜별 검증
  Object.values(data.days).forEach(day => {
    errors.push(...validateDay(day, branchProfile))
  })

  return { isValid: errors.length === 0, errors, warnings }
}
