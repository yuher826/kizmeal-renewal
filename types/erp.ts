import type { LucideIcon } from 'lucide-react'

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
