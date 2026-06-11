'use client'

import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'

// ── 타입 ──────────────────────────────────────────────────────────
type HistoryEntry = {
  round?:    number
  by:        string
  role:      string
  action:    string
  memo?:     string
  category?: string
  at:        string
}

type ReviewItem = {
  id:              string
  branch_id:       string | null
  branch_name:     string
  pptx_url:        string | null
  jpg_url:         string | null
  review_status:   'generation_complete' | 'correction_request' | 'resubmitted' | 'approved' | 'deployed'
  memo:            string | null
  memo_category:   string | null
  correction_count: number
  memo_history:    HistoryEntry[]
  reviewed_by:     string | null
  reviewed_at:     string | null
  approved_by:     string | null
  approved_at:     string | null
  deployed_by:     string | null
  deployed_at:     string | null
  resubmitted_at:  string | null
}

type Stats = {
  total:               number
  generation_complete: number
  correction_request:  number
  resubmitted:         number
  approved:            number
  deployed:            number
}

type CurrentAdmin = {
  id:         string
  name:       string
  role:       string
  diet_scope: string | null
}

// ── 상수 ──────────────────────────────────────────────────────────
const CORRECTION_CATEGORIES = ['내용오류', '알레르기오류', '디자인오류', '기타']

const STATUS_META: Record<string, { label: string; badgeCls: string }> = {
  generation_complete: { label: '검토대기',  badgeCls: 'bg-gray-100 text-gray-700' },
  correction_request:  { label: '수정요청',  badgeCls: 'bg-orange-100 text-orange-700' },
  resubmitted:         { label: '재제출됨',  badgeCls: 'bg-blue-100 text-blue-700' },
  approved:            { label: '승인완료',  badgeCls: 'bg-green-100 text-green-700' },
  deployed:            { label: '배포완료',  badgeCls: 'bg-teal-100 text-teal-700' },
}

type ManagerTab = 'all' | 'generation_complete' | 'correction_request' | 'resubmitted' | 'approved' | 'deployed'
type NutritionistTab = 'correction' | 'approved' | 'history'

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
  const opts: { year: number; month: number; label: string }[] = []
  const d = new Date()
  for (let i = 0; i < 6; i++) {
    opts.push({ year: d.getFullYear(), month: d.getMonth() + 1, label: `${d.getFullYear()}년 ${d.getMonth() + 1}월` })
    d.setMonth(d.getMonth() - 1)
  }
  return opts
}

// ── 스켈레톤 ──────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 h-14" />
      ))}
    </div>
  )
}

// ── 상태배지 ──────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? { label: status, badgeCls: 'bg-gray-100 text-gray-600' }
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${meta.badgeCls}`}>
      {meta.label}
    </span>
  )
}

// ── 수정이력 아이콘 ────────────────────────────────────────────────
function historyIcon(action: string) {
  if (action === 'correction_request') return '🔴'
  if (action === 'resubmit')           return '🔵'
  if (action === 'approved')           return '🟢'
  if (action === 'deployed')           return '✅'
  return '⚪'
}

// ── 워크플로우 스텝 ───────────────────────────────────────────────
function WorkflowSteps({
  stats, activeTab, onTabChange,
}: {
  stats:        Stats
  activeTab?:   ManagerTab
  onTabChange?: (tab: ManagerTab) => void
}) {
  // 클릭 가능 모드 (manager/super_admin)
  if (onTabChange) {
    const steps: { label: string; count: number; tab: ManagerTab; activeCls: string; idleCls: string }[] = [
      { label: '검토대기', count: stats.generation_complete,  tab: 'generation_complete', activeCls: 'bg-gray-700 text-white',    idleCls: 'text-gray-600 hover:bg-gray-100' },
      { label: '수정요청', count: stats.correction_request,   tab: 'correction_request',  activeCls: 'bg-orange-500 text-white',  idleCls: 'text-orange-500 hover:bg-orange-50' },
      { label: '재제출됨', count: stats.resubmitted,          tab: 'resubmitted',         activeCls: 'bg-blue-500 text-white',    idleCls: 'text-blue-500 hover:bg-blue-50' },
      { label: '승인완료', count: stats.approved,             tab: 'approved',            activeCls: 'bg-green-600 text-white',   idleCls: 'text-green-600 hover:bg-green-50' },
      { label: '배포완료', count: stats.deployed,             tab: 'deployed',            activeCls: 'bg-teal-600 text-white',    idleCls: 'text-teal-600 hover:bg-teal-50' },
    ]
    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        <button
          type="button"
          onClick={() => onTabChange('all')}
          className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors ${
            !activeTab || activeTab === 'all'
              ? 'bg-[#2D6A4F] text-white'
              : 'text-gray-500 bg-gray-100 hover:bg-gray-200'
          }`}
        >
          전체 {stats.total}
        </button>
        {steps.map(s => (
          <button
            key={s.tab}
            type="button"
            onClick={() => onTabChange(s.tab)}
            className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors ${
              activeTab === s.tab ? s.activeCls : s.idleCls
            }`}
          >
            {s.label} {s.count}
          </button>
        ))}
      </div>
    )
  }

  // 읽기 전용 모드 (director, nutritionist)
  const readSteps = [
    { label: '생성완료', count: stats.generation_complete,                    color: 'text-gray-600' },
    { label: '검토중',   count: stats.correction_request + stats.resubmitted, color: 'text-orange-600' },
    { label: '승인완료', count: stats.approved,                                color: 'text-green-600' },
    { label: '배포완료', count: stats.deployed,                                color: 'text-teal-600' },
  ]
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {readSteps.map((s, i) => (
        <div key={s.label} className="flex items-center gap-1">
          <span className={`text-xs font-semibold ${s.color}`}>
            [{s.label} {s.count}]
          </span>
          {i < readSteps.length - 1 && <span className="text-gray-300 text-xs">→</span>}
        </div>
      ))}
    </div>
  )
}

// ── 공통 상단 섹션 ────────────────────────────────────────────────
function CommonHeader({
  year, month, stats, search,
  onYearMonth, onSearch,
  activeTab, onTabChange,
}: {
  year: number; month: number; stats: Stats; search: string
  onYearMonth:  (y: number, m: number) => void
  onSearch:     (v: string) => void
  activeTab?:   ManagerTab
  onTabChange?: (tab: ManagerTab) => void
}) {
  const monthOptions = getMonthOptions()
  const total     = stats.total
  const deployed  = stats.deployed
  const deployPct = total > 0 ? Math.round((deployed / total) * 100) : 0

  return (
    <div className="space-y-3">
      {/* 월 선택 */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-gray-500 font-medium flex-shrink-0">월 선택</span>
        <select
          value={`${year}-${month}`}
          onChange={e => {
            const [y, m] = e.target.value.split('-').map(Number)
            onYearMonth(y, m)
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

      {/* 워크플로우 스텝 */}
      {total > 0 && <WorkflowSteps stats={stats} activeTab={activeTab} onTabChange={onTabChange} />}

      {/* 진행률 바 */}
      {total > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold text-[#1C2B1E]">배포 진행률</span>
            <span className="text-sm font-bold text-teal-600">{total}개 중 {deployed}개 배포완료 ({deployPct}%)</span>
          </div>
          <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-teal-500 transition-all duration-500" style={{ width: `${deployPct}%` }} />
          </div>
        </div>
      )}

      {/* 검색창 */}
      <input
        type="text"
        value={search}
        onChange={e => onSearch(e.target.value)}
        placeholder="원명 검색..."
        className="w-full sm:w-72 text-sm border border-gray-200 rounded-xl px-4 py-2.5 bg-white focus:outline-none focus:border-[#2D6A4F]"
      />
    </div>
  )
}

// ── Manager/SuperAdmin 화면 ────────────────────────────────────────
function ManagerView({
  items, showToast, onRefresh, tab, onTabChange,
}: {
  items:       ReviewItem[]
  stats:       Stats
  year:        number
  month:       number
  adminId:     string
  adminName:   string
  showToast:   (msg: string, type?: 'success' | 'error') => void
  onRefresh:   () => void
  tab:         ManagerTab
  onTabChange: (t: ManagerTab) => void
}) {
  // 낙관적 업데이트용 로컬 아이템
  const [localItems, setLocalItems] = useState<ReviewItem[]>(items)
  useEffect(() => { setLocalItems(items) }, [items])

  const [search]             = useState('')
  const [selectedIds,    setSelectedIds]    = useState<Set<string>>(new Set())
  useEffect(() => { setSelectedIds(new Set()) }, [tab])
  const [loadingItemIds, setLoadingItemIds] = useState<Set<string>>(new Set())
  const [activeInlineId, setActiveInlineId] = useState<string | null>(null)
  const [inlineMemo,     setInlineMemo]     = useState('')
  const [inlineCategory, setInlineCategory] = useState('')
  const [expandedHistory, setExpandedHistory] = useState<Set<string>>(new Set())
  const [submitting,     setSubmitting]     = useState(false)

  function patchItem(id: string, patch: Partial<ReviewItem>) {
    setLocalItems(prev => prev.map(it => it.id === id ? { ...it, ...patch } : it))
  }

  const localStats: Stats = {
    total:               localItems.length,
    generation_complete: localItems.filter(i => i.review_status === 'generation_complete').length,
    correction_request:  localItems.filter(i => i.review_status === 'correction_request').length,
    resubmitted:         localItems.filter(i => i.review_status === 'resubmitted').length,
    approved:            localItems.filter(i => i.review_status === 'approved').length,
    deployed:            localItems.filter(i => i.review_status === 'deployed').length,
  }

  const TAB_KEYS: { key: ManagerTab; label: string; icon: string }[] = [
    { key: 'all',                 label: '전체',    icon: '📋' },
    { key: 'generation_complete', label: '검토대기', icon: '⏳' },
    { key: 'correction_request',  label: '수정요청', icon: '🔴' },
    { key: 'resubmitted',         label: '재제출됨', icon: '🔵' },
    { key: 'approved',            label: '승인완료', icon: '✅' },
    { key: 'deployed',            label: '배포완료', icon: '📤' },
  ]
  const tabCount: Record<ManagerTab, number> = {
    all: localStats.total, generation_complete: localStats.generation_complete,
    correction_request: localStats.correction_request, resubmitted: localStats.resubmitted,
    approved: localStats.approved, deployed: localStats.deployed,
  }

  const filtered = localItems.filter(it => {
    if (tab !== 'all' && it.review_status !== tab) return false
    if (search && !it.branch_name.includes(search)) return false
    return true
  })

  // generation_complete만 체크 가능
  const selectableIds = filtered.filter(it => it.review_status === 'generation_complete').map(it => it.id)
  const allSelected   = selectableIds.length > 0 && selectableIds.every(id => selectedIds.has(id))
  const someSelected  = selectedIds.size > 0

  function toggleSelect(id: string) {
    setSelectedIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }
  function toggleSelectAll() {
    setSelectedIds(allSelected ? new Set() : new Set(selectableIds))
  }

  // 단건 승인 (낙관적 업데이트)
  async function handleApprove(item: ReviewItem) {
    const prev = item.review_status
    setLoadingItemIds(s => { const n = new Set(s); n.add(item.id); return n })
    patchItem(item.id, { review_status: 'approved' })
    try {
      const res  = await fetch('/api/diet-review', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approved', ids: [item.id] }),
      })
      const data = await res.json()
      if (data.success) {
        fetch('/api/diet-review/notify', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'approved_to_nutritionist', branchName: item.branch_name }),
        }).catch(() => {})
        showToast(`${item.branch_name} 승인 완료 — 영양사에게 알림 전송됨`, 'success')
      } else {
        patchItem(item.id, { review_status: prev }); showToast(`오류: ${data.error}`, 'error')
      }
    } catch {
      patchItem(item.id, { review_status: prev }); showToast('네트워크 오류', 'error')
    } finally {
      setLoadingItemIds(s => { const n = new Set(s); n.delete(item.id); return n })
    }
  }

  // 일괄 승인
  async function handleBatchApprove(ids: string[]) {
    setSubmitting(true)
    const prevMap = new Map(ids.map(id => [id, localItems.find(i => i.id === id)?.review_status]))
    ids.forEach(id => patchItem(id, { review_status: 'approved' }))
    try {
      const res  = await fetch('/api/diet-review', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approved', ids }),
      })
      const data = await res.json()
      if (data.success) {
        showToast(`${data.updated?.length ?? 0}개 승인 완료`, 'success'); setSelectedIds(new Set())
      } else {
        ids.forEach(id => { const p = prevMap.get(id); if (p) patchItem(id, { review_status: p as ReviewItem['review_status'] }) })
        showToast(`오류: ${data.error}`, 'error')
      }
    } catch { onRefresh(); showToast('네트워크 오류', 'error') }
    finally { setSubmitting(false) }
  }

  // 단건 수정요청 (낙관적 업데이트)
  async function handleCorrectionSubmit(item: ReviewItem) {
    if (!inlineMemo.trim())  { showToast('메모를 입력해주세요.', 'error'); return }
    if (!inlineCategory)     { showToast('카테고리를 선택해주세요.', 'error'); return }
    const prev = item.review_status
    const savedMemo = inlineMemo, savedCat = inlineCategory
    setLoadingItemIds(s => { const n = new Set(s); n.add(item.id); return n })
    patchItem(item.id, { review_status: 'correction_request', memo: savedMemo, memo_category: savedCat })
    setActiveInlineId(null); setInlineMemo(''); setInlineCategory('')
    try {
      const res  = await fetch('/api/diet-review', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'correction_request', ids: [item.id], memo: savedMemo, memo_category: savedCat || undefined }),
      })
      const data = await res.json()
      if (data.success) {
        fetch('/api/diet-review/notify', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'correction_to_nutritionist', branchName: item.branch_name, memo: savedMemo, category: savedCat }),
        }).catch(() => {})
        showToast(`${item.branch_name} 수정요청 전송 — 영양사 알림 발송됨`, 'success')
      } else {
        patchItem(item.id, { review_status: prev, memo: null, memo_category: null })
        setActiveInlineId(item.id); setInlineMemo(savedMemo); setInlineCategory(savedCat)
        showToast(`오류: ${data.error}`, 'error')
      }
    } catch {
      patchItem(item.id, { review_status: prev, memo: null, memo_category: null })
      setActiveInlineId(item.id); setInlineMemo(savedMemo); setInlineCategory(savedCat)
      showToast('네트워크 오류', 'error')
    } finally {
      setLoadingItemIds(s => { const n = new Set(s); n.delete(item.id); return n })
    }
  }

  // 일괄 수정요청
  async function handleBatchCorrectionSubmit(ids: string[]) {
    if (!inlineMemo.trim()) { showToast('메모를 입력해주세요.', 'error'); return }
    if (!inlineCategory)    { showToast('카테고리를 선택해주세요.', 'error'); return }
    setSubmitting(true)
    try {
      const res  = await fetch('/api/diet-review', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'correction_request', ids, memo: inlineMemo, memo_category: inlineCategory || undefined }),
      })
      const data = await res.json()
      if (data.success) {
        showToast(`${data.updated?.length ?? 0}개 수정요청 완료`, 'success')
        setActiveInlineId(null); setInlineMemo(''); setInlineCategory(''); setSelectedIds(new Set())
        onRefresh()
      } else { showToast(`오류: ${data.error}`, 'error') }
    } catch { showToast('네트워크 오류', 'error') }
    finally { setSubmitting(false) }
  }

  function rowBg(status: string) {
    if (status === 'correction_request') return 'bg-orange-50'
    if (status === 'resubmitted')        return 'bg-blue-50/30'
    if (status === 'approved')           return 'bg-green-50'
    if (status === 'deployed')           return 'bg-teal-50'
    return ''
  }

  return (
    <div className="space-y-4">
      {/* 탭 */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {TAB_KEYS.map(t => (
          <button key={t.key} type="button" onClick={() => onTabChange(t.key)}
            className={`flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-colors ${
              tab === t.key ? 'bg-[#2D6A4F] text-white shadow-sm' : 'bg-white text-gray-600 border border-gray-200 hover:border-[#2D6A4F] hover:text-[#2D6A4F]'
            }`}>
            <span>{t.icon}</span>
            <span>{t.label}</span>
            <span className={`min-w-[20px] h-5 px-1 rounded-full text-[10px] flex items-center justify-center font-bold ${
              tab === t.key ? 'bg-white/25 text-white' : 'bg-gray-100 text-gray-500'
            }`}>{tabCount[t.key]}</span>
          </button>
        ))}
      </div>

      {/* 일괄 액션 */}
      {someSelected && (
        <div className="flex gap-2 flex-wrap">
          <button type="button" onClick={() => handleBatchApprove(Array.from(selectedIds))} disabled={submitting}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#2E7D32] text-white text-sm font-semibold hover:bg-[#1B5E20] disabled:opacity-40 transition-colors">
            ✅ 선택항목 승인 ({selectedIds.size}개)
          </button>
          <button type="button"
            onClick={() => { setActiveInlineId('__batch__'); setInlineMemo(''); setInlineCategory('') }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orange-50 text-orange-700 text-sm font-semibold hover:bg-orange-100 transition-colors border border-orange-200">
            ✏️ 선택항목 수정요청 ({selectedIds.size}개)
          </button>
        </div>
      )}

      {/* 일괄 수정요청 인라인 */}
      {activeInlineId === '__batch__' && (
        <div className="rounded-2xl border border-orange-200 bg-orange-50/40 p-4 space-y-3">
          <p className="text-sm font-semibold text-orange-700">수정 요청 내용 (선택된 {selectedIds.size}개 항목)</p>
          <select value={inlineCategory} onChange={e => setInlineCategory(e.target.value)}
            className="w-full sm:w-56 text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:border-orange-400">
            <option value="">카테고리 선택 (필수)</option>
            {CORRECTION_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <textarea value={inlineMemo} onChange={e => setInlineMemo(e.target.value)}
            placeholder="예) 3주차 목요일 메뉴 오타 수정 바랍니다" rows={2}
            className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:border-orange-400" />
          <div className="flex gap-2">
            <button type="button" onClick={() => handleBatchCorrectionSubmit(Array.from(selectedIds))}
              disabled={submitting || !inlineMemo.trim() || !inlineCategory}
              className="px-4 py-2 rounded-xl bg-orange-600 text-white text-sm font-semibold hover:bg-orange-700 disabled:opacity-40">
              수정요청 제출
            </button>
            <button type="button" onClick={() => { setActiveInlineId(null); setInlineMemo(''); setInlineCategory('') }}
              className="px-4 py-2 rounded-xl bg-gray-100 text-gray-600 text-sm font-semibold hover:bg-gray-200">취소</button>
          </div>
        </div>
      )}

      {/* 빈 상태 */}
      {filtered.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
          <p className="text-gray-400 text-sm">해당 탭에 식단표가 없습니다.</p>
        </div>
      )}

      {/* 데스크탑 테이블 */}
      {filtered.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden hidden sm:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-xs">
                <th className="px-3 py-3 w-10">
                  <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} className="rounded" />
                </th>
                <th className="text-center px-3 py-3 font-semibold text-gray-500 w-8">#</th>
                <th className="text-left   px-3 py-3 font-semibold text-gray-500">원명</th>
                <th className="text-center px-3 py-3 font-semibold text-gray-500">PPTX</th>
                <th className="text-center px-3 py-3 font-semibold text-gray-500">상태</th>
                <th className="text-center px-3 py-3 font-semibold text-gray-500">수정이력</th>
                <th className="text-center px-3 py-3 font-semibold text-gray-500">액션</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item, idx) => (
                <>
                  <tr key={item.id} className={`border-b border-gray-50 transition-colors ${rowBg(item.review_status) || (idx % 2 === 1 ? 'bg-gray-50/40' : '')}`}>
                    <td className="px-3 py-3 text-center">
                      <input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleSelect(item.id)}
                        disabled={item.review_status !== 'generation_complete'}
                        className="rounded disabled:opacity-30" />
                    </td>
                    <td className="text-center px-3 py-3 text-gray-400 text-xs">{idx + 1}</td>
                    <td className="px-3 py-3 font-medium text-[#1C2B1E]">
                      <div>
                        {item.branch_name}
                        {item.review_status === 'resubmitted' && (
                          <span className="ml-2 text-xs text-blue-600 font-semibold">재검토 필요</span>
                        )}
                      </div>
                      {item.review_status === 'correction_request' && item.memo && (
                        <div className="mt-0.5 flex items-start gap-1 text-xs text-orange-700">
                          <span>🔴</span>
                          {item.memo_category && <span className="font-semibold">[{item.memo_category}]</span>}
                          <span className="text-gray-500 line-clamp-1">{item.memo}</span>
                        </div>
                      )}
                    </td>
                    <td className="text-center px-3 py-3">
                      {item.pptx_url
                        ? <a href={item.pptx_url} target="_blank" rel="noopener noreferrer" className="px-2.5 py-1.5 rounded-lg bg-[#E3F2FD] text-[#1565C0] text-xs font-bold hover:bg-[#BBDEFB]">PPTX</a>
                        : <span className="text-gray-300 text-xs">-</span>}
                    </td>
                    <td className="text-center px-3 py-3"><StatusBadge status={item.review_status} /></td>
                    <td className="text-center px-3 py-3">
                      {item.correction_count === 0
                        ? <span className="text-gray-300 text-xs">-</span>
                        : <button type="button"
                            onClick={() => setExpandedHistory(prev => { const n = new Set(prev); if (n.has(item.id)) n.delete(item.id); else n.add(item.id); return n })}
                            className="text-orange-600 text-xs font-medium hover:underline">
                            {item.correction_count}회 {expandedHistory.has(item.id) ? '▲' : '▼'}
                          </button>}
                    </td>
                    <td className="text-center px-3 py-3">
                      {['generation_complete', 'resubmitted'].includes(item.review_status) && (
                        <div className="flex gap-1.5 justify-center flex-wrap">
                          <button type="button" onClick={() => handleApprove(item)} disabled={loadingItemIds.has(item.id)}
                            className="px-3 py-1.5 rounded-lg bg-[#2E7D32] text-white text-xs font-semibold hover:bg-[#1B5E20] disabled:opacity-50 flex items-center gap-1">
                            {loadingItemIds.has(item.id)
                              ? <><span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /><span>처리중</span></>
                              : '✅ 승인'}
                          </button>
                          <button type="button"
                            onClick={() => { setActiveInlineId(activeInlineId === item.id ? null : item.id); setInlineMemo(''); setInlineCategory('') }}
                            className="px-3 py-1.5 rounded-lg bg-orange-50 text-orange-700 text-xs font-semibold hover:bg-orange-100 border border-orange-200">
                            ✏️ 수정요청
                          </button>
                        </div>
                      )}
                      {item.review_status === 'correction_request' && (
                        <div className="flex gap-1.5 justify-center flex-wrap">
                          <span className="text-orange-600 text-xs font-medium">수정요청됨</span>
                          <button type="button"
                            onClick={() => { setActiveInlineId(activeInlineId === item.id ? null : item.id); setInlineMemo(''); setInlineCategory('') }}
                            className="px-2 py-1 rounded-lg bg-orange-50 text-orange-700 text-xs font-semibold border border-orange-200 hover:bg-orange-100">
                            재요청
                          </button>
                        </div>
                      )}
                      {item.review_status === 'approved' && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold">✅ 승인완료</span>
                      )}
                      {item.review_status === 'deployed' && (
                        <div className="space-y-0.5">
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-teal-100 text-teal-700 rounded-full text-xs font-bold">📤 배포완료</span>
                          {item.deployed_at && <div className="text-gray-400 text-[10px]">{formatKST(item.deployed_at)}</div>}
                        </div>
                      )}
                    </td>
                  </tr>

                  {/* 단건 수정요청 인라인 */}
                  {activeInlineId === item.id && (
                    <tr key={`${item.id}-inline`}>
                      <td colSpan={7} className="px-4 pb-3 bg-orange-50/30">
                        <div className="rounded-xl border border-orange-200 bg-white p-3 space-y-2">
                          <p className="text-xs font-semibold text-orange-700">수정 요청 — {item.branch_name}</p>
                          <select value={inlineCategory} onChange={e => setInlineCategory(e.target.value)}
                            className="w-full sm:w-48 text-xs border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:border-orange-400">
                            <option value="">카테고리 선택 (필수)</option>
                            {CORRECTION_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                          <textarea value={inlineMemo} onChange={e => setInlineMemo(e.target.value)}
                            placeholder="예) 3주차 목요일 메뉴 오타 수정 바랍니다" rows={2}
                            className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-orange-400" />
                          <div className="flex gap-2">
                            <button type="button" onClick={() => handleCorrectionSubmit(item)}
                              disabled={loadingItemIds.has(item.id) || !inlineMemo.trim() || !inlineCategory}
                              className="px-4 py-1.5 rounded-lg bg-orange-600 text-white text-xs font-semibold disabled:opacity-40 flex items-center gap-1">
                              {loadingItemIds.has(item.id)
                                ? <><span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /><span>처리중</span></>
                                : '수정요청 제출'}
                            </button>
                            <button type="button" onClick={() => { setActiveInlineId(null); setInlineMemo(''); setInlineCategory('') }}
                              className="px-4 py-1.5 rounded-lg bg-gray-100 text-gray-600 text-xs font-semibold">취소</button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}

                  {/* 수정이력 아코디언 */}
                  {expandedHistory.has(item.id) && (
                    <tr key={`${item.id}-hist`}>
                      <td colSpan={7} className="px-4 pb-3 bg-gray-50/60">
                        <div className="space-y-1.5 pt-1">
                          {(item.memo_history ?? []).map((h, i) => (
                            <div key={i} className="flex flex-wrap gap-2 items-start text-xs text-gray-600">
                              <span>{historyIcon(h.action)}</span>
                              <span className="text-gray-400">{formatKST(h.at)}</span>
                              <span className="font-medium">{h.by}</span>
                              {h.round && <span className="text-orange-600 font-semibold">수정 {h.round}회차</span>}
                              {h.category && <span className="bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">{h.category}</span>}
                              {h.memo && <span className="text-gray-500">{h.memo}</span>}
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 모바일 카드 */}
      {filtered.length > 0 && (
        <div className="sm:hidden space-y-3">
          {filtered.map(item => (
            <div key={item.id} className={`rounded-2xl border p-4 ${
              item.review_status === 'correction_request' ? 'bg-orange-50 border-orange-200' :
              item.review_status === 'approved'           ? 'bg-green-50 border-green-200' :
              item.review_status === 'deployed'           ? 'bg-teal-50 border-teal-200' :
              item.review_status === 'resubmitted'        ? 'bg-blue-50/30 border-blue-200' :
              'bg-white border-gray-100'
            }`}>
              <div className="flex items-center gap-2 mb-3">
                <input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleSelect(item.id)}
                  disabled={item.review_status !== 'generation_complete'}
                  className="rounded disabled:opacity-30 flex-shrink-0" />
                <span className="font-bold text-[#1C2B1E] flex-1 min-w-0 truncate">{item.branch_name}</span>
                <StatusBadge status={item.review_status} />
              </div>
              {item.review_status === 'correction_request' && item.memo && (
                <div className="mb-2 flex items-start gap-1 text-xs text-orange-700">
                  <span>🔴</span>
                  {item.memo_category && <span className="font-semibold">[{item.memo_category}]</span>}
                  <span className="text-gray-600">{item.memo}</span>
                </div>
              )}
              <div className="flex gap-2 flex-wrap">
                {item.pptx_url && (
                  <a href={item.pptx_url} target="_blank" rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-xl bg-[#E3F2FD] text-[#1565C0] text-xs font-bold">PPTX</a>
                )}
                {['generation_complete', 'resubmitted'].includes(item.review_status) && (
                  <>
                    <button type="button" onClick={() => handleApprove(item)} disabled={loadingItemIds.has(item.id)}
                      className="px-3 py-1.5 rounded-xl bg-[#2E7D32] text-white text-xs font-semibold disabled:opacity-50 flex items-center gap-1">
                      {loadingItemIds.has(item.id)
                        ? <><span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /><span>처리중</span></>
                        : '✅ 승인'}
                    </button>
                    <button type="button"
                      onClick={() => { setActiveInlineId(activeInlineId === item.id ? null : item.id); setInlineMemo(''); setInlineCategory('') }}
                      className="px-3 py-1.5 rounded-xl bg-orange-50 text-orange-700 text-xs font-semibold border border-orange-200">✏️ 수정요청</button>
                  </>
                )}
                {item.review_status === 'correction_request' && (
                  <button type="button"
                    onClick={() => { setActiveInlineId(activeInlineId === item.id ? null : item.id); setInlineMemo(''); setInlineCategory('') }}
                    className="px-3 py-1.5 rounded-xl bg-orange-50 text-orange-700 text-xs font-semibold border border-orange-200">✏️ 재요청</button>
                )}
              </div>
              {activeInlineId === item.id && (
                <div className="mt-3 rounded-xl border border-orange-200 bg-orange-50/30 p-3 space-y-2">
                  <select value={inlineCategory} onChange={e => setInlineCategory(e.target.value)}
                    className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none">
                    <option value="">카테고리 선택 (필수)</option>
                    {CORRECTION_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <textarea value={inlineMemo} onChange={e => setInlineMemo(e.target.value)}
                    placeholder="예) 3주차 목요일 메뉴 오타 수정 바랍니다" rows={2}
                    className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none" />
                  <div className="flex gap-2">
                    <button type="button" onClick={() => handleCorrectionSubmit(item)}
                      disabled={loadingItemIds.has(item.id) || !inlineMemo.trim() || !inlineCategory}
                      className="px-4 py-1.5 rounded-lg bg-orange-600 text-white text-xs font-semibold disabled:opacity-40 flex items-center gap-1">
                      {loadingItemIds.has(item.id)
                        ? <><span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /><span>처리중</span></>
                        : '수정요청 제출'}
                    </button>
                    <button type="button" onClick={() => { setActiveInlineId(null); setInlineMemo(''); setInlineCategory('') }}
                      className="px-4 py-1.5 rounded-lg bg-gray-100 text-gray-600 text-xs font-semibold">취소</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Nutritionist 화면 ─────────────────────────────────────────────
function NutritionistView({
  items, year, month, showToast, onRefresh,
}: {
  items:     ReviewItem[]
  year:      number
  month:     number
  showToast: (msg: string, type?: 'success' | 'error') => void
  onRefresh: () => void
}) {
  const [tab,           setTab]           = useState<NutritionistTab>('correction')
  const [selectedIds,   setSelectedIds]   = useState<Set<string>>(new Set())
  const [confirmModal,  setConfirmModal]  = useState<{ ids: string[]; names: string[] } | null>(null)
  const [uploading,     setUploading]     = useState<Record<string, boolean>>({})
  const [resubmitOpen,  setResubmitOpen]  = useState<Record<string, boolean>>({})
  const [fileMap,       setFileMap]       = useState<Record<string, File>>({})
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const correctionItems = items.filter(i => i.review_status === 'correction_request')
  const approvedItems   = items.filter(i => i.review_status === 'approved')
  const historyItems    = items.filter(i => i.review_status === 'deployed')

  const approvedSelectableIds = approvedItems.map(i => i.id)
  const allSelected = approvedSelectableIds.length > 0 && approvedSelectableIds.every(id => selectedIds.has(id))

  function toggleSelect(id: string) {
    setSelectedIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }
  function toggleSelectAll() {
    setSelectedIds(allSelected ? new Set() : new Set(approvedSelectableIds))
  }

  async function handleDeploy(ids: string[]) {
    const res  = await fetch('/api/pptx/deploy', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year, month, branch_ids: ids }),
    })
    const data = await res.json()
    if (res.ok) {
      showToast(`배포 완료! ${data.sent}개원 발송${data.failed > 0 ? ` (실패 ${data.failed})` : ''}`)
      onRefresh()
    } else {
      showToast(`배포 오류: ${data.error}`)
    }
    setConfirmModal(null)
    setSelectedIds(new Set())
  }

  function openConfirm(ids: string[]) {
    const names = ids.map(id => approvedItems.find(i => i.id === id)?.branch_name ?? id)
    setConfirmModal({ ids, names })
  }

  async function handleResubmit(item: ReviewItem) {
    const file = fileMap[item.id]
    if (!file) { showToast('파일을 선택해주세요.'); return }
    if (!item.branch_id) { showToast('branch_id 없음'); return }

    const fd = new FormData()
    fd.append('file', file)
    fd.append('branch_id', item.branch_id)
    fd.append('weekly_menu_id', item.id)

    setUploading(prev => ({ ...prev, [item.id]: true }))
    try {
      const res  = await fetch('/api/pptx/resubmit', { method: 'POST', body: fd })
      const data = await res.json()
      if (res.ok) {
        showToast('권팀장에게 재검토 요청됨')
        setResubmitOpen(prev => ({ ...prev, [item.id]: false }))
        setFileMap(prev => { const n = { ...prev }; delete n[item.id]; return n })
        onRefresh()
      } else {
        showToast(`오류: ${data.error}`)
      }
    } finally {
      setUploading(prev => ({ ...prev, [item.id]: false }))
    }
  }

  const TABS: { key: NutritionistTab; label: string; count: number }[] = [
    { key: 'correction', label: '🔴 수정요청', count: correctionItems.length },
    { key: 'approved',   label: '🟢 배포대기', count: approvedItems.length },
    { key: 'history',    label: '✅ 배포완료 이력', count: historyItems.length },
  ]

  return (
    <div className="space-y-4">
      {/* 탭 */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map(t => (
          <button key={t.key} type="button"
            onClick={() => setTab(t.key)}
            className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
              tab === t.key ? 'bg-[#2D6A4F] text-white' : 'bg-white text-gray-600 border border-gray-200 hover:border-[#2D6A4F]'
            }`}>
            {t.label}
            {t.count > 0 && (
              <span className={`w-5 h-5 rounded-full text-[10px] flex items-center justify-center font-bold ${
                tab === t.key ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
              }`}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* 탭1: 수정요청 */}
      {tab === 'correction' && (
        <div className="space-y-3">
          {correctionItems.length === 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
              <p className="text-gray-400 text-sm">수정요청된 식단표가 없습니다. 🎉</p>
            </div>
          )}
          {correctionItems.map(item => {
            const latestCorrection = [...(item.memo_history ?? [])].reverse().find(h => h.action === 'correction_request')
            return (
              <div key={item.id} className="bg-white rounded-2xl border border-orange-200 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#1C2B1E]">{item.branch_name}</span>
                  <StatusBadge status={item.review_status} />
                </div>
                {latestCorrection && (
                  <div className="bg-orange-50 rounded-xl p-3 space-y-1">
                    {latestCorrection.category && (
                      <span className="inline-block bg-orange-200 text-orange-800 text-xs font-bold px-2 py-0.5 rounded-lg">
                        {latestCorrection.category}
                      </span>
                    )}
                    <p className="text-sm text-orange-800">{latestCorrection.memo}</p>
                    <p className="text-xs text-orange-500">{latestCorrection.by} · {formatKST(latestCorrection.at)}</p>
                  </div>
                )}
                <div className="flex gap-2 flex-wrap">
                  {item.pptx_url && (
                    <a href={item.pptx_url} target="_blank" rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-xl bg-[#E3F2FD] text-[#1565C0] text-xs font-bold">
                      📊 PPTX 다운로드
                    </a>
                  )}
                  <button type="button"
                    onClick={() => setResubmitOpen(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
                    className="px-3 py-1.5 rounded-xl bg-blue-50 text-blue-700 text-xs font-semibold border border-blue-200">
                    📁 파일 업로드로 수정
                  </button>
                </div>

                {resubmitOpen[item.id] && (
                  <div className="rounded-xl border border-blue-200 bg-blue-50/30 p-3 space-y-2">
                    <p className="text-xs font-semibold text-blue-700">수정된 PPTX 파일 업로드</p>
                    <input
                      ref={el => { fileRefs.current[item.id] = el }}
                      type="file" accept=".pptx"
                      onChange={e => {
                        const f = e.target.files?.[0]
                        if (f) setFileMap(prev => ({ ...prev, [item.id]: f }))
                      }}
                      className="text-xs text-gray-600" />
                    {fileMap[item.id] && (
                      <p className="text-xs text-blue-600">선택된 파일: {fileMap[item.id].name}</p>
                    )}
                    <div className="flex gap-2">
                      <button type="button" onClick={() => handleResubmit(item)}
                        disabled={uploading[item.id] || !fileMap[item.id]}
                        className="px-4 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-40">
                        {uploading[item.id] ? '⏳ 업로드 중...' : '✅ 수정완료 제출'}
                      </button>
                      <button type="button"
                        onClick={() => { setResubmitOpen(prev => ({ ...prev, [item.id]: false })); setFileMap(prev => { const n = { ...prev }; delete n[item.id]; return n }) }}
                        className="px-4 py-1.5 rounded-lg bg-gray-100 text-gray-600 text-xs font-semibold">취소</button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* 탭2: 배포대기 */}
      {tab === 'approved' && (
        <div className="space-y-3">
          {approvedItems.length === 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
              <p className="text-gray-400 text-sm">배포 대기 중인 식단표가 없습니다.</p>
            </div>
          )}
          {approvedItems.length > 0 && (
            <>
              <div className="flex items-center gap-3 flex-wrap">
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                  <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} className="rounded" />
                  전체선택
                </label>
                {selectedIds.size > 0 && (
                  <button type="button"
                    onClick={() => openConfirm(Array.from(selectedIds))}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700">
                    📧 선택 일괄배포 ({selectedIds.size}개)
                  </button>
                )}
              </div>
              <div className="space-y-2">
                {approvedItems.map(item => (
                  <div key={item.id} className="bg-white rounded-2xl border border-green-100 p-4 flex items-center gap-3">
                    <input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleSelect(item.id)} className="rounded flex-shrink-0" />
                    <span className="font-medium text-[#1C2B1E] flex-1">{item.branch_name}</span>
                    <StatusBadge status={item.review_status} />
                    {item.reviewed_at && <span className="text-xs text-gray-400 hidden sm:block">{formatKST(item.reviewed_at)}</span>}
                    <button type="button"
                      onClick={() => openConfirm([item.id])}
                      className="px-3 py-1.5 rounded-xl bg-teal-600 text-white text-xs font-semibold hover:bg-teal-700 flex-shrink-0">
                      배포
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* 탭3: 배포완료 이력 */}
      {tab === 'history' && (
        <div className="space-y-2">
          {historyItems.length === 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
              <p className="text-gray-400 text-sm">배포 완료된 이력이 없습니다.</p>
            </div>
          )}
          {[...historyItems].sort((a, b) =>
            (b.deployed_at ?? '').localeCompare(a.deployed_at ?? '')
          ).map(item => (
            <div key={item.id} className="bg-white rounded-2xl border border-teal-100 p-4 flex items-center gap-3">
              <span className="text-teal-500 text-lg">✅</span>
              <div className="flex-1">
                <p className="font-medium text-[#1C2B1E]">{item.branch_name}</p>
                {item.deployed_at && <p className="text-xs text-gray-400">{formatKST(item.deployed_at)}</p>}
              </div>
              {item.pptx_url && (
                <a href={item.pptx_url} target="_blank" rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-xl bg-[#E3F2FD] text-[#1565C0] text-xs font-bold flex-shrink-0">
                  PPTX
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 배포 확인 모달 */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={() => setConfirmModal(null)}>
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl"
            onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-[#1C2B1E] text-lg mb-3">
              {confirmModal.ids.length === 1
                ? `"${confirmModal.names[0]}"을 배포하시겠습니까?`
                : `선택한 ${confirmModal.ids.length}개 원을 모두 배포하시겠습니까?`}
            </h3>
            {confirmModal.names.length > 1 && (
              <div className="max-h-32 overflow-y-auto mb-4 space-y-1">
                {confirmModal.names.map((n, i) => (
                  <p key={i} className="text-sm text-gray-600">• {n}</p>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <button type="button"
                onClick={() => handleDeploy(confirmModal.ids)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700">
                📧 배포하기
              </button>
              <button type="button" onClick={() => setConfirmModal(null)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-gray-100 text-gray-600 text-sm font-semibold hover:bg-gray-200">
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Director 화면 ─────────────────────────────────────────────────
function DirectorView({
  items, stats, year, month,
}: {
  items:  ReviewItem[]
  stats:  Stats
  year:   number
  month:  number
}) {
  const sorted = [...items].sort((a, b) => {
    const priority: Record<string, number> = {
      generation_complete: 0, correction_request: 1, resubmitted: 2, approved: 3, deployed: 4,
    }
    return (priority[a.review_status] ?? 5) - (priority[b.review_status] ?? 5)
  })

  const STAT_CARDS = [
    { label: '전체원수',   value: stats.total,              bg: 'bg-blue-50',   text: 'text-blue-700',  border: 'border-blue-100' },
    { label: '배포완료',   value: stats.deployed,           bg: 'bg-teal-50',   text: 'text-teal-700',  border: 'border-teal-100' },
    { label: '수정요청중', value: stats.correction_request, bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-100' },
    { label: '승인대기',   value: stats.approved,           bg: 'bg-green-50',  text: 'text-green-700', border: 'border-green-100' },
  ]

  const total      = stats.total
  const deployed   = stats.deployed
  const deployPct  = total > 0 ? Math.round((deployed / total) * 100) : 0

  return (
    <div className="space-y-4">
      {/* 통계 카드 4개 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {STAT_CARDS.map(card => (
          <div key={card.label} className={`${card.bg} border ${card.border} rounded-2xl p-4 text-center`}>
            <p className={`text-3xl font-bold ${card.text}`}>{card.value}</p>
            <p className="text-xs text-gray-500 mt-1">{card.label}</p>
          </div>
        ))}
      </div>

      {/* 월별 배포 진행률 */}
      {total > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold text-[#1C2B1E]">{year}년 {month}월 배포 진행률</span>
            <span className="text-sm font-bold text-teal-600">{deployed}/{total} ({deployPct}%)</span>
          </div>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-teal-500 transition-all duration-500" style={{ width: `${deployPct}%` }} />
          </div>
        </div>
      )}

      {/* 원별 현황 테이블 (읽기 전용) */}
      {sorted.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-xs">
                <th className="text-left px-4 py-3 font-semibold text-gray-500">원명</th>
                <th className="text-center px-3 py-3 font-semibold text-gray-500">상태</th>
                <th className="text-center px-3 py-3 font-semibold text-gray-500">최근업데이트</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((item, idx) => {
                const lastUpdate = item.deployed_at ?? item.approved_at ?? item.reviewed_at ?? null
                return (
                  <tr key={item.id} className={`border-b border-gray-50 ${idx % 2 === 1 ? 'bg-gray-50/40' : ''}`}>
                    <td className="px-4 py-3 font-medium text-[#1C2B1E]">{item.branch_name}</td>
                    <td className="text-center px-3 py-3"><StatusBadge status={item.review_status} /></td>
                    <td className="text-center px-3 py-3 text-xs text-gray-400">
                      {lastUpdate ? formatKST(lastUpdate) : '-'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {sorted.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
          <p className="text-gray-400 text-sm">이번 달 검토할 식단표가 없습니다.</p>
        </div>
      )}
    </div>
  )
}

// ── 메인 페이지 ───────────────────────────────────────────────────
function DietReviewPageInner() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const now          = new Date()

  const [year,  setYear]  = useState(() => Number(searchParams.get('year'))  || now.getFullYear())
  const [month, setMonth] = useState(() => Number(searchParams.get('month')) || now.getMonth() + 1)

  const [items,        setItems]        = useState<ReviewItem[]>([])
  const [stats,        setStats]        = useState<Stats>({
    total: 0, generation_complete: 0, correction_request: 0, resubmitted: 0, approved: 0, deployed: 0,
  })
  const [currentAdmin, setCurrentAdmin] = useState<CurrentAdmin | null>(null)
  const [search,       setSearch]       = useState('')
  const [managerTab,   setManagerTab]   = useState<ManagerTab>('all')
  const [loading,      setLoading]      = useState(true)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  const showToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }, [])

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
      setItems(data.items ?? [])
      setStats(data.stats ?? { total: 0, generation_complete: 0, correction_request: 0, resubmitted: 0, approved: 0, deployed: 0 })
      setCurrentAdmin(data.currentAdmin)
    } finally {
      setLoading(false)
    }
  }, [year, month, router, showToast])

  useEffect(() => { fetchData() }, [fetchData])

  function handleYearMonth(y: number, m: number) {
    setYear(y); setMonth(m); setSearch(''); setManagerTab('all')
  }

  const filteredItems = search
    ? items.filter(i => i.branch_name.includes(search))
    : items

  const role       = currentAdmin?.role ?? ''
  const isManager  = ['super_admin', 'manager'].includes(role)
  const isNutri    = role === 'nutritionist'
  const isDirector = role === 'director'

  return (
    <main className="min-h-screen bg-[#F6FAF6] pb-20">
      {/* ── 헤더 ─────────────────────────────────────────────── */}
      <div className="px-4 sm:px-6 pt-6 pb-3">
        <Link href="/board/admin/diet-automation" className="text-gray-400 hover:text-gray-600 text-sm inline-block mb-3">
          ← 식단표 자동화
        </Link>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-2xl">👀</span>
          <h1 className="text-xl sm:text-2xl font-bold text-[#1C2B1E]">{year}년 {month}월 식단표 검토</h1>
          {currentAdmin && (
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
              {currentAdmin.name} · {role}
            </span>
          )}
        </div>
      </div>

      <div className="px-4 sm:px-6 space-y-5">
        {/* 공통 상단 */}
        <CommonHeader
          year={year} month={month} stats={stats} search={search}
          onYearMonth={handleYearMonth} onSearch={setSearch}
          activeTab={isManager ? managerTab : undefined}
          onTabChange={isManager ? setManagerTab : undefined}
        />

        {/* 로딩 */}
        {loading && <Skeleton />}

        {/* 데이터 없음 */}
        {!loading && currentAdmin && items.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
            <p className="text-gray-400 text-sm">{year}년 {month}월 식단 데이터가 없습니다.</p>
            <Link href="/board/admin/diet-automation/upload" className="mt-4 inline-block text-[#2D6A4F] text-sm underline">
              엑셀 업로드하기
            </Link>
          </div>
        )}

        {/* 역할별 뷰 */}
        {!loading && items.length > 0 && isManager && (
          <ManagerView
            items={filteredItems} stats={stats}
            year={year} month={month}
            adminId={currentAdmin!.id} adminName={currentAdmin!.name}
            showToast={showToast} onRefresh={fetchData}
            tab={managerTab} onTabChange={setManagerTab}
          />
        )}

        {!loading && items.length > 0 && isNutri && (
          <NutritionistView
            items={filteredItems} year={year} month={month}
            showToast={showToast} onRefresh={fetchData}
          />
        )}

        {!loading && items.length > 0 && isDirector && (
          <DirectorView
            items={filteredItems} stats={stats} year={year} month={month}
          />
        )}
      </div>

      {/* 토스트 */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-2xl shadow-lg text-sm font-medium text-white transition-all max-w-sm ${
          toast.type === 'success' ? 'bg-green-600' : 'bg-red-500'
        }`}>
          <span>{toast.type === 'success' ? '✅' : '❌'}</span>
          <span>{toast.msg}</span>
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
