'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase'

/**
 * ERP 파일보관함 — 목록 (2026-08-18 권팀장 요청 2번)
 *
 * 고객사 포털의 "파일보관함"에 노출될 파일을 조회·삭제한다.
 * 업로드는 /erp/files/new로 분리 — 고객사 공지(/erp/notices +
 * /erp/notices/new)와 같은 구조. 업로드는 한 달에 몇 번뿐인데 목록은
 * 매번 보게 되므로, 자주 보는 쪽에 화면을 온전히 내준다.
 * 식단표는 식단 자동화 파이프라인이 담당하므로 여기서 다루지 않는다.
 *
 * ★배포 범위 3단계:
 *   - 전체(all)    : 모든 원
 *   - 그룹(group)  : 같은 diet_type 원만. CK 건강정보지 ↔ 위탁 건강정보지가
 *                    다르다는 운영 현실을 반영(유대표 확인)
 *   - 원별(branch) : 지정한 원 하나만. 임시원(크레오)처럼 그룹에 안 묶인
 *                    곳에 개별 전달할 때도 이 방식을 쓴다
 */

type Category = 'health_info' | 'handout' | 'photo' | 'etc'
type Scope = 'all' | 'group' | 'branch'

type FileRow = {
  id: string
  category: Category
  title: string
  file_url: string
  year: number
  month: number
  scope: Scope
  scope_diet_type: string | null
  scope_branch_id: string | null
  created_at: string
}

type BranchOption = { id: string; name: string }

const CATEGORY_LABELS: Record<Category, string> = {
  health_info: '건강정보지',
  handout:     '유인물',
  photo:       '식단사진',
  etc:         '기타',
}

/** 목록 한 페이지에 보여줄 개수. inquiries/history(30)보다 작게 잡음 —
 *  파일 목록은 행 높이가 더 크고 스캔 위주로 보게 되므로 20이 적당 */
const PAGE_SIZE = 20

export default function ErpFileArchivePage() {
  const [rows, setRows]         = useState<FileRow[]>([])
  const [branches, setBranches] = useState<BranchOption[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [toast, setToast]       = useState('')

  // ── 목록 검색·필터·페이지 ──
  const [keyword, setKeyword]           = useState('')
  const [fCategory, setFCategory]       = useState<Category | 'all'>('all')
  const [fYear, setFYear]               = useState<number | 'all'>('all')
  const [fMonth, setFMonth]             = useState<number | 'all'>('all')
  // '__ALL__'은 '필터 안 함'을 뜻하는 센티널. scope='all'(전체 원 배포)과
  // 값이 겹치면 안 되므로 별도 문자열을 쓴다.
  const [fScope, setFScope]             = useState<Scope | '__ALL__'>('__ALL__')
  const [page, setPage]                 = useState(1)


  const load = useCallback(async () => {
    const supabase = createClient()
    const [fileRes, branchRes] = await Promise.all([
      supabase
        .from('file_archive')
        .select('id, category, title, file_url, year, month, scope, scope_diet_type, scope_branch_id, created_at')
        .order('year',  { ascending: false })
        .order('month', { ascending: false })
        .order('created_at', { ascending: false }),
      supabase
        .from('branch_profiles')
        .select('id, branch_full_name, sort_order')
        .order('sort_order', { ascending: true }),
    ])

    if (fileRes.data) setRows(fileRes.data as FileRow[])
    if (branchRes.data) {
      setBranches(
        (branchRes.data as { id: string; branch_full_name: string | null }[])
          .map(b => ({ id: b.id, name: b.branch_full_name || '(이름 없음)' })),
      )
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // /erp/files/new에서 업로드 성공 후 ?uploaded=1로 돌아온 경우 알림.
  // useSearchParams는 App Router에서 Suspense 경계를 요구해 빌드가 까다로우므로
  // 마운트 시 한 번만 location을 직접 읽고, 주소창의 쿼리는 지운다.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    if (params.get('uploaded') === '1') {
      setToast('업로드되었습니다.')
      setTimeout(() => setToast(''), 2500)
      window.history.replaceState({}, '', '/erp/files')
    }
  }, [])

  async function handleDelete(row: FileRow) {
    if (!confirm(`'${row.title}' 파일을 삭제할까요?\n고객사 화면에서도 즉시 사라집니다.`)) return
    const supabase = createClient()
    const { error: delErr } = await supabase.from('file_archive').delete().eq('id', row.id)
    if (delErr) { setError(delErr.message); return }
    setToast('삭제되었습니다.')
    setTimeout(() => setToast(''), 2500)
    await load()
  }

  const branchNameById = useMemo(() => {
    const map: Record<string, string> = {}
    branches.forEach(b => { map[b.id] = b.name })
    return map
  }, [branches])

  function scopeText(row: FileRow): string {
    if (row.scope === 'all') return '전체 원'
    if (row.scope === 'group') {
      return row.scope_diet_type === 'consignment' ? '위탁 소속' : 'CK 소속'
    }
    return branchNameById[row.scope_branch_id ?? ''] || '특정 원'
  }

  // ── 검색·필터 ────────────────────────────────────────────────
  /** 필터 드롭다운에 쓸 연도 목록(자료가 있는 연도만) */
  const availableYears = useMemo(() => {
    const set = new Set<number>(rows.map(r => r.year))
    return Array.from(set).sort((a, b) => b - a)
  }, [rows])

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    return rows.filter(r =>
      (kw === '' || r.title.toLowerCase().includes(kw))
      && (fCategory === 'all' || r.category === fCategory)
      && (fYear === 'all'     || r.year === fYear)
      && (fMonth === 'all'    || r.month === fMonth)
      && (fScope === '__ALL__' || r.scope === fScope)
    )
  }, [rows, keyword, fCategory, fYear, fMonth, fScope])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageItems = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page],
  )

  // 필터가 바뀌면 1페이지로. 페이지 범위도 보정
  useEffect(() => { setPage(1) }, [keyword, fCategory, fYear, fMonth, fScope])
  useEffect(() => { if (page > totalPages) setPage(totalPages) }, [page, totalPages])

  /** 페이지 번호 목록. 10페이지 넘으면 현재 위치 주변만 + 생략(…) 표시
   *  (inquiries/history의 pageRange와 동일 로직 — UI 일관성) */
  function pageRange(): number[] {
    if (totalPages <= 10) return Array.from({ length: totalPages }, (_, i) => i + 1)
    const delta = 2
    const start = Math.max(2, page - delta)
    const end   = Math.min(totalPages - 1, page + delta)
    const range: number[] = [1]
    if (start > 2) range.push(-1)
    for (let i = start; i <= end; i++) range.push(i)
    if (end < totalPages - 1) range.push(-1)
    range.push(totalPages)
    return range
  }

  const hasActiveFilter = keyword.trim() !== ''
    || fCategory !== 'all' || fYear !== 'all' || fMonth !== 'all' || fScope !== '__ALL__'

  function resetFilters() {
    setKeyword('')
    setFCategory('all')
    setFYear('all')
    setFMonth('all')
    setFScope('__ALL__')
  }

  return (
    <main className="min-h-screen bg-[#F6FAF6] px-4 sm:px-6 py-6 sm:py-8">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">파일보관함</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            고객사 포털 파일보관함에 노출될 파일을 관리합니다 (식단표는 식단 자동화에서 처리)
          </p>
        </div>
        <Link
          href="/erp/files/new"
          className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors whitespace-nowrap flex-shrink-0"
        >
          <Plus size={15} />
          새 파일 올리기
        </Link>
      </div>

      {toast && (
        <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-lg px-4 py-3">
          {toast}
        </div>
      )}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {/* 검색·필터 */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-3 space-y-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            placeholder="파일명으로 검색"
            className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          {hasActiveFilter && (
            <button
              type="button"
              onClick={resetFilters}
              className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-500 hover:bg-slate-50 whitespace-nowrap"
            >
              초기화
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <select
            value={fCategory}
            onChange={e => setFCategory(e.target.value as Category | 'all')}
            className="px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">전체 종류</option>
            {(Object.keys(CATEGORY_LABELS) as Category[]).map(c => (
              <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
            ))}
          </select>

          <select
            value={fYear}
            onChange={e => setFYear(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            className="px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">전체 연도</option>
            {availableYears.map(y => <option key={y} value={y}>{y}년</option>)}
          </select>

          <select
            value={fMonth}
            onChange={e => setFMonth(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            className="px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">전체 월</option>
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
              <option key={m} value={m}>{m}월</option>
            ))}
          </select>

          <select
            value={fScope}
            onChange={e => setFScope(e.target.value as Scope | '__ALL__')}
            className="px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="__ALL__">전체 배포대상</option>
            <option value="all">전체 원</option>
            <option value="group">소속별</option>
            <option value="branch">특정 원</option>
          </select>
        </div>

        {!loading && (
          <p className="text-xs text-slate-400">
            전체 {rows.length}건
            {hasActiveFilter && <> 중 <b className="text-slate-600">{filtered.length}건</b> 표시</>}
          </p>
        )}
      </div>

      {/* 목록 */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="px-5 py-10 text-center text-sm text-slate-400">불러오는 중…</div>
        ) : rows.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-slate-400">등록된 파일이 없습니다.</div>
        ) : filtered.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-slate-400">
            조건에 맞는 파일이 없습니다.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">종류</th>
                  <th className="text-left px-4 py-3 font-medium">파일명</th>
                  <th className="text-left px-4 py-3 font-medium whitespace-nowrap">자료 연·월</th>
                  <th className="text-left px-4 py-3 font-medium whitespace-nowrap">배포 대상</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {pageItems.map(row => (
                  <tr key={row.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                      {CATEGORY_LABELS[row.category]}
                    </td>
                    <td className="px-4 py-3">
                      <a
                        href={row.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-emerald-700 hover:underline font-medium"
                      >
                        {row.title}
                      </a>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-500">
                      {row.year}년 {row.month}월
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-full">
                        {scopeText(row)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleDelete(row)}
                        className="text-xs text-red-600 hover:text-red-700 hover:underline"
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 페이지네이션 */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-center gap-1 px-4 py-3 border-t border-slate-100">
            <button
              type="button"
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
                  type="button"
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
              type="button"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent text-sm"
            >
              ›
            </button>
          </div>
        )}
      </div>
    </main>
  )
}
