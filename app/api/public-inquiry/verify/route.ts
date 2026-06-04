import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'

export async function POST(req: Request) {
  const serviceRole = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { contact, password } = await req.json()

  if (!contact || !password) {
    return NextResponse.json({ error: '연락처와 비밀번호를 입력해주세요.' }, { status: 400 })
  }

  const { data: inquiries, error } = await serviceRole
    .from('public_inquiries')
    .select('id, inquiry_number, name, contact, contact_type, category, title, content, status, admin_reply, replied_at, created_at, password_hash')
    .eq('contact', contact)
    .order('created_at', { ascending: false })

  if (error || !inquiries || inquiries.length === 0) {
    return NextResponse.json({ error: '해당 연락처로 등록된 문의가 없습니다.' }, { status: 404 })
  }

  let verified = false
  for (const inq of inquiries) {
    if (await bcrypt.compare(password, inq.password_hash)) {
      verified = true
      break
    }
  }

  if (!verified) {
    return NextResponse.json({ error: '비밀번호가 올바르지 않습니다.' }, { status: 401 })
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const result = inquiries.map(({ password_hash: _ph, ...rest }) => rest)
  return NextResponse.json({ inquiries: result })
}
