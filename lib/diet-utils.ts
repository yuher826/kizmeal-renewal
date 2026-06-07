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
