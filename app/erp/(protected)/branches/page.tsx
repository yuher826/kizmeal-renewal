'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Building2, Utensils, Truck, CheckCircle, Search, AlertTriangle, Plus,
} from 'lucide-react'
import type { BranchProfileRow } from '@/types/branch-profile'

// ── 유틸 ─────────────────────────────────────────────────────────────
function displayName(row: BranchProfileRow) {
  return row.branch_full_name ?? row.display_name ?? row.short_code ?? '-'
}

function normalizeGroup(g: string | null): string {
  return g && g.trim() ? g.trim() : '기타'
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
      {[120, 56, 72, 56, 72, 40, 40, 32, 32].map((w, i) => (
        <td key={i} className="px-4 py-3">
          <div
            className="animate-pulse bg-slate-100 rounded h-4"
            style={{ width: w }}
          />
        </td>
      ))}
    </tr>
  )
}

function SkeletonCard() {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
      <div className="animate-pulse bg-slate-100 rounded h-4 w-2/3" />
      <div className="animate-pulse bg-slate-100 rounded h-3 w-1/3" />
    </div>
  )
}

// ── 요약 카드 ─────────────────────────────────────────────────────────
interface SummaryCardProps {
  icon: React.ReactNode
  label: string
  value: number
  color: string
}
function SummaryCard({ icon, label, value, color }: SummaryCardProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-center gap-4">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-800">{value}</p>
        <p className="text-xs text-slate-500 mt-0.5">{label}</p>
      </div>
    </div>
  )
}

// ── 메인 ─────────────────────────────────────────────────────────────
type FilterType = 'all' | 'ck' | 'consignment'

export default function BranchesPage() {
  const router = useRouter()
  const [rows, setRows] = useState<BranchProfileRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterType>('all')

  useEffect(() => {
    fetch('/api/branch-profiles')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setRows(data)
        } else {
          setError('데이터를 불러오지 못했습니다. 새로고침 해주세요.')
        }
      })
      .catch(() => setError('데이터를 불러오지 못했습니다. 새로고침 해주세요.'))
      .finally(() => setLoading(false))
  }, [])

  // ── 클라이언트 필터링 ────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = rows
    if (filter !== 'all') {
      list = list.filter(r => r.diet_type === filter)
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(r =>
        (r.short_code ?? '').toLowerCase().includes(q) ||
        (r.display_name ?? '').toLowerCase().includes(q) ||
        (r.branch_full_name ?? '').toLowerCase().includes(q)
      )
    }
    return list
  }, [rows, filter, search])

  // ── 요약 집계 ───────────────────────────────────────────────────
  const total         = rows.length
  const ckCount       = rows.filter(r => r.diet_type === 'ck').length
  const conCount      = rows.filter(r => r.diet_type === 'consignment').length
  const deployedCount = rows.filter(r => r.this_month_deployed).length
  const incompleteCount = rows.filter(r => !r.is_profile_complete && r.contract_status === 'active').length

  // ── 그룹별 묶기 ─────────────────────────────────────────────────
  const grouped = useMemo(() => {
    const map = new Map<string, BranchProfileRow[]>()
    for (const row of filtered) {
      const g = normalizeGroup(row.group_tag)
      if (!map.has(g)) map.set(g, [])
      map.get(g)!.push(row)
    }
    // 정렬: 알파벳 오름차순, '기타' 마지막
    return Array.from(map.entries()).sort(([a], [b]) => {
      if (a === '기타') return 1
      if (b === '기타') return -1
      return a.localeCompare(b)
    })
  }, [filtered])

  function goToDetail(id: string) {
    router.push(`/erp/branches/${id}`)
  }

  // ── 필터 버튼 ───────────────────────────────────────────────────
  function FilterBtn({ value, label }: { value: FilterType; label: string }) {
    const active = filter === value
    return (
      <button
        onClick={() => setFilter(value)}
        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
          active
            ? 'bg-emerald-600 text-white'
            : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
        }`}
      >
        {label}
      </button>
    )
  }

  // ── 렌더 ────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* 요약 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <SummaryCard
          icon={<Building2 size={20} className="text-emerald-600" />}
          label="총 원수"
          value={total}
          color="bg-emerald-50"
        />
        <SummaryCard
          icon={<Utensils size={20} className="text-blue-600" />}
          label="CK"
          value={ckCount}
          color="bg-blue-50"
        />
        <SummaryCard
          icon={<Truck size={20} className="text-orange-600" />}
          label="위탁"
          value={conCount}
          color="bg-orange-50"
        />
        <SummaryCard
          icon={<CheckCircle size={20} className="text-green-600" />}
          label="이번달 배포완료"
          value={deployedCount}
          color="bg-green-50"
        />
        <SummaryCard
          icon={<AlertTriangle size={20} className="text-amber-600" />}
          label="미완료 (PPTX 미설정)"
          value={incompleteCount}
          color="bg-amber-50"
        />
      </div>

      {/* 검색 + 필터 + 신규 등록 */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
          />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="원명으로 검색..."
            className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
          />
        </div>
        <div className="flex gap-2">
          <FilterBtn value="all"         label="전체" />
          <FilterBtn value="ck"          label="CK" />
          <FilterBtn value="consignment" label="위탁" />
        </div>
        <Link
          href="/erp/branches/new"
          className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors whitespace-nowrap"
        >
          <Plus size={15} />
          신규 등록
        </Link>
      </div>

      {/* 에러 */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {/* ── 데스크탑 테이블 ──────────────────────────────────────── */}
      <div className="hidden md:block bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              {['원명', '그룹', '계약상태', '식단타입', '파일형식', '슬라이드', '이메일수', '이번달', '설정'].map(h => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center py-12 text-slate-400 text-sm">
                  검색 결과가 없습니다
                </td>
              </tr>
            ) : (
              grouped.map(([group, groupRows]) => (
                <>
                  {/* 그룹 헤더 */}
                  <tr key={`hdr-${group}`}>
                    <td
                      colSpan={9}
                      className="px-4 py-2 text-xs font-semibold text-slate-400 uppercase tracking-widest bg-slate-50/50"
                    >
                      ── {group} 그룹 ({groupRows.length}개원) ──
                    </td>
                  </tr>
                  {groupRows.map(row => (
                    <tr
                      key={row.id}
                      onClick={() => goToDetail(row.id)}
                      className={`border-b border-slate-100 hover:bg-emerald-50/30 cursor-pointer transition-colors duration-100 ${
                        row.contract_status !== 'active' ? 'opacity-50' : ''
                      }`}
                    >
                      <td className="px-4 py-3 text-sm font-medium text-slate-800 whitespace-nowrap">
                        {displayName(row)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs bg-slate-100 text-slate-600 rounded px-2 py-0.5">
                          {row.group_tag ?? '기타'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <ContractBadge status={row.contract_status} />
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
                        {row.this_month_deployed
                          ? <span className="text-emerald-600">✅</span>
                          : <span className="text-slate-300">⏳</span>
                        }
                      </td>
                      <td className="px-4 py-3 text-center text-sm">
                        {row.is_profile_complete
                          ? <span className="text-emerald-500" title="설정 완료">✅</span>
                          : <span className="text-amber-500" title="PPTX 미설정">⚠️</span>
                        }
                      </td>
                    </tr>
                  ))}
                </>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── 모바일 카드 뷰 ──────────────────────────────────────── */}
      <div className="md:hidden space-y-3">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)
        ) : filtered.length === 0 ? (
          <p className="text-slate-400 text-center py-12 text-sm">검색 결과가 없습니다</p>
        ) : (
          filtered.map(row => (
            <div
              key={row.id}
              onClick={() => goToDetail(row.id)}
              className="bg-white border border-slate-200 rounded-xl p-4 hover:border-emerald-300 cursor-pointer transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-slate-800 leading-snug">
                  {displayName(row)}
                </p>
                {row.group_tag && (
                  <span className="text-xs bg-slate-100 text-slate-600 rounded px-2 py-0.5 flex-shrink-0">
                    {row.group_tag}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <ContractBadge status={row.contract_status} />
                <DietBadge type={row.diet_type} />
              </div>
              <div className="flex items-center justify-between mt-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">
                    {row.file_format ?? '-'}
                    {row.slide_count != null && ` · ${row.slide_count}p`}
                  </span>
                  {!row.is_profile_complete && (
                    <span className="text-xs text-amber-600 flex items-center gap-0.5">
                      <AlertTriangle size={11} />
                      미설정
                    </span>
                  )}
                </div>
                <span className="text-sm">
                  {row.this_month_deployed
                    ? <span className="text-emerald-600">✅ 배포완료</span>
                    : <span className="text-slate-300">⏳ 미배포</span>
                  }
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
