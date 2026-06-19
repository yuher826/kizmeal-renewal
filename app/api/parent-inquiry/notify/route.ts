import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { FROM_EMAIL } from '@/lib/email'

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

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://kizmeal-renewal.vercel.app'

export async function POST(req: Request) {
  const user = await verifyAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { inquiry_id, reply } = await req.json()
  if (!inquiry_id) return NextResponse.json({ error: 'inquiry_id required' }, { status: 400 })

  const serviceRole = getServiceRole()

  const { data: inquiry, error } = await serviceRole
    .from('parent_inquiries')
    .select('id, title, parent_id')
    .eq('id', inquiry_id)
    .single()

  if (error || !inquiry) {
    return NextResponse.json({ error: '문의를 찾을 수 없습니다.' }, { status: 404 })
  }

  const { data: parent } = await serviceRole
    .from('parents')
    .select('name, email')
    .eq('id', inquiry.parent_id)
    .single()

  if (!parent?.email) {
    return NextResponse.json({ success: true, notified: false })
  }

  let notified = false
  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    await resend.emails.send({
      from: FROM_EMAIL,
      to: parent.email,
      subject: '[키즈밀] 1:1 문의에 답변이 등록되었습니다',
      html: buildHtml(parent.name, inquiry.title, reply || ''),
    })
    notified = true
  } catch (e) {
    console.error('Parent inquiry email failed:', e)
  }

  return NextResponse.json({ success: true, notified })
}

function buildHtml(parentName: string, title: string, reply: string) {
  return `
<div style="font-family:'Apple SD Gothic Neo',sans-serif;max-width:480px;margin:0 auto;background:#F6FAF6;padding:24px 16px;">
  <div style="background:white;border-radius:24px;padding:40px 32px;text-align:center;">
    <div style="width:64px;height:64px;background:linear-gradient(135deg,#2D6A4F,#52B788);border-radius:18px;display:inline-flex;align-items:center;justify-content:center;margin:0 auto 20px;">
      <span style="color:white;font-size:28px;font-weight:bold;">K</span>
    </div>
    <h1 style="color:#1C2B1E;font-size:20px;font-weight:bold;margin:0 0 8px;">문의에 답변이 등록되었습니다 💬</h1>
    <p style="color:#6B7280;font-size:14px;line-height:1.6;margin:0 0 16px;">
      안녕하세요, <strong>${parentName}</strong>님!<br>
      문의하신 <strong>${title}</strong>에 답변이 등록되었습니다.
    </p>
    ${reply ? `<div style="background:#E8F5E9;border-radius:12px;padding:16px;text-align:left;margin-bottom:24px;"><div style="font-size:11px;color:#52B788;font-weight:600;margin-bottom:8px;">키즈밀 답변</div><div style="color:#1C2B1E;font-size:14px;line-height:1.7;white-space:pre-wrap;">${reply}</div></div>` : ''}
    <a href="${BASE_URL}/parent/inquiry" style="display:inline-block;background:#2D6A4F;color:white;text-decoration:none;font-size:15px;font-weight:bold;padding:14px 40px;border-radius:14px;">
      답변 확인하기
    </a>
  </div>
  <p style="text-align:center;color:#9CA3AF;font-size:11px;margin-top:16px;">키즈밀 · 건강한 급식 솔루션</p>
</div>`
}
