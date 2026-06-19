'use client'

import { Suspense, useEffect, useState, useMemo, useRef } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import type { InquiryStatus, InquiryCategory } from '@/lib/types'
import { STATUS_COLORS, STATUS_LABELS, CATEGORY_ICONS, CATEGORY_LABELS } from '@/lib/types'
import InquiryDetailPanel from '../components/InquiryDetailPanel'
import { getGroupStyle } from '@/lib/cs-group-styles'

const PAGE_SIZE = 30

const STATUS_OPTS: { key: InquiryStatus | ''; label: string }[] = [
  { key: '',            label: '전체 상태' },
  { key: 'pending',     label: '대기' },
  { key: 'in_progress', label: '처리중' },
  { key: 'resolved',    label: '해결' },
  { key: 'closed',      label: '종료' },
]

type SortField = 'branch' | 'status' | 'created_at'
type SortDir = 'asc' | 'desc'

// 쿼리 결과 타입 (Supabase 조인 결과)
interface HistoryInquiry {
  id: string
  title: string | null
  status: InquiryStatus
  category: InquiryCategory
  created_at: string
  branch_id: string
  assigned_admin_id: string | null
  branches: { id: string; name: string; is_active: boolean } | { id: string; name: string; is_active: boolean }[] | null
  admins: { id: string; name: string } | { id: string; name: string }[] | null
}

interface BranchProfile {
  branch_id: string
  branch_full_name: string | null
  group_tag: string | null
  sort_order: number | null
}

interface BranchOption {
  id: string
  name: string
  displayName: string
  sortOrder: number
}

// Supabase 중첩 조인 결과를 단일 객체로 정규화
function one<T>(v: T | T[] | null | undefined): T | null {
  if (Array.isArray(v)) return v[0] ?? null
  return v ?? null
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <span className="ml-1 text-gray-300 text-xs">↕</span>
  return <span className="ml-1 text-[#2D6A4F] text-xs">{dir === 'asc' ? '↑' : '↓'}</span>
}

function HistoryInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()

  // 필터 입력값 (URL에서 초기화)
  const [keyword, setKeyword] = useState(searchParams.get('keyword') || '')
  const [filterStatus, setFilterStatus] = useState<InquiryStatus | ''>(
    (searchParams.get('status') || '') as InquiryStatus | ''
  )
  const [filterFrom, setFilterFrom] = useState(searchParams.get('from') || '')
  const [filterTo, setFilterTo] = useState(searchParams.get('to') || '')
  const [filterBranch, setFilterBranch] = useState(searchParams.get('branch') || '')

  // 검색 결과 데이터
  const [rawInquiries, setRawInquiries] = useState<HistoryInquiry[]>([])
  const [appliedKeyword, setAppliedKeyword] = useState(searchParams.get('keyword') || '')
  const [profiles, setProfiles] = useState<Record<string, BranchProfile>>({})
  const [msgCounts, setMsgCounts] = useState<Record<string, number>>({})
  const [branchOptions, setBranchOptions] = useState<BranchOption[]>([])
  const [loading, setLoading] = useState(false)
  const [initialLoaded, setInitialLoaded] = useState(false)

  // 정렬
  const [sortField, setSortField] = useState<SortField>('created_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  // 페이지 + 슬라이드 오버
  const [page, setPage] = useState(1)
  const [selectedId, setSelectedId] = useState<string | null>(
    searchParams.get('selected') || null
  )

  // 페이지 변경 시 슬라이드 오버 닫기
  const prevPageRef = useRef(page)
  useEffect(() => {
    if (prevPageRef.current !== page) {
      prevPageRef.current = page
      setSelectedId(null)
      // URL에서 selected 제거
      const params = new URLSearchParams(searchParams.toString())
      params.delete('selected')
      router.replace(`${pathname}?${params.toString()}`)
    }
  }, [page, pathname, router, searchParams])

  // ── 지점 목록 + 프로파일 로드 ─────────────────────────────────
  useEffect(() => {
    async function loadStatic() {
      const supabase = createClient()
      const [profileRes, branchRes] = await Promise.all([
        supabase.from('branch_profiles').select('branch_id, branch_full_name, group_tag, sort_order'),
        supabase.from('branches').select('id, name').eq('is_active', true),
      ])

      const pmap: Record<string, BranchProfile> = {}
      for (const p of (profileRes.data || [])) {
        pmap[p.branch_id] = p
      }
      setProfiles(pmap)

      const opts: BranchOption[] = (branchRes.data || []).map(b => ({
        id: b.id,
        name: b.name,
        displayName: pmap[b.id]?.branch_full_name || b.name,
        sortOrder: pmap[b.id]?.sort_order ?? 9999,
      }))
      opts.sort((a, b) => a.sortOrder - b.sortOrder)
      setBranchOptions(opts)
    }
    loadStatic()
  }, [])

  // ── 검색 실행 ──────────────────────────────────────────────────
  async function doSearch(kw: string, stat: string, from: string, to: string, branch: string) {
    setLoading(true)

    // URL 업데이트 (selected는 유지 안 함)
    const params = new URLSearchParams()
    if (kw) params.set('keyword', kw)
    if (stat) params.set('status', stat)
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    if (branch) params.set('branch', branch)
    router.replace(`${pathname}?${params.toString()}`)

    const supabase = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query: any = supabase
      .from('inquiries')
      .select('id, title, status, category, created_at, branch_id, assigned_admin_id, branches!inner(id, name, is_active), admins(id, name)')
      .order('created_at', { ascending: false })

    if (stat) query = query.eq('status', stat)
    if (from) query = query.gte('created_at', from + 'T00:00:00')
    if (to) query = query.lte('created_at', to + 'T23:59:59')
    if (branch) query = query.eq('branch_id', branch)

    const { data } = await query
    const inquiries = (data || []) as unknown as HistoryInquiry[]
    setRawInquiries(inquiries)
    setAppliedKeyword(kw)
    setPage(1)
    setSelectedId(null)

    // 전체 결과에 대한 메시지 수 한 번에 로드
    if (inquiries.length > 0) {
      const ids = inquiries.map(i => i.id)
      const { data: msgs } = await supabase
        .from('messages')
        .select('inquiry_id')
        .in('inquiry_id', ids)
        .eq('is_internal', false)

      const counts: Record<string, number> = {}
      for (const m of (msgs || [])) {
        counts[m.inquiry_id] = (counts[m.inquiry_id] || 0) + 1
      }
      setMsgCounts(counts)
    } else {
      setMsgCounts({})
    }

    setInitialLoaded(true)
    setLoading(false)
  }

  // 초기 로드 (마운트 1회)
  useEffect(() => {
    doSearch(keyword, filterStatus, filterFrom, filterTo, filterBranch)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleSearch() {
    doSearch(keyword, filterStatus, filterFrom, filterTo, filterBranch)
  }

  function handleReset() {
    setKeyword('')
    setFilterStatus('')
    setFilterFrom('')
    setFilterTo('')
    setFilterBranch('')
    doSearch('', '', '', '', '')
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleSearch()
  }

  // ── 클라이언트 사이드 키워드 필터 + 정렬 ────────────────────────
  const filtered = useMemo(() => {
    const kw = appliedKeyword.trim().toLowerCase()
    if (!kw) return rawInquiries
    return rawInquiries.filter(inq => {
      const branch = one(inq.branches)
      const prof = profiles[inq.branch_id]
      const branchName = prof?.branch_full_name || branch?.name || ''
      return branchName.toLowerCase().includes(kw) || (inq.title || '').toLowerCase().includes(kw)
    })
  }, [rawInquiries, appliedKeyword, profiles])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const mul = sortDir === 'asc' ? 1 : -1
      if (sortField === 'created_at') {
        return mul * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      }
      if (sortField === 'status') {
        return mul * a.status.localeCompare(b.status)
      }
      if (sortField === 'branch') {
        const pa = profiles[a.branch_id]
        const pb = profiles[b.branch_id]
        const ba = one(a.branches)
        const bb = one(b.branches)
        const nameA = pa?.branch_full_name || ba?.name || ''
        const nameB = pb?.branch_full_name || bb?.name || ''
        return mul * nameA.localeCompare(nameB, 'ko')
      }
      return 0
    })
  }, [filtered, sortField, sortDir, profiles])

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const pageItems = useMemo(
    () => sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [sorted, page]
  )

  // 페이지 범위 보정
  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  // ── 정렬 토글 ─────────────────────────────────────────────────
  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('desc')
    }
  }

  // ── 행 클릭 ───────────────────────────────────────────────────
  function handleRowClick(inqId: string) {
    setSelectedId(inqId)
    const params = new URLSearchParams(searchParams.toString())
    params.set('selected', inqId)
    router.replace(`${pathname}?${params.toString()}`)
  }

  function handleClosePanel() {
    setSelectedId(null)
    const params = new URLSearchParams(searchParams.toString())
    params.delete('selected')
    router.replace(`${pathname}?${params.toString()}`)
  }

  // ── 페이지네이션 버튼 목록 계산 ──────────────────────────────
  function pageRange(): number[] {
    if (totalPages <= 10) return Array.from({ length: totalPages }, (_, i) => i + 1)
    const delta = 2
    const start = Math.max(2, page - delta)
    const end = Math.min(totalPages - 1, page + delta)
    const range: number[] = [1]
    if (start > 2) range.push(-1) // 생략 표시
    for (let i = start; i <= end; i++) range.push(i)
    if (end < totalPages - 1) range.push(-1)
    range.push(totalPages)
    return range
  }

  return (
    <div className="min-h-full">
      {/* 슬라이드 오버 백드롭 */}
      {selectedId && (
        <div
          className="fixed inset-0 bg-black/30 z-40"
          onClick={handleClosePanel}
          aria-hidden="true"
        />
      )}

      {/* 슬라이드 오버 패널 (45% 너비) */}
      <div
        className={`fixed top-0 right-0 h-full w-[45%] min-w-[480px] z-50 shadow-2xl transition-transform duration-300 ease-in-out ${
          selectedId ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="h-full flex flex-col bg-white border-l border-slate-200">
          {/* 패널 닫기 버튼 */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 flex-shrink-0">
            <span className="text-sm font-semibold text-gray-700">문의 상세</span>
            <button
              onClick={handleClosePanel}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors font-bold"
            >
              ✕
            </button>
          </div>
          {/* InquiryDetailPanel 재사용 */}
          <div className="flex-1 overflow-hidden">
            <InquiryDetailPanel inquiryId={selectedId} />
          </div>
        </div>
      </div>

      {/* 메인 컨텐츠 */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">

        {/* 탭 네비게이션 */}
        <div className="flex border-b border-slate-200">
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

        {/* 필터 바 */}
        <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="지점명, 제목 검색..."
            className="px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F] min-w-[180px]"
          />
          <input
            type="date"
            value={filterFrom}
            onChange={e => setFilterFrom(e.target.value)}
            className="px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]"
          />
          <span className="text-gray-400 text-sm">~</span>
          <input
            type="date"
            value={filterTo}
            onChange={e => setFilterTo(e.target.value)}
            className="px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]"
          />
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value as InquiryStatus | '')}
            className="px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]"
          >
            {STATUS_OPTS.map(o => (
              <option key={o.key || 'all'} value={o.key}>{o.label}</option>
            ))}
          </select>
          <select
            value={filterBranch}
            onChange={e => setFilterBranch(e.target.value)}
            className="px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F] max-w-[200px]"
          >
            <option value="">전체 지점</option>
            {branchOptions.map(b => (
              <option key={b.id} value={b.id}>{b.displayName}</option>
            ))}
          </select>
          <button
            onClick={handleSearch}
            disabled={loading}
            className="px-4 py-2 rounded-xl bg-[#2D6A4F] text-white text-sm font-semibold hover:bg-[#1B4332] disabled:bg-gray-300 transition-colors flex items-center gap-1.5"
          >
            {loading && (
              <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            )}
            검색
          </button>
          <button
            onClick={handleReset}
            disabled={loading}
            className="px-4 py-2 rounded-xl bg-gray-100 text-gray-600 text-sm font-medium hover:bg-gray-200 disabled:opacity-50 transition-colors"
          >
            초기화
          </button>
        </div>

        {/* 결과 건수 */}
        {initialLoaded && (
          <div className="px-4 py-2 border-b border-slate-100 text-sm text-gray-500">
            총 <strong className="text-[#1C2B1E]">{sorted.length}</strong>건
          </div>
        )}

        {/* 테이블 */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th
                  className="px-4 py-3 text-left font-semibold text-gray-500 cursor-pointer select-none whitespace-nowrap hover:text-[#2D6A4F]"
                  onClick={() => toggleSort('branch')}
                >
                  지점명
                  <SortIcon active={sortField === 'branch'} dir={sortDir} />
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-500 whitespace-nowrap">
                  문의 내용
                </th>
                <th
                  className="px-4 py-3 text-left font-semibold text-gray-500 cursor-pointer select-none whitespace-nowrap hover:text-[#2D6A4F]"
                  onClick={() => toggleSort('status')}
                >
                  상태
                  <SortIcon active={sortField === 'status'} dir={sortDir} />
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-500 whitespace-nowrap">
                  메시지 수
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-500 whitespace-nowrap">
                  담당자
                </th>
                <th
                  className="px-4 py-3 text-left font-semibold text-gray-500 cursor-pointer select-none whitespace-nowrap hover:text-[#2D6A4F]"
                  onClick={() => toggleSort('created_at')}
                >
                  등록일
                  <SortIcon active={sortField === 'created_at'} dir={sortDir} />
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                // 스켈레톤 UI
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div
                          className="h-4 bg-gray-100 rounded animate-pulse"
                          style={{ width: `${50 + ((i + j) * 13) % 45}%` }}
                        />
                      </td>
                    ))}
                  </tr>
                ))
              ) : pageItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center text-gray-400">
                    {initialLoaded ? '검색 결과가 없습니다' : '검색 조건을 입력하고 검색 버튼을 눌러주세요'}
                  </td>
                </tr>
              ) : (
                pageItems.map(inq => {
                  const prof = profiles[inq.branch_id]
                  const branch = one(inq.branches)
                  const groupTag = prof?.group_tag ?? null
                  const gStyle = getGroupStyle(groupTag)
                  const branchName = prof?.branch_full_name || branch?.name || '—'
                  const admin = one(inq.admins)
                  const adminName = admin?.name || '—'
                  const isSelected = selectedId === inq.id

                  // 문의 내용 요약 (카테고리 아이콘 + 제목, 최대 60자)
                  const rawSummary = `${CATEGORY_ICONS[inq.category] || ''} ${inq.title || CATEGORY_LABELS[inq.category] || '문의'}`.trim()
                  const summary = rawSummary.length > 60 ? rawSummary.slice(0, 60) + '...' : rawSummary

                  return (
                    <tr
                      key={inq.id}
                      onClick={() => handleRowClick(inq.id)}
                      className={`border-b border-slate-100 cursor-pointer transition-colors ${
                        isSelected ? 'bg-emerald-50' : 'hover:bg-slate-50'
                      }`}
                    >
                      {/* 지점명 + 그룹 뱃지 */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {groupTag && (
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${gStyle.badgeBg} ${gStyle.badgeText}`}>
                              {groupTag}
                            </span>
                          )}
                          <span className="text-sm font-medium text-[#1C2B1E]">{branchName}</span>
                        </div>
                      </td>
                      {/* 문의 내용 요약 */}
                      <td className="px-4 py-3 text-gray-600 max-w-xs">
                        <span className="block truncate">{summary}</span>
                      </td>
                      {/* 상태 */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[inq.status]}`}>
                          {STATUS_LABELS[inq.status]}
                        </span>
                      </td>
                      {/* 메시지 수 */}
                      <td className="px-4 py-3 text-center text-gray-600">
                        {msgCounts[inq.id] !== undefined ? msgCounts[inq.id] : '—'}
                      </td>
                      {/* 담당자 */}
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{adminName}</td>
                      {/* 등록일 */}
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDate(inq.created_at)}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 페이지네이션 */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-center gap-1 px-4 py-3 border-t border-slate-100">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent text-sm"
            >
              ‹
            </button>
            {pageRange().map((p, i) =>
              p === -1 ? (
                <span key={`ellipsis-${i}`} className="w-8 h-8 flex items-center justify-center text-gray-400 text-xs">
                  …
                </span>
              ) : (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-semibold transition-colors ${
                    p === page ? 'bg-[#2D6A4F] text-white' : 'text-gray-500 hover:bg-slate-100'
                  }`}
                >
                  {p}
                </button>
              )
            )}
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent text-sm"
            >
              ›
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function InquiryHistoryPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
      </div>
    }>
      <HistoryInner />
    </Suspense>
  )
}
