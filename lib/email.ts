import { Resend } from 'resend'

const FROM = 'onboarding@resend.dev'
const BASE_URL = 'https://kizmeal-renewal.vercel.app'

function getResend() {
  return new Resend(process.env.RESEND_API_KEY)
}

export async function sendApprovalEmail(parentEmail: string, parentName: string, childName: string) {
  return getResend().emails.send({
    from: FROM,
    to: parentEmail,
    subject: '[키즈밀] 가입이 승인되었습니다! 🎉',
    html: `
<div style="font-family:'Apple SD Gothic Neo',sans-serif;max-width:480px;margin:0 auto;background:#F6FAF6;padding:24px 16px;">
  <div style="background:white;border-radius:24px;padding:40px 32px;text-align:center;">
    <div style="width:64px;height:64px;background:linear-gradient(135deg,#2D6A4F,#52B788);border-radius:18px;display:flex;align-items:center;justify-content:center;margin:0 auto 20px;">
      <span style="color:white;font-size:28px;font-weight:bold;">K</span>
    </div>
    <h1 style="color:#1C2B1E;font-size:20px;font-weight:bold;margin:0 0 8px;">가입이 승인되었습니다! 🎉</h1>
    <p style="color:#6B7280;font-size:14px;line-height:1.6;margin:0 0 8px;">
      안녕하세요, <strong>${parentName}</strong>님!<br>
      키즈밀 학부모 포털 가입이 승인되었습니다.<br>
      <strong>${childName}</strong>의 급식 사진과 식단표를 지금 바로 확인해보세요 🥗
    </p>
    <a href="${BASE_URL}/parent/login" style="display:inline-block;background:#2D6A4F;color:white;text-decoration:none;font-size:15px;font-weight:bold;padding:14px 40px;border-radius:14px;margin-top:24px;">
      포털 바로가기
    </a>
  </div>
  <p style="text-align:center;color:#9CA3AF;font-size:11px;margin-top:16px;">키즈밀 · 건강한 급식 솔루션</p>
</div>`,
  })
}

export async function sendRejectionEmail(parentEmail: string, parentName: string, reason?: string) {
  return getResend().emails.send({
    from: FROM,
    to: parentEmail,
    subject: '[키즈밀] 가입 신청 결과 안내',
    html: `
<div style="font-family:'Apple SD Gothic Neo',sans-serif;max-width:480px;margin:0 auto;background:#F6FAF6;padding:24px 16px;">
  <div style="background:white;border-radius:24px;padding:40px 32px;text-align:center;">
    <div style="width:64px;height:64px;background:linear-gradient(135deg,#2D6A4F,#52B788);border-radius:18px;display:flex;align-items:center;justify-content:center;margin:0 auto 20px;">
      <span style="color:white;font-size:28px;font-weight:bold;">K</span>
    </div>
    <h1 style="color:#1C2B1E;font-size:20px;font-weight:bold;margin:0 0 8px;">가입 신청 결과 안내</h1>
    <p style="color:#6B7280;font-size:14px;line-height:1.6;margin:0 0 8px;">
      안녕하세요, <strong>${parentName}</strong>님.<br>
      아쉽게도 이번 가입 신청이 승인되지 않았습니다.
    </p>
    ${reason ? `<div style="background:#FEF2F2;border-radius:12px;padding:12px 16px;margin:16px 0;text-align:left;"><p style="color:#DC2626;font-size:13px;margin:0;"><strong>사유:</strong> ${reason}</p></div>` : ''}
    <p style="color:#6B7280;font-size:13px;line-height:1.6;margin:16px 0 0;">
      문의사항이 있으시면 담당 원에 연락해주세요.
    </p>
  </div>
  <p style="text-align:center;color:#9CA3AF;font-size:11px;margin-top:16px;">키즈밀 · 건강한 급식 솔루션</p>
</div>`,
  })
}

export async function sendBranchAccountEmail(
  branchEmail: string,
  branchName: string,
  managerName: string,
  tempPassword: string
) {
  return getResend().emails.send({
    from: FROM,
    to: branchEmail,
    subject: '[키즈밀] 소통채널 계정이 발급되었습니다',
    html: `
<div style="font-family:'Apple SD Gothic Neo',sans-serif;max-width:480px;margin:0 auto;background:#F6FAF6;padding:24px 16px;">
  <div style="background:white;border-radius:24px;padding:40px 32px;text-align:center;">
    <div style="width:64px;height:64px;background:linear-gradient(135deg,#2D6A4F,#52B788);border-radius:18px;display:flex;align-items:center;justify-content:center;margin:0 auto 20px;">
      <span style="color:white;font-size:28px;font-weight:bold;">K</span>
    </div>
    <h1 style="color:#1C2B1E;font-size:20px;font-weight:bold;margin:0 0 8px;">소통채널 계정이 발급되었습니다</h1>
    <p style="color:#6B7280;font-size:14px;line-height:1.6;margin:0 0 16px;">
      안녕하세요, <strong>${managerName}</strong>님!<br>
      <strong>${branchName}</strong> 소통채널 계정이 발급되었습니다.
    </p>
    <div style="background:#F0F7F4;border-radius:12px;padding:16px;text-align:left;margin-bottom:24px;">
      <p style="margin:0 0 8px;font-size:14px;color:#1C2B1E;"><strong>아이디(이메일):</strong> ${branchEmail}</p>
      <p style="margin:0;font-size:14px;color:#1C2B1E;"><strong>임시 비밀번호:</strong> ${tempPassword}</p>
    </div>
    <p style="color:#EF4444;font-size:13px;margin:0 0 16px;">첫 로그인 후 반드시 비밀번호를 변경해 주세요.</p>
    <a href="${BASE_URL}/board/login" style="display:inline-block;background:#2D6A4F;color:white;text-decoration:none;font-size:15px;font-weight:bold;padding:14px 40px;border-radius:14px;">
      로그인 바로가기
    </a>
  </div>
  <p style="text-align:center;color:#9CA3AF;font-size:11px;margin-top:16px;">키즈밀 · 건강한 급식 솔루션</p>
</div>`,
  })
}

export async function sendBranchPasswordResetEmail(
  branchEmail: string,
  branchName: string,
  newPassword: string
) {
  return getResend().emails.send({
    from: FROM,
    to: branchEmail,
    subject: '[키즈밀] 임시 비밀번호가 발급되었습니다',
    html: `
<div style="font-family:'Apple SD Gothic Neo',sans-serif;max-width:480px;margin:0 auto;background:#F6FAF6;padding:24px 16px;">
  <div style="background:white;border-radius:24px;padding:40px 32px;text-align:center;">
    <div style="width:64px;height:64px;background:linear-gradient(135deg,#2D6A4F,#52B788);border-radius:18px;display:flex;align-items:center;justify-content:center;margin:0 auto 20px;">
      <span style="color:white;font-size:28px;font-weight:bold;">K</span>
    </div>
    <h1 style="color:#1C2B1E;font-size:20px;font-weight:bold;margin:0 0 8px;">임시 비밀번호가 발급되었습니다</h1>
    <p style="color:#6B7280;font-size:14px;line-height:1.6;margin:0 0 16px;">
      <strong>${branchName}</strong> 계정의 비밀번호가 초기화되었습니다.
    </p>
    <div style="background:#F0F7F4;border-radius:12px;padding:16px;text-align:left;margin-bottom:24px;">
      <p style="margin:0 0 8px;font-size:14px;color:#1C2B1E;"><strong>아이디(이메일):</strong> ${branchEmail}</p>
      <p style="margin:0;font-size:14px;color:#1C2B1E;"><strong>임시 비밀번호:</strong> ${newPassword}</p>
    </div>
    <p style="color:#EF4444;font-size:13px;margin:0 0 16px;">로그인 후 반드시 비밀번호를 변경해 주세요.</p>
    <a href="${BASE_URL}/board/login" style="display:inline-block;background:#2D6A4F;color:white;text-decoration:none;font-size:15px;font-weight:bold;padding:14px 40px;border-radius:14px;">
      로그인 바로가기
    </a>
  </div>
  <p style="text-align:center;color:#9CA3AF;font-size:11px;margin-top:16px;">키즈밀 · 건강한 급식 솔루션</p>
</div>`,
  })
}

export async function sendNewApplicationAlert(adminEmail: string, parentName: string, childName: string, branchName: string) {
  return getResend().emails.send({
    from: FROM,
    to: adminEmail,
    subject: '[키즈밀] 새 학부모 가입 신청이 도착했습니다',
    html: `
<div style="font-family:'Apple SD Gothic Neo',sans-serif;max-width:480px;margin:0 auto;background:#F6FAF6;padding:24px 16px;">
  <div style="background:white;border-radius:24px;padding:40px 32px;text-align:center;">
    <div style="width:64px;height:64px;background:linear-gradient(135deg,#2D6A4F,#52B788);border-radius:18px;display:flex;align-items:center;justify-content:center;margin:0 auto 20px;">
      <span style="color:white;font-size:28px;font-weight:bold;">K</span>
    </div>
    <h1 style="color:#1C2B1E;font-size:20px;font-weight:bold;margin:0 0 16px;">새 가입 신청이 도착했습니다 📬</h1>
    <div style="background:#F0F7F4;border-radius:12px;padding:16px;text-align:left;margin-bottom:24px;">
      <p style="margin:0 0 6px;font-size:14px;color:#1C2B1E;"><strong>보호자:</strong> ${parentName}</p>
      <p style="margin:0 0 6px;font-size:14px;color:#1C2B1E;"><strong>원아:</strong> ${childName}</p>
      <p style="margin:0;font-size:14px;color:#1C2B1E;"><strong>원:</strong> ${branchName}</p>
    </div>
    <a href="${BASE_URL}/board/admin/parents" style="display:inline-block;background:#2D6A4F;color:white;text-decoration:none;font-size:15px;font-weight:bold;padding:14px 40px;border-radius:14px;">
      승인 관리 바로가기
    </a>
  </div>
  <p style="text-align:center;color:#9CA3AF;font-size:11px;margin-top:16px;">키즈밀 · 건강한 급식 솔루션</p>
</div>`,
  })
}
