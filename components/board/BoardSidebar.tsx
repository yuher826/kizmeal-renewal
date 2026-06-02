'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase'

type MenuItem = { icon: string; label: string; href: string }

const ADMIN_MENU: MenuItem[] = [
  { icon: '🏠', label: '대시보드', href: '/board/admin' },
  { icon: '💬', label: '문의 관리', href: '/board/admin/inquiries' },
  { icon: '📋', label: '식단표 관리', href: '/board/admin/diet' },
  { icon: '🖼️', label: '콘텐츠 업로드', href: '/nutritionist/upload' },
  { icon: '👥', label: '원 관리', href: '/board/admin/branches' },
  { icon: '📢', label: '공지사항', href: '/board/admin/notices' },
  { icon: '📊', label: '통계', href: '/board/admin/stats' },
]

const CUSTOMER_MENU: MenuItem[] = [
  { icon: '🏠', label: '홈', href: '/board/dashboard' },
  { icon: '💬', label: '1:1 문의', href: '/board/customer/inquiries' },
  { icon: '📋', label: '식단표', href: '/board/customer/diet' },
  { icon: '📢', label: '공지사항', href: '/board/customer/notices' },
  { icon: '👤', label: '마이페이지', href: '/board/customer/profile' },
]

type Role = 'admin' | 'branch' | null

export default function BoardSidebar() {
  const pathname = usePathname()
  const [role, setRole] = useState<Role>(null)
  const [resolved, setResolved] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) { setResolved(true); return }
      const uid = data.session.user.id
      const { data: adminRow } = await supabase.from('admins').select('id').eq('auth_id', uid).maybeSingle()
      if (adminRow) { setRole('admin'); setResolved(true); return }
      setRole('branch')
      setResolved(true)
    })
  }, [])

  // 역할 확인 전이거나 비로그인 상태면 사이드바 미표시
  if (!resolved || !role) return null

  const menu = role === 'admin' ? ADMIN_MENU : CUSTOMER_MENU

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/board/login'
  }

  function isActive(href: string) {
    if (href === '/board/admin' || href === '/board/dashboard') return pathname === href
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <aside className="hidden lg:flex lg:flex-col w-60 flex-shrink-0 bg-white border-r border-gray-100 sticky top-0 h-screen">
      <Link href={role === 'admin' ? '/board/admin' : '/board/dashboard'} className="flex items-center gap-2.5 px-5 h-16 border-b border-gray-100 hover:opacity-80 transition-opacity">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#2D6A4F] to-[#52B788] flex items-center justify-center text-white font-bold text-lg font-serif">K</div>
        <div>
          <p className="font-bold text-[#1C2B1E] text-sm leading-none">소통채널</p>
          <p className="text-gray-400 text-xs mt-1">{role === 'admin' ? '관리자' : '가맹점'}</p>
        </div>
      </Link>

      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {menu.map(item => {
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                active
                  ? 'bg-[#E8F5E9] text-[#2D6A4F]'
                  : 'text-gray-600 hover:bg-[#F6FAF6] hover:text-[#2D6A4F]'
              }`}
            >
              <span className="text-lg flex-shrink-0">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      <div className="px-3 py-4 border-t border-gray-100">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-colors"
        >
          <span className="text-lg flex-shrink-0">🚪</span>
          <span>로그아웃</span>
        </button>
      </div>
    </aside>
  )
}
