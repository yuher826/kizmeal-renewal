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
  | 'nutritionist'
  | 'admin'

export interface ErpUser {
  id: string
  email: string
  name: string
  role: ErpRole
}

export interface ErpMenuItem {
  label: string
  href: string
  icon: LucideIcon
  disabled?: boolean
  allowedRoles?: ErpRole[]
}

export interface ErpNavGroup {
  title: string
  items: ErpMenuItem[]
}
