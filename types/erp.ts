import type { LucideIcon } from 'lucide-react'

export interface BranchAccountInfo {
  exists: boolean
  email: string | null
  kos_id: string | null
  status: 'pending' | 'active' | 'inactive' | null
  last_login_at: string | null
  created_at: string | null
  auth_user_id: string | null
}

export type ErpRole =
  | 'super_admin'
  | 'manager'
  | 'director'
  | 'nutritionist_ck'
  | 'nutritionist_consignment'
  | 'staff'
  | 'admin'

export interface ErpUser {
  id: string
  auth_id: string
  email: string
  name: string
  role: ErpRole
  access_scope: string | null
  is_active: boolean | null
  can_manage_templates?: boolean | null
  can_handle_cs?: boolean | null
  can_write_notices?: boolean | null
}

export interface ErpMenuItem {
  label: string
  href: string
  icon: LucideIcon
  disabled?: boolean
}

export interface ErpNavGroup {
  title: string
  items: ErpMenuItem[]
}
