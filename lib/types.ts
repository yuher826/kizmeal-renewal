export type InquiryStatus = 'pending' | 'in_progress' | 'resolved' | 'closed'
export type InquiryCategory = 'MEAL_COUNT' | 'ALLERGY' | 'DELIVERY' | 'MENU' | 'SCHEDULE' | 'PHOTO' | 'CONTRACT' | 'OTHER' | 'STAFF_MEAL' | 'HYGIENE' | 'COMPLAINT'
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
  COMPLAINT: '컴플레인',
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
  COMPLAINT: '😤',
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
  COMPLAINT: 'bg-red-100 text-red-800',
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

// ── 식단 프로파일 (meal_config JSONB) ──────────────────────────
export interface MealConfigSnack {
  오전: boolean
  오후: boolean
  방과후: boolean
  돌봄: boolean
  기타: string[]
}

export interface AllergyChildConfig {
  이름: string
  항목: number[]
  기타알레르기: string[]
}

export interface MealConfig {
  간식: MealConfigSnack
  특이사항: string
  pptx슬라이드: 1 | 3
  알레르기아이: AllergyChildConfig[]
  식단확인: {
    마지막확인: string | null
    확인횟수: number
  }
}

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
  meal_config?: MealConfig | Record<string, unknown>
  must_change_password?: boolean
  assigned_admin_id?: string
  branch_profiles?: BranchProfile
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
  updated_at?: string
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

export interface BranchProfileAllergyChild {
  id: string
  name: string
  allergens: number[]
  extra_allergies: string[]
}

// ═══════════════════════════════════════════════════════════════
// 식단표 자동화 B-2 — 월별 식단 입력 타입
// ═══════════════════════════════════════════════════════════════

// ── 알레르기 ──────────────────────────────────────────────────
export const ALLERGEN_LIST = [
  { num: 1,  label: '난류(가금류)' },
  { num: 2,  label: '우유' },
  { num: 3,  label: '메밀' },
  { num: 4,  label: '땅콩' },
  { num: 5,  label: '대두' },
  { num: 6,  label: '밀' },
  { num: 7,  label: '고등어' },
  { num: 8,  label: '게' },
  { num: 9,  label: '새우' },
  { num: 10, label: '돼지고기' },
  { num: 11, label: '복숭아' },
  { num: 12, label: '토마토' },
  { num: 13, label: '아황산류' },
  { num: 14, label: '호두' },
  { num: 15, label: '닭고기' },
  { num: 16, label: '쇠고기' },
  { num: 17, label: '오징어' },
  { num: 18, label: '조개류' },
  { num: 19, label: '잣' },
] as const

export type AllergenNum = 1|2|3|4|5|6|7|8|9|10|11|12|13|14|15|16|17|18|19

export const ALLERGEN_CIRCLE: Record<number, string> = {
  1:'①',2:'②',3:'③',4:'④',5:'⑤',6:'⑥',7:'⑦',8:'⑧',9:'⑨',10:'⑩',
  11:'⑪',12:'⑫',13:'⑬',14:'⑭',15:'⑮',16:'⑯',17:'⑰',18:'⑱',19:'⑲',
}

// ── 메뉴 항목 ─────────────────────────────────────────────────
export interface MenuItemInput {
  value: string
  allergens: AllergenNum[]
  and_sauce?: { value: string; allergens: AllergenNum[] }
  ingpa_exclude?: boolean
  is_dessert_prefix?: boolean
  is_empty?: boolean
}

export interface OverrideItem {
  target: string[]
  type: 'replace' | 'exclude' | 'full_replace'
  value?: string
  allergens?: AllergenNum[]
  exclude_targets?: string[]
  menu_items?: string[]
}

export interface SnackItemInput {
  value: string
  allergens: AllergenNum[]
  calories: number
  value_en?: string
  is_empty?: boolean
  overrides?: OverrideItem[]
}

// ── 셀 선택 ───────────────────────────────────────────────────
export interface CellSelection {
  date: string
  field: 'rice'|'soup'|'side1'|'side2'|'side3'|
         'kimchi'|'calories'|'snack_am'|'snack_pm'|
         'snack_care'|'ellan_ingpa_row'|'date_header'
}

// ── 원별 소풍·특별제공 ─────────────────────────────────────────
export interface BranchPicnic {
  target: string[]
  menu: string
  allergens: AllergenNum[]
  calories: number
}

export interface SpecialProvision {
  target: string[]
  menu: string
  allergens: AllergenNum[]
  calories: number
  note?: string
}

// ── 원 옵션 ───────────────────────────────────────────────────
export interface BranchOption {
  id: string
  short_name: string
  branch_name: string
  group_code: string
  is_dongtan_exception: boolean
  snack_label: string
  needs_english: boolean
  has_care_snack: boolean
}

// ── 하루치 식단 ───────────────────────────────────────────────
export interface DayMenuInput {
  date: string
  is_holiday: boolean
  holiday_name?: string
  is_self_closed: boolean
  self_closed_reason?: string
  is_picnic: boolean
  picnic_menu?: string
  birthday_mark: boolean
  rice:   MenuItemInput
  soup:   MenuItemInput
  side1:  MenuItemInput
  side2:  MenuItemInput
  side3:  MenuItemInput
  kimchi: MenuItemInput
  calories: number
  carb:    number
  protein: number
  fat:     number
  ellan_ingpa_row: string
  snack_am:   SnackItemInput
  snack_pm:   SnackItemInput
  snack_care?: SnackItemInput
  special_provisions?: SpecialProvision[]
  branch_picnics?: BranchPicnic[]
}

// ── 월별 식단 전체 ────────────────────────────────────────────
export interface MonthlyMenuData {
  year: number
  month: number
  diet_type: 'CK' | 'consignment'
  branch_id?: string
  month_note: string
  days: Record<string, DayMenuInput>
  status: 'draft' | 'submitted' | 'approved' | 'deployed'
}

// ── 검증 ──────────────────────────────────────────────────────
export interface ValidationError {
  code: string
  date?: string
  field?: string
  message: string
}

export interface MonthlyValidationResult {
  isValid: boolean
  errors: ValidationError[]
  warnings: string[]
}

// ═══════════════════════════════════════════════════════════════

export interface BranchProfile {
  id?: string
  branch_id: string
  diet_plan_type: 'CK' | 'CONSIGNMENT'
  snack_morning: boolean
  snack_afternoon: boolean
  snack_afterschool: boolean
  snack_childcare: boolean
  snack_teacher_extra: boolean
  custom_snack_slots: { key: string; label: string }[]
  nutritionist_name: string
  nutritionist_email: string
  distribution_email: string
  special_notes: string
  allergy_children: BranchProfileAllergyChild[]
  pptx_template_id?: string
  memo?: string
  created_at?: string
  updated_at?: string
  // 신규 필드 (STEP A — add_branch_profiles_columns.sql 실행 후 활성화)
  branch_full_name?: string
  display_name?: string
  short_code?: string
  group_tag?: 'E' | 'P' | 'R' | 'SLP' | 'MB' | '기타'
  contract_status?: 'active' | 'inactive'
  contract_start_date?: string
  contract_renew_date?: string
  inactive_reason?: string
  file_format?: 'pdf' | 'jpg' | 'ppt' | 'pdf+jpg'
  slide_count?: 1 | 2 | 3 | 4
  needs_english?: boolean
  english_name?: string
  snack_label?: string
  childcare_label?: string
  morning_snack_fixed?: boolean
  morning_snack_fixed_menu?: string
  is_elan?: boolean
  is_ingpa?: boolean
  has_dessert_fruit?: boolean
  has_birthday_snack?: boolean
  has_health_booklet?: boolean
  has_yonder?: boolean
  yonder_name?: string
  is_table_15row?: boolean
  direct_delivery?: boolean
  special_note?: string
  distribution_emails?: string[]
  english_code?: string
}
