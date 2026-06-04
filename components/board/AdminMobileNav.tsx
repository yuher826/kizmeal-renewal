'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'

type NavItem = { icon: string; label: string; href: string }
type NavGroup = { title: string; icon: string; items: NavItem[] }

const NAV_GROUPS: NavGroup[] = [
  {
    title: '홈페이지 관리', icon: '🌐',
    items: [
      { icon: '📝', label: '콘텐츠 관리',    href: '/board/admin/content' },
      { icon: '📢', label: '홈페이지 공지',   href: '/board/admin/notices?type=public' },
    ],
  },
  {
    title: '소통허브 관리', icon: '💬',
    items: [
      { icon: '💬', label: '문의 관리',   href: '/board/admin/inquiries' },
      { icon: '📣', label: '가맹점 공지', href: '/board/admin/notices?type=branch' },
      { icon: '🍱', label: '식단표 배포', href: '/board/admin/diet' },
    ],
  },
  {
    title: '운영 관리', icon: '⚙️',
    items: [
      { icon: '🏠', label: '대시보드',   href: '/board/admin' },
      { icon: '🏫', label: '원 관리',    href: '/board/admin/branches' },
      { icon: '👨‍👩‍👧', label: '학부모 승인', href: '/board/admin/parents' },
      { icon: '📊', label: '통계',       href: '/board/admin/stats' },
    ],
  },
]

function getPageTitle(pathname: string, searchParams: URLSearchParams): string {
  const type = searchParams.get('type')
  if (pathname.startsWith('/board/admin/notices')) {
    if (type === 'public') return '홈페이지 공지'
    if (type === 'branch') return '가맹점 공지'
    return '공지사항'
  }
  if (pathname.startsWith('/board/admin/content'))    return '콘텐츠 관리'
  if (pathname.startsWith('/board/admin/inquiries'))  return '문의 관리'
  if (pathname.startsWith('/board/admin/diet'))       return '식단표 배포'
  if (pathname.startsWith('/board/admin/branches'))   return '원 관리'
  if (pathname.startsWith('/board/admin/parents'))    return '학부모 승인'
  if (pathname.startsWith('/board/admin/stats'))      return '통계'
  if (pathname === '/board/admin')                    return '대시보드'
  return '소통채널'
}

export default function AdminMobileNav() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()

  useEffect(() => { setOpen(false) }, [pathname])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  async function handleLogout() {
    setOpen(false)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/board/login')
  }

  function isActive(href: string) {
    const [path, query] = href.split('?')
    if (query) {
      const type = new URLSearchParams(query).get('type')
      return pathname === path && searchParams.get('type') === type
    }
    if (path === '/board/admin') return pathname === path
    return pathname === path || pathname.startsWith(path + '/')
  }

  return (
    <>
      {/* ── 고정 상단 헤더 바 (모바일 전용) ─────────────────── */}
      <header className="sm:hidden fixed top-0 left-0 right-0 h-14 bg-white border-b border-gray-100 z-30 flex items-center px-3 gap-2.5">
        <button
          type="button"
          aria-label="메뉴 열기"
          onClick={() => setOpen(true)}
          className="w-10 h-10 flex items-center justify-center text-gray-600 hover:text-[#2D6A4F] hover:bg-gray-50 rounded-xl transition-colors flex-shrink-0"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <rect x="2" y="4"  width="16" height="2" rx="1" fill="currentColor"/>
            <rect x="2" y="9"  width="16" height="2" rx="1" fill="currentColor"/>
            <rect x="2" y="14" width="16" height="2" rx="1" fill="currentColor"/>
          </svg>
        </button>
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 bg-gradient-to-br from-[#2D6A4F] to-[#52B788] rounded-lg flex items-center justify-center text-white font-bold text-xs flex-shrink-0">K</div>
          <div className="min-w-0">
            <p className="text-xs text-gray-400 leading-none">소통채널 관리자</p>
            <p className="text-sm font-bold text-[#1C2B1E] leading-tight truncate">
              {getPageTitle(pathname, searchParams)}
            </p>
          </div>
        </div>
      </header>

      {/* ── 스페이서 ─────────────────────────────────────────── */}
      <div className="sm:hidden h-14 flex-shrink-0" aria-hidden="true" />

      {/* ── 백드롭 ────────────────────────────────────────────── */}
      <div
        aria-hidden="true"
        onClick={() => setOpen(false)}
        className={`sm:hidden fixed inset-0 z-40 bg-black/40 transition-opacity duration-300 ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* ── 좌측 슬라이드 드로어 ──────────────────────────────── */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="관리자 메뉴"
        className={`sm:hidden fixed top-0 left-0 bottom-0 z-50 w-72 bg-white flex flex-col shadow-2xl transition-transform duration-300 ease-in-out ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* 드로어 헤더 */}
        <div className="flex items-center justify-between px-5 h-16 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-[#2D6A4F] to-[#52B788] rounded-xl flex items-center justify-center text-white font-bold">K</div>
            <div>
              <p className="text-xs text-gray-400 leading-none mb-0.5">소통채널</p>
              <p className="text-sm font-bold text-[#1C2B1E]">관리자 메뉴</p>
            </div>
          </div>
          <button
            type="button"
            aria-label="메뉴 닫기"
            onClick={() => setOpen(false)}
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* 그룹 네비게이션 */}
        <nav className="flex-1 min-h-0 px-3 py-3 overflow-y-auto space-y-1 max-h-[calc(100vh-140px)]">
          {NAV_GROUPS.map((group, gi) => (
            <div key={group.title} className={gi > 0 ? 'pt-2 border-t border-gray-100' : ''}>
              {/* 그룹 타이틀 */}
              <p className="px-3 pt-2 pb-1 text-[10px] font-bold text-gray-400 uppercase tracking-wide flex items-center gap-1">
                <span>{group.icon}</span>{group.title}
              </p>
              {group.items.map(item => {
                const active = isActive(item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-3 rounded-xl mb-0.5 text-sm font-medium transition-colors ${
                      active
                        ? 'bg-[#E8F5E9] text-[#2D6A4F]'
                        : 'text-gray-700 hover:bg-gray-50 active:bg-gray-100'
                    }`}
                  >
                    <span className="text-base w-6 text-center leading-none flex-shrink-0">{item.icon}</span>
                    <span className="flex-1">{item.label}</span>
                    {active && <span className="w-1.5 h-1.5 bg-[#2D6A4F] rounded-full flex-shrink-0" />}
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>

        {/* 로그아웃 */}
        <div className="px-3 pt-3 pb-8 border-t border-gray-100 flex-shrink-0">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 active:bg-red-100 transition-colors"
          >
            <span className="text-base w-6 text-center leading-none">🚪</span>
            <span>로그아웃</span>
          </button>
        </div>
      </div>
    </>
  )
}
