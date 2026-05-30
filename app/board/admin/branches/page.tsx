'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import type { Branch, Brand } from '@/lib/types'

function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000)
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86400000)
  const hours = Math.floor(diff / 3600000)
  if (days > 0) return `${days}일 전`
  if (hours > 0) return `${hours}시간 전`
  return '최근'
}

interface BranchWithStats extends Branch {
  inquiry_count?: number
  pending_count?: number
  last_inquiry_at?: string
}

export default function AdminBranchesPage() {
  const [branches, setBranches] = useState<BranchWithStats[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterBrand, setFilterBrand] = useState('')
  const [filterExpiry, setFilterExpiry] = useState<'all' | 'urgent' | 'soon'>('all')

  const load = useCallback(async () => {
    const supabase = createClient()

    const [branchRes, brandRes, inqRes] = await Promise.all([
      supabase
        .from('branches')
        .select('*, brands(*)')
        .eq('is_active', true)
        .order('name', { ascending: true }),
      supabase.from('brands').select('*').eq('is_active', true),
      supabase
        .from('inquiries')
        .select('branch_id, status, created_at'),
    ])

    if (brandRes.data) setBrands(brandRes.data as Brand[])

    if (branchRes.data && inqRes.data) {
      const inqs = inqRes.data

      const enriched: BranchWithStats[] = branchRes.data.map(b => {
        const branchInqs = inqs.filter(i => i.branch_id === b.id)
        const pending = branchInqs.filter(i => i.status === 'pending' || i.status === 'in_progress').length
        const last = branchInqs.sort((a, c) =>
          new Date(c.created_at).getTime() - new Date(a.created_at).getTime()
        )[0]

        return {
          ...b,
          inquiry_count: branchInqs.length,
          pending_count: pending,
          last_inquiry_at: last?.created_at,
        } as BranchWithStats
      })

      setBranches(enriched)
    }

    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = branches.filter(b => {
    if (filterBrand && b.brand_id !== filterBrand) return false
    if (filterExpiry !== 'all') {
      const days = daysUntil(b.contract_end)
      if (filterExpiry === 'urgent' && (days === null || days > 30)) return false
      if (filterExpiry === 'soon' && (days === null || days <= 30 || days > 60)) return false
    }
    if (search) {
      const q = search.toLowerCase()
      if (!b.name.toLowerCase().includes(q) && !b.kos_id.toLowerCase().includes(q) &&
          !(b.owner_name || '').toLowerCase().includes(q)) return false
    }
    return true
  })

  const stats = {
    total: branches.length,
    expiringSoon: branches.filter(b => {
      const d = daysUntil(b.contract_end)
      return d !== null && d <= 30 && d >= 0
    }).length,
    pending: branches.reduce((sum, b) => sum + (b.pending_count || 0), 0),
  }

  async function handleLogout() {
    const s = createClient()
    await s.auth.signOut()
    window.location.href = '/board/login'
  }

  return (
    <div className="min-h-screen bg-[#F6FAF6] font-sans">
      <header className="bg-white border-b border-gray-100 px-4 sm:px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-[#2D6A4F] to-[#52B788] rounded-xl flex items-center justify-center text-white font-bold text-sm">K</div>
          <div>
            <h1 className="font-bold text-[#1C2B1E] text-sm">가맹점 관리</h1>
            <p className="text-gray-400 text-xs">전체 가맹점 목록</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/board/admin" className="text-sm text-[#2D6A4F] font-medium hover:underline">대시보드</Link>
          <Link href="/board/admin/inquiries" className="text-sm text-[#2D6A4F] font-medium hover:underline">문의 관리</Link>
          <button onClick={handleLogout} className="text-xs text-gray-400 hover:text-gray-600">로그아웃</button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: '전체 가맹점', value: loading ? '—' : stats.total, icon: '🏪', color: 'text-[#1C2B1E]' },
            { label: '계약 만료 임박', value: loading ? '—' : stats.expiringSoon, icon: '⚠️', color: 'text-red-600', alert: stats.expiringSoon > 0 },
            { label: '미처리 문의', value: loading ? '—' : stats.pending, icon: '💬', color: 'text-orange-600', alert: stats.pending > 0 },
          ].map(card => (
            <div key={card.label} className={`bg-white rounded-2xl border p-4 ${card.alert ? 'border-red-200' : 'border-gray-100'}`}>
              <div className="text-xl mb-1">{card.icon}</div>
              <div className={`text-2xl font-bold ${card.color}`}>{card.value}</div>
              <div className="text-xs text-gray-400 mt-0.5">{card.label}</div>
            </div>
          ))}
        </div>

        {/* Filter */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <div className="flex flex-wrap gap-3">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="지점명, KOS ID, 대표자 검색..."
              className="flex-1 min-w-[200px] px-4 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]"
            />
            <select
              value={filterBrand}
              onChange={e => setFilterBrand(e.target.value)}
              className="px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]"
            >
              <option value="">전체 브랜드</option>
              {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <select
              value={filterExpiry}
              onChange={e => setFilterExpiry(e.target.value as typeof filterExpiry)}
              className="px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]"
            >
              <option value="all">만료 전체</option>
              <option value="urgent">긴급 (30일 이내)</option>
              <option value="soon">임박 (60일 이내)</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[#F8FDF8]">
                  {['지점명', '브랜드', '대표자', '연락처', '식수', '계약 만료', '미처리 문의', '마지막 문의', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-bold text-gray-400 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={9} className="px-4 py-3">
                        <div className="h-4 bg-gray-100 rounded animate-pulse" />
                      </td>
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-gray-400 text-sm">
                      가맹점 없음
                    </td>
                  </tr>
                ) : (
                  filtered.map(b => {
                    const days = daysUntil(b.contract_end)
                    return (
                      <tr key={b.id} className="hover:bg-[#F8FDF8] transition-colors border-t border-gray-50">
                        <td className="px-4 py-3">
                          <div>
                            <span className="text-sm font-semibold text-[#1C2B1E]">{b.name}</span>
                            <p className="text-xs text-gray-400">{b.kos_id}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs bg-[#E8F5E9] text-[#2D6A4F] font-medium px-2 py-0.5 rounded-full">
                            {b.brands?.name || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{b.owner_name || '—'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{b.phone || '—'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{b.meal_count ? `${b.meal_count}명` : '—'}</td>
                        <td className="px-4 py-3">
                          {b.contract_end ? (
                            <div>
                              <span className="text-xs text-gray-600">{b.contract_end}</span>
                              {days !== null && (
                                <span className={`ml-2 text-xs font-bold px-1.5 py-0.5 rounded-full ${
                                  days < 0 ? 'bg-gray-200 text-gray-500'
                                  : days <= 14 ? 'bg-red-100 text-red-700'
                                  : days <= 30 ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-blue-50 text-blue-700'
                                }`}>
                                  {days < 0 ? '만료' : `D-${days}`}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {(b.pending_count || 0) > 0 ? (
                            <span className="inline-flex items-center justify-center w-6 h-6 bg-red-500 text-white text-xs font-bold rounded-full">
                              {b.pending_count}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-gray-400">
                            {b.last_inquiry_at ? timeAgo(b.last_inquiry_at) : '없음'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/board/admin/inquiries?branch=${b.id}`}
                            className="text-xs bg-[#2D6A4F] hover:bg-[#1B4332] text-white font-medium px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                          >
                            문의 보기
                          </Link>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 border-t border-gray-100">
            <p className="text-xs text-gray-400">총 {filtered.length}개 가맹점</p>
          </div>
        </div>
      </div>
    </div>
  )
}
