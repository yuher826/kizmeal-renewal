'use client'

import { Bell, BellOff } from 'lucide-react'

interface Props {
  enabled: boolean
  onToggle: () => void
  /** 버튼에 표시할 이름(기본 '알림'). 헤더의 "배지·목록"/"소리·팝업"처럼 화면마다
   *  다른 토글임을 명확히 할 때 넘긴다. 고객사 화면은 생략해 기존 표시를 유지한다 */
  label?: string
  className?: string
}

/** 알림(소리+팝업) ON/OFF 토글 버튼 (🔔) */
export default function NotifyToggleButton({ enabled, onToggle, label = '알림', className = '' }: Props) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={`${label} ${enabled ? '끄기' : '켜기'}`}
      aria-label={`${label} ${enabled ? '끄기' : '켜기'}`}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
        enabled
          ? 'bg-[#2D6A4F] border-[#2D6A4F] text-white'
          : 'bg-white border-gray-200 text-gray-500 hover:border-[#2D6A4F] hover:text-[#2D6A4F]'
      } ${className}`}
    >
      {enabled ? <Bell size={14} /> : <BellOff size={14} />}
      <span>{label} {enabled ? 'ON' : 'OFF'}</span>
    </button>
  )
}
