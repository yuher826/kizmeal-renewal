/** 역할(role) 관련 상수 및 유틸 함수 중앙 관리 */

/** 영양사 역할 목록 (CK 직계약 + 위탁) */
export const NUTRITIONIST_ROLES: string[] = [
  'nutritionist_ck',
  'nutritionist_consignment',
]

/** 엑셀 업로드 허용 역할 */
export const UPLOAD_ROLES: string[] = [
  'super_admin',
  'manager',
  ...NUTRITIONIST_ROLES,
]

/** 검토 페이지 조회 허용 역할 */
export const REVIEW_ALLOWED_ROLES: string[] = [
  'super_admin',
  'manager',
  'director',
  ...NUTRITIONIST_ROLES,
]

/** 배포 허용 역할 */
export const DEPLOY_ROLES: string[] = [
  'super_admin',
  ...NUTRITIONIST_ROLES,
]

/** 수정 제출(resubmit) 허용 역할 */
export const RESUBMIT_ROLES: string[] = [
  'super_admin',
  ...NUTRITIONIST_ROLES,
]

/** 영양사 여부 체크 */
export const isNutritionist = (role: string): boolean =>
  NUTRITIONIST_ROLES.includes(role)
