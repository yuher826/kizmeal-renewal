'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ChevronRight, Menu, Bell } from 'lucide-react'
import type { ErpUser } from '@/types/erp'
import { canAccessErpPage } from '@/lib/erp-access'
import NotifyToggleButton from '@/components/NotifyToggleButton'
import {
  playNotify, showBrowserNotification, setupAudioUnlock,
  requestNotificationPermission, isNotifySoundEnabled,
} from '@/lib/useNotifier'

// 헤더 배지·폴링 ON/OFF 저장 키 — CS 관리 페이지의 팝업·소리 ON/OFF
// (lib/useNotifier.ts의 cs_notify_sound_enabled)와는 완전히 독립된 별개 설정이다.
const BADGE_ENABLED_KEY = 'cs_notify_badge_enabled'

interface CsNotification {
  id: string
  inquiry_id: string
  message_id: string | null
  kind: 'new_inquiry' | 'new_message' | 'takeover'
  branch_name: string | null
  preview: string | null
  created_at: string
}

// takeover만 구분 표시한다 — new_inquiry/new_message는 지금처럼 branch_name +
// preview로 이미 구분되지만, takeover의 preview는 "누가 이어받았다"는 문장이라
// branch_name만 보면 평범한 새 메시지처럼 보인다.
const KIND_TAG: Partial<Record<CsNotification['kind'], string>> = {
  takeover: '🔄 이어받음',
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

  // CS 알림 — /erp/inquiries에 접근 가능한 사람에게만 폴링한다(생성 API와 동일
  // 기준으로 맞춘다 — 기준이 어긋나면 "알림은 쌓이는데 종이 안 보이는" 상태가 된다).
  // 나머지(영양사 등)는 어차피 빈 응답만 30초마다 받게 되므로 요청 자체를 안 만든다.
  const canSeeCs = canAccessErpPage(user, '/erp/inquiries')
  const [notifications, setNotifications] = useState<CsNotification[]>([])
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  // 배지·폴링 ON/OFF. 서버(SSR)엔 localStorage가 없으므로 초기값은 항상 true로
  // 시작해 hydration mismatch를 피하고, 저장된 값은 마운트 후 아래 effect에서 반영한다.
  const [badgeEnabled, setBadgeEnabled] = useState(true)
  // 이어받기(takeover) 소리·팝업용 — 이미 본 적 있는 알림 id(중복 재생 방지)와
  // "첫 조회를 끝냈는지" 플래그(첫 조회는 기준선만 잡고 울리지 않는다).
  const seenTakeoverIdsRef = useRef<Set<string>>(new Set())
  const firstFetchDoneRef = useRef(false)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(BADGE_ENABLED_KEY)
      if (saved !== null) setBadgeEnabled(saved === 'true')
    } catch {
      /* localStorage 접근 불가 환경은 기본값(ON) 유지 */
    }
  }, [])

  // CS 화면에 안 들어간 사람도 이어받기 소리가 나도록, 헤더가 마운트되는
  // 시점에 미리 준비해 둔다(오디오 unlock 바인딩·팝업 권한 요청).
  useEffect(() => {
    if (!canSeeCs) return
    setupAudioUnlock()
    if (isNotifySoundEnabled()) void requestNotificationPermission()
  }, [canSeeCs])

  function toggleBadge() {
    setBadgeEnabled(prev => {
      const next = !prev
      try {
        localStorage.setItem(BADGE_ENABLED_KEY, String(next))
      } catch {
        /* 저장 실패해도 이번 세션 동작엔 영향 없음 */
      }
      return next
    })
  }

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/cs/notifications')
      if (!res.ok) return
      const json = await res.json()
      const list: CsNotification[] = json.notifications || []
      setNotifications(list)

      // 이어받기(takeover)만 소리+팝업 — 원래 담당자가 모르고 계속 처리하면
      // 중복 대응이 생긴다. new_inquiry/new_message는 CS 화면(inquiries/page.tsx)의
      // 실시간 구독에서만 울려서, 여기서까지 울리면 이중 재생이 된다.
      const takeovers = list.filter(n => n.kind === 'takeover')
      if (!firstFetchDoneRef.current) {
        // 첫 조회는 기준선만 잡는다 — 새로고침·로그인 직후 지난 알림이
        // 한꺼번에 울리는 것을 막기 위해.
        takeovers.forEach(n => seenTakeoverIdsRef.current.add(n.id))
        firstFetchDoneRef.current = true
        return
      }
      const newTakeovers = takeovers.filter(n => !seenTakeoverIdsRef.current.has(n.id))
      takeovers.forEach(n => seenTakeoverIdsRef.current.add(n.id))
      if (newTakeovers.length > 0 && isNotifySoundEnabled()) {
        playNotify('/sounds/takeover.mp3') // 여러 건이 동시에 와도 소리는 1회
        newTakeovers.slice(0, 3).forEach(n => {
          showBrowserNotification(
            '🔄 담당 문의를 이어받았습니다',
            `${n.branch_name || '고객사'} · ${n.preview || ''}`,
            () => router.push(`/erp/inquiries?id=${n.inquiry_id}`)
          )
        })
      }
    } catch {
      /* 폴링 실패는 조용히 무시 — 다음 주기에 다시 시도 */
    }
  }, [router])

  // ★OFF일 땐 요청 자체를 안 만든다 — 배지만 숨기고 30초마다 계속 폴링하면 의미가
  //   없다. DB 쪽 생성(cs_notifications INSERT)은 계속 일어나므로, 다시 켜면
  //   effect가 재실행되며 그동안 쌓인 알림을 즉시 가져온다.
  useEffect(() => {
    if (!canSeeCs || !badgeEnabled) return
    fetchNotifications()
    const timer = setInterval(fetchNotifications, 30000)
    return () => clearInterval(timer)
  }, [canSeeCs, badgeEnabled, fetchNotifications])

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
              {badgeEnabled && notifications.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {notifications.length > 9 ? '9+' : notifications.length}
                </span>
              )}
            </button>

            {open && (
              <div className="absolute right-0 mt-2 w-80 max-w-[90vw] bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 gap-2">
                  <span className="text-sm font-semibold text-slate-800 flex-shrink-0">CS 알림</span>
                  <div className="flex items-center gap-2">
                    <NotifyToggleButton enabled={badgeEnabled} onToggle={toggleBadge} />
                    {badgeEnabled && notifications.length > 0 && (
                      <button
                        type="button"
                        onClick={handleMarkAllRead}
                        className="text-xs text-[#2D6A4F] font-medium hover:underline flex-shrink-0"
                      >
                        모두 읽음
                      </button>
                    )}
                  </div>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {!badgeEnabled ? (
                    <p className="px-4 py-8 text-center text-sm text-slate-400">알림이 꺼져 있습니다. 켜면 다시 받습니다.</p>
                  ) : notifications.length === 0 ? (
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
                          <span className="text-sm font-semibold text-slate-800 truncate flex items-center gap-1.5">
                            {KIND_TAG[n.kind] && (
                              <span className="text-[10px] font-semibold text-amber-700 bg-amber-100 rounded px-1.5 py-0.5 flex-shrink-0">
                                {KIND_TAG[n.kind]}
                              </span>
                            )}
                            <span className="truncate">{n.branch_name || '고객사'}</span>
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
