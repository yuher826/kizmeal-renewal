'use client'

import { Bell, BellOff } from 'lucide-react'

interface Props {
  enabled: boolean
  onToggle: () => void
  className?: string
}

/** 새 문의/답변 알림(소리+팝업) ON/OFF 토글 버튼 (🔔) */
export default function NotifyToggleButton({ enabled, onToggle, className = '' }: Props) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={enabled ? '알림 끄기' : '알림 켜기'}
      aria-label={enabled ? '알림 끄기' : '알림 켜기'}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
        enabled
          ? 'bg-[#2D6A4F] border-[#2D6A4F] text-white'
          : 'bg-white border-gray-200 text-gray-500 hover:border-[#2D6A4F] hover:text-[#2D6A4F]'
      } ${className}`}
    >
      {enabled ? <Bell size={14} /> : <BellOff size={14} />}
      <span>알림 {enabled ? 'ON' : 'OFF'}</span>
    </button>
  )
}
