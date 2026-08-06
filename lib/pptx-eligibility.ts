/**
 * pptx-eligibility.ts — 원(branch) 배포 자격 필터 (코드 레벨)
 *
 * ★ 설계 제약
 *   contract_type 필터링은 반드시 "DB에서 가져온 뒤 코드 레벨에서" 수행한다.
 *   Supabase 쿼리(.neq/.eq 등)에 contract_type 조건을 넣지 않는다.
 *   이유: PostgREST 의 neq.temporary 는 SQL 3값 논리 때문에 contract_type IS NULL 행을
 *         결과에서 제외시킨다. 현재 branch_profiles 는 contract_type 이 NULL 다수 /
 *         temporary 소수 이므로, DB 필터로 처리하면 NULL 원이 전부 배포에서 사라진다.
 *   따라서 기존 쿼리는 그대로 두고, 여기서 한 겹 더 거른다.
 *
 *   자격 규칙: contract_type === 'temporary' 인 원만 제외.
 *             null / undefined / 빈 문자열 / 'permanent' 등은 전부 통과(자격 있음).
 */

/** 배포에서 제외할 계약유형 값 (임시 계약 원) */
export const EXCLUDED_CONTRACT_TYPE = 'temporary'

/** 자격 판정에 필요한 최소 형태 (contract_type 만 있으면 됨) */
export type EligibilityProfile = {
  contract_type?: string | null
  short_code?:    string | null
  display_name?:  string | null
}

/**
 * 단일 원 프로파일이 PPTX 생성·배포 대상인지 판정한다.
 * - contract_type === 'temporary' → false (제외)
 * - 그 외(null / undefined / 빈 문자열 / 'permanent' 등) → true (자격 있음)
 */
export function isEligibleForPptx(profile: EligibilityProfile): boolean {
  return profile?.contract_type !== EXCLUDED_CONTRACT_TYPE
}

/**
 * 프로파일 리스트에서 배포 자격이 있는 원만 남긴다.
 * - 제외된 원은 short_code / display_name 을 한글 로그로 출력한다.
 * - 결과가 0개면 (안전장치) 명확한 한글 에러와 함께 throw 한다.
 *   → 전멸(전체 원이 사라지는) 상황을 조용히 통과시키지 않기 위함.
 */
export function filterEligibleBranches<T extends EligibilityProfile>(profiles: T[]): T[] {
  const eligible: T[] = []
  const excluded: T[] = []

  for (const p of profiles) {
    if (isEligibleForPptx(p)) eligible.push(p)
    else excluded.push(p)
  }

  if (excluded.length > 0) {
    console.log(`[배포 제외] 임시 계약(temporary) 원 ${excluded.length}개 제외:`)
    for (const p of excluded) {
      const shortCode   = (p.short_code   ?? '').trim() || '(short_code 없음)'
      const displayName = (p.display_name ?? '').trim() || '(display_name 없음)'
      console.log(`  - ${shortCode} / ${displayName}`)
    }
  }

  if (eligible.length === 0) {
    throw new Error(
      `배포 자격이 있는 원이 0개입니다. ` +
      `(전체 ${profiles.length}개, 임시계약 제외 ${excluded.length}개) — ` +
      `필터 조건 또는 원본 데이터를 확인하세요. 배포를 중단합니다.`,
    )
  }

  return eligible
}
