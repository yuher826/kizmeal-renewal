'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'

// ── 타입 ──────────────────────────────────────────────────────────
type MemoHistory = {
  status:         string
  memo?:          string
  memo_category?: string
  at:             string
  by:             string
}

type ReviewItem = {
  id:               string
  branch_id:        string | null
  branch_name:      string
  pptx_url:         string | null
  jpg_url:          string | null
  review_status:    'pending' | 'approved' | 'correction_requested'
  memo:             string | null
  memo_category:    string | null
  correction_count: number
  memo_history:     MemoHistory[]
  reviewed_by:      string | null
  reviewed_at:      string | null
  reviewed_by_name: string | null
  approved_by:      string | null
  approved_at:      string | null
  approved_by_name: string | null
}

type Stats = {
  total:                number
  pending:              number
  approved:             number
  correction_requested: number
  final_approved:       number
}

type MenuRow = {
  id:     string
  status: string
  year:   number
  month:  number
}

type CurrentAdmin = {
  id:   string
  name: string
  role: string
}

// ── 상수 ──────────────────────────────────────────────────────────
const MEMO_TEMPLATES = ['메뉴명 오류', '날짜 오류', '특이사항 미반영', '파일형식 오류']

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  draft:            { label: '작성 중',     color: '#9E9E9E', bg: '#F5F5F5' },
  generating:       { label: '생성 중',     color: '#1565C0', bg: '#E3F2FD' },
  generated:        { label: '생성완료',    color: '#00838F', bg: '#E0F7FA' },
  review_requested: { label: '검토 요청됨', color: '#E65100', bg: '#FFF3E0' },
  approved:         { label: '승인 완료',   color: '#2E7D32', bg: '#E8F5E9' },
  deployed:         { label: '배포 완료',   color: '#2D6A4F', bg: '#F6FAF6' },
  error:            { label: '오류',        color: '#C62828', bg: '#FFEBEE' },
}

// ── 유틸 ──────────────────────────────────────────────────────────
function formatKST(iso: string) {
  try {
    return new Date(iso).toLocaleString('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    })
  } catch { return iso }
}

function getMonthOptions() {
  const options: { year: number; month: number; label: string }[] = []
  const d = new Date()
  for (let i = 0; i < 6; i++) {
    options.push({
      year:  d.getFullYear(),
      month: d.getMonth() + 1,
      label: `${d.getFullYear()}년 ${d.getMonth() + 1}월`,
    })
    d.setMonth(d.getMonth() - 1)
  }
  return options
}

// ── 내부 컴포넌트 ─────────────────────────────────────────────────
function DietReviewPageInner() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const now          = new Date()

  const [year,  setYear]  = useState(() => Number(searchParams.get('year'))  || now.getFullYear())
  const [month, setMonth] = useState(() => Number(searchParams.get('month')) || now.getMonth() + 1)

  const [menuRow,      setMenuRow]      = useState<MenuRow | null>(null)
  const [reviewItems,  setReviewItems]  = useState<ReviewItem[]>([])
  const [stats,        setStats]        = useState<Stats>({ total: 0, pending: 0, approved: 0, correction_requested: 0, final_approved: 0 })
  const [currentAdmin, setCurrentAdmin] = useState<CurrentAdmin | null>(null)

  const [selectedIds,     setSelectedIds]     = useState<Set<string>>(new Set())
  const [activeInlineId,  setActiveInlineId]  = useState<string | null>(null)
  const [inlineMemo,      setInlineMemo]      = useState('')
  const [inlineCategory,  setInlineCategory]  = useState('')
  const [expandedHistory, setExpandedHistory] = useState<Set<string>>(new Set())
  const [previewItem,     setPreviewItem]     = useState<ReviewItem | null>(null)

  const [loading,    setLoading]    = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [deploying,  setDeploying]  = useState(false)
  const [notifying,  setNotifying]  = useState(false)
  const [toast,      setToast]      = useState<string | null>(null)

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 4000)
  }, [])

  // ── 데이터 로드 ─────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch(`/api/diet-review?year=${year}&month=${month}`)
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 403) { router.push('/board/admin'); return }
        showToast(`오류: ${data.error}`)
        return
      }
      setMenuRow(data.menuRow)
      setReviewItems(data.items ?? [])
      setStats(data.stats ?? { total: 0, pending: 0, approved: 0, correction_requested: 0, final_approved: 0 })
      setCurrentAdmin(data.currentAdmin)
      setSelectedIds(new Set())
    } finally {
      setLoading(false)
    }
  }, [year, month, router, showToast])

  useEffect(() => { fetchData() }, [fetchData])

  // ESC 키로 모달 닫기
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setPreviewItem(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // ── 로컬 상태 업데이트 ──────────────────────────────────────────
  function applyItemUpdate(updated: ReviewItem, prevItems: ReviewItem[]) {
    const next = prevItems.map(it => it.id === updated.id ? updated : it)
    setReviewItems(next)
    setStats({
      total:                next.length,
      pending:              next.filter(i => i.review_status === 'pending').length,
      approved:             next.filter(i => i.review_status === 'approved' && !i.approved_by).length,
      correction_requested: next.filter(i => i.review_status === 'correction_requested').length,
      final_approved:       next.filter(i => i.review_status === 'approved' && !!i.approved_by).length,
    })
    return next
  }

  // ── 단건 API 호출 ───────────────────────────────────────────────
  async function postReview(payload: {
    item_id:        string
    review_status:  'approved' | 'correction_requested'
    memo?:          string
    memo_category?: string
  }): Promise<ReviewItem | null> {
    const res  = await fetch('/api/diet-review', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body:   JSON.stringify(payload),
    })
    const data = await res.json()
    if (!res.ok) { showToast(`오류: ${data.error}`); return null }
    return data.item as ReviewItem
  }

  // ── 단건 승인 ───────────────────────────────────────────────────
  async function handleApproveOne(itemId: string) {
    setSubmitting(true)
    const updated = await postReview({ item_id: itemId, review_status: 'approved' })
    if (updated) applyItemUpdate(updated, reviewItems)
    setSubmitting(false)
  }

  // ── 인라인 수정요청 저장 ────────────────────────────────────────
  async function handleSaveInline(itemId: string) {
    setSubmitting(true)
    const updated = await postReview({
      item_id: itemId, review_status: 'correction_requested',
      memo: inlineMemo || undefined, memo_category: inlineCategory || undefined,
    })
    if (updated) {
      applyItemUpdate(updated, reviewItems)
      setActiveInlineId(null); setInlineMemo(''); setInlineCategory('')
    }
    setSubmitting(false)
  }

  // ── 일괄 승인 ───────────────────────────────────────────────────
  async function handleBatchApprove() {
    const isDir = currentAdmin?.role === 'director'
    const eligible = reviewItems.filter(it =>
      selectedIds.has(it.id) &&
      (isDir
        ? it.review_status === 'approved' && !it.approved_by
        : ['pending', 'correction_requested'].includes(it.review_status))
    )
    if (!eligible.length) { showToast('선택 가능한 항목이 없습니다.'); return }
    setSubmitting(true)
    let current = [...reviewItems]
    for (const item of eligible) {
      const updated = await postReview({ item_id: item.id, review_status: 'approved' })
      if (updated) current = applyItemUpdate(updated, current)
    }
    setSelectedIds(new Set())
    setSubmitting(false)
    showToast(`${eligible.length}개 항목 ${isDir ? '최종승인' : '승인'} 완료`)
    if (isDir && menuRow) {
      await fetch('/api/diet-review/notify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'final_approved', year, month, weekly_menu_id: menuRow.id }),
      })
    }
  }

  // ── 일괄 수정요청 ───────────────────────────────────────────────
  async function handleBatchCorrection() {
    const eligible = reviewItems.filter(it =>
      selectedIds.has(it.id) && ['pending', 'correction_requested'].includes(it.review_status)
    )
    if (!eligible.length) { showToast('선택 가능한 항목이 없습니다.'); return }
    setSubmitting(true)
    let current = [...reviewItems]
    for (const item of eligible) {
      const updated = await postReview({ item_id: item.id, review_status: 'correction_requested' })
      if (updated) current = applyItemUpdate(updated, current)
    }
    setSelectedIds(new Set()); setSubmitting(false)
    showToast(`${eligible.length}개 항목 수정요청 완료`)
  }

  // ── 이사님께 검토완료 보고 ──────────────────────────────────────
  async function handleNotifyDirector() {
    if (!menuRow) return
    setNotifying(true)
    const res = await fetch('/api/diet-review/notify', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'review_complete', year, month, weekly_menu_id: menuRow.id }),
    })
    setNotifying(false)
    showToast(res.ok ? '이사님께 알림을 보냈습니다.' : '알림 전송 오류')
  }

  // ── 최종승인 원 부분 배포 ───────────────────────────────────────
  async function handlePartialDeploy() {
    const finalItems = reviewItems.filter(it => it.review_status === 'approved' && !!it.approved_by && it.branch_id)
    if (!finalItems.length) { showToast('최종승인된 항목이 없습니다.'); return }
    const branchIds = finalItems.map(it => it.branch_id).filter(Boolean) as string[]
    const pending   = stats.pending + stats.correction_requested
    if (!confirm(
      `최종승인된 ${finalItems.length}개원에 이메일을 배포합니다.\n` +
      (pending > 0 ? `미승인 ${pending}개원은 이번 배포에서 제외됩니다.\n` : '') +
      '계속하시겠습니까?'
    )) return
    setDeploying(true)
    try {
      const res  = await fetch('/api/pptx/deploy', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year, month, branch_ids: branchIds }),
      })
      const data = await res.json()
      if (!res.ok) showToast(`배포 오류: ${data.error}`)
      else {
        showToast(`배포 완료! ${data.sent}개원 발송${data.failed > 0 ? ` (실패 ${data.failed})` : ''}`)
        await fetchData()
      }
    } catch (err) { showToast(`배포 오류: ${err}`) }
    finally { setDeploying(false) }
  }

  // ── 체크박스 ────────────────────────────────────────────────────
  function isSelectable(item: ReviewItem) {
    if (!currentAdmin) return false
    if (currentAdmin.role === 'director') return item.review_status === 'approved' && !item.approved_by
    return ['pending', 'correction_requested'].includes(item.review_status)
  }

  function getEligibleIds() {
    return reviewItems.filter(isSelectable).map(it => it.id)
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => { const n = new Set(prev); if (n.has(id)) { n.delete(id) } else { n.add(id) } ; return n })
  }

  function toggleSelectAll() {
    const eligible = getEligibleIds()
    const allSel   = eligible.every(id => selectedIds.has(id))
    setSelectedIds(allSel ? new Set() : new Set(eligible))
  }

  // ── 상태 뱃지 ───────────────────────────────────────────────────
  function ReviewStatusBadge({ item }: { item: ReviewItem }) {
    if (item.review_status === 'pending') {
      return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-500">미검토</span>
    }
    if (item.review_status === 'correction_requested') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700">
          수정요청
          {item.correction_count > 0 && (
            <span className="w-4 h-4 bg-red-500 text-white rounded-full text-[9px] flex items-center justify-center leading-none">
              {item.correction_count}
            </span>
          )}
        </span>
      )
    }
    if (item.approved_by) {
      return (
        <div className="flex flex-col gap-0.5">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-[#1B4332] text-white">✅ 최종승인</span>
          {item.approved_at && <span className="text-[10px] text-gray-400 pl-1">{formatKST(item.approved_at)}</span>}
        </div>
      )
    }
    return (
      <div className="flex flex-col gap-0.5">
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">승인</span>
        {item.reviewed_at && <span className="text-[10px] text-gray-400 pl-1">{formatKST(item.reviewed_at)}</span>}
      </div>
    )
  }

  // ── 액션 셀 ─────────────────────────────────────────────────────
  function ActionCell({ item }: { item: ReviewItem }) {
    if (!currentAdmin) return null
    const isManager = ['super_admin', 'manager'].includes(currentAdmin.role)
    const isDir     = currentAdmin.role === 'director'

    if (isManager) {
      const canAct      = ['pending', 'correction_requested'].includes(item.review_status)
      const canRecheck  = item.review_status === 'approved' && item.correction_count > 0 && !item.approved_by
      return (
        <div className="flex flex-col gap-1.5">
          {canAct && (
            <div className="flex gap-1.5 flex-wrap">
              <button type="button" onClick={() => handleApproveOne(item.id)} disabled={submitting}
                className="px-3 py-1.5 rounded-lg bg-[#2E7D32] text-white text-xs font-semibold hover:bg-[#1B5E20] disabled:opacity-40 transition-colors">
                ✅ 승인
              </button>
              <button type="button"
                onClick={() => { setActiveInlineId(item.id); setInlineMemo(''); setInlineCategory('') }}
                className="px-3 py-1.5 rounded-lg bg-red-50 text-red-700 text-xs font-semibold hover:bg-red-100 transition-colors">
                ✏️ 수정요청
              </button>
            </div>
          )}
          {canRecheck && (
            <button type="button" onClick={() => handleApproveOne(item.id)} disabled={submitting}
              className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-xs font-semibold hover:bg-blue-100 disabled:opacity-40 transition-colors">
              ↩️ 수정확인
            </button>
          )}
        </div>
      )
    }

    if (isDir && item.review_status === 'approved' && item.reviewed_by && !item.approved_by) {
      return (
        <button type="button" onClick={() => handleApproveOne(item.id)} disabled={submitting}
          className="px-3 py-1.5 rounded-lg bg-[#1B4332] text-white text-xs font-semibold hover:bg-[#0d2b1f] disabled:opacity-40 transition-colors">
          ✅ 최종승인
        </button>
      )
    }
    return null
  }

  // ── 파일 셀 ─────────────────────────────────────────────────────
  function FileCell({ item }: { item: ReviewItem }) {
    const isManager = ['super_admin', 'manager'].includes(currentAdmin?.role ?? '')
    if (!item.pptx_url && !item.jpg_url) {
      return (
        <div className="flex items-center justify-center gap-2">
          <span className="px-2 py-1 bg-red-100 text-red-600 text-xs font-bold rounded-lg">생성실패</span>
          {isManager && (
            <button type="button" onClick={() => router.push('/board/admin/diet-automation')}
              className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-lg hover:bg-gray-200 transition-colors">
              🔄 재생성
            </button>
          )}
        </div>
      )
    }
    return (
      <div className="flex items-center justify-center gap-1.5">
        {item.jpg_url && (
          <button type="button" onClick={() => setPreviewItem(item)}
            className="px-2.5 py-1.5 rounded-lg bg-amber-50 text-amber-700 text-xs font-bold hover:bg-amber-100 transition-colors">
            👁️ 미리보기
          </button>
        )}
        {item.pptx_url && (
          <a href={item.pptx_url} target="_blank" rel="noopener noreferrer"
            className="px-2.5 py-1.5 rounded-lg bg-[#E3F2FD] text-[#1565C0] text-xs font-bold hover:bg-[#BBDEFB] transition-colors">
            PPTX
          </a>
        )}
      </div>
    )
  }

  // ── 파생 값 ─────────────────────────────────────────────────────
  const total        = stats.total
  const reviewed     = stats.approved + stats.final_approved
  const approvedPct  = total > 0 ? (stats.approved      / total) * 100 : 0
  const finalPct     = total > 0 ? (stats.final_approved / total) * 100 : 0
  const isManager    = ['super_admin', 'manager'].includes(currentAdmin?.role ?? '')
  const isDirector   = currentAdmin?.role === 'director'
  const isDeployed   = menuRow?.status === 'deployed'
  const eligibleIds  = getEligibleIds()
  const allSelected  = eligibleIds.length > 0 && eligibleIds.every(id => selectedIds.has(id))
  const someSelected = selectedIds.size > 0
  const menuMeta     = STATUS_META[menuRow?.status ?? ''] ?? { label: menuRow?.status ?? '-', color: '#9E9E9E', bg: '#F5F5F5' }
  const monthOptions = getMonthOptions()

  if (loading) {
    return (
      <main className="min-h-screen bg-[#F6FAF6] flex items-center justify-center">
        <p className="text-gray-400 text-sm animate-pulse">로딩 중...</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#F6FAF6] pb-32">

      {/* ── 헤더 ──────────────────────────────────────────────────── */}
      <div className="px-4 sm:px-6 pt-6 pb-2">
        <Link href="/board/admin/diet-automation" className="text-gray-400 hover:text-gray-600 text-sm inline-block mb-3">
          ← 식단표 자동화
        </Link>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-2xl">👀</span>
          <h1 className="text-xl sm:text-2xl font-bold text-[#1C2B1E]">{year}년 {month}월 식단표 검토</h1>
          {menuRow && (
            <span className="inline-block px-3 py-1 rounded-full text-xs font-bold"
              style={{ color: menuMeta.color, background: menuMeta.bg }}>
              {menuMeta.label}
            </span>
          )}
        </div>
      </div>

      <div className="px-4 sm:px-6 py-4 space-y-4">

        {/* ── 월 선택 ───────────────────────────────────────────────── */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500 font-medium flex-shrink-0">월 선택</span>
          <select
            value={`${year}-${month}`}
            onChange={e => {
              const [y, m] = e.target.value.split('-').map(Number)
              setYear(y); setMonth(m); setSelectedIds(new Set()); setActiveInlineId(null)
            }}
            className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:border-[#2D6A4F]"
          >
            {monthOptions.map(opt => (
              <option key={`${opt.year}-${opt.month}`} value={`${opt.year}-${opt.month}`}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* ── 진행률 바 ─────────────────────────────────────────────── */}
        {total > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-[#1C2B1E]">검토 진행률</span>
              <span className="text-sm font-bold text-[#2D6A4F]">{reviewed}/{total}</span>
            </div>
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden flex mb-3">
              <div className="bg-[#52B788] transition-all duration-500" style={{ width: `${approvedPct}%` }} />
              <div className="bg-[#2D6A4F] transition-all duration-500"  style={{ width: `${finalPct}%` }} />
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-gray-200 inline-block" />미검토 {stats.pending}개</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#52B788] inline-block" />승인 {stats.approved}개</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#2D6A4F] inline-block" />최종승인 {stats.final_approved}개</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block" />수정요청 {stats.correction_requested}개</span>
            </div>
          </div>
        )}

        {/* ── 상단 액션 버튼 ─────────────────────────────────────────── */}
        {(isManager || isDirector) && total > 0 && (
          <div className="flex flex-wrap gap-2 items-center">
            {isManager && (
              <>
                <button type="button" onClick={handleBatchApprove} disabled={submitting || !someSelected}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#2E7D32] text-white text-sm font-semibold hover:bg-[#1B5E20] disabled:opacity-40 transition-colors">
                  ☑️ 선택항목 승인
                </button>
                <button type="button" onClick={handleBatchCorrection} disabled={submitting || !someSelected}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-50 text-red-700 text-sm font-semibold hover:bg-red-100 disabled:opacity-40 transition-colors border border-red-200">
                  ✏️ 선택항목 수정요청
                </button>
                <button type="button" onClick={handleNotifyDirector}
                  disabled={notifying || stats.pending > 0}
                  title={stats.pending > 0 ? `미검토 ${stats.pending}개 남음` : undefined}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1565C0] text-white text-sm font-semibold hover:bg-[#0D47A1] disabled:opacity-40 transition-colors">
                  {notifying ? '⏳ 전송 중...' : '📋 이사님께 검토완료 보고'}
                </button>
              </>
            )}
            {isDirector && (
              <button type="button" onClick={handleBatchApprove} disabled={submitting || !someSelected}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1B4332] text-white text-sm font-semibold hover:bg-[#0d2b1f] disabled:opacity-40 transition-colors">
                ☑️ 선택항목 최종승인
              </button>
            )}
          </div>
        )}

        {/* ── 데이터 없음 ───────────────────────────────────────────── */}
        {!menuRow && (
          <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
            <p className="text-gray-400 text-sm">{year}년 {month}월 식단 데이터가 없습니다.</p>
            <Link href="/board/admin/diet-automation/upload" className="mt-4 inline-block text-[#2D6A4F] text-sm underline">
              엑셀 업로드하기
            </Link>
          </div>
        )}

        {/* ── 데스크탑 테이블 ───────────────────────────────────────── */}
        {reviewItems.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden hidden sm:block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100 text-xs">
                    <th className="px-3 py-3 w-10">
                      <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} className="rounded" />
                    </th>
                    <th className="text-center px-3 py-3 font-semibold text-gray-500 w-8">#</th>
                    <th className="text-left   px-3 py-3 font-semibold text-gray-500">원명</th>
                    <th className="text-center px-3 py-3 font-semibold text-gray-500">파일확인</th>
                    <th className="text-center px-3 py-3 font-semibold text-gray-500">검토상태</th>
                    <th className="text-center px-3 py-3 font-semibold text-gray-500">수정이력</th>
                    <th className="text-center px-3 py-3 font-semibold text-gray-500">액션</th>
                  </tr>
                </thead>
                <tbody>
                  {reviewItems.map((item, idx) => {
                    const isDeployedRow = isDeployed
                    return (
                      <>
                        <tr key={item.id}
                          className={`border-b border-gray-50 transition-colors hover:bg-green-50/30 ${idx % 2 === 1 ? 'bg-gray-50/50' : 'bg-white'} ${isDeployedRow ? 'opacity-60' : ''}`}>
                          <td className="px-3 py-3 text-center">
                            <input type="checkbox"
                              checked={selectedIds.has(item.id)}
                              onChange={() => toggleSelect(item.id)}
                              disabled={!isSelectable(item)}
                              className="rounded disabled:opacity-30" />
                          </td>
                          <td className="text-center px-3 py-3 text-gray-400 text-xs">{idx + 1}</td>
                          <td className="px-3 py-3 font-medium text-[#1C2B1E]">
                            {item.branch_name}
                            {isDeployedRow && <span className="ml-2 text-xs text-[#2D6A4F] font-normal">배포완료</span>}
                          </td>
                          <td className="text-center px-3 py-3"><FileCell item={item} /></td>
                          <td className="text-center px-3 py-3"><ReviewStatusBadge item={item} /></td>
                          <td className="text-center px-3 py-3">
                            {item.correction_count === 0 ? (
                              <span className="text-gray-400 text-xs">-</span>
                            ) : (
                              <button type="button"
                                onClick={() => setExpandedHistory(prev => {
                                  const n = new Set(prev); if (n.has(item.id)) { n.delete(item.id) } else { n.add(item.id) }; return n
                                })}
                                className="text-red-600 text-xs font-medium hover:underline">
                                수정 {item.correction_count}회 {expandedHistory.has(item.id) ? '▲' : '▼'}
                              </button>
                            )}
                          </td>
                          <td className="text-center px-3 py-3"><ActionCell item={item} /></td>
                        </tr>
                        {/* 인라인 메모 입력 */}
                        {activeInlineId === item.id && (
                          <tr key={`${item.id}-inline`}>
                            <td colSpan={7} className="px-4 pb-3 bg-red-50/50">
                              <div className="rounded-xl border border-red-200 bg-white p-3 space-y-2">
                                <p className="text-xs font-semibold text-red-700">수정 요청 내용</p>
                                <div className="flex flex-wrap gap-1.5">
                                  {MEMO_TEMPLATES.map(tpl => (
                                    <button key={tpl} type="button" onClick={() => setInlineCategory(tpl)}
                                      className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                                        inlineCategory === tpl
                                          ? 'bg-red-600 text-white border-red-600'
                                          : 'bg-white text-gray-600 border-gray-200 hover:border-red-300'
                                      }`}>
                                      {tpl}
                                    </button>
                                  ))}
                                </div>
                                <textarea value={inlineMemo} onChange={e => setInlineMemo(e.target.value)}
                                  placeholder="직접 입력..." rows={2}
                                  className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-red-400" />
                                <div className="flex gap-2">
                                  <button type="button" onClick={() => handleSaveInline(item.id)} disabled={submitting}
                                    className="px-4 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 disabled:opacity-40 transition-colors">
                                    저장
                                  </button>
                                  <button type="button"
                                    onClick={() => { setActiveInlineId(null); setInlineMemo(''); setInlineCategory('') }}
                                    className="px-4 py-1.5 rounded-lg bg-gray-100 text-gray-600 text-xs font-semibold hover:bg-gray-200 transition-colors">
                                    취소
                                  </button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                        {/* 수정이력 아코디언 */}
                        {expandedHistory.has(item.id) && (
                          <tr key={`${item.id}-history`}>
                            <td colSpan={7} className="px-4 pb-3 bg-gray-50/60">
                              <div className="space-y-1.5 pt-1">
                                {(item.memo_history ?? []).map((h, hidx) => (
                                  <div key={hidx} className="flex flex-wrap gap-2 items-start text-xs text-gray-600">
                                    <span className="text-gray-400 flex-shrink-0">{formatKST(h.at)}</span>
                                    <span className="text-gray-400">·</span>
                                    <span className="font-medium">{h.by}</span>
                                    <span className="text-gray-400">·</span>
                                    <span className={
                                      h.status === 'correction_requested' ? 'text-red-600 font-semibold' :
                                      h.status === 'final_approved'        ? 'text-[#2D6A4F] font-semibold' :
                                      'text-green-700 font-semibold'
                                    }>
                                      {h.status === 'correction_requested' ? '수정요청' :
                                       h.status === 'final_approved' ? '최종승인' : '승인'}
                                    </span>
                                    {h.memo_category && <span className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded">{h.memo_category}</span>}
                                    {h.memo && <span className="text-gray-500">{h.memo}</span>}
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── 모바일 카드 ───────────────────────────────────────────── */}
        {reviewItems.length > 0 && (
          <div className="sm:hidden space-y-3">
            {reviewItems.map((item, idx) => (
              <div key={item.id} className="bg-white rounded-2xl border border-gray-100 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleSelect(item.id)}
                    disabled={!isSelectable(item)} className="rounded disabled:opacity-30 flex-shrink-0" />
                  <span className="text-xs text-gray-400">{idx + 1}</span>
                  <span className="font-bold text-[#1C2B1E] flex-1 min-w-0 truncate">{item.branch_name}</span>
                  <ReviewStatusBadge item={item} />
                </div>
                <div className="flex gap-2 mb-3 flex-wrap">
                  {item.jpg_url && (
                    <button type="button" onClick={() => setPreviewItem(item)}
                      className="px-3 py-1.5 rounded-xl bg-amber-50 text-amber-700 text-xs font-bold">
                      👁️ 미리보기
                    </button>
                  )}
                  {item.pptx_url && (
                    <a href={item.pptx_url} target="_blank" rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-xl bg-[#E3F2FD] text-[#1565C0] text-xs font-bold">
                      PPTX
                    </a>
                  )}
                  {!item.pptx_url && !item.jpg_url && (
                    <span className="px-3 py-1.5 bg-red-100 text-red-600 text-xs font-bold rounded-xl">생성실패</span>
                  )}
                </div>
                <div className="flex gap-2 flex-wrap"><ActionCell item={item} /></div>

                {/* 모바일 인라인 메모 */}
                {activeInlineId === item.id && (
                  <div className="mt-3 rounded-xl border border-red-200 bg-red-50/30 p-3 space-y-2">
                    <p className="text-xs font-semibold text-red-700">수정 요청 내용</p>
                    <div className="flex flex-wrap gap-1.5">
                      {MEMO_TEMPLATES.map(tpl => (
                        <button key={tpl} type="button" onClick={() => setInlineCategory(tpl)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                            inlineCategory === tpl ? 'bg-red-600 text-white border-red-600' : 'bg-white text-gray-600 border-gray-200'
                          }`}>
                          {tpl}
                        </button>
                      ))}
                    </div>
                    <textarea value={inlineMemo} onChange={e => setInlineMemo(e.target.value)}
                      placeholder="직접 입력..." rows={2}
                      className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none" />
                    <div className="flex gap-2">
                      <button type="button" onClick={() => handleSaveInline(item.id)} disabled={submitting}
                        className="px-4 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold disabled:opacity-40">저장</button>
                      <button type="button" onClick={() => { setActiveInlineId(null); setInlineMemo(''); setInlineCategory('') }}
                        className="px-4 py-1.5 rounded-lg bg-gray-100 text-gray-600 text-xs font-semibold">취소</button>
                    </div>
                  </div>
                )}

                {/* 모바일 수정이력 */}
                {item.correction_count > 0 && (
                  <div className="mt-3 border-t border-gray-100 pt-3">
                    <button type="button"
                      onClick={() => setExpandedHistory(prev => {
                        const n = new Set(prev); if (n.has(item.id)) { n.delete(item.id) } else { n.add(item.id) }; return n
                      })}
                      className="text-red-600 text-xs font-medium">
                      수정 {item.correction_count}회 {expandedHistory.has(item.id) ? '▲' : '▼'}
                    </button>
                    {expandedHistory.has(item.id) && (
                      <div className="mt-2 space-y-1.5">
                        {(item.memo_history ?? []).map((h, hidx) => (
                          <div key={hidx} className="text-xs text-gray-600 flex flex-wrap gap-1">
                            <span className="text-gray-400">{formatKST(h.at)}</span>
                            <span className="font-medium">{h.by}</span>
                            {h.memo_category && <span className="bg-red-100 text-red-700 px-1 rounded">{h.memo_category}</span>}
                            {h.memo && <span className="text-gray-500">{h.memo}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── 하단 바 ───────────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 sm:px-6 py-3 z-20">
        {isDeployed ? (
          <div className="flex items-center gap-3 max-w-5xl mx-auto">
            <span className="text-xl">🚀</span>
            <div>
              <p className="text-sm font-bold text-[#2D6A4F]">{year}년 {month}월 배포 완료</p>
              <p className="text-xs text-gray-500">각 원 담당자 이메일로 발송되었습니다.</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3 max-w-5xl mx-auto flex-wrap">
            <p className="text-xs text-gray-500">
              승인 {stats.approved}개 · 최종승인 {stats.final_approved}개 · 미검토 {stats.pending}개 / 전체 {stats.total}개
            </p>
            {isManager && stats.final_approved > 0 && (
              <button type="button" onClick={handlePartialDeploy} disabled={deploying}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1565C0] text-white text-sm font-semibold hover:bg-[#0D47A1] disabled:opacity-40 transition-colors">
                {deploying ? '⏳ 발송 중...' : `📧 최종승인된 ${stats.final_approved}개원 배포하기`}
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── JPG 미리보기 모달 ─────────────────────────────────────── */}
      {previewItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)' }}
          onClick={() => setPreviewItem(null)}>
          <div className="bg-white rounded-2xl p-4 max-w-2xl w-full shadow-2xl"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-[#1C2B1E]">{previewItem.branch_name}</h3>
              <button type="button" onClick={() => setPreviewItem(null)}
                className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                ✕
              </button>
            </div>
            {previewItem.jpg_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewItem.jpg_url} alt={`${previewItem.branch_name} 식단표`}
                className="w-full max-h-[75vh] object-contain rounded-xl" />
            )}
            {previewItem.pptx_url && (
              <div className="mt-3 flex justify-center">
                <a href={previewItem.pptx_url} target="_blank" rel="noopener noreferrer"
                  className="px-5 py-2.5 rounded-xl bg-[#E3F2FD] text-[#1565C0] text-sm font-semibold hover:bg-[#BBDEFB] transition-colors">
                  📊 PPTX 다운로드
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 토스트 ────────────────────────────────────────────────── */}
      {toast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-sm rounded-2xl px-5 py-3 shadow-lg z-50 whitespace-nowrap">
          {toast}
        </div>
      )}
    </main>
  )
}

function LoadingFallback() {
  return (
    <main className="min-h-screen bg-[#F6FAF6] flex items-center justify-center">
      <p className="text-gray-400 text-sm animate-pulse">로딩 중...</p>
    </main>
  )
}

export default function DietReviewPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <DietReviewPageInner />
    </Suspense>
  )
}
