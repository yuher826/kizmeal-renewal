export interface BranchProfileRow {
  id: string
  branch_id: string
  short_code: string | null
  display_name: string | null
  branch_full_name: string | null
  group_tag: string | null
  contract_status: string | null
  contract_type: string | null
  diet_type: string | null
  file_format: string | null
  slide_count: number | null
  distribution_emails: string[] | null
  review_required: boolean | null
  contract_start_date: string | null
  renew_date: string | null
  updated_at: string | null
  sort_order: number | null
  this_month_deployed: boolean
  is_profile_complete: boolean
}

export interface RecentMenu {
  year: number
  month: number
  week_num: number | null
  pptx_url: string | null
  pdf_url: string | null
  created_at: string
}

export interface BranchProfileDetail extends BranchProfileRow {
  diet_plan_type: string | null
  brand_id: string | null
  owner_name: string | null
  kos_id: string | null
  snack_morning: boolean | null
  snack_afternoon: boolean | null
  snack_afterschool: boolean | null
  snack_childcare: boolean | null
  snack_teacher_extra: boolean | null
  has_dessert_fruit: boolean | null
  has_birthday_snack: boolean | null
  has_health_booklet: boolean | null
  has_yonder: boolean | null
  yonder_name: string | null
  needs_english: boolean | null
  english_name: string | null
  english_code: string | null
  is_elan: boolean | null
  is_ingpa: boolean | null
  is_table_15row: boolean | null
  direct_delivery: boolean | null
  slide_type: string | null
  pptx_template_id: string | null
  special_notes: string | null
  memo: string | null
  nutritionist_name: string | null
  nutritionist_email: string | null
  distribution_email: string | null
  recent_menus: RecentMenu[]
}
