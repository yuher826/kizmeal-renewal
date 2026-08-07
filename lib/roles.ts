/** 역할(role) 관련 상수 및 유틸 함수 중앙 관리 */

/** 역할 문자열 상수 (리터럴 중앙 관리) */
export const ROLES = {
  SUPER_ADMIN:              'super_admin',
  MANAGER:                  'manager',
  DIRECTOR:                 'director',
  NUTRITIONIST_CK:          'nutritionist_ck',
  NUTRITIONIST_CONSIGNMENT: 'nutritionist_consignment',
} as const

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

/** 일반 배포 허용 역할 (CK 영양사만) */
export const DEPLOY_ROLES: string[] = ['nutritionist_ck']

/** 비상 배포 허용 역할 (관리자급) */
export const EMERGENCY_DEPLOY_ROLES: string[] = ['super_admin', 'manager']

/** 수정 제출(resubmit) 허용 역할 */
export const RESUBMIT_ROLES: string[] = [
  'super_admin',
  ...NUTRITIONIST_ROLES,
]

/** 관리자 계정 "생성" 가능 역할 (요청자 기준) */
export const ADMIN_CREATE_ROLES: string[] = [
  ROLES.SUPER_ADMIN,
  ROLES.MANAGER,
]

/** 매니저가 생성할 수 있는 하위 역할 (super_admin·manager 제외한 나머지 전부) */
export const MANAGER_CREATABLE_ROLES: string[] = Object.values(ROLES).filter(
  r => r !== ROLES.SUPER_ADMIN && r !== ROLES.MANAGER
)

/** 매니저가 생성하는 계정에 강제되는 접근범위 */
export const MANAGER_FORCED_SCOPE = 'erp_only'

/** 영양사 여부 체크 */
export const isNutritionist = (role: string): boolean =>
  NUTRITIONIST_ROLES.includes(role)

/** 역할 → 한글 라벨 (공통) */
export const ROLE_LABEL: Record<string, string> = {
  super_admin:              '슈퍼관리자',
  manager:                  '매니저',
  director:                 '이사',
  nutritionist_ck:          '영양사 (직영)',
  nutritionist_consignment: '영양사 (위탁)',
  admin:                    '관리자',
}
