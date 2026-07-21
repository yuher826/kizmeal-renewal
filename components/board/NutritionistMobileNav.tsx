'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { KIZMEAL_LOGO_PATH } from '@/lib/brand'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

const NAV = [
  { icon: '🏠', label: '대시보드', href: '/nutritionist/dashboard' },
  { icon: '🖼️', label: '컨텐츠 등록', href: '/nutritionist/upload' },
]

function getPageTitle(pathname: string): string {
  if (pathname.startsWith('/nutritionist/upload')) return '컨텐츠 등록'
  if (pathname === '/nutritionist/dashboard') return '대시보드'
  return '영양사'
}

export default function NutritionistMobileNav() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
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
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={KIZMEAL_LOGO_PATH} alt="키즈밀 로고" className="h-7 w-auto object-contain flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-xs text-gray-400 leading-none">영양사</p>
            <p className="text-sm font-bold text-[#1C2B1E] leading-tight truncate">
              {getPageTitle(pathname)}
            </p>
          </div>
        </div>
      </header>

      {/* ── 헤더 높이 스페이서 (모바일 전용) ────────────────── */}
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
        aria-label="영양사 메뉴"
        className={`sm:hidden fixed top-0 left-0 bottom-0 z-50 w-72 bg-white flex flex-col shadow-2xl transition-transform duration-300 ease-in-out ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* 드로어 헤더 */}
        <div className="flex items-center justify-between px-5 h-16 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={KIZMEAL_LOGO_PATH} alt="키즈밀 로고" className="h-7 w-auto object-contain" />
            <div>
              <p className="text-xs text-gray-400 leading-none mb-0.5">키즈밀</p>
              <p className="text-sm font-bold text-[#1C2B1E]">영양사 메뉴</p>
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

        {/* 네비게이션 항목 */}
        <nav className="flex-1 min-h-0 px-3 py-3 overflow-y-auto max-h-[calc(100vh-140px)]">
          {NAV.map(item => {
            const active = pathname === item.href ||
              (item.href !== '/nutritionist/dashboard' && pathname.startsWith(item.href))
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl mb-1 text-sm font-semibold transition-colors ${
                  active
                    ? 'bg-[#E8F5E9] text-[#1B4332]'
                    : 'text-gray-700 hover:bg-gray-50 active:bg-gray-100'
                }`}
              >
                <span className="text-lg w-6 text-center leading-none">{item.icon}</span>
                <span className="flex-1">{item.label}</span>
                {active && <span className="w-2 h-2 bg-[#2D6A4F] rounded-full" />}
              </Link>
            )
          })}
        </nav>

        {/* 구분선 + 로그아웃 */}
        <div className="px-3 pt-3 pb-8 border-t border-gray-100 flex-shrink-0">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-sm font-semibold text-red-500 hover:bg-red-50 active:bg-red-100 transition-colors"
          >
            <span className="text-lg w-6 text-center leading-none">🚪</span>
            <span>로그아웃</span>
          </button>
        </div>
      </div>
    </>
  )
}
