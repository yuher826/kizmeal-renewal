import Link from 'next/link'
import { CATEGORY_COLORS, CATEGORY_ICONS, CATEGORY_LABELS, type Inquiry, type SlaRule } from '@/lib/types'
import StatusBadge from './StatusBadge'
import SlaBadge from './SlaBadge'

interface Props {
  inquiry: Inquiry
  slaRules?: Record<string, SlaRule>
  href: string
  showBranch?: boolean
  unreadCount?: number
}

function timeAgo(isoString: string) {
  const diff = Date.now() - new Date(isoString).getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(mins / 60)
  const days = Math.floor(hours / 24)
  if (days > 0) return `${days}일 전`
  if (hours > 0) return `${hours}시간 전`
  if (mins > 0) return `${mins}분 전`
  return '방금'
}

export default function InquiryCard({ inquiry, slaRules, href, showBranch = false, unreadCount }: Props) {
  const rule = slaRules?.[inquiry.category]
  const lastMessage = inquiry.messages?.[0]
  const preview = lastMessage?.content?.slice(0, 80) || '내용 없음'

  return (
    <Link href={href} className="block group">
      <div className="bg-white rounded-2xl border border-gray-100 px-5 py-4 hover:border-[#52B788] hover:shadow-sm transition-all">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${CATEGORY_COLORS[inquiry.category]}`}>
              {CATEGORY_ICONS[inquiry.category]} {CATEGORY_LABELS[inquiry.category]}
            </span>
            <StatusBadge status={inquiry.status} />
            {rule && <SlaBadge inquiry={inquiry} rule={rule} />}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {(unreadCount ?? 0) > 0 && (
              <span className="w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                {unreadCount}
              </span>
            )}
            <span className="text-xs text-gray-400 whitespace-nowrap">
              {timeAgo(inquiry.last_message_at || inquiry.created_at)}
            </span>
          </div>
        </div>

        <h3 className="font-semibold text-[#1C2B1E] text-sm mb-1 truncate group-hover:text-[#2D6A4F] transition-colors">
          {inquiry.title}
        </h3>

        {showBranch && inquiry.branches && (
          <p className="text-xs text-[#2D6A4F] font-medium mb-1">
            {inquiry.branches.name}
          </p>
        )}

        <p className="text-xs text-gray-400 line-clamp-1">{preview}</p>
      </div>
    </Link>
  )
}
