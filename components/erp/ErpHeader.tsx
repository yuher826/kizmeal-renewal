'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronRight, Menu, Bell } from 'lucide-react'
import type { ErpUser } from '@/types/erp'

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
}

interface Props {
  user: ErpUser
  onMenuClick: () => void
}

export default function ErpHeader({ user, onMenuClick }: Props) {
  const pathname = usePathname()

  // 가장 긴 prefix 매칭
  const matchedKey = Object.keys(BREADCRUMB_MAP)
    .filter(k => pathname.startsWith(k))
    .sort((a, b) => b.length - a.length)[0]

  const crumb = matchedKey ? BREADCRUMB_MAP[matchedKey] : null
  const badge = ROLE_BADGE[user.role] ?? ROLE_BADGE.admin

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
        <button
          type="button"
          aria-label="알림"
          className="relative w-9 h-9 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <Bell size={20} />
        </button>
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
