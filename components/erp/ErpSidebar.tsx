'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LogOut, Settings } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { ERP_NAV_GROUPS } from '@/lib/erp-nav'
import { canAccessErpPage, landingPathFor } from '@/lib/erp-access'
import type { ErpUser } from '@/types/erp'

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
  open: boolean
  setOpen: (v: boolean) => void
}

// 전체 메뉴 경로 중 현재 경로와 일치하거나 상위 경로인 것을 모아
// 가장 긴(가장 구체적인) 경로 하나만 활성 메뉴로 판정한다.
const ALL_NAV_HREFS = ERP_NAV_GROUPS.flatMap(group =>
  group.items.filter(item => !item.disabled).map(item => item.href)
)

function getActiveHref(pathname: string): string | undefined {
  const matched = ALL_NAV_HREFS.filter(
    href => pathname === href || pathname.startsWith(`${href}/`)
  )
  if (matched.length === 0) return undefined
  return matched.reduce((longest, href) => (href.length > longest.length ? href : longest))
}

export default function ErpSidebar({ user, open, setOpen }: Props) {
  const pathname = usePathname()
  const activeHref = getActiveHref(pathname)

  useEffect(() => { setOpen(false) }, [pathname])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  async function handleLogout() {
    setOpen(false)
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/erp/login'
  }

  const badge = ROLE_BADGE[user.role] ?? ROLE_BADGE.admin

  const content = (
    <div className="h-screen flex flex-col w-64 bg-white border-r border-slate-200">
      {/* 로고 */}
      <Link
        href={landingPathFor(user)}
        className="bg-emerald-600 px-5 py-4 flex items-center gap-2 flex-shrink-0 cursor-pointer hover:bg-emerald-700 transition-colors duration-150"
      >
        <span className="text-white text-lg font-bold tracking-wide">KIZMEAL</span>
        <span className="bg-white/25 text-white text-xs font-semibold rounded-md px-2 py-0.5">ERP</span>
      </Link>

      {/* 메뉴 */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        {ERP_NAV_GROUPS.map((group, gi) => {
          // disabled 항목은 접근 검사를 건너뛰고 '준비중'으로 노출한다(페이지가 없어 규칙이 없음).
          // 그 외는 canAccessErpPage로 메뉴 노출과 실제 접근 가능 여부를 일치시킨다.
          const visibleItems = group.items.filter(
            item => item.disabled || canAccessErpPage(user, item.href)
          )
          if (visibleItems.length === 0) return null
          return (
            <div key={group.title} className={gi === 0 ? 'mt-2' : 'mt-5'}>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest px-3 mb-2">
                {group.title}
              </p>
              <div className="space-y-0.5">
                {visibleItems.map(item => {
                  const Icon = item.icon
                  const active = !item.disabled && item.href === activeHref
                  if (item.disabled) {
                    return (
                      <div
                        key={item.href}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-300 cursor-not-allowed w-full"
                      >
                        <Icon size={16} />
                        <span className="flex-1">{item.label}</span>
                        <span className="text-xs bg-slate-100 text-slate-400 rounded px-1.5 py-0.5">준비중</span>
                      </div>
                    )
                  }
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      className={`flex items-center gap-3 rounded-lg text-sm transition-colors duration-150 w-full ${
                        active
                          ? 'bg-emerald-50 text-emerald-700 font-medium border-l-2 border-emerald-600 px-[10px] py-2.5'
                          : 'px-3 py-2.5 text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      <Icon size={16} />
                      <span>{item.label}</span>
                    </Link>
                  )
                })}
              </div>
            </div>
          )
        })}
      </nav>

      {/* 유저 카드 */}
      <div className="border-t border-slate-200 p-4 flex-shrink-0">
        <div className="bg-slate-50 rounded-xl p-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0">
              {user.name.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-800 truncate">{user.name}</p>
              <span className={`inline-block text-xs font-medium rounded px-1.5 py-0.5 mt-0.5 ${badge.bg} ${badge.text}`}>
                {badge.label}
              </span>
            </div>
          </div>
          <div className="mt-2 flex flex-col gap-1">
            <Link
              href="/erp/my-page"
              className={`text-xs flex items-center gap-1.5 transition-colors ${
                pathname === '/erp/my-page'
                  ? 'text-emerald-600 font-medium'
                  : 'text-slate-400 hover:text-slate-700'
              }`}
            >
              <Settings size={12} />
              마이페이지
            </Link>
            <button
              onClick={handleLogout}
              className="text-xs text-slate-400 hover:text-red-500 flex items-center gap-1.5 transition-colors"
            >
              <LogOut size={12} />
              로그아웃
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <>
      {/* 데스크탑 사이드바 */}
      <div className="hidden lg:flex flex-shrink-0">
        {content}
      </div>

      {/* 모바일 백드롭 */}
      <div
        aria-hidden="true"
        onClick={() => setOpen(false)}
        className={`lg:hidden fixed inset-0 z-40 bg-black/40 transition-opacity duration-300 ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* 모바일 슬라이드 드로어 */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="ERP 메뉴"
        className={`lg:hidden fixed top-0 left-0 bottom-0 z-50 flex flex-col shadow-2xl transition-transform duration-300 ease-in-out ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {content}
      </div>
    </>
  )
}
