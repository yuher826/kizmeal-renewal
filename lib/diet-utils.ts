import { AllergenNum, ALLERGEN_CIRCLE } from './types'

// [1,5,12] → "①⑤⑫"
export function allergensToCircle(nums: AllergenNum[]): string {
  return [...nums].sort((a, b) => a - b).map(n => ALLERGEN_CIRCLE[n]).join('')
}

// 멸균우유 → 무항생제멸균우유 자동변환
export function autoConvertMilk(value: string): string {
  return value.replace(/멸균우유/g, '무항생제멸균우유')
}

// "초코브라우니[2], 멸균우유" → "초코브라우니, 무항생제멸균우유"
export function removeQuantityMark(value: string): string {
  return autoConvertMilk(value).replace(/\[\d+\]/g, '')
}

// 중식 메뉴 셀 텍스트 (value + 원문자)
export function formatMenuForPptx(value: string, allergens: AllergenNum[]): string {
  return `${removeQuantityMark(value)}${allergensToCircle(allergens)}`
}

// 오전/오후 간식 셀 텍스트 — 한 줄
// "삶은계란①, 유기농요구르트② 130Kcal"
export function formatSnackForPptx(
  value: string,
  allergens: AllergenNum[],
  calories: number,
): string {
  return `${removeQuantityMark(value)}${allergensToCircle(allergens)} ${calories}Kcal`
}

// 돌봄(저녁) 간식 셀 텍스트 — vertical tab 구분
export function formatCareSnackForPptx(
  value: string,
  allergens: AllergenNum[],
  calories: number,
): string {
  return `${removeQuantityMark(value)}${allergensToCircle(allergens)}\v ${calories}Kcal`
}

// 중식 칼로리 포맷: "466Kcal(탄59단16지23)"
export function formatLunchCalories(
  calories: number,
  carb: number,
  protein: number,
  fat: number,
): string {
  return `${calories}Kcal(탄${carb}단${protein}지${fat})`
}

// 그룹 약자 → 원 약자 배열 확장
export function expandGroupTarget(
  target: string,
  allBranches: { short_name: string; group: string; is_dongtan?: boolean }[],
  excludeTargets: string[] = [],
): string[] {
  const groupMap: Record<string, string> = {
    P: 'POLY', E: 'ECC', R: 'RISE', SLP: 'SLP', MB: 'MB',
  }
  if (groupMap[target]) {
    return allBranches
      .filter(b => b.group === groupMap[target])
      .filter(b => !b.is_dongtan)
      .filter(b => !excludeTargets.includes(b.short_name))
      .map(b => b.short_name)
  }
  if (target.includes('/')) return target.split('/').map(t => t.trim())
  return [target]
}

// 연도 드롭다운 선택지 — 작년 ~ 3년 후(총 5개)를 현재 연도 기준으로 계산.
// 연도 배열을 하드코딩하면 범위 끝을 지난 뒤 선택지가 사라져 코드를 고쳐야 한다.
// 작년을 남기는 건 지난 달 폼을 다시 만들 수 있어야 하기 때문.
// current(현재 선택값)가 범위 밖이면 목록에 끼워넣는다 — URL ?year=2020 처럼
// 범위를 벗어난 값이 들어오면 select에 일치하는 option이 없어 빈 선택으로 보이기 때문.
export function getYearOptions(current?: number): number[] {
  const base  = new Date().getFullYear()
  const years = Array.from({ length: 5 }, (_, i) => base - 1 + i)
  if (current && !years.includes(current)) {
    years.push(current)
    years.sort((a, b) => a - b)
  }
  return years
}
