import { createClient } from './supabase'

export type ParentStatus = 'pending' | 'approved' | 'rejected'

export interface Parent {
  id: string
  auth_id?: string
  name: string
  email: string
  phone?: string
  status: ParentStatus
  rejected_reason?: string
  approved_at?: string
  created_at: string
}

export interface Child {
  id: string
  parent_id: string
  branch_id?: string
  name_ko: string
  name_en?: string
  birth_date?: string
  class_name?: string
  is_active: boolean
  created_at: string
  branches?: { id: string; name: string; brands?: { name: string } }
}

export interface Content {
  id: string
  branch_id: string
  type: 'menu' | 'photo' | 'recipe' | 'notice'
  title: string
  body?: string
  date?: string
  month?: string
  image_urls?: string[]
  tags?: string[]
  published_at?: string
  created_at: string
}

export interface ParentNotification {
  id: string
  parent_id: string
  content_id?: string
  type: string
  title: string
  body?: string
  is_read: boolean
  created_at: string
}

export interface PushSubscription {
  id: string
  parent_id: string
  endpoint: string
  p256dh: string
  auth: string
}

export async function getParentProfile(): Promise<{ parent: Parent | null; children: Child[] }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { parent: null, children: [] }

  const { data: parent } = await supabase
    .from('parents')
    .select('*')
    .eq('auth_id', user.id)
    .maybeSingle()

  if (!parent) return { parent: null, children: [] }

  const { data: children } = await supabase
    .from('children')
    .select('*, branches(id, name, brands(name))')
    .eq('parent_id', parent.id)
    .eq('is_active', true)
    .order('created_at')

  return {
    parent: parent as Parent,
    children: (children || []) as unknown as Child[],
  }
}

export async function getContentsForBranch(
  branchId: string,
  type: Content['type'],
  options?: { month?: string; date?: string; limit?: number }
): Promise<Content[]> {
  const supabase = createClient()

  let query = supabase
    .from('contents')
    .select('*')
    .eq('branch_id', branchId)
    .eq('type', type)
    .order('date', { ascending: false })

  if (options?.month) query = query.eq('month', options.month)
  if (options?.date) query = query.eq('date', options.date)
  if (options?.limit) query = query.limit(options.limit)

  const { data } = await query
  return (data || []) as Content[]
}

export function formatKoreanDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
}

export function getYearMonth(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}
