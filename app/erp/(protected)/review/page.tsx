'use client'

import { useState, useEffect, useCallback, useRef, Suspense, Fragment, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronDown, ChevronRight as ChevronRightIcon } from 'lucide-react'
import { isNutritionist, DEPLOY_ROLES, EMERGENCY_DEPLOY_ROLES, ROLE_LABEL } from '@/lib/roles'

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
  sort_order:       number | null
  group_tag:        string | null
  branch_full_name: string | null
  branchReviewType?: 'standard' | 'special'
  fileFormat?:       string | null
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

// ── 그룹(원 프로파일과 동일) ──────────────────────────────────────
const GROUPS = [
  { tag: 'E',   label: 'ECC계열',  headerClass: 'bg-blue-50 border-blue-200',    badgeClass: 'bg-blue-100 text-blue-700',   dotClass: 'bg-blue-500' },
  { tag: 'P',   label: 'POLY계열', headerClass: 'bg-green-50 border-green-200',   badgeClass: 'bg-green-100 text-green-700', dotClass: 'bg-green-500' },
  { tag: 'R',   label: '라이즈계열', headerClass: 'bg-purple-50 border-purple-200', badgeClass: 'bg-purple-100 text-purple-700', dotClass: 'bg-purple-500' },
  { tag: 'MB',  label: 'MB계열',   headerClass: 'bg-orange-50 border-orange-200', badgeClass: 'bg-orange-100 text-orange-700', dotClass: 'bg-orange-500' },
  { tag: 'SLP', label: 'SLP계열',  headerClass: 'bg-pink-50 border-pink-200',     badgeClass: 'bg-pink-100 text-pink-700',   dotClass: 'bg-pink-500' },
  { tag: 'AO',  label: '알티오라',  headerClass: 'bg-teal-50 border-teal-200',     badgeClass: 'bg-teal-100 text-teal-700',   dotClass: 'bg-teal-500' },
  { tag: '기타', label: '기타',     headerClass: 'bg-slate-50 border-slate-200',   badgeClass: 'bg-slate-100 text-slate-600', dotClass: 'bg-slate-400' },
]
function normalizeGroup(g: string | null): string {
  if (!g || !g.trim()) return '기타'
  const t = g.trim()
  return GROUPS.find(gr => gr.tag === t) ? t : '기타'
}

function getSpecialBadge(item: ReviewItem): string | null {
  if (item.branch_full_name === '목동poly') return '슬라이드 다수 주의'
  if (item.fileFormat === 'PDF+JPG') return 'PDF+JPG 2버전'
  if (item.fileFormat === 'JPG') return 'JPG 형식'
  if (item.fileFormat === 'PDF') return 'PDF 형식'
  return null
}

function getSpecialNote(item: ReviewItem): string | null {
  if (item.fileFormat === 'PDF+JPG') return '알레르기 표기본 + 무표기본 2개 파일 모두 확인 필요'
  if (item.branch_full_name === '목동poly') return '슬라이드 수가 많습니다. 전체 페이지 꼼꼼히 확인 필요'
  if (item.fileFormat === 'JPG') return 'JPG 형식으로 출력됩니다'
  if (item.fileFormat === 'PDF') return 'PDF 형식으로 출력됩니다'
  return null
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
  items, showToast, tab, onTabChange, patchItem, year, month, role,
}: {
  items:       ReviewItem[]
  year:        number
  month:       number
  role:        string
  adminId:     string
  adminName:   string
  showToast:   (msg: string, type?: 'success' | 'error') => void
  onRefresh:   () => void
  tab:         ManagerTab
  onTabChange: (t: ManagerTab) => void
  patchItem:   (id: string, patch: Partial<ReviewItem>) => void
}) {
  const [selectedIds,     setSelectedIds]    = useState<Set<string>>(new Set())
  useEffect(() => { setSelectedIds(new Set()) }, [tab])
  useEffect(() => { setSelectedIds(new Set()) }, [year, month])
  const selectAllRef                         = useRef<HTMLInputElement>(null)
  const selectAllMobileRef                   = useRef<HTMLInputElement>(null)
  const [loadingItemIds,  setLoadingItemIds] = useState<Set<string>>(new Set())
  const [activeInlineId,  setActiveInlineId] = useState<string | null>(null)
  const [inlineMemo,      setInlineMemo]     = useState('')
  const [inlineCategory,  setInlineCategory] = useState('')
  const [expandedHistory, setExpandedHistory] = useState<Set<string>>(new Set())
  const [submitting,      setSubmitting]     = useState(false)
  const [showBatchConfirm,  setShowBatchConfirm]  = useState(false)
  const [showTabBatchConfirm, setShowTabBatchConfirm] = useState(false)
  type TabBatchData = { ids: string[]; gcCount: number; rsCount: number; branchNames: string[] }
  const [tabBatchData, setTabBatchData] = useState<TabBatchData | null>(null)
  const [emergencyItem,     setEmergencyItem]     = useState<ReviewItem | null>(null)
  const [emergencyInput,    setEmergencyInput]    = useState('')
  const [emergencyLoading,  setEmergencyLoading]  = useState(false)
  const [deployingIds,      setDeployingIds]      = useState<Set<string>>(new Set())
  const [isDeployingAll,    setIsDeployingAll]    = useState(false)
  const [deployFailedNames, setDeployFailedNames] = useState<string[]>([])
  const isDeploying = deployingIds.size > 0 || isDeployingAll

  // 그룹 아코디언 상태 (Manager 독립)
  const [managerOpenGroups, setManagerOpenGroups] = useState<Set<string>>(new Set())
  // 이원화 검토 탭 (표준/특이 업장)
  const [activeReviewTab, setActiveReviewTab] = useState<'standard' | 'special'>('standard')
  useEffect(() => { setSelectedIds(new Set()) }, [activeReviewTab])
  // 탭 전환 또는 데이터 첫 로드 시 검토대기/재제출 그룹만 자동 펼침
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (items.length === 0) return
    const tabItems = items.filter(i => (i.branchReviewType ?? 'standard') === activeReviewTab)
    const autoOpen = new Set<string>()
    GROUPS.forEach(g => {
      if (tabItems.some(
        i => normalizeGroup(i.group_tag) === g.tag &&
             (i.review_status === 'generation_complete' || i.review_status === 'resubmitted')
      )) autoOpen.add(g.tag)
    })
    setManagerOpenGroups(autoOpen)
  }, [activeReviewTab, items.length]) // items.length: 최초 로드 시에만 재실행
  function toggleGroup(tag: string) {
    setManagerOpenGroups(prev => { const n = new Set(prev); if (n.has(tag)) n.delete(tag); else n.add(tag); return n })
  }

  const TAB_KEYS: { key: ManagerTab; label: string; icon: string }[] = [
    { key: 'all',                 label: '전체',    icon: '📋' },
    { key: 'generation_complete', label: '검토대기', icon: '⏳' },
    { key: 'correction_request',  label: '수정요청', icon: '🔴' },
    { key: 'resubmitted',         label: '재제출됨', icon: '🔵' },
    { key: 'approved',            label: '승인완료', icon: '✅' },
    { key: 'deployed',            label: '배포완료', icon: '📤' },
  ]
  // 이원화 검토 탭 기준 필터링
  const standardCount      = items.filter(i => (i.branchReviewType ?? 'standard') === 'standard').length
  const specialCount       = items.filter(i => (i.branchReviewType ?? 'standard') === 'special').length
  // 탭별 검토대기(gen_complete + resubmitted) 카운트 — 탭 버튼에 표시
  const standardPendingCount = items.filter(i =>
    (i.branchReviewType ?? 'standard') === 'standard' &&
    (i.review_status === 'generation_complete' || i.review_status === 'resubmitted')
  ).length
  const specialPendingCount = items.filter(i =>
    (i.branchReviewType ?? 'standard') === 'special' &&
    (i.review_status === 'generation_complete' || i.review_status === 'resubmitted')
  ).length
  const reviewTabItems     = items.filter(i => (i.branchReviewType ?? 'standard') === activeReviewTab)
  // 재제출 항목 (상단 강조 섹션용)
  const resubmittedTabItems = reviewTabItems.filter(i => i.review_status === 'resubmitted')
  // pptx_url null 업장 제외한 실제 승인 가능 카운트
  const tabApprovableCount = reviewTabItems.filter(
    i => (i.review_status === 'generation_complete' || i.review_status === 'resubmitted') && i.pptx_url !== null
  ).length
  const tabCount: Record<ManagerTab, number> = {
    all:                 reviewTabItems.length,
    generation_complete: reviewTabItems.filter(i => i.review_status === 'generation_complete').length,
    correction_request:  reviewTabItems.filter(i => i.review_status === 'correction_request').length,
    resubmitted:         reviewTabItems.filter(i => i.review_status === 'resubmitted').length,
    approved:            reviewTabItems.filter(i => i.review_status === 'approved').length,
    deployed:            reviewTabItems.filter(i => i.review_status === 'deployed').length,
  }

  const filtered = reviewTabItems.filter(it => tab === 'all' || it.review_status === tab)

  // generation_complete만 체크 가능
  const checkableIds = filtered.filter(i => i.review_status === 'generation_complete').map(i => i.id)
  const allChecked   = checkableIds.length > 0 && checkableIds.every(id => selectedIds.has(id))
  const someChecked  = checkableIds.some(id => selectedIds.has(id))

  useEffect(() => {
    if (!selectAllRef.current) return
    selectAllRef.current.checked       = allChecked
    selectAllRef.current.indeterminate = someChecked && !allChecked
  }, [allChecked, someChecked])

  useEffect(() => {
    if (!selectAllMobileRef.current) return
    selectAllMobileRef.current.checked       = allChecked
    selectAllMobileRef.current.indeterminate = someChecked && !allChecked
  }, [allChecked, someChecked])

  function toggleOne(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  function toggleSelectAll() {
    setSelectedIds(allChecked ? new Set() : new Set(checkableIds))
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

  // 일괄 승인 (모달 확인 후 실행)
  async function handleBatchApprove() {
    setShowBatchConfirm(false)
    setSubmitting(true)
    // pptx_url null 업장 제외
    const ids = Array.from(selectedIds).filter(id => items.find(i => i.id === id)?.pptx_url !== null)
    const branchNames = ids.map(id => items.find(i => i.id === id)?.branch_full_name ?? items.find(i => i.id === id)?.branch_name ?? '')
    const prevMap = new Map(ids.map(id => [id, items.find(i => i.id === id)?.review_status]))
    ids.forEach(id => patchItem(id, { review_status: 'approved' }))
    setSelectedIds(new Set())
    try {
      const res  = await fetch('/api/diet-review', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approved', ids }),
      })
      const data = await res.json()
      if (data.success) {
        const finalCount = data.updated?.length ?? ids.length
        fetch('/api/diet-review/notify', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type:                'diet_approval_email',
            year, month,
            approvedCount:       finalCount,
            resubmittedCount:    0,
            tabType:             activeReviewTab,
            approvedBranchNames: branchNames,
          }),
        }).catch(() => {})
        showToast(`✅ ${finalCount}개 업장 승인 완료 · 배서영 영양사에게 배포 알림이 발송됐습니다.`, 'success')
      } else {
        ids.forEach(id => { const p = prevMap.get(id); if (p) patchItem(id, { review_status: p as ReviewItem['review_status'] }) })
        setSelectedIds(new Set(ids))
        showToast(`오류: ${data.error}`, 'error')
      }
    } catch {
      ids.forEach(id => { const p = prevMap.get(id); if (p) patchItem(id, { review_status: p as ReviewItem['review_status'] }) })
      setSelectedIds(new Set(ids))
      showToast('네트워크 오류', 'error')
    }
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

  // 일괄 수정요청 (모달 확인 후 실행)
  async function handleBatchCorrectionSubmit() {
    if (!inlineMemo.trim()) { showToast('메모를 입력해주세요.', 'error'); return }
    if (!inlineCategory)    { showToast('카테고리를 선택해주세요.', 'error'); return }
    const ids = Array.from(selectedIds)
    const savedMemo = inlineMemo, savedCat = inlineCategory
    setActiveInlineId(null); setInlineMemo(''); setInlineCategory('')
    setSubmitting(true)
    const prevMap = new Map(ids.map(id => [id, items.find(i => i.id === id)?.review_status]))
    ids.forEach(id => patchItem(id, { review_status: 'correction_request', memo: savedMemo, memo_category: savedCat }))
    setSelectedIds(new Set())
    try {
      const res  = await fetch('/api/diet-review', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'correction_request', ids, memo: savedMemo, memo_category: savedCat || undefined }),
      })
      const data = await res.json()
      if (data.success) {
        fetch('/api/diet-review/notify', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'correction_to_nutritionist' }),
        }).catch(() => {})
        showToast(`${data.updated?.length ?? ids.length}개 원 수정요청 전송됨`, 'success')
      } else {
        ids.forEach(id => { const p = prevMap.get(id); if (p) patchItem(id, { review_status: p as ReviewItem['review_status'], memo: null, memo_category: null }) })
        setSelectedIds(new Set(ids))
        showToast(`오류: ${data.error}`, 'error')
      }
    } catch {
      ids.forEach(id => { const p = prevMap.get(id); if (p) patchItem(id, { review_status: p as ReviewItem['review_status'], memo: null, memo_category: null }) })
      setSelectedIds(new Set(ids))
      showToast('네트워크 오류', 'error')
    }
    finally { setSubmitting(false) }
  }

  async function handleEmergencyDeploy() {
    if (!emergencyItem) return
    setEmergencyLoading(true)
    const item = emergencyItem
    try {
      const res  = await fetch('/api/pptx/deploy', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year, month, branch_ids: [item.branch_id], is_emergency: true }),
      })
      const data = await res.json()
      if (res.ok) {
        patchItem(item.id, { review_status: 'deployed' })
        setEmergencyItem(null)
        setEmergencyInput('')
        fetch('/api/diet-review/notify', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'emergency_deploy', year, month, branch_names: [item.branch_name] }),
        }).catch(() => {})
        showToast('비상 배포 완료 — 기록이 저장됐습니다', 'success')
      } else {
        showToast(`비상 배포 실패 — ${data.error ?? '다시 시도해주세요'}`, 'error')
      }
    } catch {
      showToast('비상 배포 실패 — 다시 시도해주세요', 'error')
    } finally {
      setEmergencyLoading(false)
    }
  }

  async function handleDeploy(item: ReviewItem) {
    if (item.review_status !== 'approved') return
    if (!confirm('이메일을 발송하시겠습니까?')) return
    const prev = item.review_status
    setDeployingIds(s => { const n = new Set(s); n.add(item.id); return n })
    patchItem(item.id, { review_status: 'deployed' })
    try {
      const res  = await fetch('/api/pptx/deploy', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year, month, branch_ids: [item.branch_id], is_emergency: false }),
      })
      const data = await res.json()
      if (res.ok) {
        const failedNames: string[] = data.results?.failed  ?? []
        const skippedCount: number  = data.skipped ?? 0
        if (failedNames.length > 0) {
          patchItem(item.id, { review_status: prev })
          if (failedNames.length === 1) {
            showToast(`배포 실패: ${failedNames[0]}`, 'error')
          } else {
            setDeployFailedNames(failedNames)
          }
        } else if ((data.sent ?? 0) > 0) {
          const skippedMsg = skippedCount > 0 ? ` (${skippedCount}개 이미 배포됨)` : ''
          showToast(`${item.branch_name} 배포 완료! 🎉${skippedMsg}`, 'success')
        } else {
          patchItem(item.id, { review_status: prev })
          showToast('배포 실패. 관리자에게 문의하세요', 'error')
        }
      } else {
        patchItem(item.id, { review_status: prev })
        showToast(`배포 실패: ${data.error ?? '이메일 발송 오류'}`, 'error')
      }
    } catch {
      patchItem(item.id, { review_status: prev })
      showToast('배포 중 오류 발생, 다시 시도해주세요', 'error')
    } finally {
      setDeployingIds(s => { const n = new Set(s); n.delete(item.id); return n })
    }
  }

  async function handleBatchDeploy() {
    const approvedItems = filtered.filter(i => i.review_status === 'approved')
    if (!approvedItems.length) return
    if (!confirm(`승인완료된 ${approvedItems.length}개 원에 이메일을 발송합니다.`)) return
    setIsDeployingAll(true)
    const prevMap = new Map(approvedItems.map(i => [i.id, i.review_status]))
    approvedItems.forEach(i => patchItem(i.id, { review_status: 'deployed' }))
    try {
      const branch_ids = approvedItems.map(i => i.branch_id).filter(Boolean) as string[]
      const res  = await fetch('/api/pptx/deploy', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year, month, branch_ids, is_emergency: false }),
      })
      const data = await res.json()
      if (res.ok) {
        const successItems: { id: string; branch_name: string }[] = data.results?.success ?? []
        const failedNames:  string[] = data.results?.failed  ?? []
        const skippedCount: number   = data.skipped ?? 0
        failedNames.forEach(name => {
          const it = approvedItems.find(i => i.branch_name === name)
          if (it) patchItem(it.id, { review_status: prevMap.get(it.id) as ReviewItem['review_status'] })
        })
        if (successItems.length > 0) {
          const successIds = new Set(successItems.map(s => s.id))
          setSelectedIds(prev => new Set(Array.from(prev).filter(id => !successIds.has(id))))
        }
        if (successItems.length > 0 && failedNames.length === 0) {
          const skippedMsg = skippedCount > 0 ? ` (${skippedCount}개 이미 배포됨)` : ''
          showToast(`${successItems.length}개 원 배포 완료! 🎉${skippedMsg}`, 'success')
        } else if (successItems.length > 0 && failedNames.length > 0) {
          if (failedNames.length === 1) {
            showToast(`${successItems.length}개 완료, 배포 실패: ${failedNames[0]}`, 'error')
          } else {
            showToast(`${successItems.length}개 완료`, 'success')
            setDeployFailedNames(failedNames)
          }
        } else {
          approvedItems.forEach(i => patchItem(i.id, { review_status: prevMap.get(i.id) as ReviewItem['review_status'] }))
          showToast('배포 실패. 관리자에게 문의하세요', 'error')
        }
      } else {
        approvedItems.forEach(i => patchItem(i.id, { review_status: prevMap.get(i.id) as ReviewItem['review_status'] }))
        showToast(`배포 실패: ${data.error}`, 'error')
      }
    } catch {
      approvedItems.forEach(i => patchItem(i.id, { review_status: prevMap.get(i.id) as ReviewItem['review_status'] }))
      showToast('배포 중 오류 발생, 다시 시도해주세요', 'error')
    } finally {
      setIsDeployingAll(false)
    }
  }

  // 현재 이원화 탭의 승인 가능 항목 전체 일괄 승인 — 확인 모달 표시
  function handleTabBatchApprove() {
    const approvable = reviewTabItems.filter(
      i => (i.review_status === 'generation_complete' || i.review_status === 'resubmitted') && i.pptx_url !== null
    )
    if (!approvable.length) return
    setTabBatchData({
      ids:         approvable.map(i => i.id),
      gcCount:     approvable.filter(i => i.review_status === 'generation_complete').length,
      rsCount:     approvable.filter(i => i.review_status === 'resubmitted').length,
      branchNames: approvable.map(i => i.branch_full_name ?? i.branch_name),
    })
    setShowTabBatchConfirm(true)
  }

  // 확인 모달 승인 후 실제 실행
  async function executeTabBatchApprove() {
    if (!tabBatchData) return
    setShowTabBatchConfirm(false)
    setSubmitting(true)
    const { ids, rsCount, branchNames } = tabBatchData
    const prevMap = new Map(ids.map(id => [id, reviewTabItems.find(i => i.id === id)?.review_status]))
    ids.forEach(id => patchItem(id, { review_status: 'approved' }))
    try {
      const res  = await fetch('/api/diet-review', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approved', ids }),
      })
      const data = await res.json()
      if (data.success) {
        const finalCount = data.updated?.length ?? ids.length
        fetch('/api/diet-review/notify', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type:                'diet_approval_email',
            year, month,
            approvedCount:       finalCount,
            resubmittedCount:    rsCount,
            tabType:             activeReviewTab,
            approvedBranchNames: branchNames,
          }),
        }).catch(() => {})
        showToast(`✅ ${finalCount}개 업장 승인 완료 · 배서영 영양사에게 배포 알림이 발송됐습니다.`, 'success')
      } else {
        ids.forEach(id => { const p = prevMap.get(id); if (p) patchItem(id, { review_status: p as ReviewItem['review_status'] }) })
        showToast(`오류: ${data.error}`, 'error')
      }
    } catch {
      ids.forEach(id => { const p = prevMap.get(id); if (p) patchItem(id, { review_status: p as ReviewItem['review_status'] }) })
      showToast('네트워크 오류', 'error')
    } finally {
      setSubmitting(false)
      setTabBatchData(null)
    }
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
      {/* 이원화 검토 탭 + 현재 탭 전체 승인 버튼 */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => setActiveReviewTab('standard')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
            activeReviewTab === 'standard'
              ? 'bg-[#2D6A4F] text-white'
              : 'bg-white text-gray-600 border border-gray-200 hover:border-[#2D6A4F] hover:text-[#2D6A4F]'
          }`}
        >
          표준 업장 {standardCount}
          {standardPendingCount > 0 && (
            <span className={`ml-1.5 text-xs ${activeReviewTab === 'standard' ? 'text-white/80' : 'text-gray-400'}`}>
              · 검토대기 {standardPendingCount}건
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setActiveReviewTab('special')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
            activeReviewTab === 'special'
              ? 'bg-amber-500 text-white'
              : 'bg-white text-amber-700 border border-amber-200 hover:border-amber-400 hover:bg-amber-50'
          }`}
        >
          특이 업장 {specialCount}
          {specialPendingCount > 0 && (
            <span className={`ml-1.5 text-xs ${activeReviewTab === 'special' ? 'text-white/80' : 'text-amber-500'}`}>
              · 검토대기 {specialPendingCount}건
            </span>
          )}
        </button>
        {tabApprovableCount > 0 && (
          <button
            type="button"
            onClick={handleTabBatchApprove}
            disabled={submitting}
            className="ml-auto flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#2E7D32] text-white text-sm font-semibold hover:bg-[#1B5E20] disabled:opacity-40 transition-colors"
          >
            {submitting
              ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" /><span>처리중...</span></>
              : `✅ 현재 탭 전체 승인 (${tabApprovableCount}건)`}
          </button>
        )}
      </div>

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

      {/* 특이 업장 탭 amber 주의 배너 */}
      {activeReviewTab === 'special' && (
        <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 border border-amber-300 rounded-xl text-amber-800 text-sm font-semibold">
          ⚠️ 아래 업장은 파일 형식 또는 검토 방식이 달라 각별한 확인이 필요합니다.
        </div>
      )}

      {/* 승인완료 탭 일괄 배포 버튼 */}
      {tab === 'approved' && filtered.length > 0 && DEPLOY_ROLES.includes(role) && (
        <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-2xl px-4 py-3">
          <span className="text-sm font-semibold text-green-700">
            승인완료 {filtered.length}개 원이 배포 대기 중입니다.
          </span>
          <button
            type="button"
            onClick={handleBatchDeploy}
            disabled={isDeploying}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 disabled:opacity-40 transition-colors"
          >
            {isDeployingAll
              ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" /><span>배포 중...</span></>
              : `📧 전체 배포 (${filtered.length}개)`}
          </button>
        </div>
      )}

      {/* 선택 항목 액션 바 */}
      {selectedIds.size > 0 && (
        <div className="bg-[#E8F5E9] border border-[#2D6A4F]/20 rounded-2xl px-4 py-3 flex flex-wrap items-center gap-3">
          <span className="text-sm font-bold text-[#2D6A4F]">{selectedIds.size}개 선택됨</span>
          <div className="flex gap-2 flex-wrap">
            <button type="button" onClick={() => setShowBatchConfirm(true)} disabled={submitting}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#2E7D32] text-white text-sm font-semibold hover:bg-[#1B5E20] disabled:opacity-40 transition-colors">
              {submitting
                ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" /><span>처리중...</span></>
                : `✅ 선택 ${selectedIds.size}개 일괄승인`}
            </button>
            <button type="button"
              onClick={() => { setActiveInlineId('__batch__'); setInlineMemo(''); setInlineCategory('') }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orange-50 text-orange-700 text-sm font-semibold hover:bg-orange-100 transition-colors border border-orange-200">
              ✏️ 선택 {selectedIds.size}개 수정요청
            </button>
          </div>
        </div>
      )}

      {/* 일괄승인 확인 모달 */}
      {showBatchConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full space-y-4">
            <div className="space-y-2 text-center">
              <p className="text-base font-bold text-[#1C2B1E] leading-relaxed">
                선택한 {selectedIds.size}개 원을 승인합니다.
              </p>
              <p className="text-sm text-gray-600">PPTX를 모두 확인하셨나요?</p>
              <p className="text-xs text-gray-400">승인 후 배서영 영양사에게 배포 알림이 자동 발송됩니다.</p>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowBatchConfirm(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                취소
              </button>
              <button type="button" onClick={handleBatchApprove}
                className="flex-1 py-2.5 rounded-xl bg-[#2E7D32] text-white text-sm font-semibold hover:bg-[#1B5E20] transition-colors">
                승인하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 현재 탭 전체 승인 확인 모달 */}
      {showTabBatchConfirm && tabBatchData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full space-y-4">
            {activeReviewTab === 'standard' ? (
              <div className="space-y-2 text-center">
                <p className="text-base font-bold text-[#1C2B1E] leading-relaxed">
                  표준 업장 {tabBatchData.ids.length}개를 일괄 승인합니다.
                </p>
                <p className="text-sm text-gray-500">
                  (검토대기 {tabBatchData.gcCount}건 + 재제출 {tabBatchData.rsCount}건)
                </p>
                <p className="text-sm text-gray-600">PPTX를 모두 확인하셨나요?</p>
                <p className="text-xs text-gray-400">승인 후 배서영 영양사에게 배포 알림이 자동 발송됩니다.</p>
              </div>
            ) : (
              <div className="space-y-2 text-center">
                <p className="text-base font-bold text-amber-700 leading-relaxed">
                  ⚠️ 특이 업장 {tabBatchData.ids.length}개를 일괄 승인합니다.
                </p>
                <p className="text-sm text-gray-600 leading-relaxed">
                  엘란(2버전), 목동poly(슬라이드 다수) 등 추가 확인이 필요한 업장입니다.
                </p>
                <p className="text-sm text-gray-600">각 업장 PPTX를 모두 확인하셨나요?</p>
                <p className="text-xs text-gray-400">승인 후 배서영 영양사에게 배포 알림이 발송됩니다.</p>
              </div>
            )}
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowTabBatchConfirm(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                취소
              </button>
              <button type="button" onClick={executeTabBatchApprove}
                className={`flex-1 py-2.5 rounded-xl text-white text-sm font-semibold transition-colors ${
                  activeReviewTab === 'special'
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-[#2E7D32] hover:bg-[#1B5E20]'
                }`}>
                {activeReviewTab === 'special' ? '⚠️ 승인하기' : '승인하기'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 일괄 수정요청 모달 */}
      {activeInlineId === '__batch__' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full space-y-4">
            <p className="text-base font-bold text-[#1C2B1E]">선택한 {selectedIds.size}개 원에 수정요청</p>
            <select value={inlineCategory} onChange={e => setInlineCategory(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:border-orange-400">
              <option value="">카테고리 선택 (필수)</option>
              {CORRECTION_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1">수정 내용 (필수)</p>
              <textarea value={inlineMemo} onChange={e => setInlineMemo(e.target.value)}
                placeholder="예) 3주차 목요일 메뉴 오타 수정 바랍니다" rows={3}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:border-orange-400" />
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => { setActiveInlineId(null); setInlineMemo(''); setInlineCategory('') }}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                취소
              </button>
              <button type="button" onClick={() => handleBatchCorrectionSubmit()}
                disabled={submitting || !inlineMemo.trim() || !inlineCategory}
                className="flex-1 py-2.5 rounded-xl bg-orange-600 text-white text-sm font-semibold hover:bg-orange-700 disabled:opacity-40 transition-colors">
                수정요청 전송
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 비상 배포 모달 */}
      {emergencyItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full space-y-4">
            <p className="text-base font-bold text-red-600 text-center">⚠️ 비상 배포 확인</p>
            <p className="text-sm text-gray-600 text-center leading-relaxed">
              이 기능은 비상시에만 사용하세요.<br />정상 배포는 영양사가 진행합니다.
            </p>
            <p className="text-sm font-semibold text-[#1C2B1E] text-center">{emergencyItem.branch_name}</p>
            <div>
              <p className="text-xs text-gray-500 mb-1">확인을 위해 <strong>비상배포</strong>를 입력하세요</p>
              <input
                type="text"
                value={emergencyInput}
                onChange={e => setEmergencyInput(e.target.value)}
                placeholder="비상배포"
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:border-red-400"
              />
            </div>
            <div className="flex gap-3">
              <button type="button"
                onClick={() => { setEmergencyItem(null); setEmergencyInput('') }}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                취소
              </button>
              <button type="button"
                onClick={handleEmergencyDeploy}
                disabled={emergencyInput !== '비상배포' || emergencyLoading}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold disabled:opacity-40 flex items-center justify-center gap-1 transition-colors hover:bg-red-700">
                {emergencyLoading
                  ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /><span>배포중...</span></>
                  : '🚨 비상 배포'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 배포 실패 목록 모달 */}
      {deployFailedNames.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full space-y-4">
            <p className="text-base font-bold text-red-600 text-center">배포 실패 원 목록</p>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {deployFailedNames.map((name, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-gray-700">
                  <span className="text-red-500">✗</span>
                  <span>{name}</span>
                </div>
              ))}
            </div>
            <button type="button"
              onClick={() => setDeployFailedNames([])}
              className="w-full py-2.5 rounded-xl bg-gray-100 text-sm font-semibold text-gray-700 hover:bg-gray-200 transition-colors">
              닫기
            </button>
          </div>
        </div>
      )}

      {/* 재제출 강조 섹션 — 권팀장이 수정요청한 업장이 재제출했을 때 최우선 표시 */}
      {resubmittedTabItems.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 space-y-3">
          <p className="text-sm font-bold text-blue-700">
            🔵 재제출 완료 — {resubmittedTabItems.length}건 먼저 확인하세요
          </p>
          <div className="space-y-2">
            {resubmittedTabItems.map(item => (
              <div key={item.id} className="bg-white rounded-xl border border-blue-100 p-3 flex flex-wrap items-center gap-3">
                <span className="font-medium text-[#1C2B1E] flex-1 min-w-0 truncate">
                  {item.branch_full_name ?? item.branch_name}
                </span>
                {item.pptx_url && (
                  <a href={`/api/download?url=${encodeURIComponent(item.pptx_url)}&filename=${encodeURIComponent(`${item.branch_name}_${year}${String(month).padStart(2, '0')}.pptx`)}`}
                    className="px-2.5 py-1 rounded-lg bg-[#E3F2FD] text-[#1565C0] text-xs font-bold flex-shrink-0">
                    PPTX
                  </a>
                )}
                {item.resubmitted_at && (
                  <span className="text-xs text-gray-400 flex-shrink-0">{formatKST(item.resubmitted_at)}</span>
                )}
                {item.correction_count > 0 && (
                  <span className="text-xs text-orange-600 font-semibold flex-shrink-0">
                    수정이력 {item.correction_count}회
                  </span>
                )}
                <button type="button" onClick={() => handleApprove(item)} disabled={loadingItemIds.has(item.id)}
                  className="px-3 py-1.5 rounded-lg bg-[#2E7D32] text-white text-xs font-semibold hover:bg-[#1B5E20] disabled:opacity-50 flex items-center gap-1 flex-shrink-0">
                  {loadingItemIds.has(item.id)
                    ? <><span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /><span>처리중</span></>
                    : '✅ 승인'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 전체 펼치기/접기 버튼 */}
      {filtered.length > 0 && (
        <div className="flex justify-end">
          {GROUPS.map(g => g.tag).every(t => managerOpenGroups.has(t)) ? (
            <button onClick={() => setManagerOpenGroups(new Set())} className="border border-slate-200 text-slate-600 rounded-lg px-3 py-1.5 text-sm hover:bg-slate-50 transition-colors">전체 접기</button>
          ) : (
            <button onClick={() => setManagerOpenGroups(new Set(GROUPS.map(g => g.tag)))} className="border border-slate-200 text-slate-600 rounded-lg px-3 py-1.5 text-sm hover:bg-slate-50 transition-colors">전체 펼치기</button>
          )}
        </div>
      )}

      {/* 빈 상태 */}
      {filtered.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
          <p className="text-gray-400 text-sm">
            {activeReviewTab === 'special'
              ? '현재 검토 대상 특이 업장이 없습니다.'
              : '해당 탭에 식단표가 없습니다.'}
          </p>
        </div>
      )}

      {/* 데스크탑 테이블 */}
      {filtered.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden hidden sm:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-xs">
                <th className="px-3 py-3 w-10">
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    onClick={e => { e.stopPropagation(); e.preventDefault(); toggleSelectAll() }}
                    onChange={() => {}}
                    className="rounded cursor-pointer"
                  />
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
              {GROUPS.map(g => {
                const groupItems = filtered.filter(it => normalizeGroup(it.group_tag) === g.tag)
                if (groupItems.length === 0) return null
                const isOpen = managerOpenGroups.has(g.tag)
                return (
                  <Fragment key={g.tag}>
                    <tr>
                      <td colSpan={7} className="p-0 border-0">
                        <div className={`${g.headerClass} border rounded-xl px-4 py-3 flex items-center justify-between cursor-pointer mb-1 transition-all hover:brightness-95`} onClick={() => toggleGroup(g.tag)}>
                          <div className="flex items-center">
                            {isOpen ? <ChevronDown size={14} className="text-slate-500" /> : <ChevronRightIcon size={14} className="text-slate-500" />}
                            <div className={`${g.dotClass} w-2 h-2 rounded-full mx-2`} />
                            <span className="text-sm font-semibold text-slate-700">{g.label}</span>
                          </div>
                          <span className="text-sm text-slate-400">{groupItems.length}개원</span>
                        </div>
                      </td>
                    </tr>
                    {isOpen && groupItems.map((item, idx) => (
                <Fragment key={item.id}>
                  <tr className={`border-b border-gray-50 transition-colors ${rowBg(item.review_status) || (idx % 2 === 1 ? 'bg-gray-50/40' : '')}`}>
                    <td className="px-3 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(item.id)}
                        onChange={() => toggleOne(item.id)}
                        onClick={e => e.stopPropagation()}
                        disabled={item.review_status !== 'generation_complete'}
                        className="rounded cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                      />
                    </td>
                    <td className="text-center px-3 py-3 text-gray-400 text-xs">{item.sort_order ?? '—'}</td>
                    <td className="px-3 py-3 font-medium text-[#1C2B1E]">
                      <div>
                        {item.branch_full_name ?? item.branch_name}
                        {activeReviewTab === 'special' && getSpecialBadge(item) && (
                          <span className="ml-2 text-xs font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
                            {getSpecialBadge(item)}
                          </span>
                        )}
                        {item.review_status === 'resubmitted' && (
                          <span className="ml-2 text-xs text-blue-600 font-semibold">재검토 필요</span>
                        )}
                      </div>
                      {activeReviewTab === 'special' && getSpecialNote(item) && (
                        <div className="mt-0.5 text-xs text-amber-700 font-medium">{getSpecialNote(item)}</div>
                      )}
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
                        ? <a href={`/api/download?url=${encodeURIComponent(item.pptx_url ?? '')}&filename=${encodeURIComponent(`${item.branch_name}_${year}${String(month).padStart(2, '0')}.pptx`)}`} className="px-2.5 py-1.5 rounded-lg bg-[#E3F2FD] text-[#1565C0] text-xs font-bold hover:bg-[#BBDEFB]">PPTX</a>
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
                        <div className="flex flex-col items-center gap-1">
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold">✅ 승인완료</span>
                          {DEPLOY_ROLES.includes(role) && (
                            <button type="button"
                              onClick={() => handleDeploy(item)}
                              disabled={isDeploying}
                              className="px-2 py-1 rounded-lg bg-teal-600 text-white text-xs font-semibold hover:bg-teal-700 disabled:opacity-40 flex items-center gap-1 transition-colors">
                              {deployingIds.has(item.id)
                                ? <><span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /><span>배포중</span></>
                                : '📧 배포'}
                            </button>
                          )}
                          {EMERGENCY_DEPLOY_ROLES.includes(role) && (
                            <button type="button"
                              onClick={() => { setEmergencyItem(item); setEmergencyInput('') }}
                              className="px-2 py-1 rounded-lg border border-red-500 text-red-500 text-xs hover:bg-red-50 transition-colors">
                              🚨 비상배포
                            </button>
                          )}
                        </div>
                      )}
                      {item.review_status === 'deployed' && (
                        <div className="space-y-1 flex flex-col items-center">
                          <div className="space-y-0.5 text-center">
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-teal-100 text-teal-700 rounded-full text-xs font-bold">📤 배포완료</span>
                            {item.deployed_at && <div className="text-gray-400 text-[10px]">{formatKST(item.deployed_at)}</div>}
                            {item.memo_history.filter(h => h.action === 'deployed').length >= 2 && (
                              <div className="text-amber-600 text-[10px] font-semibold">🔄 재배포 {item.memo_history.filter(h => h.action === 'deployed').length}회</div>
                            )}
                          </div>
                          {['manager', 'super_admin'].includes(role) && (
                            <button type="button"
                              onClick={() => {
                                if (!window.confirm('⚠️ 이미 배포된 식단입니다.\n수정 후 정정본을 재발송해야 합니다.\n계속하시겠습니까?')) return
                                setActiveInlineId(activeInlineId === item.id ? null : item.id)
                                setInlineMemo(''); setInlineCategory('')
                              }}
                              className="px-2 py-1 rounded-lg bg-amber-50 text-amber-700 text-xs font-semibold border border-amber-300 hover:bg-amber-100 transition-colors">
                              ⚠️ 배포후 수정요청
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>

                  {/* 단건 수정요청 인라인 */}
                  {activeInlineId === item.id && (() => {
                    const isPostDeploy = item.deployed_at !== null
                    return (
                      <tr>
                        <td colSpan={7} className={`px-4 pb-3 ${isPostDeploy ? 'bg-amber-50/30' : 'bg-orange-50/30'}`}>
                          <div className={`rounded-xl border ${isPostDeploy ? 'border-amber-300' : 'border-orange-200'} bg-white p-3 space-y-2`}>
                            <p className={`text-xs font-semibold ${isPostDeploy ? 'text-amber-700' : 'text-orange-700'}`}>
                              {isPostDeploy ? `⚠️ 배포후 수정요청 — ${item.branch_name}` : `수정 요청 — ${item.branch_name}`}
                            </p>
                            <select value={inlineCategory} onChange={e => setInlineCategory(e.target.value)}
                              className={`w-full sm:w-48 text-xs border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none ${isPostDeploy ? 'focus:border-amber-400' : 'focus:border-orange-400'}`}>
                              <option value="">카테고리 선택 (필수)</option>
                              {CORRECTION_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                            <textarea value={inlineMemo} onChange={e => setInlineMemo(e.target.value)}
                              placeholder="예) 3주차 목요일 메뉴 오타 수정 바랍니다" rows={2}
                              className={`w-full text-xs border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none ${isPostDeploy ? 'focus:border-amber-400' : 'focus:border-orange-400'}`} />
                            <div className="flex gap-2">
                              <button type="button" onClick={() => handleCorrectionSubmit(item)}
                                disabled={loadingItemIds.has(item.id) || !inlineMemo.trim() || !inlineCategory}
                                className={`px-4 py-1.5 rounded-lg ${isPostDeploy ? 'bg-amber-600' : 'bg-orange-600'} text-white text-xs font-semibold disabled:opacity-40 flex items-center gap-1`}>
                                {loadingItemIds.has(item.id)
                                  ? <><span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /><span>처리중</span></>
                                  : (isPostDeploy ? '⚠️ 배포후 수정요청 제출' : '수정요청 제출')}
                              </button>
                              <button type="button" onClick={() => { setActiveInlineId(null); setInlineMemo(''); setInlineCategory('') }}
                                className="px-4 py-1.5 rounded-lg bg-gray-100 text-gray-600 text-xs font-semibold">취소</button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )
                  })()}

                  {/* 수정이력 아코디언 */}
                  {expandedHistory.has(item.id) && (
                    <tr>
                      <td colSpan={7} className="px-4 pb-3 bg-gray-50/60">
                        <div className="space-y-1.5 pt-1">
                          {(item.memo_history ?? []).map((h, i) => (
                            <div key={i} className="flex flex-wrap gap-2 items-start text-xs text-gray-600">
                              <span>{historyIcon(h.action)}</span>
                              <span className="text-gray-400">{formatKST(h.at)}</span>
                              <span className="font-medium">
                                {h.by}{h.role ? ` · ${ROLE_LABEL[h.role] ?? h.role}` : ''}
                              </span>
                              {h.round && <span className="text-orange-600 font-semibold">수정 {h.round}회차</span>}
                              {h.category && <span className="bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">{h.category}</span>}
                              {h.memo && <span className="text-gray-500">{h.memo}</span>}
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
                    ))}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 모바일 카드 */}
      {filtered.length > 0 && (
        <div className="sm:hidden space-y-3">
          {/* 전체선택 (모바일) */}
          {checkableIds.length > 0 && (
            <div className="flex items-center gap-2 px-1 pb-1 border-b border-gray-100">
              <input
                ref={selectAllMobileRef}
                type="checkbox"
                onClick={e => { e.stopPropagation(); e.preventDefault(); toggleSelectAll() }}
                onChange={() => {}}
                className="rounded cursor-pointer"
              />
              <span className="text-sm text-gray-500">전체선택 ({checkableIds.length}개)</span>
            </div>
          )}
          {GROUPS.map(g => {
            const groupItems = filtered.filter(it => normalizeGroup(it.group_tag) === g.tag)
            if (groupItems.length === 0) return null
            const isOpen = managerOpenGroups.has(g.tag)
            return (
              <div key={g.tag} className="space-y-2">
                <div className={`${g.headerClass} border rounded-xl px-4 py-3 flex items-center justify-between cursor-pointer transition-all hover:brightness-95`} onClick={() => toggleGroup(g.tag)}>
                  <div className="flex items-center">
                    {isOpen ? <ChevronDown size={14} className="text-slate-500" /> : <ChevronRightIcon size={14} className="text-slate-500" />}
                    <div className={`${g.dotClass} w-2 h-2 rounded-full mx-2`} />
                    <span className="text-sm font-semibold text-slate-700">{g.label}</span>
                  </div>
                  <span className="text-sm text-slate-400">{groupItems.length}개원</span>
                </div>
                {isOpen && groupItems.map(item => (
            <div key={item.id} className={`rounded-2xl border p-4 ${
              item.review_status === 'correction_request' ? 'bg-orange-50 border-orange-200' :
              item.review_status === 'approved'           ? 'bg-green-50 border-green-200' :
              item.review_status === 'deployed'           ? 'bg-teal-50 border-teal-200' :
              item.review_status === 'resubmitted'        ? 'bg-blue-50/30 border-blue-200' :
              'bg-white border-gray-100'
            }`}>
              <div className="flex items-center gap-2 mb-3">
                <input
                  type="checkbox"
                  checked={selectedIds.has(item.id)}
                  onChange={() => toggleOne(item.id)}
                  onClick={e => e.stopPropagation()}
                  disabled={item.review_status !== 'generation_complete'}
                  className="rounded cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
                />
                <span className="font-bold text-[#1C2B1E] flex-1 min-w-0 truncate">
                  <span className="text-gray-400 text-xs mr-1.5 font-normal">{item.sort_order ?? '—'}</span>
                  {item.branch_full_name ?? item.branch_name}
                </span>
                <StatusBadge status={item.review_status} />
              </div>
              {activeReviewTab === 'special' && getSpecialBadge(item) && (
                <span className="mb-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 inline-block">
                  {getSpecialBadge(item)}
                </span>
              )}
              {activeReviewTab === 'special' && getSpecialNote(item) && (
                <p className="mb-2 text-xs text-amber-700 font-medium">{getSpecialNote(item)}</p>
              )}
              {item.review_status === 'correction_request' && item.memo && (
                <div className="mb-2 flex items-start gap-1 text-xs text-orange-700">
                  <span>🔴</span>
                  {item.memo_category && <span className="font-semibold">[{item.memo_category}]</span>}
                  <span className="text-gray-600">{item.memo}</span>
                </div>
              )}
              <div className="flex gap-2 flex-wrap">
                {item.pptx_url && (
                  <a href={`/api/download?url=${encodeURIComponent(item.pptx_url ?? '')}&filename=${encodeURIComponent(`${item.branch_name}_${year}${String(month).padStart(2, '0')}.pptx`)}`}
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
                {item.review_status === 'approved' && DEPLOY_ROLES.includes(role) && (
                  <button type="button"
                    onClick={() => handleDeploy(item)}
                    disabled={isDeploying}
                    className="px-3 py-1.5 rounded-xl bg-teal-600 text-white text-xs font-semibold hover:bg-teal-700 disabled:opacity-40 flex items-center gap-1">
                    {deployingIds.has(item.id)
                      ? <><span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /><span>배포중</span></>
                      : '📧 배포'}
                  </button>
                )}
                {item.review_status === 'approved' && EMERGENCY_DEPLOY_ROLES.includes(role) && (
                  <button type="button"
                    onClick={() => { setEmergencyItem(item); setEmergencyInput('') }}
                    className="px-3 py-1.5 rounded-xl border border-red-500 text-red-500 text-xs font-semibold hover:bg-red-50">
                    🚨 비상배포
                  </button>
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
              {item.correction_count > 0 && (
                <div className="mt-3">
                  <button type="button"
                    onClick={() => setExpandedHistory(prev => { const n = new Set(prev); if (n.has(item.id)) n.delete(item.id); else n.add(item.id); return n })}
                    className="text-orange-600 text-xs font-medium hover:underline">
                    수정이력 {item.correction_count}회 {expandedHistory.has(item.id) ? '▲' : '▼'}
                  </button>
                  {expandedHistory.has(item.id) && (
                    <div className="mt-2 space-y-1.5 bg-gray-50/60 rounded-xl p-2">
                      {(item.memo_history ?? []).map((h, i) => (
                        <div key={i} className="flex flex-wrap gap-2 items-start text-xs text-gray-600">
                          <span>{historyIcon(h.action)}</span>
                          <span className="text-gray-400">{formatKST(h.at)}</span>
                          <span className="font-medium">
                            {h.by}{h.role ? ` · ${ROLE_LABEL[h.role] ?? h.role}` : ''}
                          </span>
                          {h.round && <span className="text-orange-600 font-semibold">수정 {h.round}회차</span>}
                          {h.category && <span className="bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">{h.category}</span>}
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
            )
          })}
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
  const [confirmModal,     setConfirmModal]     = useState<{ ids: string[]; branch_ids: string[]; names: string[] } | null>(null)
  const [uploading,        setUploading]        = useState<Record<string, boolean>>({})
  const [resubmitOpen,     setResubmitOpen]     = useState<Record<string, boolean>>({})
  const [fileMap,          setFileMap]          = useState<Record<string, File>>({})
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const [isDeploying,      setIsDeploying]      = useState(false)
  const [deployFailedNames, setDeployFailedNames] = useState<string[]>([])

  // 그룹 아코디언 상태 (탭별 독립)
  const [correctionOpenGroups, setCorrectionOpenGroups] = useState<Set<string>>(new Set())
  const [deployOpenGroups,     setDeployOpenGroups]     = useState<Set<string>>(new Set())
  const [historyOpenGroups,    setHistoryOpenGroups]    = useState<Set<string>>(new Set())
  function makeToggle(setter: (updater: (prev: Set<string>) => Set<string>) => void) {
    return (tag: string) => setter(prev => { const n = new Set(prev); if (n.has(tag)) n.delete(tag); else n.add(tag); return n })
  }
  const toggleCorrection = makeToggle(setCorrectionOpenGroups)
  const toggleDeploy     = makeToggle(setDeployOpenGroups)
  const toggleHistory    = makeToggle(setHistoryOpenGroups)

  // 그룹 단위 카드 렌더 (원 프로파일과 동일한 아코디언)
  function renderGrouped(
    list: ReviewItem[],
    openGroups: Set<string>,
    toggle: (tag: string) => void,
    renderCard: (item: ReviewItem) => ReactNode,
  ) {
    return GROUPS.map(g => {
      const groupItems = list.filter(it => normalizeGroup(it.group_tag) === g.tag)
      if (groupItems.length === 0) return null
      const isOpen = openGroups.has(g.tag)
      return (
        <div key={g.tag} className="space-y-2">
          <div className={`${g.headerClass} border rounded-xl px-4 py-3 flex items-center justify-between cursor-pointer transition-all hover:brightness-95`} onClick={() => toggle(g.tag)}>
            <div className="flex items-center">
              {isOpen ? <ChevronDown size={14} className="text-slate-500" /> : <ChevronRightIcon size={14} className="text-slate-500" />}
              <div className={`${g.dotClass} w-2 h-2 rounded-full mx-2`} />
              <span className="text-sm font-semibold text-slate-700">{g.label}</span>
            </div>
            <span className="text-sm text-slate-400">{groupItems.length}개원</span>
          </div>
          {isOpen && groupItems.map(renderCard)}
        </div>
      )
    })
  }

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

  async function handleDeploy(branch_ids: string[]) {
    setIsDeploying(true)
    try {
      const res  = await fetch('/api/pptx/deploy', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year, month, branch_ids, is_emergency: false }),
      })
      const data = await res.json()
      if (res.ok) {
        const failedNames:  string[] = data.results?.failed  ?? []
        const skippedCount: number   = data.skipped ?? 0
        if (failedNames.length === 0) {
          const skippedMsg = skippedCount > 0 ? ` (${skippedCount}개 이미 배포됨)` : ''
          showToast(`배포 완료! ${data.sent}개원 발송${skippedMsg}`, 'success')
          onRefresh()
        } else if ((data.sent ?? 0) > 0) {
          showToast(`${data.sent}개 완료`, 'success')
          setDeployFailedNames(failedNames)
          onRefresh()
        } else {
          showToast('배포 실패. 관리자에게 문의하세요', 'error')
        }
      } else {
        showToast(`배포 오류: ${data.error}`, 'error')
      }
    } catch {
      showToast('배포 중 오류 발생, 다시 시도해주세요', 'error')
    } finally {
      setIsDeploying(false)
      setConfirmModal(null)
      setSelectedIds(new Set())
    }
  }

  function openConfirm(ids: string[]) {
    const found      = ids.map(id => approvedItems.find(i => i.id === id))
    const names      = found.map(i => i?.branch_name ?? '')
    const branch_ids = found.map(i => i?.branch_id).filter((id): id is string => !!id)
    setConfirmModal({ ids, branch_ids, names })
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
          {correctionItems.length > 0 && (
            <div className="flex justify-end">
              {GROUPS.map(g => g.tag).every(t => correctionOpenGroups.has(t)) ? (
                <button onClick={() => setCorrectionOpenGroups(new Set())} className="border border-slate-200 text-slate-600 rounded-lg px-3 py-1.5 text-sm hover:bg-slate-50 transition-colors">전체 접기</button>
              ) : (
                <button onClick={() => setCorrectionOpenGroups(new Set(GROUPS.map(g => g.tag)))} className="border border-slate-200 text-slate-600 rounded-lg px-3 py-1.5 text-sm hover:bg-slate-50 transition-colors">전체 펼치기</button>
              )}
            </div>
          )}
          {correctionItems.length === 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
              <p className="text-gray-400 text-sm">수정요청된 식단표가 없습니다. 🎉</p>
            </div>
          )}
          {renderGrouped(correctionItems, correctionOpenGroups, toggleCorrection, item => {
            const latestCorrection = [...(item.memo_history ?? [])].reverse().find(h => h.action === 'correction_request')
            return (
              <div key={item.id} className="bg-white rounded-2xl border border-orange-200 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#1C2B1E]">
                    <span className="text-gray-400 text-xs mr-1.5 font-normal">{item.sort_order ?? '—'}</span>
                    {item.branch_full_name ?? item.branch_name}
                  </span>
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
                    <a href={`/api/download?url=${encodeURIComponent(item.pptx_url ?? '')}&filename=${encodeURIComponent(`${item.branch_name}_${year}${String(month).padStart(2, '0')}.pptx`)}`}
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
                    disabled={isDeploying}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 disabled:opacity-40 transition-colors">
                    {isDeploying ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" /><span>배포 중...</span></> : `📧 선택 일괄배포 (${selectedIds.size}개)`}
                  </button>
                )}
                {GROUPS.map(g => g.tag).every(t => deployOpenGroups.has(t)) ? (
                  <button onClick={() => setDeployOpenGroups(new Set())} className="border border-slate-200 text-slate-600 rounded-lg px-3 py-1.5 text-sm hover:bg-slate-50 transition-colors ml-auto">전체 접기</button>
                ) : (
                  <button onClick={() => setDeployOpenGroups(new Set(GROUPS.map(g => g.tag)))} className="border border-slate-200 text-slate-600 rounded-lg px-3 py-1.5 text-sm hover:bg-slate-50 transition-colors ml-auto">전체 펼치기</button>
                )}
              </div>
              <div className="space-y-2">
                {renderGrouped(approvedItems, deployOpenGroups, toggleDeploy, item => (
                  <div key={item.id} className="bg-white rounded-2xl border border-green-100 p-4 flex items-center gap-3">
                    <input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleSelect(item.id)} className="rounded flex-shrink-0" />
                    <span className="font-medium text-[#1C2B1E] flex-1">
                      <span className="text-gray-400 text-xs mr-1.5 font-normal">{item.sort_order ?? '—'}</span>
                      {item.branch_full_name ?? item.branch_name}
                    </span>
                    <StatusBadge status={item.review_status} />
                    {item.reviewed_at && <span className="text-xs text-gray-400 hidden sm:block">{formatKST(item.reviewed_at)}</span>}
                    <button type="button"
                      onClick={() => openConfirm([item.id])}
                      disabled={isDeploying}
                      className="px-3 py-1.5 rounded-xl bg-teal-600 text-white text-xs font-semibold hover:bg-teal-700 disabled:opacity-40 flex-shrink-0 transition-colors">
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
          {historyItems.length > 0 && (
            <div className="flex justify-end">
              {GROUPS.map(g => g.tag).every(t => historyOpenGroups.has(t)) ? (
                <button onClick={() => setHistoryOpenGroups(new Set())} className="border border-slate-200 text-slate-600 rounded-lg px-3 py-1.5 text-sm hover:bg-slate-50 transition-colors">전체 접기</button>
              ) : (
                <button onClick={() => setHistoryOpenGroups(new Set(GROUPS.map(g => g.tag)))} className="border border-slate-200 text-slate-600 rounded-lg px-3 py-1.5 text-sm hover:bg-slate-50 transition-colors">전체 펼치기</button>
              )}
            </div>
          )}
          {historyItems.length === 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
              <p className="text-gray-400 text-sm">배포 완료된 이력이 없습니다.</p>
            </div>
          )}
          {renderGrouped(
            [...historyItems].sort((a, b) => (b.deployed_at ?? '').localeCompare(a.deployed_at ?? '')),
            historyOpenGroups, toggleHistory, item => (
            <div key={item.id} className="bg-white rounded-2xl border border-teal-100 p-4 flex items-center gap-3">
              <span className="text-teal-500 text-lg">✅</span>
              <div className="flex-1">
                <p className="font-medium text-[#1C2B1E]">
                  <span className="text-gray-400 text-xs mr-1.5 font-normal">{item.sort_order ?? '—'}</span>
                  {item.branch_full_name ?? item.branch_name}
                </p>
                {item.deployed_at && <p className="text-xs text-gray-400">{formatKST(item.deployed_at)}</p>}
              </div>
              {item.pptx_url && (
                <a href={`/api/download?url=${encodeURIComponent(item.pptx_url ?? '')}&filename=${encodeURIComponent(`${item.branch_name}_${year}${String(month).padStart(2, '0')}.pptx`)}`}
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
                onClick={() => handleDeploy(confirmModal.branch_ids)}
                disabled={isDeploying}
                className="flex-1 px-4 py-2.5 rounded-xl bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 disabled:opacity-40 transition-colors flex items-center justify-center gap-1.5">
                {isDeploying ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /><span>배포 중...</span></> : '📧 배포하기'}
              </button>
              <button type="button" onClick={() => setConfirmModal(null)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-gray-100 text-gray-600 text-sm font-semibold hover:bg-gray-200">
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 배포 실패 목록 모달 */}
      {deployFailedNames.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full space-y-4">
            <p className="text-base font-bold text-red-600 text-center">배포 실패 원 목록</p>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {deployFailedNames.map((name, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-gray-700">
                  <span className="text-red-500">✗</span>
                  <span>{name}</span>
                </div>
              ))}
            </div>
            <button type="button"
              onClick={() => setDeployFailedNames([])}
              className="w-full py-2.5 rounded-xl bg-gray-100 text-sm font-semibold text-gray-700 hover:bg-gray-200 transition-colors">
              닫기
            </button>
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
    const ao = a.sort_order ?? 9999
    const bo = b.sort_order ?? 9999
    return ao - bo
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

  // 그룹 아코디언 상태 (Director 독립)
  const [directorOpenGroups, setDirectorOpenGroups] = useState<Set<string>>(new Set())
  function toggleGroup(tag: string) {
    setDirectorOpenGroups(prev => { const n = new Set(prev); if (n.has(tag)) n.delete(tag); else n.add(tag); return n })
  }

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

      {/* 전체 펼치기/접기 버튼 */}
      {sorted.length > 0 && (
        <div className="flex justify-end">
          {GROUPS.map(g => g.tag).every(t => directorOpenGroups.has(t)) ? (
            <button onClick={() => setDirectorOpenGroups(new Set())} className="border border-slate-200 text-slate-600 rounded-lg px-3 py-1.5 text-sm hover:bg-slate-50 transition-colors">전체 접기</button>
          ) : (
            <button onClick={() => setDirectorOpenGroups(new Set(GROUPS.map(g => g.tag)))} className="border border-slate-200 text-slate-600 rounded-lg px-3 py-1.5 text-sm hover:bg-slate-50 transition-colors">전체 펼치기</button>
          )}
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
                <th className="text-center px-3 py-3 font-semibold text-gray-500">PPTX</th>
              </tr>
            </thead>
            <tbody>
              {GROUPS.map(g => {
                const groupItems = sorted.filter(it => normalizeGroup(it.group_tag) === g.tag)
                if (groupItems.length === 0) return null
                const isOpen = directorOpenGroups.has(g.tag)
                return (
                  <Fragment key={g.tag}>
                    <tr>
                      <td colSpan={4} className="p-0 border-0">
                        <div className={`${g.headerClass} border rounded-xl px-4 py-3 flex items-center justify-between cursor-pointer mb-1 transition-all hover:brightness-95`} onClick={() => toggleGroup(g.tag)}>
                          <div className="flex items-center">
                            {isOpen ? <ChevronDown size={14} className="text-slate-500" /> : <ChevronRightIcon size={14} className="text-slate-500" />}
                            <div className={`${g.dotClass} w-2 h-2 rounded-full mx-2`} />
                            <span className="text-sm font-semibold text-slate-700">{g.label}</span>
                          </div>
                          <span className="text-sm text-slate-400">{groupItems.length}개원</span>
                        </div>
                      </td>
                    </tr>
                    {isOpen && groupItems.map((item, idx) => {
                const lastUpdate = item.deployed_at ?? item.approved_at ?? item.reviewed_at ?? null
                const pptxMatch = item.pptx_url?.match(/_(\d{4})(\d{2})\.pptx/)
                const yyyymm = pptxMatch ? `${pptxMatch[1]}년 ${pptxMatch[2]}월` : ''
                return (
                  <tr key={item.id} className={`border-b border-gray-50 hover:bg-emerald-50/30 cursor-pointer transition-colors ${idx % 2 === 1 ? 'bg-gray-50/40' : ''}`}>
                    <td className="px-4 py-3 font-medium text-[#1C2B1E]">
                      <span className="text-gray-400 text-xs mr-1.5">{item.sort_order ?? '—'}</span>
                      {item.branch_full_name ?? item.branch_name}
                    </td>
                    <td className="text-center px-3 py-3"><StatusBadge status={item.review_status} /></td>
                    <td className="text-center px-3 py-3 text-xs text-gray-400">
                      {lastUpdate ? formatKST(lastUpdate) : '-'}
                    </td>
                    <td className="text-center px-3 py-3">
                      {item.review_status === 'deployed' && item.pptx_url ? (
                        <a
                          href={`/api/download?url=${encodeURIComponent(item.pptx_url)}&filename=${encodeURIComponent(`${item.branch_name}_${yyyymm}.pptx`)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1.5 rounded-lg bg-[#E3F2FD] text-[#1565C0] text-xs font-bold hover:bg-[#BBDEFB] transition-colors"
                        >
                          PPTX
                        </a>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
                  </Fragment>
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
  const [localItems,   setLocalItems]   = useState<ReviewItem[]>([])
  useEffect(() => { setLocalItems(items) }, [items])
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

  const localStats: Stats = {
    total:               localItems.length,
    generation_complete: localItems.filter(i => i.review_status === 'generation_complete').length,
    correction_request:  localItems.filter(i => i.review_status === 'correction_request').length,
    resubmitted:         localItems.filter(i => i.review_status === 'resubmitted').length,
    approved:            localItems.filter(i => i.review_status === 'approved').length,
    deployed:            localItems.filter(i => i.review_status === 'deployed').length,
  }

  const patchLocalItem = useCallback((id: string, patch: Partial<ReviewItem>) => {
    setLocalItems(prev => prev.map(it => it.id === id ? { ...it, ...patch } : it))
  }, [])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch(`/api/diet-review?year=${year}&month=${month}`)
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 403) { router.push('/erp/diet'); return }
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
    window.history.replaceState(null, '', `?year=${y}&month=${m}`)
  }

  const filteredItems = search
    ? localItems.filter(i => i.branch_name.includes(search))
    : localItems

  const role       = currentAdmin?.role ?? ''
  const isManager  = ['super_admin', 'manager'].includes(role)
  const isNutri    = isNutritionist(role)
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
        {/* TEST MODE 배지 */}
        {process.env.NEXT_PUBLIC_EMAIL_TEST_MODE === 'true' && (
          <div className="flex items-center gap-2 px-4 py-2 bg-yellow-50 border border-yellow-300 rounded-xl text-yellow-800 text-xs font-semibold">
            <span>⚠️ TEST MODE 활성화됨 — 이메일이 실제 수신자 대신 테스트 주소로만 발송됩니다.</span>
          </div>
        )}
        {/* 공통 상단 */}
        <CommonHeader
          year={year} month={month} stats={localStats} search={search}
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
            items={filteredItems}
            year={year} month={month} role={role}
            adminId={currentAdmin!.id} adminName={currentAdmin!.name}
            showToast={showToast} onRefresh={fetchData}
            tab={managerTab} onTabChange={setManagerTab}
            patchItem={patchLocalItem}
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
