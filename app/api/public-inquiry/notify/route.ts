import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { FROM_EMAIL } from '@/lib/email'

export async function POST(req: Request) {
  const serviceRole = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const resend = new Resend(process.env.RESEND_API_KEY)
  const { inquiry_id } = await req.json()

  const { data: inquiry, error } = await serviceRole
    .from('public_inquiries')
    .select('*')
    .eq('id', inquiry_id)
    .single()

  if (error || !inquiry) {
    return NextResponse.json({ error: '문의를 찾을 수 없습니다.' }, { status: 404 })
  }

  await serviceRole
    .from('public_inquiries')
    .update({ status: 'resolved', replied_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', inquiry_id)

  let notified = false

  if (inquiry.contact_type === 'email') {
    try {
      await resend.emails.send({
        from: FROM_EMAIL,
        to: inquiry.contact,
        subject: '[키즈밀] 문의에 답변이 등록되었습니다',
        html: buildEmailHtml(inquiry),
      })
      notified = true
    } catch (e) {
      console.error('Email send failed:', e)
    }
  }

  await serviceRole
    .from('public_inquiries')
    .update({ is_notified: notified, updated_at: new Date().toISOString() })
    .eq('id', inquiry_id)

  return NextResponse.json({ success: true, notified })
}

function buildEmailHtml(inq: Record<string, string>) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://kizmeal.com'
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F0F4F0;font-family:-apple-system,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 16px;">
    <div style="background:#2D6A4F;border-radius:16px 16px 0 0;padding:32px;text-align:center;">
      <div style="font-size:28px;font-weight:bold;color:white;letter-spacing:-0.5px;">키즈밀</div>
      <div style="color:#B7E4C7;margin-top:4px;font-size:13px;">KIZMEAL</div>
    </div>
    <div style="background:white;padding:32px;border-radius:0 0 16px 16px;border:1px solid #E8F5E9;border-top:none;">
      <h2 style="color:#1C2B1E;margin:0 0 8px;font-size:18px;">문의에 답변이 등록되었습니다 ✅</h2>
      <p style="color:#6B7280;font-size:14px;margin:0 0 24px;">${inq.name}님의 문의 <strong>${inq.inquiry_number}</strong>에 답변이 등록되었습니다.</p>
      <div style="background:#E8F5E9;border-radius:12px;padding:20px;margin-bottom:24px;">
        <div style="font-size:11px;color:#52B788;font-weight:600;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px;">키즈밀 답변</div>
        <div style="color:#1C2B1E;font-size:14px;line-height:1.7;white-space:pre-wrap;">${inq.admin_reply || ''}</div>
      </div>
      <a href="${siteUrl}/inquiry/check"
         style="display:block;background:#2D6A4F;color:white;text-align:center;padding:14px 24px;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px;">
        문의 확인하기
      </a>
      <p style="color:#9CA3AF;font-size:12px;margin-top:24px;text-align:center;line-height:1.6;">
        키즈밀 고객지원 · 031-388-3501<br>
        본 메일은 발신전용입니다.
      </p>
    </div>
  </div>
</body>
</html>`
}
