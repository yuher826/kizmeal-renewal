import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const ADMIN_EMAIL = 'admin@kizmeal.com'
const ADMIN_PORTAL_URL = 'https://kizmeal-renewal.vercel.app/board/admin/parents'
const GREEN = '#2D6A4F'

function buildAdminEmailHtml(parentName: string, childName: string, branchName: string): string {
  return `
<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:sans-serif;">
  <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
    <div style="background:${GREEN};padding:24px 32px;">
      <h1 style="margin:0;color:#fff;font-size:20px;font-weight:700;">키즈밀 관리자</h1>
    </div>
    <div style="padding:32px;">
      <h2 style="margin:0 0 16px;color:#111;font-size:20px;">새 학부모 가입 신청이 접수되었습니다</h2>
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
        <tr>
          <td style="padding:10px 0;color:#888;font-size:14px;width:80px;">학부모</td>
          <td style="padding:10px 0;color:#111;font-size:14px;font-weight:600;">${parentName}</td>
        </tr>
        <tr style="border-top:1px solid #eee;">
          <td style="padding:10px 0;color:#888;font-size:14px;">원아</td>
          <td style="padding:10px 0;color:#111;font-size:14px;font-weight:600;">${childName}</td>
        </tr>
        <tr style="border-top:1px solid #eee;">
          <td style="padding:10px 0;color:#888;font-size:14px;">지점</td>
          <td style="padding:10px 0;color:#111;font-size:14px;font-weight:600;">${branchName}</td>
        </tr>
      </table>
      <a href="${ADMIN_PORTAL_URL}"
         style="display:inline-block;background:${GREEN};color:#fff;text-decoration:none;padding:14px 28px;border-radius:6px;font-size:15px;font-weight:600;">
        승인하러 가기
      </a>
      <p style="margin:32px 0 0;color:#999;font-size:12px;">
        본 메일은 키즈밀 시스템에서 자동 발송되었습니다.
      </p>
    </div>
  </div>
</body>
</html>`
}

export async function POST(request: NextRequest) {
  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) {
    return NextResponse.json({ error: 'RESEND_API_KEY not configured' }, { status: 503 })
  }

  try {
    const body = await request.json()
    const { parentName, childName, branchName } = body as {
      parentName: string
      childName: string
      branchName: string
    }

    if (!parentName || !childName || !branchName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const resend = new Resend(resendKey)
    const { error } = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: ADMIN_EMAIL,
      subject: '[키즈밀 관리자] 새 학부모 가입 신청',
      html: buildAdminEmailHtml(parentName, childName, branchName),
    })

    if (error) {
      console.error('Resend error:', error)
      return NextResponse.json({ error: 'Email send failed' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('notify-admin error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
