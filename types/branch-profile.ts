export interface BranchProfileRow {
  id: string
  branch_id: string
  short_code: string | null
  display_name: string | null
  branch_full_name: string | null
  group_tag: string | null
  contract_status: string | null
  diet_type: string | null
  file_format: string | null
  slide_count: number | null
  distribution_emails: string[] | null
  review_required: boolean | null
  contract_start_date: string | null
  renew_date: string | null
  updated_at: string | null
  this_month_deployed: boolean
}
