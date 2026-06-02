import { redirect } from 'next/navigation'

// 기존 완성된 1:1 문의 페이지(/board/inquiries)로 연결
export default function CustomerInquiriesRedirect() {
  redirect('/board/inquiries')
}
