import { STATUS_COLORS, STATUS_LABELS, type InquiryStatus } from '@/lib/types'

interface Props {
  status: InquiryStatus
  size?: 'sm' | 'md'
}

export default function StatusBadge({ status, size = 'sm' }: Props) {
  const px = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'
  return (
    <span className={`inline-flex items-center font-semibold rounded-full ${px} ${STATUS_COLORS[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  )
}
