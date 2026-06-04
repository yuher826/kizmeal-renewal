import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'

function getServiceRole() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function verifyAdmin() {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: admin } = await supabase.from('admins').select('id').eq('auth_id', user.id).maybeSingle()
  return admin ? user : null
}

export async function GET(req: Request) {
  const user = await verifyAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const serviceRole = getServiceRole()
  const url = new URL(req.url)
  const id = url.searchParams.get('id')

  if (id) {
    const { data, error } = await serviceRole
      .from('public_inquiries')
      .select('*')
      .eq('id', id)
      .single()
    if (error) return NextResponse.json({ error: '문의를 찾을 수 없습니다.' }, { status: 404 })
    return NextResponse.json({ data })
  }

  const status = url.searchParams.get('status') || 'all'
  const search = url.searchParams.get('search') || ''
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'))
  const limit = 30

  let query = serviceRole
    .from('public_inquiries')
    .select('id, inquiry_number, name, contact, contact_type, category, title, status, is_notified, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1)

  if (status !== 'all') query = query.eq('status', status)
  if (search) {
    query = query.or(
      `name.ilike.%${search}%,contact.ilike.%${search}%,inquiry_number.ilike.%${search}%,title.ilike.%${search}%`
    )
  }

  const { data, count, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data, count })
}

export async function PATCH(req: Request) {
  const user = await verifyAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const serviceRole = getServiceRole()
  const body = await req.json()
  const { id, status, admin_reply, admin_memo } = body
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (status !== undefined) updates.status = status
  if (admin_reply !== undefined) { updates.admin_reply = admin_reply; updates.replied_by = user.id }
  if (admin_memo !== undefined) updates.admin_memo = admin_memo

  const { data, error } = await serviceRole
    .from('public_inquiries')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
