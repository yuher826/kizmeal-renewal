'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ChevronRight, Menu, Bell } from 'lucide-react'
import type { ErpUser } from '@/types/erp'
import { canHandleCs } from '@/lib/roles'

interface CsNotification {
  id: string
  inquiry_id: string
  message_id: string | null
  kind: 'new_inquiry' | 'new_message'
  branch_name: string | null
  preview: string | null
  created_at: string
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(mins / 60)
  const days = Math.floor(hours / 24)
  if (days > 0) return `${days}일 전`
  if (hours > 0) return `${hours}시간 전`
  if (mins > 0) return `${mins}분 전`
  return '방금'
}

const BREADCRUMB_MAP: Record<string, { groups: string[]; page: string }> = {
  '/erp/diet':            { groups: ['식단 관리'], page: '식단 자동화' },
  '/erp/review':          { groups: ['식단 관리'], page: '식단 검토' },
  '/erp/branches/new':    { groups: ['식단 관리', '원 프로파일'], page: '신규 등록' },
  '/erp/branches/':       { groups: ['식단 관리', '원 프로파일'], page: '상세' },
  '/erp/branches':        { groups: ['식단 관리'], page: '원 프로파일' },
  '/erp/notices/new':     { groups: ['소통 관리', '고객사 공지'], page: '공지 작성' },
  '/erp/notices':         { groups: ['소통 관리'], page: '고객사 공지' },
  '/erp/inquiries':       { groups: ['소통 관리'], page: 'CS 관리' },
  '/erp/files/new':       { groups: ['소통 관리', '파일보관함'], page: '새 파일 올리기' },
  '/erp/files':           { groups: ['소통 관리'], page: '파일보관함' },
  '/erp/email':           { groups: ['배포 관리'], page: '이메일 배포' },
  '/erp/stats':           { groups: ['분석'],      page: '통계' },
  '/erp/my-page':         { groups: [],             page: '마이페이지' },
}

const ROLE_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  super_admin:  { bg: 'bg-purple-100', text: 'text-purple-700', label: '슈퍼관리자' },
  admin:        { bg: 'bg-blue-100',   text: 'text-blue-700',   label: '관리자' },
  manager:      { bg: 'bg-blue-100',   text: 'text-blue-700',   label: '매니저' },
  director:     { bg: 'bg-orange-100', text: 'text-orange-700', label: '디렉터' },
  nutritionist_ck:          { bg: 'bg-green-100', text: 'text-green-700', label: '영양사 (직영)' },
  nutritionist_consignment: { bg: 'bg-green-100', text: 'text-green-700', label: '영양사 (위탁)' },
  staff:        { bg: 'bg-slate-100',  text: 'text-slate-600',  label: '직원' },
}

interface Props {
  user: ErpUser
  onMenuClick: () => void
}

export default function ErpHeader({ user, onMenuClick }: Props) {
  const pathname = usePathname()
  const router = useRouter()

  // 가장 긴 prefix 매칭
  const matchedKey = Object.keys(BREADCRUMB_MAP)
    .filter(k => pathname.startsWith(k))
    .sort((a, b) => b.length - a.length)[0]

  const crumb = matchedKey ? BREADCRUMB_MAP[matchedKey] : null
  const badge = ROLE_BADGE[user.role] ?? ROLE_BADGE.admin

  // CS 알림 — CS 담당자(canHandleCs)에게만 폴링한다. 나머지(영양사·director 등)는
  // 어차피 빈 응답만 30초마다 받게 되므로 아예 요청 자체를 만들지 않는다.
  const canSeeCs = canHandleCs(user)
  const [notifications, setNotifications] = useState<CsNotification[]>([])
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/cs/notifications')
      if (!res.ok) return
      const json = await res.json()
      setNotifications(json.notifications || [])
    } catch {
      /* 폴링 실패는 조용히 무시 — 다음 주기에 다시 시도 */
    }
  }, [])

  useEffect(() => {
    if (!canSeeCs) return
    fetchNotifications()
    const timer = setInterval(fetchNotifications, 30000)
    return () => clearInterval(timer)
  }, [canSeeCs, fetchNotifications])

  // 드롭다운 바깥 클릭 시 닫기
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  async function markRead(ids: string[]) {
    setNotifications(prev => prev.filter(n => !ids.includes(n.id)))
    try {
      await fetch('/api/cs/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      })
    } catch {
      /* 읽음 처리 실패해도 다음 폴링에서 다시 내려오므로 조용히 무시 */
    }
  }

  function handleNotificationClick(n: CsNotification) {
    setOpen(false)
    markRead([n.id])
    router.push(`/erp/inquiries?id=${n.inquiry_id}`)
  }

  function handleMarkAllRead() {
    if (notifications.length === 0) return
    markRead(notifications.map(n => n.id))
  }

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 flex-shrink-0">
      {/* 왼쪽: 햄버거(모바일) + 브레드크럼 */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="메뉴 열기"
          onClick={onMenuClick}
          className="lg:hidden w-9 h-9 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <Menu size={20} />
        </button>

        {crumb ? (
          <nav className="flex items-center gap-1" aria-label="브레드크럼">
            <span className="text-xs text-slate-400">ERP</span>
            {crumb.groups.map(g => (
              <span key={g} className="flex items-center gap-1">
                <ChevronRight size={12} className="text-slate-300" />
                <span className="text-xs text-slate-400">{g}</span>
              </span>
            ))}
            <ChevronRight size={12} className="text-slate-300" />
            <span className="text-sm font-semibold text-slate-800">{crumb.page}</span>
          </nav>
        ) : (
          <span className="text-sm font-semibold text-slate-800">ERP</span>
        )}
      </div>

      {/* 오른쪽: 알림 + 유저 */}
      <div className="flex items-center gap-3">
        {canSeeCs && (
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              aria-label="CS 알림"
              onClick={() => setOpen(prev => !prev)}
              className="relative w-9 h-9 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <Bell size={20} />
              {notifications.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {notifications.length > 9 ? '9+' : notifications.length}
                </span>
              )}
            </button>

            {open && (
              <div className="absolute right-0 mt-2 w-80 max-w-[90vw] bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                  <span className="text-sm font-semibold text-slate-800">CS 알림</span>
                  {notifications.length > 0 && (
                    <button
                      type="button"
                      onClick={handleMarkAllRead}
                      className="text-xs text-[#2D6A4F] font-medium hover:underline"
                    >
                      모두 읽음
                    </button>
                  )}
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <p className="px-4 py-8 text-center text-sm text-slate-400">새 알림이 없습니다</p>
                  ) : (
                    notifications.map(n => (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => handleNotificationClick(n)}
                        className="w-full text-left px-4 py-3 border-b border-slate-50 last:border-b-0 hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-slate-800 truncate">
                            {n.branch_name || '고객사'}
                          </span>
                          <span className="text-xs text-slate-400 flex-shrink-0">{timeAgo(n.created_at)}</span>
                        </div>
                        {n.preview && (
                          <p className="text-xs text-slate-500 mt-0.5 truncate">{n.preview}</p>
                        )}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}
        <div className="w-px h-5 bg-slate-200" aria-hidden="true" />
        <div className="flex items-center gap-2">
          <Link
            href="/erp/my-page"
            className="text-sm text-slate-600 hidden sm:block hover:underline"
          >
            {user.name}
          </Link>
          <span className={`text-xs font-medium rounded px-1.5 py-0.5 ${badge.bg} ${badge.text}`}>
            {badge.label}
          </span>
        </div>
      </div>
    </header>
  )
}
