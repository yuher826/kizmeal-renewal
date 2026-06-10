import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

type GenResult = {
  branch_id:   string | null
  branch_name: string
  pptx_url:    string
  jpg_url?:    string
  status:      string
}

// ── GET /api/diet-review?year=&month= ────────────────────────────
export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: adminRow } = await supabase
    .from('admins')
    .select('id, name, role')
    .eq('auth_id', user.id)
    .maybeSingle()

  if (!adminRow) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const ALLOWED = ['super_admin', 'manager', 'director']
  if (!ALLOWED.includes(adminRow.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const url    = new URL(req.url)
  const year   = Number(url.searchParams.get('year'))
  const month  = Number(url.searchParams.get('month'))
  if (!year || !month) {
    return NextResponse.json({ error: 'year, month 필요' }, { status: 400 })
  }

  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const db = serviceKey ? createAdminClient(supabaseUrl, serviceKey) : supabase

  // ── 1. 글로벌 weekly_menu 조회 ─────────────────────────────────
  const { data: menuRow } = await db
    .from('weekly_menus')
    .select('id, status, year, month, generation_results')
    .eq('year', year).eq('month', month).eq('diet_type', 'CK').is('branch_id', null)
    .maybeSingle()

  if (!menuRow) {
    return NextResponse.json({
      menuRow: null,
      items:   [],
      stats:   { total: 0, pending: 0, approved: 0, correction_requested: 0, final_approved: 0 },
      currentAdmin: { id: adminRow.id, name: adminRow.name, role: adminRow.role },
    })
  }

  // ── 2. diet_review_items 존재 확인 후 없으면 자동 생성 ────────
  const { data: existingItems } = await db
    .from('diet_review_items')
    .select('id')
    .eq('weekly_menu_id', menuRow.id)
    .limit(1)

  if (!existingItems || existingItems.length === 0) {
    // 브랜치별 weekly_menus 우선
    const { data: branchMenus } = await db
      .from('weekly_menus')
      .select('id, branch_id, pptx_url, jpg_url')
      .eq('year', year).eq('month', month)
      .not('branch_id', 'is', null)

    if (branchMenus && branchMenus.length > 0) {
      const branchIds = branchMenus.map((r: { branch_id: string }) => r.branch_id).filter(Boolean)
      const { data: branches } = await db
        .from('branches')
        .select('id, name')
        .in('id', branchIds)
      const nameMap = new Map<string, string>(
        (branches ?? []).map((b: { id: string; name: string }) => [b.id, b.name])
      )
      const toInsert = branchMenus.map((r: {
        branch_id: string
        pptx_url: string | null
        jpg_url:  string | null
      }) => ({
        weekly_menu_id: menuRow.id,
        branch_id:      r.branch_id,
        branch_name:    nameMap.get(r.branch_id) ?? r.branch_id,
        pptx_url:       r.pptx_url ?? null,
        jpg_url:        r.jpg_url  ?? null,
        review_status:  'pending',
      }))
      await db.from('diet_review_items').insert(toInsert)
    } else {
      // fallback: generation_results JSONB
      const gen = menuRow.generation_results as { results?: GenResult[] } | null
      const successes = (gen?.results ?? []).filter(r => r.status === 'success')
      if (successes.length > 0) {
        const toInsert = successes.map(r => ({
          weekly_menu_id: menuRow.id,
          branch_id:      r.branch_id ?? null,
          branch_name:    r.branch_name,
          pptx_url:       r.pptx_url ?? null,
          jpg_url:        r.jpg_url  ?? null,
          review_status:  'pending',
        }))
        await db.from('diet_review_items').insert(toInsert)
      }
    }
  }

  // ── 3. 최신 items 조회 ─────────────────────────────────────────
  const { data: items } = await db
    .from('diet_review_items')
    .select('*')
    .eq('weekly_menu_id', menuRow.id)
    .order('branch_name')

  const allItems = (items ?? []) as Array<{
    id: string
    branch_id: string | null
    branch_name: string
    pptx_url: string | null
    jpg_url: string | null
    review_status: string
    memo: string | null
    memo_category: string | null
    correction_count: number
    memo_history: unknown[]
    reviewed_by: string | null
    reviewed_at: string | null
    approved_by: string | null
    approved_at: string | null
  }>

  // ── 4. 관리자 이름 조회 ────────────────────────────────────────
  const adminIds = new Set<string>()
  for (const item of allItems) {
    if (item.reviewed_by) adminIds.add(item.reviewed_by)
    if (item.approved_by) adminIds.add(item.approved_by)
  }
  const adminNameMap = new Map<string, string>()
  if (adminIds.size > 0) {
    const { data: admins } = await db
      .from('admins')
      .select('id, name')
      .in('id', Array.from(adminIds))
    for (const a of admins ?? []) {
      adminNameMap.set(a.id, a.name)
    }
  }

  // ── 5. 통계 ────────────────────────────────────────────────────
  const stats = {
    total:                allItems.length,
    pending:              allItems.filter(i => i.review_status === 'pending').length,
    approved:             allItems.filter(i => i.review_status === 'approved' && !i.approved_by).length,
    correction_requested: allItems.filter(i => i.review_status === 'correction_requested').length,
    final_approved:       allItems.filter(i => i.review_status === 'approved' && !!i.approved_by).length,
  }

  return NextResponse.json({
    menuRow,
    items: allItems.map(item => ({
      ...item,
      reviewed_by_name: item.reviewed_by ? (adminNameMap.get(item.reviewed_by) ?? null) : null,
      approved_by_name: item.approved_by ? (adminNameMap.get(item.approved_by) ?? null) : null,
    })),
    stats,
    currentAdmin: { id: adminRow.id, name: adminRow.name, role: adminRow.role },
  })
}

// ── POST /api/diet-review ────────────────────────────────────────
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: adminRow } = await supabase
    .from('admins')
    .select('id, name, role')
    .eq('auth_id', user.id)
    .maybeSingle()

  if (!adminRow) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const ALLOWED = ['super_admin', 'manager', 'director']
  if (!ALLOWED.includes(adminRow.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: {
    item_id:        string
    review_status:  'approved' | 'correction_requested'
    memo?:          string
    memo_category?: string
  }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: '요청 형식 오류' }, { status: 400 })
  }

  const { item_id, review_status, memo, memo_category } = body

  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const db = serviceKey ? createAdminClient(supabaseUrl, serviceKey) : supabase

  const { data: current } = await db
    .from('diet_review_items')
    .select('correction_count, memo_history, reviewed_by, approved_by')
    .eq('id', item_id)
    .maybeSingle()

  if (!current) return NextResponse.json({ error: 'Item not found' }, { status: 404 })

  const now     = new Date().toISOString()
  const history = Array.isArray(current.memo_history) ? [...current.memo_history] : []

  const updates: Record<string, unknown> = {
    review_status,
    updated_at: now,
  }

  if (review_status === 'approved') {
    if (adminRow.role === 'director') {
      updates.approved_by  = adminRow.id
      updates.approved_at  = now
      updates.reviewed_by  = current.reviewed_by ?? adminRow.id
      updates.reviewed_at  = current.reviewed_by ? undefined : now
      history.push({ status: 'final_approved', at: now, by: adminRow.name ?? adminRow.id })
    } else {
      updates.reviewed_by = adminRow.id
      updates.reviewed_at = now
      history.push({ status: 'approved', at: now, by: adminRow.name ?? adminRow.id })
    }
  } else {
    updates.memo          = memo ?? null
    updates.memo_category = memo_category ?? null
    updates.reviewed_by   = adminRow.id
    updates.reviewed_at   = now
    updates.correction_count = ((current.correction_count as number) ?? 0) + 1
    history.push({
      status:        'correction_requested',
      memo:          memo ?? undefined,
      memo_category: memo_category ?? undefined,
      at:            now,
      by:            adminRow.name ?? adminRow.id,
    })
  }

  updates.memo_history = history

  // director가 이미 reviewed_at을 undefined로 설정하면 undefined key 제거
  for (const k of Object.keys(updates)) {
    if (updates[k] === undefined) delete updates[k]
  }

  const { data: updated, error } = await db
    .from('diet_review_items')
    .update(updates)
    .eq('id', item_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    item: {
      ...updated,
      reviewed_by_name: adminRow.role !== 'director' ? adminRow.name : (current.reviewed_by ? null : adminRow.name),
      approved_by_name: adminRow.role === 'director'  ? adminRow.name : null,
    },
  })
}
