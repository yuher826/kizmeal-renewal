export type InquiryStatus = 'pending' | 'in_progress' | 'resolved' | 'closed'
export type InquiryCategory = 'MEAL_COUNT' | 'ALLERGY' | 'DELIVERY' | 'MENU' | 'SCHEDULE' | 'PHOTO' | 'CONTRACT' | 'OTHER' | 'STAFF_MEAL' | 'HYGIENE'
export type SenderType = 'branch' | 'admin' | 'system'
export type Priority = 'low' | 'medium' | 'high' | 'urgent'
export type SlaStatus = 'ok' | 'warning' | 'exceeded'

export const CATEGORY_LABELS: Record<InquiryCategory, string> = {
  MEAL_COUNT: '식수 변경',
  ALLERGY: '알레르기',
  DELIVERY: '배송/납품 문제',
  MENU: '메뉴 컴플레인/요청',
  SCHEDULE: '일정 변경',
  PHOTO: '급식 사진',
  CONTRACT: '계약/서류',
  OTHER: '기타 문의',
  STAFF_MEAL: '교직원 급식 컴플레인',
  HYGIENE: '위생 민원',
}

export const CATEGORY_ICONS: Record<InquiryCategory, string> = {
  MEAL_COUNT: '🍽️',
  ALLERGY: '🌿',
  DELIVERY: '📦',
  MENU: '🍽️',
  SCHEDULE: '📅',
  PHOTO: '📸',
  CONTRACT: '📄',
  OTHER: '💬',
  STAFF_MEAL: '👨‍🍳',
  HYGIENE: '🧹',
}

export const CATEGORY_COLORS: Record<InquiryCategory, string> = {
  MEAL_COUNT: 'bg-green-100 text-green-800',
  ALLERGY: 'bg-emerald-100 text-emerald-800',
  DELIVERY: 'bg-blue-100 text-blue-800',
  MENU: 'bg-teal-100 text-teal-800',
  SCHEDULE: 'bg-purple-100 text-purple-800',
  PHOTO: 'bg-pink-100 text-pink-800',
  CONTRACT: 'bg-orange-100 text-orange-800',
  OTHER: 'bg-gray-100 text-gray-700',
  STAFF_MEAL: 'bg-amber-100 text-amber-800',
  HYGIENE: 'bg-red-100 text-red-800',
}

export const STATUS_LABELS: Record<InquiryStatus, string> = {
  pending: '대기중',
  in_progress: '처리중',
  resolved: '해결됨',
  closed: '종료',
}

export const STATUS_COLORS: Record<InquiryStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  in_progress: 'bg-blue-100 text-blue-800',
  resolved: 'bg-green-100 text-green-800',
  closed: 'bg-gray-100 text-gray-600',
}

export const PRIORITY_LABELS: Record<Priority, string> = {
  low: '낮음',
  medium: '보통',
  high: '높음',
  urgent: '긴급',
}

export const PRIORITY_COLORS: Record<Priority, string> = {
  low: 'bg-gray-100 text-gray-600',
  medium: 'bg-blue-50 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
}

export interface Brand {
  id: string
  name: string
  code: string
  logo_url?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export type BranchStatus = 'new' | 'active' | 'vacation' | 'expired' | 'inactive'
export type BranchType = 'franchise' | 'independent'

export interface Branch {
  id: string
  brand_id: string
  auth_id?: string
  kos_id: string // 키즈밀 자체 원코드 (KZM-001 형식)
  name: string
  owner_name?: string
  phone?: string
  email?: string
  address?: string
  region?: string
  tier?: string
  contract_start?: string
  contract_end?: string
  meal_count?: number
  is_active: boolean
  created_at: string
  updated_at: string
  brands?: Brand
  // Extended columns (added via branch_management.sql migration)
  branch_type?: BranchType
  status?: BranchStatus
  diet_type?: 'ck' | 'catering'
  meal_config?: Record<string, boolean>
  must_change_password?: boolean
  assigned_admin_id?: string
}

export interface BranchMember {
  id: string
  branch_id: string
  auth_id?: string
  name: string
  email: string
  role: string
  is_active: boolean
  invited_at?: string
  joined_at?: string
  created_at: string
  branches?: Branch
}

export interface Admin {
  id: string
  auth_id?: string
  name: string
  email: string
  role: string
  department?: string
  phone?: string
  is_active: boolean
  created_at: string
}

export interface SlaRule {
  id: string
  category: string
  response_hours: number
  warning_hours: number
  escalate_hours: number
  created_at: string
}

export interface Inquiry {
  id: string
  branch_id: string
  brand_id: string
  assigned_admin_id?: string
  title: string
  category: InquiryCategory
  status: InquiryStatus
  priority: Priority
  form_data?: Record<string, unknown>
  first_response_at?: string
  resolved_at?: string
  closed_at?: string
  last_message_at?: string
  unread_count_branch: number
  unread_count_admin: number
  created_at: string
  updated_at: string
  branches?: Branch
  admins?: Admin
  messages?: Message[]
}

export interface Message {
  id: string
  inquiry_id: string
  sender_id?: string
  sender_type: SenderType
  content: string
  is_internal: boolean
  is_read: boolean
  created_at: string
  message_attachments?: MessageAttachment[]
}

export interface MessageAttachment {
  id: string
  message_id: string
  file_name: string
  file_size: number
  file_type: string
  storage_path: string
  created_at: string
}

export interface InquiryNote {
  id: string
  inquiry_id: string
  admin_id: string
  content: string
  created_at: string
  admins?: Admin
}

export interface PhoneLog {
  id: string
  inquiry_id: string
  admin_id: string
  memo?: string
  duration_minutes?: number
  created_at: string
  admins?: Admin
}

export interface ReplyTemplate {
  id: string
  brand_id?: string
  category?: string
  title: string
  content: string
  usage_count: number
  created_by?: string
  created_at: string
}

export interface Notification {
  id: string
  recipient_auth_id?: string
  recipient_type?: string
  recipient_id?: string
  inquiry_id?: string
  type: string
  title: string
  body?: string
  content?: string
  is_read: boolean
  created_at: string
}

export interface FormFieldDefinition {
  id: string
  category: string
  field_key: string
  field_label: string
  field_type: 'text' | 'number' | 'date' | 'select' | 'checkbox' | 'textarea'
  options?: string[]
  is_required: boolean
  sort_order: number
}

export interface WeeklyReport {
  id: string
  week_start: string
  total_inquiries: number
  resolved_inquiries: number
  avg_response_hours?: number
  avg_satisfaction?: number
  category_stats?: Record<string, number>
  created_at: string
}
