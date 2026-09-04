import { ROUTES } from '@/lib/routes'
import {
  UPLOAD_ROLES,
  REVIEW_ALLOWED_ROLES,
  BRANCH_PROFILE_CREATE_ROLES,
  canManageTemplates,
} from '@/lib/roles'

/**
 * ERP 페이지 접근 판정에 필요한 admin 최소 형태.
 * role 단독이 아닌 이유 — `/erp/diet/templates`는 role이 아니라
 * can_manage_templates 플래그로 열린다. 앞으로 플래그가 2개
 * (can_handle_cs, can_write_notices) 더 붙을 예정이라 admin 객체로 받는다.
 */
export type ErpAccessAdmin = {
  role: string
  can_manage_templates?: boolean | null
}

/**
 * 경로별 접근 허용 규칙. deny by default — 여기 없는 경로는 전원 차단된다.
 *
 * ⚠️ 상수 재사용은 /erp/upload, /erp/review, /erp/history,
 *    /erp/branches/new, /erp/diet/templates 다섯 개만 한다. 페이지가
 *    이미 그 상수를 쓰고 있어 따라가는 것이다. 나머지는 리터럴로 쓴다 —
 *    lib/roles.ts의 경고대로 관심사가 다른 곳에서 상수를 공유하면
 *    한쪽만 바꿀 때 다른 쪽이 조용히 따라 바뀐다.
 */
const RULES: Array<{ prefix: string; allow: (admin: ErpAccessAdmin) => boolean }> = [
  { prefix: '/erp/my-page', allow: () => true },
  { prefix: '/erp/diet/templates', allow: canManageTemplates },
  {
    prefix: '/erp/diet',
    allow: a => ['super_admin', 'manager', 'nutritionist_ck', 'nutritionist_consignment'].includes(a.role),
  },
  { prefix: '/erp/upload', allow: a => UPLOAD_ROLES.includes(a.role) },
  { prefix: '/erp/review', allow: a => REVIEW_ALLOWED_ROLES.includes(a.role) },
  { prefix: '/erp/history', allow: a => REVIEW_ALLOWED_ROLES.includes(a.role) },
  { prefix: '/erp/branches/new', allow: a => BRANCH_PROFILE_CREATE_ROLES.includes(a.role) },
  {
    prefix: '/erp/branches',
    allow: a => ['super_admin', 'manager', 'nutritionist_ck', 'nutritionist_consignment'].includes(a.role),
  },
  { prefix: '/erp/notices', allow: a => ['super_admin', 'manager', 'director'].includes(a.role) },
  { prefix: '/erp/inquiries', allow: a => ['super_admin', 'manager', 'director'].includes(a.role) },
  { prefix: '/erp/files', allow: a => ['super_admin', 'manager', 'director'].includes(a.role) },
  { prefix: '/erp/admins', allow: a => ['super_admin', 'manager'].includes(a.role) },
  { prefix: '/erp/brands', allow: a => ['super_admin', 'manager'].includes(a.role) },
  { prefix: '/erp/stats', allow: a => ['super_admin', 'manager', 'director'].includes(a.role) },
]

/** 착지 경로가 항상 매트릭스에서 파생되도록, 별도 목록을 두지 않는다 */
const LANDING_PREFERENCE: Record<string, string[]> = {
  super_admin: [ROUTES.ERP_INQUIRIES, ROUTES.ERP_DIET, ROUTES.ERP_MY_PAGE],
  manager: [ROUTES.ERP_INQUIRIES, ROUTES.ERP_DIET, ROUTES.ERP_MY_PAGE],
  director: [ROUTES.ERP_INQUIRIES, ROUTES.ERP_REVIEW, ROUTES.ERP_MY_PAGE],
  nutritionist_ck: [ROUTES.ERP_DIET, ROUTES.ERP_MY_PAGE],
  nutritionist_consignment: [ROUTES.ERP_DIET, ROUTES.ERP_MY_PAGE],
}

/**
 * 최장 prefix 매칭이 필수인 이유 — 단순 startsWith면 /erp/diet가
 * /erp/diet/templates를 삼켜 영양사 전원이 템플릿 관리에 들어간다.
 * /erp/branches와 /erp/branches/new도 같은 함정이다.
 */
export function canAccessErpPage(admin: ErpAccessAdmin, pathname: string): boolean {
  const matched = RULES.filter(
    r => pathname === r.prefix || pathname.startsWith(`${r.prefix}/`)
  )
  if (matched.length === 0) return false
  const longest = matched.reduce((a, b) => (b.prefix.length > a.prefix.length ? b : a))
  return longest.allow(admin)
}

/**
 * /erp/my-page가 전 역할 허용이라 최후 폴백이 항상 성립한다. 착지가
 * 허용 목록 밖으로 나가는 것이 구조적으로 불가능해지므로 별도의
 * 빌드 타임 검증 스크립트는 두지 않는다.
 */
export function landingPathFor(admin: ErpAccessAdmin): string {
  return (
    (LANDING_PREFERENCE[admin.role] ?? []).find(p => canAccessErpPage(admin, p)) ??
    ROUTES.ERP_MY_PAGE
  )
}
