import { STATUS_COLORS, STATUS_LABELS, type InquiryStatus } from '@/lib/types'

interface Props {
  status: InquiryStatus
  size?: 'sm' | 'md'
  // 고객사 화면은 CUSTOMER_STATUS_LABELS를 넘긴다 — 기본값(STATUS_LABELS)은
  // ERP(내부)용이라 '확인중' 같은 내부 사정이 그대로 노출된다.
  labels?: Record<InquiryStatus, string>
}

export default function StatusBadge({ status, size = 'sm', labels = STATUS_LABELS }: Props) {
  const px = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'
  return (
    <span className={`inline-flex items-center font-semibold rounded-full ${px} ${STATUS_COLORS[status]}`}>
      {labels[status]}
    </span>
  )
}
