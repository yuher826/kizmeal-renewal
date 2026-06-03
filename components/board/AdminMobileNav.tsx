'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

const NAV = [
  { icon: '📬', label: '문의 관리',  href: '/board/admin/inquiries' },
  { icon: '🏫', label: '가맹점 관리', href: '/board/admin/branches' },
  { icon: '👨‍👩‍👧', label: '학부모 승인', href: '/board/admin/parents' },
  { icon: '🍱', label: '식단표 관리', href: '/board/admin/diet' },
  { icon: '📢', label: '공지사항',   href: '/board/admin/notices' },
]

export default function AdminMobileNav() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    setOpen(false)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/board/login')
  }

  return (
    <>
      {/* 햄버거 버튼 — 모바일 전용, 우하단 고정 */}
      <button
        type="button"
        aria-label="메뉴 열기"
        onClick={() => setOpen(true)}
        className="sm:hidden fixed bottom-6 right-4 z-40 w-14 h-14 bg-[#2D6A4F] hover:bg-[#1B4332] text-white rounded-full flex items-center justify-center shadow-xl text-2xl transition-colors"
      >
        ☰
      </button>

      {/* 풀스크린 오버레이 */}
      {open && (
        <div className="sm:hidden fixed inset-0 z-50 bg-white flex flex-col">
          {/* 헤더 */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-[#2D6A4F] to-[#52B788] rounded-xl flex items-center justify-center text-white font-bold text-base">K</div>
              <span className="font-bold text-[#1C2B1E] text-base">소통채널 관리자</span>
            </div>
            <button type="button" onClick={() => setOpen(false)}
              className="w-10 h-10 flex items-center justify-center text-gray-400 text-xl hover:text-gray-600">
              ✕
            </button>
          </div>

          {/* 네비게이션 */}
          <nav className="flex-1 px-4 py-5 overflow-y-auto">
            {NAV.map(item => (
              <Link key={item.href} href={item.href} onClick={() => setOpen(false)}
                className={`flex items-center gap-4 px-4 py-4 rounded-2xl mb-1.5 text-sm font-semibold transition-colors ${
                  pathname.startsWith(item.href)
                    ? 'bg-[#E8F5E9] text-[#1B4332]'
                    : 'text-gray-700 hover:bg-gray-50 active:bg-gray-100'
                }`}
              >
                <span className="text-2xl w-8 text-center">{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </nav>

          {/* 로그아웃 */}
          <div className="px-4 pb-10 border-t border-gray-100 pt-4">
            <button type="button" onClick={handleLogout}
              className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl text-sm font-semibold text-red-600 hover:bg-red-50 active:bg-red-100 transition-colors">
              <span className="text-2xl w-8 text-center">🚪</span>
              로그아웃
            </button>
          </div>
        </div>
      )}
    </>
  )
}
