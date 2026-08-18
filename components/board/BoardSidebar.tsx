'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { ADMIN_TABS, getActiveAdminTab } from '@/lib/admin-tabs'
import { KIZMEAL_LOGO_PATH } from '@/lib/brand'

type MenuItem = { icon: string; label: string; href: string }

const CUSTOMER_MENU: MenuItem[] = [
  { icon: '🏠', label: '홈', href: '/board/dashboard' },
  { icon: '💬', label: '1:1 문의', href: '/board/inquiries' },
  // 2026-08-18 권팀장 요청 2번: '식단표' → '파일보관함'으로 확장.
  // ⚠️ 고객사 메뉴는 이 파일(데스크톱)과 CustomerMobileNav.tsx(모바일)
  //    두 곳에 각각 정의돼 있다. 라벨을 바꿀 때 반드시 둘 다 고칠 것.
  { icon: '📁', label: '파일보관함', href: '/board/customer/diet' },
  { icon: '📢', label: '공지사항', href: '/board/customer/notices' },
  { icon: '👤', label: '마이페이지', href: '/board/settings' },
]

type Role = 'admin' | 'branch' | null

export default function BoardSidebar() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
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

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/board/login'
  }

  function isActive(href: string) {
    const [path, query] = href.split('?')
    // 쿼리(?type=...)가 있는 항목은 path + type 까지 일치해야 활성화
    if (query) {
      const type = new URLSearchParams(query).get('type')
      return pathname === path && searchParams.get('type') === type
    }
    return pathname === path
  }

  function renderItem(item: MenuItem) {
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
  }

  return (
    <aside className="hidden lg:flex lg:flex-col w-60 flex-shrink-0 bg-white border-r border-gray-100 h-full">
      <Link href={role === 'admin' ? '/board/admin' : '/board/dashboard'} className="flex items-center gap-2.5 px-5 h-16 border-b border-gray-100 hover:opacity-80 transition-opacity">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={KIZMEAL_LOGO_PATH} alt="키즈밀 로고" className="h-7 w-auto object-contain" />
        <div>
          <p className="font-bold text-[#1C2B1E] text-sm leading-none">소통채널</p>
          <p className="text-gray-400 text-xs mt-1">{role === 'admin' ? '관리자' : '고객사'}</p>
        </div>
      </Link>

      <nav className="flex-1 overflow-y-auto py-4 px-3 flex flex-col">
        {role === 'admin' ? (() => {
          const activeTab = getActiveAdminTab(pathname)
          const tab = ADMIN_TABS.find(t => t.key === activeTab) || ADMIN_TABS[0]
          return (
            <>
              <p className="px-3 pb-1.5 text-[11px] font-bold text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
                <span>{tab.icon}</span>{tab.label}
              </p>
              <div className="space-y-1">
                {tab.items.map(renderItem)}
              </div>
              <div className="mt-auto pt-4">
                <div className="bg-[#F6FAF6] border border-[#2D6A4F]/20 rounded-xl p-4">
                  <p className="text-sm leading-relaxed text-gray-600">{tab.description}</p>
                  <Link
                    href="/erp"
                    className="mt-3 flex items-center justify-center gap-1.5 w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-lg transition-colors"
                  >
                    ERP 바로가기 →
                  </Link>
                </div>
              </div>
            </>
          )
        })() : (
          <div className="space-y-1">
            {CUSTOMER_MENU.map(renderItem)}
          </div>
        )}
      </nav>

      <div className="flex-shrink-0 px-3 py-4 border-t border-gray-100">
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
