'use client'

export interface DietNotification {
  id: string
  type: string
  title: string
  message?: string
  branch_id?: string
  is_read: boolean
  created_at: string
  recipient_role?: string
}

const TYPE_META: Record<string, { icon: string; color: string }> = {
  input_complete:        { icon: '✅', color: '#2196F3' },
  review_request:        { icon: '👀', color: '#FF9800' },
  correction_request:    { icon: '✏️',  color: '#F44336' },
  approve_complete:      { icon: '✔️',  color: '#4CAF50' },
  deploy_complete:       { icon: '🚀', color: '#2D6A4F' },
  email_bounce:          { icon: '⚠️', color: '#F44336' },
  email_resent:          { icon: '📧', color: '#607D8B' },
  pptx_failed:           { icon: '❌', color: '#F44336' },
  pptx_retry_success:    { icon: '🔄', color: '#9C27B0' },
  receipt_confirmed:     { icon: '📬', color: '#00BCD4' },
  urgent_change_request: { icon: '🔴', color: '#F44336' },
  content_error_report:  { icon: '🐛', color: '#FF5722' },
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)   return '방금 전'
  if (m < 60)  return `${m}분 전`
  const h = Math.floor(m / 60)
  if (h < 24)  return `${h}시간 전`
  return `${Math.floor(h / 24)}일 전`
}

export default function DietNotificationPanel({
  notifications = [],
  onMarkRead,
}: {
  notifications?: DietNotification[]
  onMarkRead?: (id: string) => void
}) {
  const unread = notifications.filter(n => !n.is_read).length

  if (notifications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <span className="text-5xl mb-4">🔔</span>
        <p className="text-sm font-medium text-gray-500">새 알림이 없습니다</p>
        <p className="text-xs mt-1 text-gray-400">
          식단 입력·검토·승인·배포 시 알림이 여기 표시됩니다
        </p>
      </div>
    )
  }

  return (
    <div>
      {unread > 0 && (
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-[#2D6A4F]">
            읽지 않은 알림 {unread}개
          </span>
          {onMarkRead && (
            <button
              type="button"
              onClick={() => notifications.filter(n => !n.is_read).forEach(n => onMarkRead(n.id))}
              className="text-xs text-gray-400 hover:text-[#2D6A4F] transition-colors"
            >
              모두 읽음 처리
            </button>
          )}
        </div>
      )}
      <ul className="space-y-2">
        {notifications.map(n => {
          const meta = TYPE_META[n.type] ?? { icon: '🔔', color: '#9E9E9E' }
          return (
            <li
              key={n.id}
              className={`flex items-start gap-3 p-3 rounded-xl border transition-colors ${
                n.is_read
                  ? 'bg-white border-gray-100 text-gray-500'
                  : 'bg-[#F6FAF6] border-[#B7E4C7]'
              }`}
            >
              <span className="text-lg leading-none flex-shrink-0 mt-0.5">{meta.icon}</span>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium leading-snug ${n.is_read ? 'text-gray-500' : 'text-[#1C2B1E]'}`}>
                  {n.title}
                </p>
                {n.message && (
                  <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{n.message}</p>
                )}
                <p className="text-[10px] text-gray-400 mt-1">{timeAgo(n.created_at)}</p>
              </div>
              {!n.is_read && onMarkRead && (
                <button
                  type="button"
                  onClick={() => onMarkRead(n.id)}
                  className="flex-shrink-0 w-5 h-5 rounded-full bg-[#2D6A4F] flex items-center justify-center hover:bg-[#1B4332] transition-colors"
                  aria-label="읽음 처리"
                >
                  <span className="text-[10px] text-white leading-none">✓</span>
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
