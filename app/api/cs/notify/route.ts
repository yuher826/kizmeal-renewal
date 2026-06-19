import { NextResponse } from 'next/server'
import {
  sendCsNewInquiryNotification,
  sendCsReplyNotification,
} from '@/lib/email'

export async function POST(req: Request) {
  const body = await req.json()
  const { type, branchName, branchEmail, content, inquiryId } = body as {
    type: 'new_inquiry' | 'admin_reply'
    branchName: string
    branchEmail?: string
    content: string
    inquiryId: string
  }

  if (!type || !branchName || !content || !inquiryId) {
    return NextResponse.json({ error: 'type, branchName, content, inquiryId는 필수입니다.' }, { status: 400 })
  }

  try {
    if (type === 'new_inquiry') {
      // 지점 → 관리자 알림
      await sendCsNewInquiryNotification({ branchName, content, inquiryId })
    } else if (type === 'admin_reply') {
      // 관리자 → 지점 알림 (branchEmail 없으면 스킵)
      if (!branchEmail) {
        return NextResponse.json({ success: true, notified: false, reason: 'branchEmail 없음' })
      }
      await sendCsReplyNotification({ branchName, branchEmail, content, inquiryId })
    } else {
      return NextResponse.json({ error: '알 수 없는 type입니다.' }, { status: 400 })
    }
  } catch (e) {
    // 이메일 발송 실패 — 500 에러 대신 error 필드만 반환
    console.error('[CS notify] 이메일 발송 실패:', e)
    return NextResponse.json({ success: false, error: String(e) })
  }

  return NextResponse.json({ success: true, notified: true })
}
