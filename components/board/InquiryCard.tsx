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
  // 대화 내용 검색(권팀장 요청 8-2)에서 제목이 아니라 대화 내용으로 매칭된
  // 경우, 그 매칭된 부분을 보여주기 위한 미리보기(있으면 기본 preview 대신 표시)
  matchPreview?: string
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

// 권팀장 요청: 상대시간만으론 정확한 시점을 알 수 없어서, 옆에 정확한
// 날짜·시간이 바로 보이도록 함(호버 툴팁은 캡처·확인이 번거롭다는 피드백으로
// 상시 노출로 변경).
function fullDateTime(isoString: string) {
  return new Date(isoString).toLocaleString('ko-KR', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  })
}

export default function InquiryCard({ inquiry, slaRules, href, showBranch = false, unreadCount, matchPreview }: Props) {
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
              <span className="text-gray-300"> · {fullDateTime(inquiry.last_message_at || inquiry.created_at)}</span>
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

        {matchPreview && (
          <p className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-1 mt-2 line-clamp-1">
            💬 {matchPreview}
          </p>
        )}
      </div>
    </Link>
  )
}
