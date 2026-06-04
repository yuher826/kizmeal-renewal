'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import type { Inquiry, InquiryStatus, InquiryCategory, SlaRule, Admin } from '@/lib/types'
import {
  CATEGORY_COLORS, CATEGORY_ICONS, CATEGORY_LABELS,
  STATUS_COLORS, STATUS_LABELS,
} from '@/lib/types'
import { getSlaStatus, getSlaIcon } from '@/lib/sla'

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

const PUBLIC_STATUS_TABS = [
  { key: 'all', label: '전체' },
  { key: 'pending', label: '접수중' },
  { key: 'in_progress', label: '검토중' },
  { key: 'resolved', label: '답변완료' },
]

const PUBLIC_STATUS_BADGES: Record<string, { label: string; color: string }> = {
  pending: { label: '접수중', color: 'bg-yellow-100 text-yellow-800' },
  in_progress: { label: '검토중', color: 'bg-blue-100 text-blue-800' },
  resolved: { label: '답변완료', color: 'bg-green-100 text-green-800' },
}

const PUBLIC_CATEGORY_LABELS: Record<string, string> = {
  service: '서비스',
  price: '가격',
  menu: '메뉴',
  facility: '시설',
  other: '기타',
}

type PublicInquiry = {
  id: string
  inquiry_number: string
  name: string
  contact: string
  contact_type: string
  category: string
  title: string
  status: string
  is_notified: boolean
  created_at: string
}

export default function AdminInquiriesPage() {
  const searchParams = useSearchParams()
  const branchFilter = searchParams.get('branch') || ''
  const tab = searchParams.get('tab') || 'branch'

  // ── Branch inquiry state ──────────────────────────────────────
  const [inquiries, setInquiries] = useState<Inquiry[]>([])
  const [admins, setAdmins] = useState<Admin[]>([])
  const [slaRules, setSlaRules] = useState<Record<string, SlaRule>>({})
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<string[]>([])

  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<InquiryStatus | ''>('')
  const [filterCategory, setFilterCategory] = useState<InquiryCategory | ''>('')
  const [filterAdmin, setFilterAdmin] = useState('')
  const [filterSla, setFilterSla] = useState<'all' | 'warning' | 'exceeded'>('all')
  const [sortBy, setSortBy] = useState<'latest' | 'oldest' | 'sla'>('latest')

  // ── Public inquiry state ──────────────────────────────────────
  const [publicStatus, setPublicStatus] = useState('all')
  const [publicSearch, setPublicSearch] = useState('')
  const [publicSearchInput, setPublicSearchInput] = useState('')
  const [publicInquiries, setPublicInquiries] = useState<PublicInquiry[]>([])
  const [publicTotal, setPublicTotal] = useState(0)
  const [publicLoading, setPublicLoading] = useState(false)
  const [publicUnansweredCount, setPublicUnansweredCount] = useState(0)

  // ── Branch inquiry load ───────────────────────────────────────
  useEffect(() => {
    const supabase = createClient()

    async function load() {
      const [inqRes, adminRes, slaRes] = await Promise.all([
        supabase
          .from('inquiries')
          .select('*, branches(name, kos_id, brands(name, code)), admins(id, name)')
          .order('created_at', { ascending: false }),
        supabase.from('admins').select('id, name, email').eq('is_active', true),
        supabase.from('sla_rules').select('*'),
      ])

      if (inqRes.data) setInquiries(inqRes.data as unknown as Inquiry[])
      if (adminRes.data) setAdmins(adminRes.data as Admin[])
      if (slaRes.data) {
        const map: Record<string, SlaRule> = {}
        slaRes.data.forEach(r => { map[r.category] = r })
        setSlaRules(map)
      }
      setLoading(false)
    }

    load()

    const channel = supabase
      .channel('admin-inquiries')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inquiries' }, () => load())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  // ── Public unanswered badge count (always fetch) ──────────────
  useEffect(() => {
    fetch('/api/public-inquiry/admin?status=pending')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setPublicUnansweredCount(d.count || 0) })
      .catch(() => {})
  }, [])

  // ── Public inquiry load ───────────────────────────────────────
  const loadPublic = useCallback(async () => {
    setPublicLoading(true)
    const params = new URLSearchParams({ status: publicStatus, search: publicSearch })
    const res = await fetch(`/api/public-inquiry/admin?${params}`)
    if (res.ok) {
      const data = await res.json()
      setPublicInquiries(data.data || [])
      setPublicTotal(data.count || 0)
    }
    setPublicLoading(false)
  }, [publicStatus, publicSearch])

  useEffect(() => {
    if (tab === 'public') loadPublic()
  }, [tab, loadPublic])

  // ── Branch filtered list ──────────────────────────────────────
  const filtered = inquiries
    .filter(i => {
      if (branchFilter && i.branch_id !== branchFilter) return false
      if (filterStatus && i.status !== filterStatus) return false
      if (filterCategory && i.category !== filterCategory) return false
      if (filterAdmin && i.assigned_admin_id !== filterAdmin) return false
      if (filterSla !== 'all') {
        const rule = slaRules[i.category]
        const status = getSlaStatus(i, rule)
        if (filterSla === 'warning' && status !== 'warning') return false
        if (filterSla === 'exceeded' && status !== 'exceeded') return false
      }
      if (search) {
        const q = search.toLowerCase()
        const branchName = i.branches?.name?.toLowerCase() || ''
        const title = i.title?.toLowerCase() || ''
        if (!branchName.includes(q) && !title.includes(q)) return false
      }
      return true
    })
    .sort((a, b) => {
      if (sortBy === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      if (sortBy === 'sla') {
        const ra = slaRules[a.category]
        const rb = slaRules[b.category]
        const sa = getSlaStatus(a, ra)
        const sb = getSlaStatus(b, rb)
        const order = { exceeded: 0, warning: 1, ok: 2 }
        return order[sa] - order[sb]
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })

  const stats = {
    newToday: inquiries.filter(i => {
      const today = new Date()
      const d = new Date(i.created_at)
      return d.toDateString() === today.toDateString()
    }).length,
    unread: inquiries.filter(i => i.status === 'pending').length,
    inProgress: inquiries.filter(i => i.status === 'in_progress').length,
    slaExceeded: inquiries.filter(i => {
      const rule = slaRules[i.category]
      return getSlaStatus(i, rule) === 'exceeded'
    }).length,
  }

  async function bulkUpdateStatus(status: InquiryStatus) {
    if (!selected.length) return
    const supabase = createClient()
    await supabase.from('inquiries').update({ status }).in('id', selected)
    setSelected([])
  }

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/board/login'
  }

  function handlePublicSearch(e: React.FormEvent) {
    e.preventDefault()
    setPublicSearch(publicSearchInput)
  }

  const phoneNeedsCall = publicInquiries.filter(
    i => i.contact_type === 'phone' && i.status !== 'resolved' && !i.is_notified
  )

  return (
    <div className="min-h-screen bg-[#F6FAF6] font-sans">
      <header className="bg-white border-b border-gray-100 px-4 sm:px-6 py-4 hidden sm:flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-[#2D6A4F] to-[#52B788] rounded-xl flex items-center justify-center text-white font-bold text-sm">K</div>
          <div>
            <Link href="/board/admin" className="font-bold text-[#1C2B1E] text-sm hover:text-[#2D6A4F]">문의 관리</Link>
            <p className="text-gray-400 text-xs">전체 문의 목록</p>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-3">
          {stats.unread > 0 && (
            <span className="text-xs bg-red-100 text-red-700 font-semibold px-2.5 py-1 rounded-full">
              미처리 {stats.unread}건
            </span>
          )}
          <Link href="/board/admin" className="text-sm text-[#2D6A4F] font-medium hover:underline">대시보드</Link>
          <button onClick={handleLogout} className="text-xs text-gray-400 hover:text-gray-600">로그아웃</button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">

        {/* 통계 카드 — 가맹점 탭에서만 */}
        {tab === 'branch' && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: '오늘 새 문의', value: stats.newToday, icon: '📬', color: 'text-blue-600' },
              { label: '미처리', value: stats.unread, icon: '🔴', color: 'text-red-600', alert: stats.unread > 0 },
              { label: '처리중', value: stats.inProgress, icon: '⚡', color: 'text-yellow-600' },
              { label: 'SLA 초과', value: stats.slaExceeded, icon: '⚠️', color: 'text-orange-600', alert: stats.slaExceeded > 0 },
            ].map(card => (
              <div key={card.label} className={`bg-white rounded-2xl border p-4 ${card.alert ? 'border-red-200' : 'border-gray-100'}`}>
                <div className="text-xl mb-1">{card.icon}</div>
                <div className={`text-2xl font-bold ${card.color}`}>{card.value}</div>
                <div className="text-xs text-gray-400 mt-0.5">{card.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* 탭 */}
        <div className="flex gap-1 border-b border-gray-200">
          <Link
            href="/board/admin/inquiries?tab=branch"
            className={`px-5 py-2.5 text-sm font-semibold transition-colors duration-200 border-b-2 -mb-px ${
              tab === 'branch'
                ? 'border-[#2D6A4F] text-[#2D6A4F]'
                : 'border-transparent text-gray-400 hover:text-[#2D6A4F]'
            }`}
          >
            가맹점 문의
          </Link>
          <Link
            href="/board/admin/inquiries?tab=public"
            className={`px-5 py-2.5 text-sm font-semibold transition-colors duration-200 border-b-2 -mb-px flex items-center gap-1.5 ${
              tab === 'public'
                ? 'border-[#2D6A4F] text-[#2D6A4F]'
                : 'border-transparent text-gray-400 hover:text-[#2D6A4F]'
            }`}
          >
            일반 문의
            {publicUnansweredCount > 0 && (
              <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                {publicUnansweredCount}
              </span>
            )}
          </Link>
        </div>

        {/* ── 가맹점 문의 탭 ───────────────────────────────────── */}
        {tab === 'branch' && (
          <>
            {/* 검색 & 필터 */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <div className="flex flex-wrap gap-3">
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="지점명, 제목으로 검색..."
                  className="flex-1 min-w-[200px] px-4 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]"
                />
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as InquiryStatus | '')}
                  className="px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]">
                  <option value="">전체 상태</option>
                  {(Object.entries(STATUS_LABELS) as [InquiryStatus, string][]).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
                <select value={filterCategory} onChange={e => setFilterCategory(e.target.value as InquiryCategory | '')}
                  className="px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]">
                  <option value="">전체 분류</option>
                  {(['DELIVERY', 'MENU', 'STAFF_MEAL', 'HYGIENE', 'CONTRACT', 'OTHER'] as InquiryCategory[]).map(k => (
                    <option key={k} value={k}>{CATEGORY_ICONS[k]} {CATEGORY_LABELS[k]}</option>
                  ))}
                </select>
                <select value={filterAdmin} onChange={e => setFilterAdmin(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]">
                  <option value="">전체 담당자</option>
                  {admins.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
                <select value={filterSla} onChange={e => setFilterSla(e.target.value as typeof filterSla)}
                  className="px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]">
                  <option value="all">전체 SLA</option>
                  <option value="warning">임박 🟡</option>
                  <option value="exceeded">초과 🔴</option>
                </select>
                <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}
                  className="px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]">
                  <option value="latest">최신순</option>
                  <option value="oldest">오래된순</option>
                  <option value="sla">SLA 임박순</option>
                </select>
              </div>
            </div>

            {/* 벌크 액션 */}
            {selected.length > 0 && (
              <div className="bg-[#E8F5E9] rounded-xl px-4 py-3 flex items-center gap-3">
                <span className="text-sm font-semibold text-[#2D6A4F]">{selected.length}건 선택됨</span>
                <button onClick={() => bulkUpdateStatus('in_progress')}
                  className="text-xs bg-blue-100 text-blue-700 font-semibold px-3 py-1.5 rounded-lg hover:bg-blue-200 transition-colors">처리중으로</button>
                <button onClick={() => bulkUpdateStatus('resolved')}
                  className="text-xs bg-green-100 text-green-700 font-semibold px-3 py-1.5 rounded-lg hover:bg-green-200 transition-colors">해결됨으로</button>
                <button onClick={() => setSelected([])}
                  className="text-xs text-gray-500 hover:text-gray-700 ml-auto">취소</button>
              </div>
            )}

            {/* 문의 목록 */}
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              {/* 모바일 카드뷰 */}
              <div className="sm:hidden divide-y divide-gray-50">
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="p-4"><div className="h-16 bg-gray-50 rounded-xl animate-pulse"/></div>
                  ))
                ) : filtered.length === 0 ? (
                  <div className="px-4 py-10 text-center text-gray-400 text-sm">문의 내역이 없습니다.</div>
                ) : filtered.map(inq => {
                  const rule = slaRules[inq.category]
                  const slaStatus = getSlaStatus(inq, rule)
                  return (
                    <div key={inq.id} className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[#1C2B1E] whitespace-nowrap truncate">{inq.branches?.name || '—'}</p>
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-semibold ${CATEGORY_COLORS[inq.category]}`}>
                              {CATEGORY_ICONS[inq.category]} {CATEGORY_LABELS[inq.category]}
                            </span>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[inq.status]}`}>
                              {STATUS_LABELS[inq.status]}
                            </span>
                          </div>
                        </div>
                        <Link href={`/board/admin/inquiries/${inq.id}`}
                          className="flex-shrink-0 text-xs bg-[#2D6A4F] hover:bg-[#1B4332] text-white font-semibold px-4 py-2.5 rounded-xl transition-colors">
                          답변
                        </Link>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {(inq.unread_count_admin ?? 0) > 0 && (
                          <span className="w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center flex-shrink-0">{inq.unread_count_admin}</span>
                        )}
                        <p className="text-sm text-[#1C2B1E] truncate">{inq.title}</p>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <span>{inq.admins?.name || '미배정'}</span>
                        <span>·</span>
                        <span>{getSlaIcon(slaStatus)}</span>
                        <span>·</span>
                        <span>{timeAgo(inq.created_at)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* 데스크탑 테이블 */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-[#F8FDF8]">
                      <th className="px-4 py-3">
                        <input
                          type="checkbox"
                          onChange={e => setSelected(e.target.checked ? filtered.map(i => i.id) : [])}
                          checked={selected.length === filtered.length && filtered.length > 0}
                          className="rounded"
                        />
                      </th>
                      {['지점명', '분류', '제목', '상태', '담당자', 'SLA', '날짜', ''].map(h => (
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
                          문의 내역이 없습니다.
                        </td>
                      </tr>
                    ) : (
                      filtered.map(inq => {
                        const rule = slaRules[inq.category]
                        const slaStatus = getSlaStatus(inq, rule)

                        return (
                          <tr key={inq.id} className="hover:bg-[#F8FDF8] transition-colors border-t border-gray-50">
                            <td className="px-4 py-3">
                              <input
                                type="checkbox"
                                checked={selected.includes(inq.id)}
                                onChange={e => {
                                  if (e.target.checked) setSelected(prev => [...prev, inq.id])
                                  else setSelected(prev => prev.filter(id => id !== inq.id))
                                }}
                                className="rounded"
                              />
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div>
                                <span className="text-sm font-semibold text-[#1C2B1E]">{inq.branches?.name || '—'}</span>
                                {inq.branches?.brands?.name && (
                                  <p className="text-xs text-gray-400">{inq.branches.brands.name}</p>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${CATEGORY_COLORS[inq.category]}`}>
                                {CATEGORY_ICONS[inq.category]} {CATEGORY_LABELS[inq.category]}
                              </span>
                            </td>
                            <td className="px-4 py-3 max-w-[220px]">
                              <div className="flex items-center gap-1.5">
                                {(inq.unread_count_admin ?? 0) > 0 && (
                                  <span className="w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center flex-shrink-0">
                                    {inq.unread_count_admin}
                                  </span>
                                )}
                                <span className="text-sm text-[#1C2B1E] truncate">{inq.title}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[inq.status]}`}>
                                {STATUS_LABELS[inq.status]}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-xs text-gray-600">{inq.admins?.name || '미배정'}</span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-sm">{getSlaIcon(slaStatus)}</span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-xs text-gray-400 whitespace-nowrap">{timeAgo(inq.created_at)}</span>
                            </td>
                            <td className="px-4 py-3">
                              <Link
                                href={`/board/admin/inquiries/${inq.id}`}
                                className="text-xs bg-[#2D6A4F] hover:bg-[#1B4332] text-white font-medium px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                              >
                                답변
                              </Link>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
              <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
                <p className="text-xs text-gray-400">총 {filtered.length}건</p>
              </div>
            </div>
          </>
        )}

        {/* ── 일반 문의 탭 ─────────────────────────────────────── */}
        {tab === 'public' && (
          <>
            {/* 전화 연락 필요 — 상단 고정 */}
            {phoneNeedsCall.length > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4">
                <p className="text-orange-700 font-bold text-sm mb-3">
                  📞 전화 연락 필요 ({phoneNeedsCall.length}건)
                </p>
                <div className="space-y-2">
                  {phoneNeedsCall.map(i => (
                    <Link
                      key={i.id}
                      href={`/board/admin/public-inquiries/${i.id}`}
                      className="flex items-center justify-between bg-white rounded-xl px-4 py-3 hover:bg-orange-50 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-sm font-semibold text-[#1C2B1E] flex-shrink-0">{i.name}</span>
                        <span className="text-xs text-gray-400 truncate">{i.title}</span>
                      </div>
                      <span className="text-sm font-bold text-orange-600 flex-shrink-0 ml-3">{i.contact}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* 상태 필터 + 검색 */}
            <div className="bg-white rounded-2xl p-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
              <div className="flex gap-1 flex-wrap">
                {PUBLIC_STATUS_TABS.map(t => (
                  <button
                    key={t.key}
                    onClick={() => setPublicStatus(t.key)}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                      publicStatus === t.key
                        ? 'bg-[#2D6A4F] text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <form onSubmit={handlePublicSearch} className="flex-1 flex gap-2 w-full sm:w-auto">
                <input
                  type="text"
                  value={publicSearchInput}
                  onChange={e => setPublicSearchInput(e.target.value)}
                  placeholder="이름, 연락처, 문의번호, 제목 검색"
                  className="flex-1 border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]"
                />
                <button
                  type="submit"
                  className="bg-[#2D6A4F] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#1B4332] transition-colors"
                >
                  검색
                </button>
              </form>
            </div>

            {/* 목록 테이블 */}
            <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
              {publicLoading ? (
                <div className="p-12 text-center text-gray-400">불러오는 중...</div>
              ) : publicInquiries.length === 0 ? (
                <div className="p-12 text-center text-gray-400">문의가 없습니다.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-[#F8FDF8] border-b border-gray-100">
                        {['문의번호', '이름', '유형', '제목', '접수일', '상태'].map(h => (
                          <th key={h} className="text-left px-5 py-3 text-xs font-bold text-gray-400 whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {publicInquiries.map(inq => {
                        const badge = PUBLIC_STATUS_BADGES[inq.status] || PUBLIC_STATUS_BADGES.pending
                        return (
                          <tr key={inq.id} className="hover:bg-[#F8FDF8] transition-colors">
                            <td className="px-5 py-4">
                              <Link
                                href={`/board/admin/public-inquiries/${inq.id}`}
                                className="text-xs font-mono text-gray-500 hover:text-[#2D6A4F]"
                              >
                                {inq.inquiry_number}
                              </Link>
                            </td>
                            <td className="px-5 py-4 text-sm font-semibold text-[#1C2B1E] whitespace-nowrap">
                              <Link href={`/board/admin/public-inquiries/${inq.id}`} className="hover:text-[#2D6A4F]">
                                {inq.name}
                              </Link>
                            </td>
                            <td className="px-5 py-4 text-sm text-gray-500">
                              {PUBLIC_CATEGORY_LABELS[inq.category] || inq.category}
                            </td>
                            <td className="px-5 py-4 max-w-xs">
                              <Link
                                href={`/board/admin/public-inquiries/${inq.id}`}
                                className="text-sm text-[#1C2B1E] hover:text-[#2D6A4F] block truncate"
                              >
                                {inq.title}
                              </Link>
                            </td>
                            <td className="px-5 py-4 text-sm text-gray-400 whitespace-nowrap">
                              {new Date(inq.created_at).toLocaleDateString('ko-KR')}
                            </td>
                            <td className="px-5 py-4">
                              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${badge.color}`}>
                                {badge.label}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <p className="text-xs text-gray-400 text-right">총 {publicTotal}건</p>
          </>
        )}

      </div>
    </div>
  )
}
