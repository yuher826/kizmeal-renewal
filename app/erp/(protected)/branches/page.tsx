'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Building2, Utensils, Truck, CheckCircle, Search, AlertTriangle, Plus,
  ChevronLeft, ChevronRight, ChevronDown, ChevronRight as ChevronRightIcon,
} from 'lucide-react'
import type { BranchProfileRow } from '@/types/branch-profile'

const ITEMS_PER_GROUP = 20

const GROUPS = [
  {
    tag: 'E', label: 'ECC계열',
    headerClass: 'bg-blue-50 border-blue-200',
    badgeClass: 'bg-blue-100 text-blue-700',
    dotClass: 'bg-blue-500',
  },
  {
    tag: 'P', label: 'POLY계열',
    headerClass: 'bg-green-50 border-green-200',
    badgeClass: 'bg-green-100 text-green-700',
    dotClass: 'bg-green-500',
  },
  {
    tag: 'R', label: '라이즈계열',
    headerClass: 'bg-purple-50 border-purple-200',
    badgeClass: 'bg-purple-100 text-purple-700',
    dotClass: 'bg-purple-500',
  },
  {
    tag: 'MB', label: 'MB계열',
    headerClass: 'bg-orange-50 border-orange-200',
    badgeClass: 'bg-orange-100 text-orange-700',
    dotClass: 'bg-orange-500',
  },
  {
    tag: 'SLP', label: 'SLP계열',
    headerClass: 'bg-pink-50 border-pink-200',
    badgeClass: 'bg-pink-100 text-pink-700',
    dotClass: 'bg-pink-500',
  },
  {
    tag: 'AO', label: '알티오라',
    headerClass: 'bg-teal-50 border-teal-200',
    badgeClass: 'bg-teal-100 text-teal-700',
    dotClass: 'bg-teal-500',
  },
  {
    tag: '기타', label: '기타',
    headerClass: 'bg-slate-50 border-slate-200',
    badgeClass: 'bg-slate-100 text-slate-600',
    dotClass: 'bg-slate-400',
  },
]

// ── 유틸 ─────────────────────────────────────────────────────────────
function displayName(row: BranchProfileRow) {
  return row.branch_full_name ?? row.display_name ?? row.short_code ?? '-'
}

function normalizeGroup(g: string | null): string {
  if (!g || !g.trim()) return '기타'
  const t = g.trim()
  if (GROUPS.find(gr => gr.tag === t)) return t
  return '기타'
}

// ── 배지 ─────────────────────────────────────────────────────────────
function ContractBadge({ status }: { status: string | null }) {
  if (status === 'active') {
    return (
      <span className="inline-flex items-center text-xs font-medium bg-emerald-100 text-emerald-700 rounded px-2 py-0.5">
        계약중
      </span>
    )
  }
  return (
    <span className="inline-flex items-center text-xs font-medium bg-slate-100 text-slate-400 rounded px-2 py-0.5">
      만료
    </span>
  )
}

function ContractTypeBadge({ type }: { type: string | null }) {
  if (type === 'temporary') {
    return (
      <span className="inline-flex items-center text-xs font-medium bg-amber-100 text-amber-700 rounded px-2 py-0.5">
        임시
      </span>
    )
  }
  return (
    <span className="inline-flex items-center text-xs font-medium bg-slate-100 text-slate-600 rounded px-2 py-0.5">
      장기
    </span>
  )
}

function DietBadge({ type }: { type: string | null }) {
  if (type === 'ck') {
    return (
      <span className="inline-flex items-center text-xs font-medium bg-blue-100 text-blue-700 rounded px-2 py-0.5">
        CK
      </span>
    )
  }
  if (type === 'consignment') {
    return (
      <span className="inline-flex items-center text-xs font-medium bg-orange-100 text-orange-700 rounded px-2 py-0.5">
        위탁
      </span>
    )
  }
  return (
    <span className="inline-flex items-center text-xs font-medium bg-slate-100 text-slate-400 rounded px-2 py-0.5">
      -
    </span>
  )
}

// ── 스켈레톤 ─────────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <tr>
      {[32, 120, 56, 72, 56, 56, 72, 40, 40, 32, 32].map((w, i) => (
        <td key={i} className="px-4 py-3">
          <div className="animate-pulse bg-slate-100 rounded h-4" style={{ width: w }} />
        </td>
      ))}
    </tr>
  )
}

// ── 요약 카드 ─────────────────────────────────────────────────────────
interface SummaryCardProps {
  icon: React.ReactNode
  label: string
  value: number
  color: string
  isActive?: boolean
  onClick?: () => void
}
function SummaryCard({ icon, label, value, color, isActive, onClick }: SummaryCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`bg-white border rounded-xl p-5 flex items-center gap-4 w-full text-left transition-all ${
        isActive
          ? 'border-emerald-400 ring-2 ring-emerald-300 brightness-95'
          : 'border-slate-200 hover:brightness-95'
      }`}
    >
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-800">{value}</p>
        <p className="text-xs text-slate-500 mt-0.5">{label}</p>
      </div>
    </button>
  )
}

// ── 그룹 내 페이지네이션 ─────────────────────────────────────────────
function GroupPagination({
  tag,
  total,
  current,
  onPage,
}: {
  tag: string
  total: number
  current: number
  onPage: (tag: string, page: number) => void
}) {
  const totalPages = Math.ceil(total / ITEMS_PER_GROUP)
  if (totalPages <= 1) return null

  const start = (current - 1) * ITEMS_PER_GROUP + 1
  const end = Math.min(current * ITEMS_PER_GROUP, total)

  function pages(): number[] {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1)
    let s = Math.max(1, current - 2)
    let e = Math.min(totalPages, current + 2)
    if (e - s < 4) {
      if (s === 1) e = Math.min(totalPages, 5)
      else s = Math.max(1, e - 4)
    }
    return Array.from({ length: e - s + 1 }, (_, i) => s + i)
  }

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50">
      <span className="text-xs text-slate-400">
        {start}–{end} / 총 {total}개
      </span>
      <div className="flex gap-1">
        <button
          onClick={() => onPage(tag, current - 1)}
          disabled={current === 1}
          className="w-7 h-7 flex items-center justify-center rounded bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ChevronLeft size={13} />
        </button>
        {pages().map(n => (
          <button
            key={n}
            onClick={() => onPage(tag, n)}
            className={`w-7 h-7 text-xs font-medium rounded transition-colors ${
              n === current
                ? 'bg-emerald-600 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {n}
          </button>
        ))}
        <button
          onClick={() => onPage(tag, current + 1)}
          disabled={current === Math.ceil(total / ITEMS_PER_GROUP)}
          className="w-7 h-7 flex items-center justify-center rounded bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ChevronRight size={13} />
        </button>
      </div>
    </div>
  )
}

// ── 메인 ─────────────────────────────────────────────────────────────
export default function BranchesPage() {
  const router = useRouter()
  const [rows, setRows] = useState<BranchProfileRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // 검색 / 필터
  const [searchQuery, setSearchQuery] = useState('')
  const [groupFilter, setGroupFilter] = useState('전체')
  const [dietTypeFilter, setDietTypeFilter] = useState('전체')
  const [fileFormatFilter, setFileFormatFilter] = useState('전체')
  const [contractFilter, setContractFilter] = useState('전체')
  const [statFilter, setStatFilter] = useState<'ck' | 'catering' | 'deployedThisMonth' | 'incomplete' | null>(null)

  // 아코디언 / 페이지네이션
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set())
  const [groupPages, setGroupPages] = useState<Map<string, number>>(new Map())
  const [showAllMode, setShowAllMode] = useState(false)

  useEffect(() => {
    fetch('/api/branch-profiles')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setRows(data)
        else setError('데이터를 불러오지 못했습니다. 새로고침 해주세요.')
      })
      .catch(() => setError('데이터를 불러오지 못했습니다. 새로고침 해주세요.'))
      .finally(() => setLoading(false))
  }, [])

  // 검색어 변경 시 일치하는 그룹 자동 열기
  useEffect(() => {
    if (!searchQuery.trim()) return
    const q = searchQuery.trim().toLowerCase()
    const matching = new Set<string>()
    for (const row of rows) {
      if (
        (row.short_code ?? '').toLowerCase().includes(q) ||
        (row.display_name ?? '').toLowerCase().includes(q) ||
        (row.branch_full_name ?? '').toLowerCase().includes(q)
      ) {
        matching.add(normalizeGroup(row.group_tag))
      }
    }
    setOpenGroups(prev => {
      const next = new Set(prev)
      matching.forEach(g => next.add(g))
      return next
    })
    setGroupPages(new Map())
  }, [searchQuery, rows])

  // statFilter 변경 시 페이지 리셋
  useEffect(() => { setGroupPages(new Map()) }, [statFilter])

  // 필터링된 데이터
  const filteredData = useMemo(() => {
    let list = rows
    if (statFilter === 'ck') list = list.filter(r => r.diet_type === 'ck')
    else if (statFilter === 'catering') list = list.filter(r => r.diet_type === 'consignment')
    else if (statFilter === 'deployedThisMonth') list = list.filter(r => r.this_month_deployed)
    else if (statFilter === 'incomplete') list = list.filter(r => !r.is_profile_complete && r.contract_status === 'active')
    if (dietTypeFilter !== '전체') {
      if (dietTypeFilter === 'CK') list = list.filter(r => r.diet_type === 'ck')
      else if (dietTypeFilter === '위탁') list = list.filter(r => r.diet_type === 'consignment')
    }
    if (fileFormatFilter !== '전체') {
      list = list.filter(r => (r.file_format ?? '') === fileFormatFilter)
    }
    if (contractFilter !== '전체') {
      if (contractFilter === '계약중') list = list.filter(r => r.contract_status === 'active')
      else if (contractFilter === '만료') list = list.filter(r => r.contract_status !== 'active')
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      list = list.filter(r =>
        (r.short_code ?? '').toLowerCase().includes(q) ||
        (r.display_name ?? '').toLowerCase().includes(q) ||
        (r.branch_full_name ?? '').toLowerCase().includes(q)
      )
    }
    return list
  }, [rows, dietTypeFilter, fileFormatFilter, contractFilter, searchQuery, statFilter])

  // 요약 집계 (전체 rows 기준 고정)
  const total           = rows.length
  const ckCount         = rows.filter(r => r.diet_type === 'ck').length
  const conCount        = rows.filter(r => r.diet_type === 'consignment').length
  const deployedCount   = rows.filter(r => r.this_month_deployed).length
  const incompleteCount = rows.filter(r => !r.is_profile_complete && r.contract_status === 'active').length

  function toggleGroup(tag: string) {
    setOpenGroups(prev => {
      const next = new Set(prev)
      if (next.has(tag)) next.delete(tag)
      else next.add(tag)
      return next
    })
  }

  function handleGroupFilter(tag: string) {
    setGroupFilter(tag)
    if (tag === '전체') {
      setOpenGroups(new Set(GROUPS.map(g => g.tag)))
    } else {
      setOpenGroups(new Set([tag]))
    }
    setGroupPages(new Map())
  }

  function handleFilterChange(fn: () => void) {
    fn()
    setGroupPages(new Map())
  }

  function handleGroupPage(tag: string, page: number) {
    setGroupPages(prev => new Map(prev).set(tag, page))
  }

  function goToDetail(id: string) {
    router.push(`/erp/branches/${id}`)
  }

  const isFiltered = filteredData.length !== rows.length || searchQuery.trim() !== ''

  return (
    <div className="space-y-4">
      {/* 요약 카드 (전체 rows 기준 고정) */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <SummaryCard
          icon={<Building2 size={20} className="text-emerald-600" />}
          label="총 원수" value={total} color="bg-emerald-50"
          isActive={statFilter === null}
          onClick={() => setStatFilter(null)}
        />
        <SummaryCard
          icon={<Utensils size={20} className="text-blue-600" />}
          label="CK" value={ckCount} color="bg-blue-50"
          isActive={statFilter === 'ck'}
          onClick={() => setStatFilter(prev => prev === 'ck' ? null : 'ck')}
        />
        <SummaryCard
          icon={<Truck size={20} className="text-orange-600" />}
          label="위탁" value={conCount} color="bg-orange-50"
          isActive={statFilter === 'catering'}
          onClick={() => setStatFilter(prev => prev === 'catering' ? null : 'catering')}
        />
        <SummaryCard
          icon={<CheckCircle size={20} className="text-green-600" />}
          label="이번달 배포완료" value={deployedCount} color="bg-green-50"
          isActive={statFilter === 'deployedThisMonth'}
          onClick={() => setStatFilter(prev => prev === 'deployedThisMonth' ? null : 'deployedThisMonth')}
        />
        <SummaryCard
          icon={<AlertTriangle size={20} className="text-amber-600" />}
          label="미완료 (PPTX 미설정)" value={incompleteCount} color="bg-amber-50"
          isActive={statFilter === 'incomplete'}
          onClick={() => setStatFilter(prev => prev === 'incomplete' ? null : 'incomplete')}
        />
      </div>

      {/* 검색창 + 신규 등록 */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="원명으로 검색..."
            className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
          />
        </div>
        <Link
          href="/erp/branches/new"
          className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors whitespace-nowrap"
        >
          <Plus size={15} />
          신규 등록
        </Link>
      </div>

      {/* 프랜차이즈 필터 + 조건 필터 + 전체 펼침/접기 */}
      <div className="flex flex-wrap gap-2 items-center justify-between">
        {/* 프랜차이즈 버튼 */}
        <div className="flex flex-wrap gap-1.5">
          {['전체', ...GROUPS.map(g => g.tag)].map(tag => {
            const label = tag === '전체' ? '전체' : (GROUPS.find(g => g.tag === tag)?.label.replace('계열', '') ?? tag)
            const active = groupFilter === tag
            return (
              <button
                key={tag}
                onClick={() => handleGroupFilter(tag)}
                className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
                  active
                    ? 'bg-emerald-600 text-white'
                    : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>

        {/* 우측 버튼 */}
        {(() => {
          const visibleTags = GROUPS
            .filter(g => groupFilter === '전체' || g.tag === groupFilter)
            .filter(g => filteredData.some(r => normalizeGroup(r.group_tag) === g.tag))
            .map(g => g.tag)
          const allOpen = visibleTags.length > 0 && visibleTags.every(t => openGroups.has(t))
          return (
        <div className="flex gap-2">
          {allOpen ? (
            <button
              onClick={() => setOpenGroups(new Set())}
              className="border border-slate-200 text-slate-600 rounded-lg px-3 py-1.5 text-sm hover:bg-slate-50 transition-colors"
            >
              전체 접기
            </button>
          ) : (
            <button
              onClick={() => setOpenGroups(new Set(visibleTags))}
              className="border border-slate-200 text-slate-600 rounded-lg px-3 py-1.5 text-sm hover:bg-slate-50 transition-colors"
            >
              전체 펼치기
            </button>
          )}
          <button
            title="그룹당 원이 20개 초과일 때 자동 적용됩니다"
            onClick={() => setShowAllMode(false)}
            className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
              !showAllMode ? 'bg-emerald-600 text-white' : 'border border-slate-200 text-slate-600'
            }`}
          >
            20개씩
          </button>
          <button
            title="모든 그룹의 원을 전체 표시합니다"
            onClick={() => setShowAllMode(true)}
            className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
              showAllMode ? 'bg-emerald-600 text-white' : 'border border-slate-200 text-slate-600'
            }`}
          >
            전체보기
          </button>
        </div>
          )
        })()}
      </div>

      {/* 조건 필터 */}
      <div className="flex flex-wrap gap-2 items-center">
        <select
          value={dietTypeFilter}
          onChange={e => handleFilterChange(() => setDietTypeFilter(e.target.value))}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-600 focus:outline-none focus:border-emerald-500"
        >
          <option>전체</option>
          <option>CK</option>
          <option>위탁</option>
        </select>
        <select
          value={fileFormatFilter}
          onChange={e => handleFilterChange(() => setFileFormatFilter(e.target.value))}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-600 focus:outline-none focus:border-emerald-500"
        >
          <option>전체</option>
          <option>PDF</option>
          <option>JPG</option>
          <option>PPT</option>
        </select>
        <select
          value={contractFilter}
          onChange={e => handleFilterChange(() => setContractFilter(e.target.value))}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-600 focus:outline-none focus:border-emerald-500"
        >
          <option>전체</option>
          <option>계약중</option>
          <option>만료</option>
        </select>
        <span className="text-sm text-slate-500 ml-auto">
          {isFiltered ? `${filteredData.length}개원 검색됨` : `총 ${rows.length}개원`}
        </span>
      </div>

      {/* 에러 */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {/* 스켈레톤 */}
      {loading && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full">
            <tbody>
              {Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}
            </tbody>
          </table>
        </div>
      )}

      {/* 아코디언 그룹 목록 */}
      {!loading && (
        <div>
          {GROUPS
            .filter(g => groupFilter === '전체' || g.tag === groupFilter)
            .map(g => {
              const groupBranches = filteredData.filter(r => normalizeGroup(r.group_tag) === g.tag)
              if (groupBranches.length === 0) return null

              const isOpen = openGroups.has(g.tag)
              const currentPage = groupPages.get(g.tag) ?? 1
              const needPagination = !showAllMode && groupBranches.length > ITEMS_PER_GROUP
              const displayed = needPagination
                ? groupBranches.slice((currentPage - 1) * ITEMS_PER_GROUP, currentPage * ITEMS_PER_GROUP)
                : groupBranches

              return (
                <div key={g.tag}>
                  {/* 그룹 헤더 */}
                  <div
                    className={`${g.headerClass} border rounded-xl px-4 py-3 flex items-center justify-between cursor-pointer mb-1 transition-all hover:brightness-95`}
                    onClick={() => toggleGroup(g.tag)}
                  >
                    <div className="flex items-center">
                      {isOpen
                        ? <ChevronDown size={14} className="text-slate-500" />
                        : <ChevronRightIcon size={14} className="text-slate-500" />}
                      <div className={`${g.dotClass} w-2 h-2 rounded-full mx-2`} />
                      <span className="text-sm font-semibold text-slate-700">{g.label}</span>
                    </div>
                    <span className="text-sm text-slate-400">{groupBranches.length}개원</span>
                  </div>

                  {/* 그룹 콘텐츠 */}
                  {isOpen && (
                    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden mb-3">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200">
                            {['#', '원명', '그룹', '계약상태', '계약유형', '식단타입', '파일형식', '슬라이드', '이메일수', '이번달', '설정'].map(h => (
                              <th
                                key={h}
                                className={`px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap ${
                                  h === '#' ? 'w-12 text-center' : 'text-left'
                                }`}
                              >
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {displayed.length === 0 ? (
                            <tr>
                              <td colSpan={11} className="text-center py-8 text-slate-400 text-sm">
                                검색 결과가 없습니다
                              </td>
                            </tr>
                          ) : (
                            displayed.map(row => (
                              <tr
                                key={row.id}
                                onClick={() => goToDetail(row.id)}
                                className={`border-b border-slate-100 hover:bg-emerald-50/30 cursor-pointer transition-colors duration-100 ${
                                  row.contract_status !== 'active' ? 'opacity-50' : ''
                                }`}
                              >
                                <td className="px-4 py-3 text-sm text-slate-400 text-center w-12">
                                  {groupFilter === '전체'
                                    ? (row.sort_order ?? '—')
                                    : groupBranches.indexOf(row) + 1}
                                </td>
                                <td className="px-4 py-3 text-sm font-medium text-slate-800 whitespace-nowrap">
                                  {displayName(row)}
                                </td>
                                <td className="px-4 py-3">
                                  <span className={`text-xs rounded px-2 py-0.5 ${g.badgeClass}`}>
                                    {row.group_tag ?? '기타'}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <ContractBadge status={row.contract_status} />
                                </td>
                                <td className="px-4 py-3">
                                  <ContractTypeBadge type={row.contract_type} />
                                </td>
                                <td className="px-4 py-3">
                                  <DietBadge type={row.diet_type} />
                                </td>
                                <td className="px-4 py-3">
                                  <span className="text-xs bg-slate-100 text-slate-600 rounded px-2 py-0.5">
                                    {row.file_format ?? '-'}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-sm text-slate-600 text-center">
                                  {row.slide_count ?? '-'}
                                </td>
                                <td className="px-4 py-3 text-sm text-slate-600 text-center">
                                  {row.distribution_emails?.length ?? 0}
                                </td>
                                <td className="px-4 py-3 text-center text-sm">
                                  {row.this_month_deployed ? (
                                    <Link
                                      href="/erp/diet"
                                      onClick={e => e.stopPropagation()}
                                      title="식단 자동화 확인하기"
                                      className="text-emerald-500 hover:text-emerald-700 cursor-pointer transition-colors inline-block"
                                    >
                                      ✅
                                    </Link>
                                  ) : (
                                    <Link
                                      href="/erp/diet"
                                      onClick={e => e.stopPropagation()}
                                      title="식단 자동화에서 배포하기"
                                      className="text-slate-300 hover:text-amber-500 cursor-pointer transition-colors inline-block"
                                    >
                                      ⏳
                                    </Link>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-center text-sm">
                                  {row.is_profile_complete
                                    ? <span className="text-emerald-500" title="설정 완료">✅</span>
                                    : <span className="text-amber-500" title="PPTX 미설정">⚠️</span>
                                  }
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>

                      {/* 그룹 내 페이지네이션 */}
                      {needPagination && (
                        <GroupPagination
                          tag={g.tag}
                          total={groupBranches.length}
                          current={currentPage}
                          onPage={handleGroupPage}
                        />
                      )}
                    </div>
                  )}
                </div>
              )
            })}

          {/* 필터 결과 없음 */}
          {filteredData.length === 0 && (
            <div className="bg-white border border-slate-200 rounded-xl py-12 text-center text-slate-400 text-sm">
              검색 결과가 없습니다
            </div>
          )}
        </div>
      )}
    </div>
  )
}
