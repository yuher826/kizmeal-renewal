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

/**
 * ⚠️ 이 역할 목록은 DB 정책에도 같은 값이 별도로 존재한다.
 *    정책: diet_review_items_admin_access
 *    파일: supabase/migrations/enable_rls_admins_diet_review_260826.sql
 *    여기를 고치면 정책도 같이 고쳐야 한다. 한쪽만 고치면
 *    service_role 경로에서는 멀쩡한데 anon 경로에서만 조용히 막힌다.
 *    (현재 앱은 service_role로만 접근하므로 즉시 티가 나지 않는다)
 */
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

/** 원 담당자 계정 관리(생성·이메일변경·비번초기화·초대재발송·계정정지·운영상태) 허용 역할 */
// ⚠️ ADMIN_CREATE_ROLES를 재사용하지 않는다 — 지금은 값이 같지만
//    관심사가 다르다(관리자 계정 생성 vs 원 담당자 계정 관리). 하나를
//    바꾸면 다른 하나까지 딸려 바뀌는 사고를 막기 위해 별도 상수로 둔다.
export const BRANCH_ACCOUNT_ROLES: string[] = [
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

/**
 * 템플릿 관리(업로드/활성화) 가능 여부.
 * ★role이 아니라 admins.can_manage_templates 플래그로 판단한다 — 템플릿
 *   담당은 "직무"가 아니라 "배정"이다. 영양사는 여러 명이지만 템플릿을
 *   올리는 담당자는 따로 있다. role 기반으로 막으면 영양사 계정이 늘어날
 *   때마다 권한이 자동으로 따라붙어 아무도 모르게 넓어진다.
 * super_admin은 담당자 부재(퇴사·휴가 등) 시 대체 경로로 항상 통과시킨다.
 */
export const canManageTemplates = (a: { role: string; can_manage_templates?: boolean | null }): boolean =>
  a.role === ROLES.SUPER_ADMIN || a.can_manage_templates === true

/**
 * 템플릿 삭제 가능 여부 — super_admin만.
 * ★DELETE를 이렇게 좁힌 것은 임시 조치다. 정식 해법은 soft delete
 *   (deleted_at 컬럼)이며, hard delete를 아무나(담당자 포함) 할 수 있게
 *   두면 과거 배포분을 재현할 방법이 없어진다. 별도 과제로 HANDOFF에 있음.
 */
export const canDeleteTemplate = (a: { role: string }): boolean =>
  a.role === ROLES.SUPER_ADMIN

/** 역할 → 한글 라벨 (공통) */
export const ROLE_LABEL: Record<string, string> = {
  super_admin:              '슈퍼관리자',
  manager:                  '매니저',
  director:                 '이사',
  nutritionist_ck:          '영양사 (직영)',
  nutritionist_consignment: '영양사 (위탁)',
  admin:                    '관리자',
}
