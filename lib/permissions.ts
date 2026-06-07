export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  MANAGER: 'manager',
  NUTRITIONIST_CK: 'nutritionist_ck',
  NUTRITIONIST_CONSIGNMENT: 'nutritionist_consignment',
} as const

export type Role = typeof ROLES[keyof typeof ROLES]

export const PERMISSIONS = {
  MANAGE_BRANCHES:          ['super_admin', 'manager'],
  INPUT_CK_DIET:            ['super_admin', 'manager', 'nutritionist_ck'],
  INPUT_CONSIGNMENT_DIET:   ['super_admin', 'manager', 'nutritionist_consignment'],
  REVIEW_DIET:              ['super_admin', 'manager'],
  APPROVE_DIET:             ['super_admin', 'manager'],
  DEPLOY_DIET:              ['super_admin', 'manager'],
  CRUD_BRANCHES:            ['super_admin', 'manager'],
  VIEW_ALL_STATS:           ['super_admin', 'manager'],
} as const

export function hasPermission(
  role: Role,
  permission: keyof typeof PERMISSIONS
): boolean {
  return (PERMISSIONS[permission] as readonly string[]).includes(role)
}
