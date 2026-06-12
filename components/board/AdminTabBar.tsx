'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { ADMIN_TABS, getActiveAdminTab, type AdminTabKey } from '@/lib/admin-tabs'

type Counts = Record<AdminTabKey, number>

const ZERO: Counts = { home: 0, service: 0 }

export default function AdminTabBar() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [counts, setCounts] = useState<Counts>(ZERO)

  const active = getActiveAdminTab(pathname, searchParams.get('type'))

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()

    async function loadCounts() {
      // 학부모 승인 대기
      const parentsPromise = supabase
        .from('parents')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')

      // 학부모 문의 미답변
      const parentInqPromise = supabase
        .from('parent_inquiries')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')

      // 서비스 문의 미답변 (서버 API — service role)
      const servicePromise = fetch('/api/public-inquiry/admin?status=pending')
        .then(r => (r.ok ? r.json() : null))
        .then(d => d?.count || 0)
        .catch(() => 0)

      const [parentsRes, parentInqRes, serviceCount] = await Promise.all([
        parentsPromise, parentInqPromise, servicePromise,
      ])

      if (cancelled) return

      const parentsCount = parentsRes.count || 0
      const parentInqCount = parentInqRes.error ? 0 : (parentInqRes.count || 0)

      setCounts({
        home: parentsCount + parentInqCount,
        service: serviceCount,
      })
    }

    loadCounts()
    return () => { cancelled = true }
  }, [pathname])

  return (
    <div className="bg-white border-b border-gray-100">
      <div className="flex">
        {ADMIN_TABS.map(tab => {
          const isActive = active === tab.key
          const badge = counts[tab.key]
          const href = tab.items[0].href
          return (
            <Link
              key={tab.key}
              href={href}
              className={`flex-1 relative flex items-center justify-center gap-1.5 px-2 py-3.5 text-xs sm:text-sm transition-colors border-b-[3px] -mb-px ${
                isActive
                  ? 'border-[#2D6A4F] text-[#2D6A4F] font-bold'
                  : 'border-transparent text-gray-400 hover:text-[#2D6A4F] font-medium'
              }`}
            >
              <span className="text-base leading-none">{tab.icon}</span>
              <span className="whitespace-nowrap">{tab.shortLabel}</span>
              {badge > 0 && (
                <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
