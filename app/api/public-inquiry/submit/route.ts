import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'

function getServiceRole() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: Request) {
  const body = await req.json()

  // Honeypot check
  if (body.website) {
    return NextResponse.json({ error: 'blocked' }, { status: 400 })
  }

  const { name, contact, contact_type, password, category, title, content } = body

  if (!name || !contact || !contact_type || !password || !category || !title || !content) {
    return NextResponse.json({ error: '필수 항목을 입력해주세요.' }, { status: 400 })
  }

  const serviceRole = getServiceRole()

  // Spam check: same contact today 3+ inquiries
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const { count } = await serviceRole
    .from('public_inquiries')
    .select('*', { count: 'exact', head: true })
    .eq('contact', contact)
    .gte('created_at', todayStart.toISOString())

  if ((count || 0) >= 3) {
    return NextResponse.json(
      {
        error: 'spam',
        title: '문의 접수 제한 안내',
        message:
          '고객님, 보다 많은 분들께\n신속하고 정확한 답변을 드리기 위해\n동일한 연락처로는 하루 최대 3건까지\n문의 접수가 가능합니다.\n\n이용에 불편을 드려 죄송합니다.\n내일 다시 문의해 주시면\n성심껏 답변드리겠습니다. 😊',
      },
      { status: 429 }
    )
  }

  const password_hash = await bcrypt.hash(password, 10)
  const ip_address = (req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '').split(',')[0].trim()
  const year = new Date().getFullYear()

  let inquiry_number = ''

  for (let attempt = 0; attempt < 5; attempt++) {
    const { count: yearCount } = await serviceRole
      .from('public_inquiries')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', `${year}-01-01`)

    const seq = String((yearCount || 0) + 1 + attempt).padStart(4, '0')
    const candidate = `KM-${year}-${seq}`

    const { error } = await serviceRole.from('public_inquiries').insert({
      inquiry_number: candidate,
      name,
      contact,
      contact_type,
      password_hash,
      category,
      title,
      content,
      ip_address,
    })

    if (!error) {
      inquiry_number = candidate
      break
    }
    if (error.code !== '23505') {
      return NextResponse.json({ error: '오류가 발생했습니다. 다시 시도해주세요.' }, { status: 500 })
    }
  }

  if (!inquiry_number) {
    return NextResponse.json({ error: '문의 접수에 실패했습니다. 잠시 후 다시 시도해주세요.' }, { status: 500 })
  }

  return NextResponse.json({ inquiry_number })
}
