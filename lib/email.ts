import { Resend } from 'resend'

// 발신 이메일 주소 (다른 파일에서도 import해서 통일 사용)
export const FROM_EMAIL = 'noreply@kizmeal.com'
const BASE_URL = 'https://kizmeal-renewal.vercel.app'
// CS 관리자 알림 수신 이메일 (권팀장)
const CS_ADMIN_EMAIL = 'desafinado@kizmeal.com'

function getResend() {
  return new Resend(process.env.RESEND_API_KEY)
}

// 테스트 모드이면 실제 수신자 대신 TEST_EMAIL로 발송
function resolveRecipient(email: string): string {
  if (process.env.EMAIL_TEST_MODE === 'true') {
    return process.env.TEST_EMAIL || email
  }
  return email
}

export async function sendApprovalEmail(parentEmail: string, parentName: string, childName: string) {
  return getResend().emails.send({
    from: FROM_EMAIL,
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
    from: FROM_EMAIL,
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

// 관리자 계정 생성 안내 (보안상 임시 비밀번호는 메일에 포함하지 않음 — 담당자가 직접 전달)
export async function sendAdminAccountEmail(adminEmail: string, adminName: string) {
  return getResend().emails.send({
    from: FROM_EMAIL,
    to: resolveRecipient(adminEmail),
    subject: '[키즈밀] ERP 관리자 계정이 생성되었습니다',
    html: `
<div style="font-family:'Apple SD Gothic Neo',sans-serif;max-width:480px;margin:0 auto;background:#F6FAF6;padding:24px 16px;">
  <div style="background:white;border-radius:24px;padding:40px 32px;text-align:center;">
    <div style="width:64px;height:64px;background:linear-gradient(135deg,#2D6A4F,#52B788);border-radius:18px;display:flex;align-items:center;justify-content:center;margin:0 auto 20px;">
      <span style="color:white;font-size:28px;font-weight:bold;">K</span>
    </div>
    <h1 style="color:#1C2B1E;font-size:20px;font-weight:bold;margin:0 0 8px;">ERP 관리자 계정이 생성되었습니다</h1>
    <p style="color:#6B7280;font-size:14px;line-height:1.6;margin:0 0 16px;">
      안녕하세요, <strong>${adminName}</strong>님!<br>
      키즈밀 ERP 관리자 계정이 생성되었습니다.
    </p>
    <div style="background:#F0F7F4;border-radius:12px;padding:16px;text-align:left;margin-bottom:24px;">
      <p style="margin:0;font-size:14px;color:#1C2B1E;"><strong>아이디(이메일):</strong> ${adminEmail}</p>
    </div>
    <p style="color:#6B7280;font-size:13px;margin:0 0 8px;">임시 비밀번호는 담당자에게 별도로 전달받으세요.</p>
    <p style="color:#EF4444;font-size:13px;margin:0 0 16px;">첫 로그인 후 반드시 비밀번호를 변경해 주세요.</p>
    <a href="${BASE_URL}/erp/login" style="display:inline-block;background:#2D6A4F;color:white;text-decoration:none;font-size:15px;font-weight:bold;padding:14px 40px;border-radius:14px;">
      ERP 로그인
    </a>
  </div>
  <p style="text-align:center;color:#9CA3AF;font-size:11px;margin-top:16px;">키즈밀 · 건강한 급식 솔루션</p>
</div>`,
  })
}

export async function sendNewApplicationAlert(adminEmail: string, parentName: string, childName: string, branchName: string) {
  return getResend().emails.send({
    from: FROM_EMAIL,
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

// ── 식단 검토 영양사 알림 ─────────────────────────────────────────
const NUTRITIONIST_EMAIL = 'sy226@kizmeal.com'

export async function sendDietApprovalNotification({
  approvedCount,
  resubmittedCount,
  month,
  tabType,
  approvedBranchNames,
}: {
  approvedCount:       number
  resubmittedCount:    number
  month:               string
  tabType:             'standard' | 'special'
  approvedBranchNames: string[]
}) {
  const tabLabel       = tabType === 'standard' ? '표준' : '특이'
  const to             = resolveRecipient(NUTRITIONIST_EMAIL)
  const subject        = `[키즈밀] ${month} 식단 검토 완료 — ${tabLabel} 업장 ${approvedCount}건 배포 요청`
  const branchListHtml = approvedBranchNames
    .map(n => `<li style="margin:0 0 4px;color:#1C2B1E;font-size:14px;">• ${n}</li>`)
    .join('')
  const resubmittedNote = resubmittedCount > 0
    ? `<span style="color:#1565C0;font-size:12px;margin-left:4px;">(재제출 포함 ${resubmittedCount}건)</span>`
    : ''
  const specialNote = tabType === 'special'
    ? `<p style="color:#92400E;font-size:13px;margin:12px 0 0;font-weight:600;">각 업장 파일 형식 확인 후 배포 진행 요망</p>`
    : ''

  return getResend().emails.send({
    from: FROM_EMAIL,
    to,
    subject,
    html: `
<div style="font-family:'Apple SD Gothic Neo',sans-serif;max-width:480px;margin:0 auto;background:#F6FAF6;padding:24px 16px;">
  <div style="background:white;border-radius:24px;padding:40px 32px;">
    <div style="text-align:center;margin-bottom:20px;">
      <div style="width:64px;height:64px;background:linear-gradient(135deg,#2D6A4F,#52B788);border-radius:18px;display:inline-flex;align-items:center;justify-content:center;">
        <span style="color:white;font-size:28px;font-weight:bold;">K</span>
      </div>
    </div>
    <h1 style="color:#1C2B1E;font-size:20px;font-weight:bold;margin:0 0 8px;text-align:center;">
      ${month} 식단 검토 완료 ✅
    </h1>
    <p style="color:#6B7280;font-size:14px;text-align:center;margin:0 0 16px;">
      ${tabLabel} 업장 <strong>${approvedCount}건</strong> 배포 요청${resubmittedNote}
    </p>
    <div style="background:#F0F7F4;border-radius:12px;padding:16px;margin-bottom:24px;">
      <p style="font-size:13px;font-weight:600;color:#2D6A4F;margin:0 0 8px;">승인된 업장 목록</p>
      <ul style="margin:0;padding:0;list-style:none;">${branchListHtml}</ul>
      ${specialNote}
    </div>
    <div style="text-align:center;">
      <a href="${BASE_URL}/erp/review" style="display:inline-block;background:#2D6A4F;color:white;text-decoration:none;font-size:15px;font-weight:bold;padding:14px 40px;border-radius:14px;">
        ERP 배포 페이지 바로가기
      </a>
    </div>
  </div>
  <p style="text-align:center;color:#9CA3AF;font-size:11px;margin-top:16px;">키즈밀 · 건강한 급식 솔루션</p>
</div>`,
  })
}

// ── CS 알림 함수 ─────────────────────────────────────────────────

/** 새 문의 접수 알림 — 지점이 메시지 보냈을 때 관리자(권팀장)에게 발송 */
export async function sendCsNewInquiryNotification({
  branchName,
  content,
  inquiryId,
}: {
  branchName: string
  content: string
  inquiryId: string
}) {
  // 앞 150자까지만 본문 미리보기 표시
  const preview = content.length > 150 ? content.slice(0, 150) + '...' : content
  const to = resolveRecipient(CS_ADMIN_EMAIL)

  return getResend().emails.send({
    from: FROM_EMAIL,
    to,
    subject: `[키즈밀 CS] 새 문의 접수 — ${branchName}`,
    html: `
<div style="font-family:'Apple SD Gothic Neo',sans-serif;max-width:480px;margin:0 auto;background:#F6FAF6;padding:24px 16px;">
  <div style="background:white;border-radius:24px;padding:40px 32px;">
    <div style="text-align:center;margin-bottom:20px;">
      <div style="width:64px;height:64px;background:linear-gradient(135deg,#2D6A4F,#52B788);border-radius:18px;display:inline-flex;align-items:center;justify-content:center;">
        <span style="color:white;font-size:28px;font-weight:bold;">K</span>
      </div>
    </div>
    <h1 style="color:#1C2B1E;font-size:20px;font-weight:bold;margin:0 0 8px;text-align:center;">새 문의가 접수되었습니다 📬</h1>
    <div style="background:#F0F7F4;border-radius:12px;padding:16px;margin:20px 0;">
      <p style="margin:0 0 8px;font-size:14px;color:#1C2B1E;"><strong>지점명:</strong> ${branchName}</p>
      <p style="margin:0;font-size:14px;color:#6B7280;line-height:1.6;white-space:pre-wrap;">${preview}</p>
    </div>
    <div style="text-align:center;">
      <a href="${BASE_URL}/erp/inquiries?id=${inquiryId}" style="display:inline-block;background:#2D6A4F;color:white;text-decoration:none;font-size:15px;font-weight:bold;padding:14px 40px;border-radius:14px;">
        ERP에서 확인하기
      </a>
    </div>
  </div>
  <p style="text-align:center;color:#9CA3AF;font-size:11px;margin-top:16px;">키즈밀 · 건강한 급식 솔루션</p>
</div>`,
  })
}

/** 관리자 답변 알림 — 관리자가 답변했을 때 지점에게 발송 */
export async function sendCsReplyNotification({
  branchName,
  branchEmail,
  content,
  inquiryId,
}: {
  branchName: string
  branchEmail: string
  content: string
  inquiryId: string
}) {
  // branchEmail이 없으면 발송 스킵
  if (!branchEmail) return
  // 앞 150자까지만 본문 미리보기 표시
  const preview = content.length > 150 ? content.slice(0, 150) + '...' : content
  const to = resolveRecipient(branchEmail)

  return getResend().emails.send({
    from: FROM_EMAIL,
    to,
    subject: `[키즈밀] 문의에 답변이 등록되었습니다`,
    html: `
<div style="font-family:'Apple SD Gothic Neo',sans-serif;max-width:480px;margin:0 auto;background:#F6FAF6;padding:24px 16px;">
  <div style="background:white;border-radius:24px;padding:40px 32px;">
    <div style="text-align:center;margin-bottom:20px;">
      <div style="width:64px;height:64px;background:linear-gradient(135deg,#2D6A4F,#52B788);border-radius:18px;display:inline-flex;align-items:center;justify-content:center;">
        <span style="color:white;font-size:28px;font-weight:bold;">K</span>
      </div>
    </div>
    <h1 style="color:#1C2B1E;font-size:20px;font-weight:bold;margin:0 0 8px;text-align:center;">문의에 답변이 등록되었습니다 💬</h1>
    <p style="color:#6B7280;font-size:14px;line-height:1.6;margin:0 0 16px;text-align:center;">
      안녕하세요, <strong>${branchName}</strong>님!<br>
      키즈밀 영양팀이 답변을 등록했습니다.
    </p>
    <div style="background:#E8F5E9;border-radius:12px;padding:16px;margin-bottom:24px;">
      <div style="font-size:11px;color:#52B788;font-weight:600;margin-bottom:8px;">키즈밀 답변</div>
      <div style="color:#1C2B1E;font-size:14px;line-height:1.7;white-space:pre-wrap;">${preview}</div>
    </div>
    <div style="text-align:center;">
      <a href="${BASE_URL}/board/inquiries/${inquiryId}" style="display:inline-block;background:#2D6A4F;color:white;text-decoration:none;font-size:15px;font-weight:bold;padding:14px 40px;border-radius:14px;">
        답변 확인하기
      </a>
    </div>
  </div>
  <p style="text-align:center;color:#9CA3AF;font-size:11px;margin-top:16px;">키즈밀 · 건강한 급식 솔루션</p>
</div>`,
  })
}
