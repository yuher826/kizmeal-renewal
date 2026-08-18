'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { ROUTES } from '@/lib/routes'

/**
 * 파일보관함 (2026-08-18 권팀장 요청 2번)
 *
 * 기존 "식단표" 화면을 확장. 식단표 외에 건강정보지·유인물·식단사진까지
 * 한 곳에서 열람한다. 식대청구서는 KOS에서 전달되므로 제외.
 *
 * ★데이터 소스가 둘이다(A안):
 *   - 식단표      → weekly_menus (자동 생성 파이프라인이 채움. 건드리지 않음)
 *   - 그 외 파일  → file_archive (관리자가 수동 업로드)
 *   두 소스를 화면에서 ArchiveItem 형태로 정규화해 하나의 목록으로 합친다.
 *
 * ★요청 3번(PDF/PPTX/JPG 표기 및 '우리 원 파일형식' 문구 제거)도 여기서
 *   함께 해결됨 — 형식별 버튼 3개 대신 파일명을 눌러 바로 여는 방식으로
 *   바꿨고, 원에 지정된 형식(file_format)에 맞는 파일 하나만 연결한다.
 */

type MenuRow = {
  id: string
  year: number
  month: number
  pptx_url: string | null
  pdf_url: string | null
  jpg_url: string | null
  status: string
  week_num: number | null
}

type ArchiveRow = {
  id: string
  category: 'health_info' | 'handout' | 'photo' | 'etc'
  title: string
  file_url: string
  year: number
  month: number
  created_at: string
}

type FileFormat = 'pdf' | 'jpg' | 'ppt' | 'pdf+jpg'

type CategoryKey = 'diet' | 'health_info' | 'handout' | 'photo' | 'etc'

/** 두 소스를 합치기 위한 공통 형태 */
type ArchiveItem = {
  id: string
  category: CategoryKey
  title: string
  url: string
  year: number
  month: number
  sortAt: string
}

const CATEGORY_TABS: { key: CategoryKey | 'all'; label: string }[] = [
  { key: 'all',         label: '전체' },
  { key: 'diet',        label: '식단표' },
  { key: 'health_info', label: '건강정보지' },
  { key: 'handout',     label: '유인물' },
  { key: 'photo',       label: '식단사진' },
  { key: 'etc',         label: '기타' },
]

/** 한 페이지에 보여줄 개수. ERP 관리자 화면과 동일하게 맞춤 */
const PAGE_SIZE = 20

const CATEGORY_META: Record<CategoryKey, { icon: string; label: string }> = {
  diet:        { icon: '🍱', label: '식단표' },
  health_info: { icon: '💚', label: '건강정보지' },
  handout:     { icon: '📄', label: '유인물' },
  photo:       { icon: '📷', label: '식단사진' },
  etc:         { icon: '📎', label: '기타' },
}

/** 원에 지정된 형식에 맞는 URL 하나를 고른다. 없으면 있는 것으로 폴백 */
function pickMenuUrl(menu: MenuRow, fmt: FileFormat): string | null {
  const byFormat: Record<FileFormat, (string | null)[]> = {
    'pdf':     [menu.pdf_url],
    'jpg':     [menu.jpg_url],
    'ppt':     [menu.pptx_url],
    'pdf+jpg': [menu.pdf_url, menu.jpg_url],
  }
  const preferred = byFormat[fmt]?.find(Boolean)
  if (preferred) return preferred
  // 지정 형식이 아직 생성되지 않았을 수 있으므로 폴백
  return menu.pdf_url || menu.jpg_url || menu.pptx_url || null
}

export default function CustomerFileArchivePage() {
  const router = useRouter()
  const [items, setItems]           = useState<ArchiveItem[]>([])
  const [branchName, setBranchName] = useState<string | null>(null)
  const [loading, setLoading]       = useState(true)

  const [keyword, setKeyword]         = useState('')
  const [tab, setTab]                 = useState<CategoryKey | 'all'>('all')
  const [filterYear, setFilterYear]   = useState<number | 'all'>('all')
  const [filterMonth, setFilterMonth] = useState<number | 'all'>('all')
  const [page, setPage]               = useState(1)

  useEffect(() => {
    const supabase = createClient()

    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace(ROUTES.BOARD_LOGIN); return }

      // branch_id 확인 (master → member 순)
      let branchId: string | null = null
      const { data: branchRow } = await supabase
        .from('branches')
        .select('id, name')
        .eq('auth_id', user.id)
        .maybeSingle()
      if (branchRow) {
        branchId = branchRow.id
        setBranchName(branchRow.name || null)
      } else {
        const { data: memberRow } = await supabase
          .from('branch_members')
          .select('branch_id')
          .eq('auth_id', user.id)
          .maybeSingle()
        if (memberRow) {
          branchId = memberRow.branch_id
          const { data: bData } = await supabase
            .from('branches').select('name').eq('id', branchId).maybeSingle()
          if (bData) setBranchName(bData.name || null)
        }
      }
      if (!branchId) { setLoading(false); return }

      const { data: profileData } = await supabase
        .from('branch_profiles')
        .select('id, file_format')
        .eq('branch_id', branchId)
        .maybeSingle()

      const profileBranchId: string | null = profileData?.id ?? null
      const fileFormat = (profileData?.file_format as FileFormat) ?? 'pdf'

      const merged: ArchiveItem[] = []

      // ── 1) 식단표 (weekly_menus) ──
      if (profileBranchId) {
        const { data: rows } = await supabase
          .from('weekly_menus')
          .select('id, year, month, pptx_url, pdf_url, jpg_url, status, week_num')
          .eq('branch_id', profileBranchId)
          .in('status', ['generation_complete', 'correction_request', 'resubmitted', 'approved', 'deployed'])
          .order('year',  { ascending: false })
          .order('month', { ascending: false })
          .order('week_num', { ascending: true, nullsFirst: true })

        if (rows) {
          // 같은 연·월은 대표 1건만 (week_num IS NULL 우선)
          const seen = new Set<string>()
          for (const r of rows as MenuRow[]) {
            const key = `${r.year}-${r.month}`
            if (seen.has(key)) continue
            const url = pickMenuUrl(r, fileFormat)
            if (!url) continue
            seen.add(key)
            merged.push({
              id: `menu-${r.id}`,
              category: 'diet',
              title: `${r.year}년 ${r.month}월 식단표`,
              url,
              year: r.year,
              month: r.month,
              // 식단표는 생성 시각 대신 자료 연·월(월초)로 정렬
              sortAt: new Date(r.year, r.month - 1, 1).toISOString(),
            })
          }
        }
      }

      // ── 2) 그 외 파일 (file_archive) ──
      //    어떤 파일이 보이는지는 RLS가 판단한다(전체공통/그룹공통/원별).
      const { data: archiveRows } = await supabase
        .from('file_archive')
        .select('id, category, title, file_url, year, month, created_at')
        .order('year',  { ascending: false })
        .order('month', { ascending: false })
        .order('created_at', { ascending: false })

      if (archiveRows) {
        for (const a of archiveRows as ArchiveRow[]) {
          merged.push({
            id: `arch-${a.id}`,
            category: a.category,
            title: a.title,
            url: a.file_url,
            year: a.year,
            month: a.month,
            sortAt: a.created_at,
          })
        }
      }

      // 자료 연·월 기준 최신순
      merged.sort((x, y) => {
        if (y.year !== x.year)   return y.year - x.year
        if (y.month !== x.month) return y.month - x.month
        return y.sortAt.localeCompare(x.sortAt)
      })

      setItems(merged)
      setLoading(false)
    }
    load()
  }, [router])

  /** 필터 드롭다운에 쓸 연도 목록(자료가 있는 연도만) */
  const availableYears = useMemo(() => {
    const set = new Set<number>(items.map(i => i.year))
    return Array.from(set).sort((a, b) => b - a)
  }, [items])

  const visible = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    return items.filter(i =>
      (kw === '' || i.title.toLowerCase().includes(kw))
      && (tab === 'all' || i.category === tab)
      && (filterYear === 'all'  || i.year === filterYear)
      && (filterMonth === 'all' || i.month === filterMonth)
    )
  }, [items, keyword, tab, filterYear, filterMonth])

  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE))
  const pageItems = useMemo(
    () => visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [visible, page],
  )

  // 조건이 바뀌면 1페이지로. 페이지 범위도 보정
  useEffect(() => { setPage(1) }, [keyword, tab, filterYear, filterMonth])
  useEffect(() => { if (page > totalPages) setPage(totalPages) }, [page, totalPages])

  /** 페이지 번호 목록. 10페이지 넘으면 현재 위치 주변만 + 생략(…) 표시
   *  (ERP 화면들과 동일 로직 — 전체 일관성) */
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

  return (
    <div className="min-h-screen bg-[#F6FAF6] font-sans">
      <header className="bg-white border-b border-gray-100 px-4 sm:px-6 h-16 hidden sm:flex items-center sticky top-0 z-10">
        <div>
          <div className="flex items-center gap-1 text-xs text-gray-400 mb-0.5">
            <span>{branchName || '소통채널'}</span>
            <span>›</span>
            <span className="text-[#2D6A4F] font-medium">파일보관함</span>
          </div>
          <h1 className="font-bold text-[#1C2B1E] text-base">파일보관함</h1>
          <p className="text-gray-400 text-xs">식단표·건강정보지 등 전달된 파일을 확인하실 수 있습니다</p>
        </div>
      </header>

      <div className="px-4 sm:px-6 py-6 space-y-4">
        {/* 파일명 검색 */}
        <input
          type="text"
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
          placeholder="파일명으로 검색"
          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F] focus:border-transparent"
        />

        {/* 종류 탭 */}
        <div className="flex gap-2 flex-wrap">
          {CATEGORY_TABS.map(t => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`px-3.5 py-2 rounded-full border text-xs font-medium transition-all ${
                tab === t.key
                  ? 'bg-[#2D6A4F] border-[#2D6A4F] text-white shadow-sm'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-[#52B788] hover:text-[#2D6A4F]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* 연·월 필터 */}
        <div className="flex gap-2">
          <select
            value={filterYear}
            onChange={e => setFilterYear(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]"
          >
            <option value="all">전체 연도</option>
            {availableYears.map(y => <option key={y} value={y}>{y}년</option>)}
          </select>
          <select
            value={filterMonth}
            onChange={e => setFilterMonth(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]"
          >
            <option value="all">전체 월</option>
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
              <option key={m} value={m}>{m}월</option>
            ))}
          </select>
        </div>

        {/* 목록 */}
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl h-16 animate-pulse border border-gray-100" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 px-6 py-16 text-center">
            <p className="text-5xl mb-4">📁</p>
            <p className="text-gray-600 font-medium">
              {items.length === 0 ? '아직 전달된 파일이 없습니다.' : '조건에 맞는 파일이 없습니다.'}
            </p>
            <p className="text-gray-400 text-sm mt-1 leading-relaxed">
              {items.length === 0
                ? '파일이 준비되면 알림을 보내드릴게요 😊'
                : '검색어나 연도·월·종류 조건을 바꿔보세요.'}
            </p>
            {items.length === 0 && (
              <Link
                href="/board/inquiries/new"
                className="inline-flex items-center gap-1.5 mt-5 text-sm text-[#2D6A4F] border border-[#2D6A4F] rounded-xl px-4 py-2 font-medium hover:bg-[#E8F5E9] transition-colors"
              >
                문의하기
              </Link>
            )}
          </div>
        ) : (
          <>
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              {pageItems.map((item, idx) => {
                const meta = CATEGORY_META[item.category]
                return (
                  <a
                    key={item.id}
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex items-center gap-3 px-4 py-3.5 hover:bg-[#F6FAF6] transition-colors ${
                      idx > 0 ? 'border-t border-gray-50' : ''
                    }`}
                  >
                    <span className="text-xl flex-shrink-0">{meta.icon}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[#1C2B1E] truncate">{item.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {meta.label} · {item.year}년 {item.month}월
                      </p>
                    </div>
                    <span className="text-gray-300 flex-shrink-0">›</span>
                  </a>
                )
              })}
            </div>

            {/* 페이지네이션 */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-1 pt-1">
                <button
                  type="button"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-white disabled:opacity-30 disabled:hover:bg-transparent text-sm"
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
                        p === page ? 'bg-[#2D6A4F] text-white' : 'text-gray-500 hover:bg-white'
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
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-white disabled:opacity-30 disabled:hover:bg-transparent text-sm"
                >
                  ›
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <div className="h-14 sm:hidden" />
    </div>
  )
}
