import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@/lib/supabase-server'

type EmailType = 'approved' | 'rejected' | 'new_application'

function buildEmailHtml(
  parentName: string,
  childName: string,
  type: EmailType,
  reason?: string
): string {
  const portalUrl = 'https://kizmeal-renewal.vercel.app/parent/login'
  const green = '#2D6A4F'

  const header = `
    <div style="background:${green};padding:24px 32px;">
      <h1 style="margin:0;color:#fff;font-size:20px;font-weight:700;font-family:sans-serif;">
        키즈밀
      </h1>
    </div>`

  if (type === 'approved') {
    return `
<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:sans-serif;">
  <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
    ${header}
    <div style="padding:32px;">
      <h2 style="margin:0 0 8px;color:#111;font-size:22px;">${parentName}님, 가입이 승인되었습니다! 🎉</h2>
      <p style="margin:0 0 24px;color:#555;font-size:15px;line-height:1.6;">
        <strong>${childName}</strong> 원아의 학부모로 키즈밀 서비스에 오신 것을 환영합니다.<br>
        아래 버튼을 눌러 포털에 로그인하세요.
      </p>
      <a href="${portalUrl}"
         style="display:inline-block;background:${green};color:#fff;text-decoration:none;padding:14px 28px;border-radius:6px;font-size:15px;font-weight:600;">
        포털 바로가기
      </a>
      <p style="margin:32px 0 0;color:#999;font-size:12px;">
        본 메일은 발신 전용입니다. 문의사항은 원 담당자에게 연락해 주세요.
      </p>
    </div>
  </div>
</body>
</html>`
  }

  if (type === 'rejected') {
    return `
<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:sans-serif;">
  <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
    ${header}
    <div style="padding:32px;">
      <h2 style="margin:0 0 8px;color:#111;font-size:22px;">가입 신청 안내</h2>
      <p style="margin:0 0 16px;color:#555;font-size:15px;line-height:1.6;">
        ${parentName}님, 안녕하세요.<br>
        안타깝게도 이번 가입 신청이 승인되지 않았습니다.
      </p>
      ${reason ? `
      <div style="background:#fafafa;border-left:4px solid #e53e3e;padding:16px;border-radius:4px;margin-bottom:24px;">
        <p style="margin:0;color:#444;font-size:14px;line-height:1.6;"><strong>사유:</strong> ${reason}</p>
      </div>` : ''}
      <p style="margin:0;color:#555;font-size:15px;line-height:1.6;">
        추가 문의사항은 원 담당자에게 연락해 주세요.
      </p>
      <p style="margin:32px 0 0;color:#999;font-size:12px;">
        본 메일은 발신 전용입니다.
      </p>
    </div>
  </div>
</body>
</html>`
  }

  // new_application
  return `
<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:sans-serif;">
  <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
    ${header}
    <div style="padding:32px;">
      <h2 style="margin:0 0 8px;color:#111;font-size:22px;">가입 신청이 접수되었습니다</h2>
      <p style="margin:0 0 24px;color:#555;font-size:15px;line-height:1.6;">
        ${parentName}님, <strong>${childName}</strong> 원아의 학부모 가입 신청이 접수되었습니다.<br>
        담당자 검토 후 결과를 안내드리겠습니다.
      </p>
      <p style="margin:0;color:#999;font-size:12px;">
        본 메일은 발신 전용입니다.
      </p>
    </div>
  </div>
</body>
</html>`
}

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: adminData } = await supabase
    .from('admins')
    .select('id')
    .eq('auth_id', user.id)
    .maybeSingle()

  if (!adminData) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) {
    return NextResponse.json({ error: 'RESEND_API_KEY not configured' }, { status: 503 })
  }

  try {
    const body = await request.json()
    const { parentEmail, parentName, childName, type, reason } = body as {
      parentEmail: string
      parentName: string
      childName: string
      type: EmailType
      reason?: string
    }

    if (!parentEmail || !parentName || !childName || !type) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const subjectMap: Record<EmailType, string> = {
      approved: `[키즈밀] ${parentName}님, 가입이 승인되었습니다!`,
      rejected: '[키즈밀] 가입 신청 안내',
      new_application: '[키즈밀] 가입 신청이 접수되었습니다',
    }

    const resend = new Resend(resendKey)
    const { error } = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: parentEmail,
      subject: subjectMap[type],
      html: buildEmailHtml(parentName, childName, type, reason),
    })

    if (error) {
      console.error('Resend error:', error)
      return NextResponse.json({ error: 'Email send failed' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('send-approval-email error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
