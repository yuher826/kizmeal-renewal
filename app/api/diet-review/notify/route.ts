import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

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

  let body: {
    type:            'review_complete' | 'final_approved'
    year:            number
    month:           number
    weekly_menu_id?: string
  }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: '요청 형식 오류' }, { status: 400 })
  }

  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const db = serviceKey ? createAdminClient(supabaseUrl, serviceKey) : supabase

  if (body.type === 'review_complete') {
    await db.from('diet_notifications').insert({
      type:           'review_complete',
      title:          `${body.year}년 ${body.month}월 식단표 검토 완료`,
      message:        '매니저 검토가 완료되었습니다. 이사님의 최종 승인을 요청합니다.',
      recipient_role: 'director',
      weekly_menu_id: body.weekly_menu_id ?? null,
      year:           body.year,
      month:          body.month,
    })
  } else if (body.type === 'final_approved') {
    await db.from('diet_notifications').insert({
      type:           'final_approved',
      title:          `${body.year}년 ${body.month}월 식단표 최종 승인 완료`,
      message:        `이사님의 최종 승인이 완료되었습니다. (${adminRow.name ?? '이사님'})`,
      recipient_role: 'super_admin',
      weekly_menu_id: body.weekly_menu_id ?? null,
      year:           body.year,
      month:          body.month,
    })
  }

  return NextResponse.json({ success: true })
}
