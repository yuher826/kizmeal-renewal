import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

// ── 타입 ──────────────────────────────────────────────────────────
type AdminRow = {
  id:                  string
  name:                string
  role:                string
  diet_scope:          string | null
  ck_location_id:      string | null
  assigned_branch_ids: string[]
  is_active:           boolean
}

type ReviewItemRow = {
  id:              string
  weekly_menu_id:  string
  branch_id:       string | null
  branch_name:     string
  pptx_url:        string | null
  jpg_url:         string | null
  review_status:   string
  memo:            string | null
  memo_category:   string | null
  correction_count: number
  memo_history:    unknown[]
  reviewed_by:     string | null
  reviewed_at:     string | null
  approved_by:     string | null
  approved_at:     string | null
  deployed_by:     string | null
  deployed_at:     string | null
  resubmitted_at:  string | null
}

type HistoryEntry = {
  round?:    number
  by:        string
  role:      string
  action:    string
  memo?:     string
  category?: string
  at:        string
}

// ── 유틸 ──────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = ReturnType<typeof createAdminClient> | any

function getDb(supabase: ReturnType<typeof createClient>): AnyDb {
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  return serviceKey ? createAdminClient(supabaseUrl, serviceKey) : supabase
}

function appendHistory(
  existing: unknown[],
  admin:    AdminRow,
  action:   string,
  extras:   { memo?: string; category?: string } = {},
): HistoryEntry[] {
  const history: HistoryEntry[] = Array.isArray(existing) ? [...existing as HistoryEntry[]] : []
  const correctionRound = history.filter(h => h.action === 'correction_request').length
  const entry: HistoryEntry = {
    by:     admin.name ?? admin.id,
    role:   admin.role,
    action,
    at:     new Date().toISOString(),
  }
  if (action === 'correction_request') entry.round = correctionRound + 1
  if (extras.memo)     entry.memo     = extras.memo
  if (extras.category) entry.category = extras.category
  history.push(entry)
  return history
}

// 영양사 접근 가능 branch_id 목록 반환
async function getNutritionistBranchIds(
  db:    ReturnType<typeof createAdminClient>,
  admin: AdminRow,
): Promise<string[] | null> {
  if (admin.diet_scope === 'consignment') {
    return (admin.assigned_branch_ids ?? []) as string[]
  }
  // diet_scope='ck'
  let query = db.from('branch_profiles').select('id').eq('diet_type', 'ck')
  if (admin.ck_location_id) {
    query = query.eq('ck_location_id', admin.ck_location_id)
  }
  const { data } = await query
  return (data ?? []).map((r: { id: string }) => r.id)
}

// ── GET /api/diet-review?year=&month= ─────────────────────────────
export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: adminRow } = await supabase
    .from('admins')
    .select('id, name, role, diet_scope, ck_location_id, assigned_branch_ids, is_active')
    .eq('auth_id', user.id)
    .maybeSingle() as { data: AdminRow | null }

  if (!adminRow) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const ALLOWED = ['super_admin', 'manager', 'director', 'nutritionist']
  if (!ALLOWED.includes(adminRow.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const url   = new URL(req.url)
  const year  = Number(url.searchParams.get('year'))
  const month = Number(url.searchParams.get('month'))
  if (!year || !month) {
    return NextResponse.json({ error: 'year, month 필요' }, { status: 400 })
  }

  const db = getDb(supabase)

  const { data: menuIds } = await db
    .from('weekly_menus')
    .select('id')
    .eq('year', year)
    .eq('month', month)

  const ids = menuIds?.map((m: { id: string }) => m.id) ?? []
  if (ids.length === 0) {
    return NextResponse.json({ items: [], stats: {} })
  }

  let itemsQuery = db
    .from('diet_review_items')
    .select('*')
    .in('weekly_menu_id', ids)
    .order('branch_name')

  if (adminRow.role === 'nutritionist') {
    const branchIds = await getNutritionistBranchIds(db, adminRow)
    if (branchIds !== null && branchIds.length > 0) {
      itemsQuery = itemsQuery.in('branch_id', branchIds)
    }
  }

  const { data: items } = await itemsQuery
  const allItems = (items ?? []) as ReviewItemRow[]

  // 4. 통계
  const stats = {
    total:               allItems.length,
    generation_complete: allItems.filter(i => i.review_status === 'generation_complete').length,
    correction_request:  allItems.filter(i => i.review_status === 'correction_request').length,
    resubmitted:         allItems.filter(i => i.review_status === 'resubmitted').length,
    approved:            allItems.filter(i => i.review_status === 'approved').length,
    deployed:            allItems.filter(i => i.review_status === 'deployed').length,
  }

  return NextResponse.json({
    menuRow: null,
    items: allItems,
    stats,
    currentAdmin: {
      id:         adminRow.id,
      name:       adminRow.name,
      role:       adminRow.role,
      diet_scope: adminRow.diet_scope,
    },
  })
}

// ── POST /api/diet-review ────────────────────────────────────────
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: adminRow } = await supabase
    .from('admins')
    .select('id, name, role, diet_scope, ck_location_id, assigned_branch_ids, is_active')
    .eq('auth_id', user.id)
    .maybeSingle() as { data: AdminRow | null }

  if (!adminRow) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // director는 POST 전체 차단
  if (adminRow.role === 'director') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: {
    action:         'correction_request' | 'approved' | 'resubmit' | 'deployed'
    item_id?:       string
    ids?:           string[]
    memo?:          string
    memo_category?: string
  }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: '요청 형식 오류' }, { status: 400 })
  }

  const { action, item_id, ids, memo, memo_category } = body
  const db = getDb(supabase)

  // ── correction_request ──────────────────────────────────────────
  if (action === 'correction_request') {
    if (!['manager', 'super_admin'].includes(adminRow.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (!memo || memo.trim() === '') {
      return NextResponse.json({ error: '수정요청 메모는 필수입니다.' }, { status: 400 })
    }

    const targetIds = ids?.length ? ids : item_id ? [item_id] : []
    if (!targetIds.length) return NextResponse.json({ error: 'item_id 또는 ids 필요' }, { status: 400 })

    const { data: currentItems } = await db
      .from('diet_review_items')
      .select('id, review_status, correction_count, memo_history')
      .in('id', targetIds)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const eligibleItems = ((currentItems ?? []) as any[]).filter((i) =>
      ['generation_complete', 'resubmitted'].includes(i.review_status)
    )
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const skippedIds = targetIds.filter(id => !eligibleItems.find((i: any) => i.id === id))

    const now = new Date().toISOString()
    const updated: ReviewItemRow[] = []

    for (const item of eligibleItems as ReviewItemRow[]) {
      const history = appendHistory(item.memo_history, adminRow, 'correction_request', {
        memo, category: memo_category,
      })
      const { data: u } = await db
        .from('diet_review_items')
        .update({
          review_status:   'correction_request',
          memo:            memo,
          memo_category:   memo_category ?? null,
          correction_count: (item.correction_count ?? 0) + 1,
          memo_history:    history,
          reviewed_by:     adminRow.id,
          reviewed_at:     now,
          updated_at:      now,
        })
        .eq('id', item.id)
        .select()
        .single()
      if (u) updated.push(u as ReviewItemRow)
    }

    // 영양사에게 알림
    if (updated.length > 0) {
      await db.from('diet_notifications').insert({
        type:           'correction_to_nutritionist',
        title:          '수정 요청이 도착했습니다',
        message:        `${adminRow.name}이(가) ${updated.length}개 원 식단표 수정을 요청했습니다.`,
        recipient_role: 'nutritionist',
      })
    }

    return NextResponse.json({ success: true, updated, skipped: skippedIds })
  }

  // ── approved ────────────────────────────────────────────────────
  if (action === 'approved') {
    if (!['manager', 'super_admin'].includes(adminRow.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const targetIds = ids?.length ? ids : item_id ? [item_id] : []
    if (!targetIds.length) return NextResponse.json({ error: 'item_id 또는 ids 필요' }, { status: 400 })

    const { data: currentItems } = await db
      .from('diet_review_items')
      .select('id, review_status, memo_history, weekly_menu_id')
      .in('id', targetIds)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const eligibleItems = ((currentItems ?? []) as any[]).filter((i) =>
      ['generation_complete', 'resubmitted'].includes(i.review_status)
    )
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const skippedIds = targetIds.filter(id => !eligibleItems.find((i: any) => i.id === id))

    const now = new Date().toISOString()
    const updated: ReviewItemRow[] = []

    for (const item of eligibleItems as ReviewItemRow[]) {
      const history = appendHistory(item.memo_history, adminRow, 'approved')
      const { data: u } = await db
        .from('diet_review_items')
        .update({
          review_status: 'approved',
          memo_history:  history,
          reviewed_by:   adminRow.id,
          reviewed_at: now,
          updated_at:  now,
        })
        .eq('id', item.id)
        .select()
        .single()
      if (u) updated.push(u as ReviewItemRow)
    }

    // 영양사에게 승인 알림
    if (updated.length > 0) {
      await db.from('diet_notifications').insert({
        type:           'approved_to_nutritionist',
        title:          '식단표가 승인되었습니다',
        message:        `${adminRow.name}이(가) ${updated.length}개 원 식단표를 승인했습니다.`,
        recipient_role: 'nutritionist',
      })
    }

    return NextResponse.json({ success: true, updated, skipped: skippedIds })
  }

  // ── resubmit ────────────────────────────────────────────────────
  if (action === 'resubmit') {
    if (!['nutritionist', 'super_admin'].includes(adminRow.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (!item_id) return NextResponse.json({ error: 'item_id 필요' }, { status: 400 })

    const { data: current } = await db
      .from('diet_review_items')
      .select('id, review_status, memo_history')
      .eq('id', item_id)
      .maybeSingle() as { data: ReviewItemRow | null }

    if (!current) return NextResponse.json({ error: '항목 없음' }, { status: 404 })

    const now = new Date().toISOString()
    const history = appendHistory(current.memo_history, adminRow, 'resubmit', { memo })

    const { data: updated } = await db
      .from('diet_review_items')
      .update({
        review_status:  'resubmitted',
        resubmitted_at: now,
        memo_history:   history,
        updated_at:     now,
      })
      .eq('id', item_id)
      .select()
      .single()

    // 매니저에게 재제출 알림
    await db.from('diet_notifications').insert({
      type:           'resubmitted_to_manager',
      title:          '식단표 재제출 알림',
      message:        `${adminRow.name}이(가) 수정 후 재제출했습니다. 재검토를 진행해주세요.`,
      recipient_role: 'manager',
    })

    return NextResponse.json({ success: true, item: updated })
  }

  // ── deployed (단건) ─────────────────────────────────────────────
  if (action === 'deployed') {
    if (!['nutritionist', 'super_admin'].includes(adminRow.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const targetIds = ids?.length ? ids : item_id ? [item_id] : []
    if (!targetIds.length) return NextResponse.json({ error: 'item_id 또는 ids 필요' }, { status: 400 })

    const { data: currentItems } = await db
      .from('diet_review_items')
      .select('id, review_status, branch_id, branch_name, memo_history')
      .in('id', targetIds)

    const now = new Date().toISOString()
    const success: string[] = []
    const skipped: string[] = []

    for (const item of (currentItems ?? []) as ReviewItemRow[]) {
      if (item.review_status === 'deployed') {
        skipped.push(item.branch_name)
        continue
      }
      // CK: approved 상태만 처리
      // (위탁+review_required=false 케이스는 deploy route에서 처리)
      if (item.review_status !== 'approved') {
        skipped.push(item.branch_name)
        continue
      }

      const history = appendHistory(item.memo_history, adminRow, 'deployed')
      const { error } = await db
        .from('diet_review_items')
        .update({
          review_status: 'deployed',
          deployed_by:   adminRow.id,
          deployed_at:   now,
          memo_history:  history,
          updated_at:  now,
        })
        .eq('id', item.id)

      if (error) skipped.push(item.branch_name)
      else       success.push(item.branch_name)
    }

    if (success.length > 0) {
      await db.from('diet_notifications').insert({
        type:           'deployed_complete',
        title:          '식단표 배포 완료',
        message:        `${success.join(', ')} 외 총 ${success.length}개원 배포가 완료되었습니다.`,
        recipient_role: 'manager',
      })
    }

    return NextResponse.json({ success: true, deployed: success, skipped })
  }

  return NextResponse.json({ error: '알 수 없는 action' }, { status: 400 })
}
