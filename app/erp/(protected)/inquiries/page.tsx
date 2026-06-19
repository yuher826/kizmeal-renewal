'use client'

import { useEffect, useState, useCallback, useMemo, Suspense } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import type { InquiryStatus, InquiryCategory, SlaRule, Inquiry } from '@/lib/types'
import {
  CATEGORY_ICONS, CATEGORY_LABELS, STATUS_COLORS, STATUS_LABELS,
} from '@/lib/types'
import { getSlaStatus } from '@/lib/sla'
import InquiryDetailPanel from './components/InquiryDetailPanel'
import Link from 'next/link'
import { getGroupStyle } from '@/lib/cs-group-styles'

const PAGE_SIZE = 20
const UNGROUPED = '미분류'
const UNGROUPED_SORT = 9999

// ── 쿼리 결과 타입 ─────────────────────────────────────────────
interface ListProfile {
  group_tag: string | null
  sort_order: number | null
  branch_full_name: string | null
}
// branch_profiles 별도 조회 행 (branch_id 포함)
interface ProfileRow extends ListProfile {
  branch_id: string
}
interface ListBranch {
  id: string
  name: string
  is_active: boolean
}
interface ListInquiry {
  id: string
  title: string | null
  status: InquiryStatus
  category: InquiryCategory
  created_at: string
  unread_count_admin: number | null
  branch_id: string
  resolved_at: string | null
  closed_at: string | null
  branches: ListBranch | ListBranch[] | null
}

// 가공된 목록 아이템
interface RowItem {
  inq: ListInquiry
  groupTag: string
  sortOrder: number
  displayName: string
  isComplaint: boolean
  isUrgentComplaint: boolean
}

// 그룹 묶음
interface Group {
  tag: string
  sortOrder: number
  items: RowItem[]
  unreadCount: number
  hasUrgent: boolean
}

// ── 유틸 ───────────────────────────────────────────────────────
// Supabase 중첩 조인은 to-one도 배열로 반환될 수 있어 단일 객체로 정규화
function one<T>(v: T | T[] | null | undefined): T | null {
  if (Array.isArray(v)) return v[0] ?? null
  return v ?? null
}

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

// YYYY-MM 키를 "YYYY년 M월" 형식으로 변환
function formatYearMonth(ym: string): string {
  const [year, month] = ym.split('-')
  return `${year}년 ${parseInt(month)}월`
}

const STATUS_FILTER_TABS: { key: InquiryStatus | ''; label: string }[] = [
  { key: '',            label: '전체' },
  { key: 'pending',     label: '대기' },
  { key: 'in_progress', label: '처리중' },
  { key: 'resolved',    label: '해결' },
  { key: 'closed',      label: '종료' },
]


function CsManagementInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const urlId = searchParams.get('id')

  const [inquiries, setInquiries] = useState<ListInquiry[]>([])
  // branch_id → 원 프로파일 매핑 (branch_profiles 별도 조회 후 합침)
  const [profiles, setProfiles] = useState<Record<string, ListProfile>>({})
  const [slaRules, setSlaRules] = useState<Record<string, SlaRule>>({})
  const [loading, setLoading] = useState(true)
  const [didInit, setDidInit] = useState(false)

  const [selectedId, setSelectedId] = useState<string | null>(urlId)
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set())

  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<InquiryStatus | ''>('')
  const [filterMonth, setFilterMonth] = useState('')
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [page, setPage] = useState(1)

  // 임시저장 초안이 있는 문의 ID 목록 (localStorage 기반)
  const [draftIds, setDraftIds] = useState<Set<string>>(new Set())

  // ── 데이터 로드 ──────────────────────────────────────────────
  const load = useCallback(async () => {
    const supabase = createClient()
    // PGRST200 회피: branch_profiles는 nested join 대신 별도 조회 후 클라이언트에서 병합
    const [inqRes, profileRes, slaRes] = await Promise.all([
      // 1단계: inquiries + branches 조인 (기존 FK 존재)
      supabase
        .from('inquiries')
        .select(`
          id, title, status, category, created_at, unread_count_admin,
          branch_id, resolved_at, closed_at,
          branches!inner ( id, name, is_active )
        `)
        // 비활성 지점 제외 (branches.is_active = true)
        .eq('branches.is_active', true)
        .order('created_at', { ascending: false }),
      // 2단계: branch_profiles 전체 별도 조회
      supabase
        .from('branch_profiles')
        .select('branch_id, group_tag, sort_order, branch_full_name'),
      supabase.from('sla_rules').select('*'),
    ])

    if (inqRes.data) setInquiries(inqRes.data as unknown as ListInquiry[])

    // 3단계: branch_id 기준으로 프로파일 매핑 생성
    if (profileRes.data) {
      const map: Record<string, ListProfile> = {}
      for (const p of profileRes.data as ProfileRow[]) {
        map[p.branch_id] = {
          group_tag: p.group_tag,
          sort_order: p.sort_order,
          branch_full_name: p.branch_full_name,
        }
      }
      setProfiles(map)
    }

    if (slaRes.data) {
      const map: Record<string, SlaRule> = {}
      slaRes.data.forEach(r => { map[r.category] = r })
      setSlaRules(map)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const supabase = createClient()
    const channel = supabase
      .channel('erp-cs-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inquiries' }, () => load())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [load])

  // 마운트 시 localStorage 스캔하여 초안이 있는 문의 ID 수집
  useEffect(() => {
    const ids = new Set<string>()
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key) continue
      const match = key.match(/^cs_draft(?:_internal)?_(.+)$/)
      if (match && localStorage.getItem(key)) ids.add(match[1])
    }
    setDraftIds(ids)
  }, [])

  // InquiryDetailPanel에서 초안 변경 시 이벤트 수신
  useEffect(() => {
    function handler(e: Event) {
      const { inquiryId, hasDraft } = (e as CustomEvent<{ inquiryId: string; hasDraft: boolean }>).detail
      setDraftIds(prev => {
        const next = new Set(prev)
        if (hasDraft) next.add(inquiryId)
        else next.delete(inquiryId)
        return next
      })
    }
    window.addEventListener('cs-draft-change', handler)
    return () => window.removeEventListener('cs-draft-change', handler)
  }, [])

  // ── 가공: 목록 아이템 ────────────────────────────────────────
  const rows: RowItem[] = useMemo(() => {
    return inquiries.map(inq => {
      const branch = one(inq.branches)
      const profile = profiles[inq.branch_id]
      const isComplaint = inq.category === 'COMPLAINT'
      const isUrgentComplaint = isComplaint && inq.status !== 'resolved' && inq.status !== 'closed'
      return {
        inq,
        groupTag: profile?.group_tag || UNGROUPED,
        sortOrder: profile?.sort_order ?? UNGROUPED_SORT,
        displayName: profile?.branch_full_name || branch?.name || '—',
        isComplaint,
        isUrgentComplaint,
      }
    })
  }, [inquiries, profiles])

  // ── 월별 필터 목록 (실제 존재하는 월만, 최신 → 과거) ────────
  const availableMonths = useMemo(() => {
    const months = new Set<string>()
    for (const inq of inquiries) {
      const d = new Date(inq.created_at)
      months.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    }
    return Array.from(months).sort((a, b) => b.localeCompare(a))
  }, [inquiries])

  // ── 상단 통계 (전체 기준) ────────────────────────────────────
  const stats = useMemo(() => {
    const now = new Date()
    const today = now.toDateString()
    const thisMonth = now.getFullYear() * 100 + now.getMonth()
    const inMonth = (iso?: string | null) => {
      if (!iso) return false
      const d = new Date(iso)
      return d.getFullYear() * 100 + d.getMonth() === thisMonth
    }
    return {
      pending: inquiries.filter(i => i.status === 'pending').length,
      today: inquiries.filter(i => new Date(i.created_at).toDateString() === today).length,
      slaExceeded: inquiries.filter(i =>
        getSlaStatus(i as unknown as Inquiry, slaRules[i.category]) === 'exceeded'
      ).length,
      doneThisMonth: inquiries.filter(i =>
        (i.status === 'resolved' || i.status === 'closed') &&
        (inMonth(i.resolved_at) || inMonth(i.closed_at))
      ).length,
    }
  }, [inquiries, slaRules])

  // ── 필터 적용 + 정렬 (그룹 sort_order → 미해결 컴플레인 우선 → 최신) ──
  const filtered: RowItem[] = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows
      .filter(r => {
        // 월별 필터
        if (filterMonth) {
          const d = new Date(r.inq.created_at)
          const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
          if (ym !== filterMonth) return false
        }
        if (filterStatus && r.inq.status !== filterStatus) return false
        if (unreadOnly && (r.inq.unread_count_admin ?? 0) <= 0) return false
        if (q) {
          const name = r.displayName.toLowerCase()
          const title = (r.inq.title || '').toLowerCase()
          if (!name.includes(q) && !title.includes(q)) return false
        }
        return true
      })
      .sort((a, b) => {
        if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
        if (a.isUrgentComplaint !== b.isUrgentComplaint) return a.isUrgentComplaint ? -1 : 1
        return new Date(b.inq.created_at).getTime() - new Date(a.inq.created_at).getTime()
      })
  }, [rows, search, filterStatus, unreadOnly, filterMonth])

  // ── 페이지네이션 (전체 목록 기준 20건씩) ─────────────────────
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageItems = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page]
  )

  // 필터 변경 시 1페이지로
  useEffect(() => { setPage(1) }, [search, filterStatus, unreadOnly, filterMonth])
  // 페이지 범위 보정
  useEffect(() => { if (page > totalPages) setPage(totalPages) }, [page, totalPages])

  // ── 현재 페이지를 그룹으로 묶기 ──────────────────────────────
  const groups: Group[] = useMemo(() => {
    const map = new Map<string, Group>()
    for (const r of pageItems) {
      let g = map.get(r.groupTag)
      if (!g) {
        g = { tag: r.groupTag, sortOrder: r.sortOrder, items: [], unreadCount: 0, hasUrgent: false }
        map.set(r.groupTag, g)
      }
      g.items.push(r)
      g.sortOrder = Math.min(g.sortOrder, r.sortOrder)
      if ((r.inq.unread_count_admin ?? 0) > 0) g.unreadCount += 1
      if (r.isUrgentComplaint) g.hasUrgent = true
    }
    return Array.from(map.values()).sort((a, b) => a.sortOrder - b.sortOrder)
  }, [pageItems])

  // ── 첫 로딩 완료 후: openGroups 초기화 + 첫 문의 자동 선택 ─────
  useEffect(() => {
    if (loading || didInit) return
    // 미처리(unread)가 있는 그룹만 펼침
    const open = new Set<string>()
    for (const g of groups) if (g.unreadCount > 0) open.add(g.tag)
    setOpenGroups(open)

    // URL에 id가 없으면 첫 번째 문의 자동 선택
    if (!selectedId && filtered.length > 0) {
      const firstId = filtered[0].inq.id
      setSelectedId(firstId)
      router.replace(`/erp/inquiries?id=${firstId}`)
    }
    setDidInit(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, didInit, groups, filtered])

  // ── 핸들러 ───────────────────────────────────────────────────
  const toggleGroup = (tag: string) => {
    setOpenGroups(prev => {
      const next = new Set(prev)
      if (next.has(tag)) next.delete(tag)
      else next.add(tag)
      return next
    })
  }

  const selectInquiry = useCallback(async (inqId: string) => {
    setSelectedId(inqId)
    router.replace(`/erp/inquiries?id=${inqId}`)
    // 선택 즉시 미읽음 0으로 (낙관적 업데이트 + DB 반영)
    setInquiries(prev => prev.map(i => i.id === inqId ? { ...i, unread_count_admin: 0 } : i))
    const supabase = createClient()
    await supabase.from('inquiries').update({ unread_count_admin: 0 }).eq('id', inqId)
  }, [router])

  // ── 렌더 ─────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col bg-white rounded-2xl border border-slate-200 overflow-hidden">
      {/* CS 서브 탭 네비게이션 */}
      <div className="flex-shrink-0 flex border-b border-slate-200">
        <Link
          href="/erp/inquiries"
          className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${
            !pathname.startsWith('/erp/inquiries/history')
              ? 'border-[#2D6A4F] text-[#2D6A4F]'
              : 'border-transparent text-gray-500 hover:text-[#2D6A4F]'
          }`}
        >
          CS 관리
        </Link>
        <Link
          href="/erp/inquiries/history"
          className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${
            pathname.startsWith('/erp/inquiries/history')
              ? 'border-[#2D6A4F] text-[#2D6A4F]'
              : 'border-transparent text-gray-500 hover:text-[#2D6A4F]'
          }`}
        >
          이력 검색
        </Link>
      </div>

      {/* 2패널 영역 */}
      <div className="flex-1 flex overflow-hidden">

      {/* ── 왼쪽 패널 (38%) ──────────────────────────────────── */}
      <div className="w-[38%] min-w-[320px] flex flex-col border-r-[0.5px] border-slate-300 overflow-hidden">

        {/* 상단 고정: 통계 + 필터 */}
        <div className="flex-shrink-0 bg-white border-b border-slate-100">
          {/* 통계 바 */}
          <div className="grid grid-cols-4 gap-2 p-3">
            {[
              { label: '미처리',     value: stats.pending,      color: 'text-red-600',    bg: 'bg-red-50' },
              { label: '오늘 신규',  value: stats.today,        color: 'text-blue-600',   bg: 'bg-blue-50' },
              { label: 'SLA 초과',   value: stats.slaExceeded,  color: 'text-orange-600', bg: 'bg-orange-50' },
              { label: '이번달 처리', value: stats.doneThisMonth, color: 'text-green-600',  bg: 'bg-green-50' },
            ].map(c => (
              <div key={c.label} className={`rounded-xl px-2.5 py-2 ${c.bg}`}>
                <div className={`text-lg font-bold leading-none ${c.color}`}>{c.value}</div>
                <div className="text-[10px] text-gray-500 mt-1 whitespace-nowrap">{c.label}</div>
              </div>
            ))}
          </div>

          {/* 검색 / 필터 */}
          <div className="px-3 pb-3 space-y-2">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="지점명, 제목으로 검색..."
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]"
            />
            <div className="flex items-center gap-2">
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value as InquiryStatus | '')}
                className="flex-1 px-2.5 py-1.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]"
              >
                {STATUS_FILTER_TABS.map(t => (
                  <option key={t.key || 'all'} value={t.key}>{t.label}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setUnreadOnly(v => !v)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors border whitespace-nowrap ${
                  unreadOnly
                    ? 'bg-[#2D6A4F] border-[#2D6A4F] text-white'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-[#2D6A4F] hover:text-[#2D6A4F]'
                }`}
              >
                미처리만
              </button>
            </div>

            {/* 월별 필터 */}
            <select
              value={filterMonth}
              onChange={e => setFilterMonth(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]"
            >
              <option value="">📅 전체 기간</option>
              {availableMonths.map(ym => (
                <option key={ym} value={ym}>{formatYearMonth(ym)}</option>
              ))}
            </select>
          </div>
        </div>

        {/* 그룹 아코디언 목록 (독립 스크롤) */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            // 로딩 스켈레톤
            <div className="p-3 space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-14 bg-gray-50 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-4 py-16 text-center text-gray-400 text-sm">
              {filterMonth ? '📭 해당 월의 문의가 없습니다' : '검색 결과가 없습니다'}
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {groups.map(group => {
                const isOpen = openGroups.has(group.tag)
                // 원 프로파일 페이지와 동일한 그룹 색상 적용
                const gStyle = getGroupStyle(group.tag)
                return (
                  <div key={group.tag}>
                    {/* 그룹 헤더 — 그룹별 배경색 적용 */}
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.tag)}
                      className={`w-full flex items-center gap-2 px-3 py-2.5 transition-colors text-left sticky top-0 z-[1] hover:brightness-95 ${gStyle.headerBg}`}
                    >
                      <svg
                        width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                        className={`text-gray-400 flex-shrink-0 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 18l6-6-6-6" />
                      </svg>
                      {/* 그룹 색상 dot */}
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${gStyle.dot}`} />
                      <span className="text-sm font-bold text-[#1C2B1E]">{group.tag}</span>
                      <span className="text-xs text-gray-400">{group.items.length}건</span>
                      {group.hasUrgent && <span className="text-xs" title="긴급 컴플레인">⚡</span>}
                      <div className="flex-1" />
                      {group.unreadCount > 0 && (
                        <span className="w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center flex-shrink-0">
                          {group.unreadCount}
                        </span>
                      )}
                    </button>

                    {/* 그룹 내 문의 아이템 — 그룹 연한 색상 hover */}
                    {isOpen && group.items.map(({ inq, displayName, isUrgentComplaint }) => {
                      const unread = (inq.unread_count_admin ?? 0) > 0
                      const isSelected = selectedId === inq.id
                      const hasDraft = draftIds.has(inq.id)
                      return (
                        <button
                          key={inq.id}
                          type="button"
                          onClick={() => selectInquiry(inq.id)}
                          className={`w-full text-left px-3 py-2.5 pl-7 flex flex-col gap-1 border-l-2 transition-colors ${
                            isSelected
                              ? 'bg-blue-50 border-l-[#2D6A4F]'
                              : `border-l-transparent ${gStyle.itemHoverBg}`
                          }`}
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            {unread && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />}
                            {isUrgentComplaint && <span className="text-xs flex-shrink-0" title="긴급 컴플레인">⚡</span>}
                            {hasDraft && <span className="text-xs flex-shrink-0" title="임시저장된 초안 있음">✏️</span>}
                            <span className={`text-sm truncate ${unread ? 'font-semibold text-[#1C2B1E]' : 'text-gray-700'}`}>
                              {displayName}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 pl-0 min-w-0">
                            <span className="text-xs text-gray-500 truncate flex-1">
                              {CATEGORY_ICONS[inq.category]}{' '}
                              {inq.title || CATEGORY_LABELS[inq.category] || '문의'}
                            </span>
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold flex-shrink-0 ${STATUS_COLORS[inq.status]}`}>
                              {STATUS_LABELS[inq.status]}
                            </span>
                          </div>
                          <span className="text-[10px] text-gray-400">{timeAgo(inq.created_at)}</span>
                        </button>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* 페이지네이션 */}
        {!loading && filtered.length > 0 && (
          <div className="flex-shrink-0 flex items-center justify-center gap-1 px-3 py-2.5 border-t border-slate-100 bg-white">
            <button
              type="button"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-sm text-gray-500 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent"
            >
              ‹
            </button>
            {Array.from({ length: totalPages }).map((_, i) => {
              const p = i + 1
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPage(p)}
                  className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs font-semibold transition-colors ${
                    p === page ? 'bg-[#2D6A4F] text-white' : 'text-gray-500 hover:bg-slate-100'
                  }`}
                >
                  {p}
                </button>
              )
            })}
            <button
              type="button"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-sm text-gray-500 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent"
            >
              ›
            </button>
          </div>
        )}
      </div>

      {/* ── 오른쪽 패널 (62%) ────────────────────────────────── */}
      <div className="flex-1 min-w-0 overflow-hidden">
        <InquiryDetailPanel inquiryId={selectedId} />
      </div>
      </div>
    </div>
  )
}

export default function CsManagementPage() {
  return (
    <Suspense fallback={
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
      </div>
    }>
      <CsManagementInner />
    </Suspense>
  )
}
