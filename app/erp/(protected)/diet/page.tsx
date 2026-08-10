'use client'

import { useState, useEffect, useCallback, useRef, Suspense, Fragment } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ChevronDown, ChevronRight as ChevronRightIcon,
  FileSpreadsheet, Download, Upload, Presentation,
  CircleCheck, Lock, Play,
  History, Building2, Printer, LoaderCircle, ArrowUp,
  Package, CircleX, Send, RefreshCw, ExternalLink,
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import DietNotificationPanel, { type DietNotification } from '@/components/board/DietNotificationPanel'
import BranchProfileAlert from '@/components/erp/BranchProfileAlert'
import { UPLOAD_ROLES, ROLES } from '@/lib/roles'
import { getYearOptions } from '@/lib/diet-utils'

// ── 상수 ──────────────────────────────────────────────────────────────
const SEPARATE_CONTRACT_CODES = new Set(['로티스', '잉글리쉬파크', '잉파', 'KIS', 'KPI', '송파MB'])
const MANUAL_PROCESS_CODES    = new Set(['덕양P'])
const JPG_ONLY_CODES          = new Set(['정발P'])
const PDF_JPG_CODES           = new Set(['엘란'])

// ── 그룹(프랜차이즈 계열) 정의 — branches/page.tsx와 동일 ───────────────
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

// ── 워크플로우 4단계 정의 (조각7-3b) ──────────────────────────────────
const WF_STEPS = [
  { key: 'prepare',  label: '양식 준비',   who: '전월 · 관리자', desc: '디자이너 양식으로 빈 폼 생성', Icon: FileSpreadsheet, brand: '#8B1E3F', cta: '양식 준비' },
  { key: 'download', label: '양식 받기',   who: '전월 · 영양사', desc: '빈 폼 엑셀 다운로드',          Icon: Download,        brand: '#8B1E3F', cta: '양식 받기' },
  { key: 'upload',   label: '엑셀 업로드', who: '전월 · 영양사', desc: '작성한 식단 엑셀 등록',        Icon: Upload,          brand: '#2D6A4F', cta: '엑셀 업로드' },
  { key: 'generate', label: 'PPTX 생성',  who: '전월 말',       desc: '49개 원 식단표 자동 생성',     Icon: Presentation,    brand: '#2D6A4F', cta: 'PPTX 생성' },
]

// ── 타입 ──────────────────────────────────────────────────────────────
type HubTab = 'workflow' | 'notifications'
type PptxGenStatus = 'idle' | 'waking' | 'generating' | 'done' | 'error'

type GenResult = {
  branch_id:   string | null
  branch_name: string
  pptx_url:    string
  pdf_url:     string
  status:      string
  error_msg:   string
}

type GenerationResults = {
  generated_at: string
  succeeded:    number
  failed:       number
  results:      GenResult[]
}

type ActionsProgress = {
  total:       number
  generated:   number
  error:       number
  generating:  number
  is_complete: boolean
}

type BranchMenuRow = {
  id:               string
  branch_id:        string
  pptx_url:         string | null
  pdf_url:          string | null
  status:           string
  short_code:       string | null
  display_name:     string | null
  deploy_email:     string | null
  sort_order:       number | null
  group_tag:        string | null
  branch_full_name: string | null
}

// ── 헬퍼 ──────────────────────────────────────────────────────────────
function formatGeneratedAt(iso: string) {
  try {
    const d = new Date(iso)
    return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
  } catch { return iso }
}

// ── 메인 컴포넌트 ──────────────────────────────────────────────────────
function DietAutomationContent() {
  const router       = useRouter()
  const searchParams = useSearchParams()

  const [tab,   setTab]   = useState<HubTab>('workflow')
  const [toast, setToast] = useState<string | null>(null)

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 4000)
  }, [])

  // ── 연/월 (URL 파라미터 또는 현재 날짜) ──────────────────────────────
  const now = new Date()
  const [pptxYear,    setPptxYear]    = useState(() => Number(searchParams.get('year'))  || now.getFullYear())
  const [pptxMonth,   setPptxMonth]   = useState(() => Number(searchParams.get('month')) || (now.getMonth() + 1))

  // ── 메뉴 row 상태 ─────────────────────────────────────────────────
  const [menuRowId,   setMenuRowId]   = useState<string | null>(null)
  const [menuStatus,  setMenuStatus]  = useState<string | null>(null)
  const [hasMenuData, setHasMenuData] = useState(false)

  // ── 워크플로우 stepper 상태 (조각7-2) ─────────────────────────────
  const [formExists,     setFormExists]     = useState<boolean | null>(null)  // ①양식준비: Storage 존재
  const [formDownloaded, setFormDownloaded] = useState<boolean | null>(null)  // ②양식받기: form_downloads 이력

  // ── PPTX 생성 상태 ────────────────────────────────────────────────
  const [genStatus,  setGenStatus]  = useState<PptxGenStatus>('idle')
  const [formGenStatus, setFormGenStatus] = useState<'idle'|'requesting'|'done'|'error'>('idle')
  const [downloadStatus, setDownloadStatus] = useState<'idle'|'downloading'|'error'>('idle')
  const [genError,   setGenError]   = useState<string | null>(null)
  const [genResults, setGenResults] = useState<GenerationResults | null>(null)

  const [actionsProgress, setActionsProgress] = useState<ActionsProgress | null>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const formPollingRef = useRef<ReturnType<typeof setInterval> | null>(null)  // 양식준비 폴링 (조각7-3a)
  const [formPolling, setFormPolling] = useState(false)  // 양식 생성 대기 중 여부

  // Actions 흐름 브랜치 결과
  const [branchMenuRows, setBranchMenuRows] = useState<BranchMenuRow[]>([])

  // ── 통계 ─────────────────────────────────────────────────────────
  const [totalActiveBranches, setTotalActiveBranches] = useState<number | null>(null)

  // ── 액션 상태 ─────────────────────────────────────────────────────
  const [downloadingZip, setDownloadingZip] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [deploying,      setDeploying]      = useState(false)
  const [sendingReview,  setSendingReview]  = useState(false)
  const [reviewSent,     setReviewSent]     = useState(false)
  const [compareIdx,     setCompareIdx]     = useState(0)

  // ── 알림 ─────────────────────────────────────────────────────────
  const [notifications,        setNotifications]        = useState<DietNotification[]>([])
  const [notificationsLoading, setNotificationsLoading] = useState(false)

  // ── 현재 사용자 역할 ───────────────────────────────────────────────
  const [userRole, setUserRole] = useState<string | null>(null)

  // ── 결과 테이블 그룹 아코디언 (초기 전부 펼침) ─────────────────────
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set())
  function toggleGroup(tag: string) {
    setOpenGroups(prev => { const n = new Set(prev); if (n.has(tag)) n.delete(tag); else n.add(tag); return n })
  }

  // ── DB 조회: 활성 계약원 수 ────────────────────────────────────────
  const fetchStats = useCallback(async () => {
    const supabase = createClient()
    const { count } = await supabase
      .from('branch_profiles')
      .select('*', { count: 'exact', head: true })
      .eq('contract_status', 'active')
    setTotalActiveBranches(count ?? 0)
  }, [])

  // ── DB 조회: 브랜치 weekly_menus rows (Actions 흐름) ────────────────
  const fetchBranchMenuRows = useCallback(async () => {
    const supabase = createClient()
    const [menuRes, profileRes] = await Promise.all([
      supabase
        .from('weekly_menus')
        .select('id, branch_id, pptx_url, pdf_url, status')
        .eq('year',      pptxYear)
        .eq('month',     pptxMonth)
        .eq('diet_type', 'CK')
        .not('branch_id', 'is', null),
      supabase
        .from('branch_profiles')
        .select('id, branch_id, short_code, display_name, distribution_email, sort_order, group_tag, branch_full_name')
        .eq('contract_status', 'active'),
    ])

    const profileMap = new Map<string, { short_code: string | null; display_name: string | null; distribution_email: string | null; sort_order: number | null; group_tag: string | null; branch_full_name: string | null }>(
      ((profileRes.data ?? []) as { id: string; branch_id: string; short_code: string | null; display_name: string | null; distribution_email: string | null; sort_order: number | null; group_tag: string | null; branch_full_name: string | null }[])
        .map(p => [p.id, { short_code: p.short_code, display_name: p.display_name, distribution_email: p.distribution_email, sort_order: p.sort_order, group_tag: p.group_tag, branch_full_name: p.branch_full_name }])
    )

    const rows: BranchMenuRow[] = ((menuRes.data ?? []) as { id: string; branch_id: string; pptx_url: string | null; pdf_url: string | null; status: string }[]).map(row => ({
      ...row,
      short_code:       profileMap.get(row.branch_id)?.short_code          ?? null,
      display_name:     profileMap.get(row.branch_id)?.display_name        ?? null,
      deploy_email:     profileMap.get(row.branch_id)?.distribution_email  ?? null,
      sort_order:       profileMap.get(row.branch_id)?.sort_order          ?? null,
      group_tag:        profileMap.get(row.branch_id)?.group_tag           ?? null,
      branch_full_name: profileMap.get(row.branch_id)?.branch_full_name    ?? null,
    }))

    // sort_order 전역 번호 기준 정렬 (값 없으면 맨 뒤)
    rows.sort((a, b) => (a.sort_order ?? 9999) - (b.sort_order ?? 9999))

    setBranchMenuRows(rows)
  }, [pptxYear, pptxMonth])

  // ── DB 조회: weekly_menus 공통 row ──────────────────────────────────
  const fetchMenuRow = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('weekly_menus')
      .select('id, status, menu_data, generation_results')
      .eq('year',      pptxYear)
      .eq('month',     pptxMonth)
      .eq('diet_type', 'CK')
      .is('branch_id', null)
      .maybeSingle()

    if (data) {
      setMenuRowId(data.id)
      setMenuStatus(data.status)
      setHasMenuData(!!data.menu_data)
      if (data.generation_results) {
        setGenResults(data.generation_results as GenerationResults)
        if (['generation_complete','review_requested','approved','deployed'].includes(data.status)) {
          setGenStatus('done')
        }
      } else {
        setGenResults(null)
        if (data.status !== 'generating') setGenStatus('idle')
      }
      if (data.status === 'generating') setGenStatus('generating')
      if (['review_requested','approved','deployed'].includes(data.status)) setReviewSent(true)
    } else {
      setMenuRowId(null)
      setMenuStatus(null)
      setHasMenuData(false)
      setGenResults(null)
      setGenStatus('idle')
      setReviewSent(false)
    }
  }, [pptxYear, pptxMonth])

  // ── 상태판정 ①: check-form API로 Storage 빈폼 존재 확인 (조각7-2) ──
  const fetchFormExists = useCallback(async () => {
    try {
      const res = await fetch(`/api/diet-automation/check-form?year=${pptxYear}&month=${pptxMonth}`)
      if (!res.ok) { setFormExists(false); return }
      const data = await res.json()
      setFormExists(!!data.exists)
    } catch {
      setFormExists(false)
    }
  }, [pptxYear, pptxMonth])

  // ── 상태판정 ②: form_downloads 이력으로 양식받기 완료 확인 (조각7-2) ──
  const fetchFormDownloaded = useCallback(async () => {
    const supabase = createClient()
    const { count } = await supabase
      .from('form_downloads')
      .select('id', { count: 'exact', head: true })
      .eq('year',  pptxYear)
      .eq('month', pptxMonth)
    setFormDownloaded((count ?? 0) > 0)
  }, [pptxYear, pptxMonth])

  useEffect(() => { fetchMenuRow() }, [fetchMenuRow])
  useEffect(() => { fetchStats()   }, [fetchStats])
  useEffect(() => { fetchFormExists()     }, [fetchFormExists])
  useEffect(() => { fetchFormDownloaded() }, [fetchFormDownloaded])
  // 마운트 및 연/월 변경 시 DB에서 브랜치 결과 로드 (페이지 재방문 복원)
  useEffect(() => { fetchBranchMenuRows() }, [fetchBranchMenuRows])

  // done 상태가 되면 브랜치 결과 rows 로드
  useEffect(() => {
    if (genStatus === 'done') fetchBranchMenuRows()
  }, [genStatus, fetchBranchMenuRows])

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('admins').select('role')
        .eq('auth_id', user.id).maybeSingle()
        .then(({ data }) => setUserRole(data?.role ?? ''))
    })
  }, [])

  // ── PPTX 생성 (GitHub Actions 트리거) ─────────────────────────────
  async function handleGenerate() {
    setGenStatus('generating')
    setGenError(null)
    setActionsProgress(null)
    setBranchMenuRows([])

    try {
      const res = await fetch('/api/pptx/trigger', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ year: pptxYear, month: pptxMonth }),
      })
      const data = await res.json()
      if (!res.ok) {
        setGenError(data.error || 'GitHub Actions 트리거 오류')
        setGenStatus('error')
      }
    } catch (err) {
      setGenError(String(err))
      setGenStatus('error')
    }
  }

  // ── 빈 폼 생성 (GitHub Actions 트리거) ─────────────────────────────
  async function handleGenerateForm() {
    setFormGenStatus('requesting')
    try {
      const res = await fetch('/api/diet-automation/trigger-form', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year: pptxYear, month: pptxMonth }),
      })
      const data = await res.json()
      if (!res.ok) {
        setFormGenStatus('error')
        alert(data.error || '빈 폼 생성 요청 실패')
      } else {
        setFormGenStatus('done')
        setFormPolling(true)   // 폴링 시작 → Storage에 파일 뜨면 자동으로 stepper 진행 (조각7-3a)
      }
    } catch (err) {
      setFormGenStatus('error')
      alert(String(err))
    }
  }

  // ── 빈폼(양식) 다운로드 ─────────────────────────────
  async function handleDownloadForm() {
    setDownloadStatus('downloading')
    try {
      const res = await fetch(`/api/diet-automation/download-form?year=${pptxYear}&month=${pptxMonth}`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setDownloadStatus('error')
        alert(data.error || '양식 다운로드에 실패했습니다')
        return
      }
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      // a.download 미지정 - 서버 Content-Disposition(한글명)에 일임
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      setDownloadStatus('idle')
      await fetchFormDownloaded()   // 받기 이력 즉시 반영 → stepper ②완료 처리 (조각7-3a)
    } catch (err) {
      setDownloadStatus('error')
      alert(String(err))
    }
  }

  // ── Actions 진행 폴링 (genStatus='generating' 동안 3초마다) ──────────
  useEffect(() => {
    if (genStatus !== 'generating') {
      if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null }
      return
    }

    const poll = async () => {
      try {
        const res = await fetch(`/api/pptx/actions-status?year=${pptxYear}&month=${pptxMonth}`)
        if (!res.ok) return
        const data: ActionsProgress = await res.json()
        setActionsProgress(data)
        if (data.is_complete) {
          setGenStatus('done')
          await fetchMenuRow()
          await fetchBranchMenuRows()
          showToast(`생성 완료! ${data.generated}개 성공${data.error > 0 ? `, ${data.error}개 실패` : ''} ✅`)
        }
      } catch { /* 폴링 오류 무시 */ }
    }

    poll()
    pollingRef.current = setInterval(poll, 3000)
    return () => { if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null } }
  }, [genStatus, pptxYear, pptxMonth, fetchMenuRow, fetchBranchMenuRows, showToast])

  // ── 양식준비 폴링 (formPolling 동안 3초마다, 최대 40초) — 조각7-3a ──
  useEffect(() => {
    if (!formPolling) {
      if (formPollingRef.current) { clearInterval(formPollingRef.current); formPollingRef.current = null }
      return
    }

    let elapsed = 0
    const MAX_MS = 40000   // 최대 40초 (gen_form.py 약 12초 소요 + 여유)

    const poll = async () => {
      elapsed += 3000
      await fetchFormExists()
      // formExists가 true로 바뀌면 아래 effect 재실행 → formPolling 해제됨
      if (elapsed >= MAX_MS) {
        setFormPolling(false)
        showToast('양식 준비가 예상보다 오래 걸립니다. 잠시 후 새로고침 해주세요.')
      }
    }

    formPollingRef.current = setInterval(poll, 3000)
    return () => { if (formPollingRef.current) { clearInterval(formPollingRef.current); formPollingRef.current = null } }
  }, [formPolling, fetchFormExists, showToast])

  // formExists가 true가 되면 폴링 종료 (조각7-3a)
  useEffect(() => {
    if (formExists === true && formPolling) {
      setFormPolling(false)
      showToast('양식 준비 완료! 이제 양식을 받을 수 있습니다 ✅')
    }
  }, [formExists, formPolling, showToast])

  // 연/월 바뀌면 진행 중이던 양식 폴링 중단 (조각7-3a)
  useEffect(() => {
    setFormPolling(false)
  }, [pptxYear, pptxMonth])

  // ── 재시도 (수정 금지) ─────────────────────────────────────────────
  async function handleRetry(_branchId: string | null, branchName: string) {
    showToast(`${branchName} 재생성 중...`)
    try {
      const res = await fetch('/api/pptx/generate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ weekly_menu_id: menuRowId }),
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(`재시도 실패: ${data.error}`)
      } else {
        showToast(`${branchName} 재생성 완료`)
        await fetchMenuRow()
      }
    } catch (err) {
      showToast(`재시도 오류: ${err}`)
    }
  }

  // ── 단일 원 메일 재발송 (확인 모달) ────────────────────────────────
  async function handleResendSingle(branchName: string) {
    if (!confirm(`${branchName}에만 식단표를 재발송하시겠습니까?`)) return
    showToast(`${branchName} 재발송은 준비 중입니다`)
  }

  // ── 이메일 배포 ────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async function handleDeploy() {
    if (!confirm(`${pptxYear}년 ${pptxMonth}월 식단표를 각 원 담당자 이메일로 발송합니다.\n계속하시겠습니까?`)) return
    setDeploying(true)
    try {
      const res = await fetch('/api/pptx/deploy', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ year: pptxYear, month: pptxMonth }),
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(`배포 오류: ${data.error}`)
      } else {
        showToast(`배포 완료! ${data.sent}개원 발송 성공${data.failed > 0 ? `, ${data.failed}개 실패` : ''}`)
        await fetchMenuRow()
      }
    } catch (err) {
      showToast(`배포 오류: ${err}`)
    } finally {
      setDeploying(false)
    }
  }

  // ── ZIP 다운로드 (genResults 또는 branchMenuRows) ─────────────────
  async function handleDownloadZip() {
    setDownloadingZip(true)
    try {
      let files: { branch_name: string; pptx_url?: string; pdf_url?: string }[] = []

      if (genResults) {
        files = genResults.results
          .filter(r => r.status === 'success')
          .map(r => ({
            branch_name: r.branch_name,
            pptx_url:    r.pptx_url || undefined,
            pdf_url:     r.pdf_url  || undefined,
          }))
      } else if (branchMenuRows.length > 0) {
        files = branchMenuRows
          .filter(r => r.pptx_url || r.pdf_url)
          .map(r => ({
            branch_name: r.short_code || r.branch_id.slice(0, 8),
            pptx_url:    r.pptx_url   || undefined,
            pdf_url:     r.pdf_url    || undefined,
          }))
      }

      if (!files.length) { showToast('다운로드할 파일이 없습니다'); return }

      const res = await fetch('/api/pptx/download-zip', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ files, year: pptxYear, month: pptxMonth }),
      })
      if (!res.ok) { showToast('ZIP 다운로드 실패'); return }
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `키즈밀_식단표_${pptxYear}_${pptxMonth}월.zip`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      showToast(`다운로드 오류: ${err}`)
    } finally {
      setDownloadingZip(false)
    }
  }

  // ── 검토 요청 ──────────────────────────────────────────────────────
  async function handleReviewRequest() {
    if (!menuRowId || reviewSent || sendingReview) return
    setSendingReview(true)
    try {
      const supabase = createClient()
      await supabase.from('weekly_menus').update({ status: 'review_requested' }).eq('id', menuRowId)
      await supabase.from('diet_notifications').insert({
        type:           'review_request',
        title:          `${pptxYear}년 ${pptxMonth}월 식단표 PPTX 검토 요청`,
        message:        `${pptxYear}년 ${pptxMonth}월 식단표 PPTX 검토를 요청합니다.`,
        recipient_role: 'manager',
        weekly_menu_id: menuRowId,
        year:           pptxYear,
        month:          pptxMonth,
      })
      setMenuStatus('review_requested')
      setReviewSent(true)
      showToast('권팀장님께 검토 요청을 보냈습니다 ✅')
    } catch (err) {
      showToast(`검토 요청 실패: ${err}`)
    } finally {
      setSendingReview(false)
    }
  }

  // ── 알림 ──────────────────────────────────────────────────────────
  async function fetchNotifications() {
    setNotificationsLoading(true)
    try {
      const supabase = createClient()
      const { data } = await supabase
        .from('diet_notifications')
        .select('id, type, title, message, branch_id, is_read, recipient_role, created_at')
        .order('created_at', { ascending: false })
        .limit(50)
      setNotifications((data ?? []) as DietNotification[])
    } finally {
      setNotificationsLoading(false)
    }
  }

  async function handleMarkRead(id: string) {
    const supabase = createClient()
    await supabase.from('diet_notifications').update({ is_read: true }).eq('id', id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
  }

  async function handleResetDemo() {
    if (!confirm('테스트 데이터를 초기화하시겠습니까?\n(이번 달 생성된 식단표 데이터가 삭제됩니다)')) return
    const res = await fetch('/api/pptx/reset-demo', { method: 'POST' })
    const data = await res.json()
    if (data.success) {
      setToast('🔧 초기화 완료. 페이지를 새로고침합니다.')
      setTimeout(() => window.location.reload(), 1500)
    } else {
      setToast('초기화 실패: ' + (data.error || '알 수 없는 오류'))
    }
  }

  // ── 결과 행 헬퍼 ──────────────────────────────────────────────────
  function getFileBadge(branchName: string) {
    if (MANUAL_PROCESS_CODES.has(branchName)) return { label: '수동처리', color: '#E65100', bg: '#FFF3E0' }
    if (JPG_ONLY_CODES.has(branchName))       return { label: 'JPG',      color: '#633806', bg: '#FAEEDA' }
    if (PDF_JPG_CODES.has(branchName))        return { label: 'PDF+JPG',  color: '#3C3489', bg: '#EEEDFE' }
    return { label: 'PDF', color: '#27500A', bg: '#EAF3DE' }
  }

  // ── 계산값 ───────────────────────────────────────────────────────
  const isGenerating = genStatus === 'waking' || genStatus === 'generating'

  const canActivateBottom =
    ['generated','review_requested','approved','deployed'].includes(menuStatus ?? '') &&
    (!!genResults || !!actionsProgress?.is_complete || branchMenuRows.length > 0)

  const generatedThisMonth =
    actionsProgress?.generated
    ?? genResults?.succeeded
    ?? branchMenuRows.filter(r => ['generation_complete','approved','deployed'].includes(r.status)).length

  const totalBranchCount = actionsProgress?.total ?? 49

  // 통합 결과 rows (genResults 우선, 없으면 branchMenuRows)
  // ⚠️ branchName은 배지/코드 판단용(변경 금지). displayName은 화면 표시 전용.
  const displayRows: { branchName: string; displayName: string; sortOrder: number|null; groupTag: string|null; pptxUrl: string|null; pdfUrl: string|null; status: string; errorMsg?: string; branchId?: string|null; deployEmail?: string|null; shortCode?: string|null }[] =
    genResults
      ? genResults.results.map(r => {
          const profileRow = branchMenuRows.find(b => b.branch_id === r.branch_id)
          return {
            branchName:  r.branch_name,
            displayName: profileRow?.branch_full_name ?? profileRow?.short_code ?? r.branch_name,
            sortOrder:   profileRow?.sort_order ?? null,
            groupTag:    profileRow?.group_tag  ?? null,
            pptxUrl:     r.pptx_url || null,
            pdfUrl:      r.pdf_url  || null,
            status:      r.status,
            errorMsg:    r.error_msg,
            branchId:    r.branch_id,
            deployEmail: null,
            shortCode:   r.branch_name,
          }
        }).sort((a, b) => (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999))
      : branchMenuRows.map(r => ({
          branchName:  r.short_code || r.branch_id.slice(0, 8),
          displayName: r.branch_full_name || r.short_code || r.branch_id.slice(0, 8),
          sortOrder:   r.sort_order,
          groupTag:    r.group_tag,
          pptxUrl:     r.pptx_url,
          pdfUrl:      r.pdf_url,
          status:      ['generation_complete','approved','deployed'].includes(r.status) ? 'success' : r.status,
          branchId:    r.branch_id,
          deployEmail: r.deploy_email,
          shortCode:   r.short_code,
        }))

  const compareRows = displayRows.filter(r => r.status === 'success')

  // 4단계 진행 현황
  const pptxDone = ['generated','review_requested','approved','deployed'].includes(menuStatus ?? '') || !!actionsProgress?.is_complete

  // 4단계 워크플로우 진행도 (앞 단계 done이어야 다음 active — 순서 강제) — 조각7-3b
  const wfProgress =
    !formExists     ? 0 :
    !formDownloaded ? 1 :
    !hasMenuData    ? 2 :
    !pptxDone       ? 3 :
                      4

  // 각 단계 active 시 실행할 액션 (조각7-3b)
  function handleWfStep(idx: number) {
    switch (idx) {
      case 0: return handleGenerateForm()
      case 1: return handleDownloadForm()
      case 2: return router.push('/board/admin/diet-automation/upload')
      case 3: return handleGenerate()
    }
  }

  return (
    <main className="min-h-screen bg-[#F6FAF6] px-4 sm:px-6 py-6 sm:py-8">

      <BranchProfileAlert />

      {/* ── 헤더 ──────────────────────────────────────────────────────── */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-2xl">🍱</span>
          <h1 className="text-xl sm:text-2xl font-bold text-[#1C2B1E]">식단표 자동화</h1>
        </div>
        <p className="text-sm text-gray-500 ml-9">
          입력 → 검토 → 승인 → PPTX 생성 → 배포 전 과정을 한 곳에서 관리합니다
        </p>
      </div>

      {/* ── 통계 카드 4개 (실제 DB 연동) ──────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        {/* 활성 계약원 */}
        <div className="rounded-2xl p-5 flex flex-col gap-1" style={{ background: '#F6FAF6', border: '1px solid #B7E4C7' }}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-gray-500">활성 계약원</span>
            <span className="text-lg leading-none">🏫</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-[#2D6A4F]">
              {totalActiveBranches === null ? '—' : totalActiveBranches}
            </span>
            <span className="text-sm font-medium text-[#2D6A4F]">개</span>
          </div>
          <span className="text-[11px] text-gray-400">contract_status = active</span>
        </div>

        {/* 이번달 생성 완료 */}
        <div className="rounded-2xl p-5 flex flex-col gap-1" style={{ background: '#E3F2FD', border: '1px solid #BBDEFB' }}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-gray-500">이번달 생성</span>
            <span className="text-lg leading-none">🖨️</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-[#1565C0]">{generatedThisMonth}</span>
            <span className="text-sm font-medium text-[#1565C0]">/ {totalBranchCount}개</span>
          </div>
          <span className="text-[11px] text-gray-400">{pptxYear}년 {pptxMonth}월</span>
        </div>

        {/* 검토·승인 상태 */}
        <div className="rounded-2xl p-5 flex flex-col gap-1" style={{ background: '#FFF3E0', border: '1px solid #FFE0B2' }}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-gray-500">검토·승인</span>
            <span className="text-lg leading-none">👀</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-[#E65100]">
              {menuStatus === 'approved' ? '승인' : menuStatus === 'review_requested' ? '검토중' : '—'}
            </span>
          </div>
          <span className="text-[11px] text-gray-400">
            {menuStatus === 'correction_requested' ? '수정 요청됨' : `이번달 상태`}
          </span>
        </div>

        {/* 배포 상태 */}
        <div className="rounded-2xl p-5 flex flex-col gap-1" style={{ background: menuStatus === 'deployed' ? '#E8F5E9' : '#F5F5F5', border: `1px solid ${menuStatus === 'deployed' ? '#A5D6A7' : '#E0E0E0'}` }}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-gray-500">배포</span>
            <span className="text-lg leading-none">🚀</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold" style={{ color: menuStatus === 'deployed' ? '#2D6A4F' : '#9E9E9E' }}>
              {menuStatus === 'deployed' ? '완료' : '대기'}
            </span>
          </div>
          <span className="text-[11px] text-gray-400">{pptxYear}년 {pptxMonth}월</span>
        </div>
      </div>

      {/* ── 탭 바 ─────────────────────────────────────────────────────── */}
      <div className="flex gap-1 mb-6 bg-white rounded-2xl p-1 border border-gray-100 w-fit shadow-sm">
        {([
          { key: 'workflow',      label: '워크플로우', icon: '📋' },
          { key: 'notifications', label: '알림',       icon: '🔔' },
        ] as { key: HubTab; label: string; icon: string }[]).map(t => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              tab === t.key
                ? 'bg-[#2D6A4F] text-white shadow-sm'
                : 'text-gray-500 hover:text-[#2D6A4F] hover:bg-[#F6FAF6]'
            }`}
          >
            <span className="text-base leading-none">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── 탭 콘텐츠 ─────────────────────────────────────────────────── */}
      {tab === 'workflow' && (
        <div>

          {/* ── 식단표 준비 워크플로우 stepper (조각7-3b) ─────────────── */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6 shadow-sm">

            {/* 헤더 */}
            <div className="flex items-start justify-between gap-3 mb-1">
              <div>
                <div className="flex items-center gap-2">
                  <FileSpreadsheet size={18} className="text-[#2D6A4F]" />
                  <span className="text-[15px] font-semibold text-[#1C2B1E]">식단표 준비 워크플로우</span>
                </div>
                <p className="text-xs text-gray-500 mt-1.5 ml-7">
                  {pptxYear}년 <b className="text-[#8B1E3F] font-semibold">{pptxMonth}월분</b> · 전월에 미리 준비합니다
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <select
                  value={pptxYear}
                  onChange={e => setPptxYear(Number(e.target.value))}
                  disabled={isGenerating}
                  className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-gray-700 bg-white focus:outline-none focus:border-[#2D6A4F] disabled:opacity-50"
                >
                  {getYearOptions(pptxYear).map(y => <option key={y} value={y}>{y}년</option>)}
                </select>
                <select
                  value={pptxMonth}
                  onChange={e => setPptxMonth(Number(e.target.value))}
                  disabled={isGenerating}
                  className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-gray-700 bg-white focus:outline-none focus:border-[#2D6A4F] disabled:opacity-50"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m}>{m}월</option>)}
                </select>
              </div>
            </div>

            {/* 범례 */}
            <div className="flex items-center gap-3.5 mt-3 mb-5 ml-7">
              <span className="inline-flex items-center gap-1.5 text-[11px] text-gray-500"><CircleCheck size={13} className="text-[#2D6A4F]" /> 완료</span>
              <span className="inline-flex items-center gap-1.5 text-[11px] text-gray-500"><span className="w-2 h-2 rounded-full bg-[#185FA5]" /> 진행 중</span>
              <span className="inline-flex items-center gap-1.5 text-[11px] text-gray-500"><Lock size={13} className="text-gray-400" /> 대기</span>
            </div>

            {/* 진행 라인 + 노드 */}
            <div className="relative mb-4">
              <div className="absolute top-4 left-[12.5%] right-[12.5%] h-[3px] bg-gray-200 rounded-full" />
              <div className="absolute top-4 left-[12.5%] h-[3px] bg-[#2D6A4F] rounded-full transition-all duration-500" style={{ width: `${Math.max(0, wfProgress - 1) * 25}%` }} />
              <div className="grid grid-cols-4 relative">
                {WF_STEPS.map((_, i) => {
                  const stepNo = i + 1
                  const done   = stepNo <= wfProgress
                  const active = stepNo === wfProgress + 1
                  return (
                    <div key={i} className="flex justify-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-semibold border-2 transition-all ${done ? 'bg-[#2D6A4F] border-[#2D6A4F] text-white' : active ? 'bg-white border-[#185FA5] text-[#185FA5]' : 'bg-white border-gray-300 text-gray-400'}`}>
                        {done ? <CircleCheck size={16} /> : stepNo}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* 4단계 카드 */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {WF_STEPS.map((step, i) => {
                const stepNo   = i + 1
                const done     = stepNo <= wfProgress
                const active   = stepNo === wfProgress + 1
                const locked   = stepNo > wfProgress + 1
                const Icon     = step.Icon
                const canClick = !!(userRole && UPLOAD_ROLES.includes(userRole))
                const busy =
                  (i === 0 && formPolling) ||
                  (i === 1 && downloadStatus === 'downloading') ||
                  (i === 3 && isGenerating)
                return (
                  <div key={step.key} className={`rounded-xl p-3.5 border-[1.5px] flex flex-col gap-2 min-h-[168px] transition-all ${done ? 'bg-[#E8F5E9] border-[#A5D6A7]' : active ? 'bg-white border-[#185FA5] ring-4 ring-[#E6F1FB]' : 'bg-gray-50 border-gray-100'}`}>
                    <div className="flex items-center justify-between">
                      <Icon size={22} className={done ? 'text-[#2D6A4F]' : !active ? 'text-gray-400' : ''} style={active ? { color: step.brand } : undefined} />
                      {done ? <CircleCheck size={17} className="text-[#2D6A4F]" /> : active ? <Play size={17} className="text-[#185FA5]" /> : <Lock size={17} className="text-gray-400" />}
                    </div>
                    <div>
                      <p className="text-[13.5px] font-semibold text-[#1C2B1E]">{step.label}</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">{step.who}</p>
                    </div>
                    <p className={`text-[11px] ${done ? 'text-[#3B6D11]' : active ? 'text-gray-500' : 'text-gray-400'}`}>{step.desc}</p>
                    <div className="mt-auto">
                      <p className={`text-[11px] font-semibold mb-2 ${done ? 'text-[#2D6A4F]' : active ? 'text-[#185FA5]' : 'text-gray-400'}`}>
                        {busy ? '진행 중...' : done ? '완료' : active ? '지금 진행하세요' : '대기 중'}
                      </p>
                      <button
                        type="button"
                        onClick={() => handleWfStep(i)}
                        disabled={locked || busy || !canClick}
                        aria-label={`${step.label} ${done ? '다시 실행' : '실행'}`}
                        className={`w-full py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:cursor-not-allowed ${done ? 'bg-transparent border border-[#A5D6A7] text-[#2D6A4F] hover:bg-[#E8F5E9]' : active ? 'text-white' : 'bg-gray-100 text-gray-400'}`}
                        style={active && !busy ? { backgroundColor: step.brand } : undefined}
                      >
                        {busy ? '진행 중...' : done ? '다시' : step.cta}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── 빠른 이동 링크 (조각7-3d) ─────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
            <Link
              href="/board/admin/diet-automation/history"
              className="group flex items-center gap-3 px-4 py-3 rounded-xl bg-white border border-gray-200 hover:border-[#2D6A4F] transition-colors shadow-sm"
            >
              <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-[#F6FAF6] text-[#2D6A4F] shrink-0">
                <History size={18} />
              </span>
              <div className="text-left flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#1C2B1E]">배포 이력</p>
                <p className="text-[11px] text-gray-400">지난 배포 기록 보기</p>
              </div>
              <ChevronRightIcon size={16} className="text-gray-300 group-hover:text-[#2D6A4F] transition-colors shrink-0" />
            </Link>
            <Link
              href="/board/admin/diet/branch-profile"
              className="group flex items-center gap-3 px-4 py-3 rounded-xl bg-white border border-gray-200 hover:border-[#2D6A4F] transition-colors shadow-sm"
            >
              <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-[#F6FAF6] text-[#2D6A4F] shrink-0">
                <Building2 size={18} />
              </span>
              <div className="text-left flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#1C2B1E]">원 프로파일 설정</p>
                <p className="text-[11px] text-gray-400">원별 정보·형식 관리</p>
              </div>
              <ChevronRightIcon size={16} className="text-gray-300 group-hover:text-[#2D6A4F] transition-colors shrink-0" />
            </Link>
          </div>

          {/* ════════════════════════════════════════════════════════════ */}
          {/* PPTX 자동생성 섹션                                          */}
          {/* ════════════════════════════════════════════════════════════ */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Printer size={18} className="text-[#2D6A4F]" />
              <h2 className="text-sm font-bold text-[#1C2B1E]">식단표 생성 결과</h2>
            </div>

            {/* 상태 표시 */}
            <div className="mb-4">
              {genStatus === 'idle' && (
                <div className="bg-gray-50 rounded-2xl border border-gray-100 p-5 flex items-center justify-center gap-2">
                  <ArrowUp size={16} className="text-gray-400" />
                  <p className="text-sm text-gray-400">위 <b className="font-semibold text-gray-500">④ PPTX 생성</b> 단계에서 생성을 시작하세요</p>
                </div>
              )}

              {genStatus === 'waking' && (
                <div className="bg-orange-50 rounded-2xl border border-orange-200 p-5 flex items-center gap-3">
                  <LoaderCircle size={20} className="animate-spin text-orange-500" />
                  <div>
                    <p className="text-sm font-bold text-orange-700">GitHub Actions 실행 준비 중...</p>
                    <p className="text-xs text-orange-600 mt-0.5">잠시 후 자동으로 진행됩니다</p>
                  </div>
                </div>
              )}

              {genStatus === 'generating' && (
                <div className="bg-blue-50 rounded-2xl border border-blue-200 p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <LoaderCircle size={20} className="animate-spin text-blue-500" />
                    <div>
                      <p className="text-sm font-bold text-blue-700">
                        GitHub Actions PPTX 생성 중
                        {actionsProgress
                          ? ` — ${actionsProgress.generated + actionsProgress.error} / ${actionsProgress.total}`
                          : '...'}
                      </p>
                      <p className="text-xs text-blue-600 mt-0.5">
                        5~10분 소요됩니다. 페이지를 새로고침해도 현황이 복원됩니다.
                      </p>
                    </div>
                  </div>
                  {actionsProgress && (
                    <div>
                      <div className="flex justify-between text-[11px] text-blue-600 mb-1">
                        <span>진행: {actionsProgress.generated}개 완료{actionsProgress.error > 0 ? `, ${actionsProgress.error}개 실패` : ''}</span>
                        <span>{actionsProgress.total}개 전체</span>
                      </div>
                      <div className="h-2 bg-blue-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full transition-all duration-500"
                          style={{ width: `${Math.round(((actionsProgress.generated + actionsProgress.error) / actionsProgress.total) * 100)}%` }}
                        />
                      </div>
                      {actionsProgress.error > 0 && (
                        <p className="text-[11px] text-red-500 mt-1">{actionsProgress.error}개 원 오류</p>
                      )}
                      <a
                        href="https://github.com/yuher826/kizmeal-renewal/actions"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-500 hover:underline mt-2 inline-block"
                      >
                        <span className="inline-flex items-center gap-1"><ExternalLink size={13} /> GitHub Actions에서 실행 중</span>
                      </a>
                    </div>
                  )}
                </div>
              )}

              {genStatus === 'done' && (
                <div className="bg-green-50 rounded-2xl border border-green-200 p-5 flex items-center gap-3">
                  <CircleCheck size={22} className="text-green-600" />
                  <div>
                    {genResults ? (
                      <>
                        <p className="text-sm font-bold text-green-700">
                          완료! 성공 {genResults.succeeded}개 / 실패 {genResults.failed}개
                        </p>
                        <p className="text-xs text-green-600 mt-0.5">{formatGeneratedAt(genResults.generated_at)} 생성</p>
                      </>
                    ) : actionsProgress ? (
                      <>
                        <p className="text-sm font-bold text-green-700">
                          {actionsProgress.generated}개 완료!{actionsProgress.error > 0 ? ` (${actionsProgress.error}개 오류)` : ''}
                        </p>
                        <p className="text-xs text-green-600 mt-0.5">GitHub Actions 생성 완료</p>
                      </>
                    ) : (
                      <p className="text-sm font-bold text-green-700">생성 완료</p>
                    )}
                  </div>
                </div>
              )}

              {genStatus === 'error' && (
                <div className="bg-red-50 rounded-2xl border border-red-200 p-5 flex items-start gap-3">
                  <span className="text-xl">🔴</span>
                  <div>
                    <p className="text-sm font-bold text-red-700">생성 오류</p>
                    <p className="text-xs text-red-600 mt-0.5 break-all">{genError}</p>
                  </div>
                </div>
              )}
            </div>

            {/* 결과 테이블 */}
            {displayRows.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-4 shadow-sm">
                {/* 테이블 헤더 */}
                <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-medium text-[#1C2B1E]">생성 결과</span>
                    <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">{displayRows.length}개원</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {GROUPS.map(g => g.tag).every(t => openGroups.has(t)) ? (
                      <button onClick={() => setOpenGroups(new Set())} className="border border-slate-200 text-slate-600 rounded-lg px-3 py-1.5 text-sm hover:bg-slate-50 transition-colors">전체 접기</button>
                    ) : (
                      <button onClick={() => setOpenGroups(new Set(GROUPS.map(g => g.tag)))} className="border border-slate-200 text-slate-600 rounded-lg px-3 py-1.5 text-sm hover:bg-slate-50 transition-colors">전체 펼치기</button>
                    )}
                    <button
                      type="button"
                      onClick={handleDownloadZip}
                      disabled={downloadingZip}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:border-[#2D6A4F] hover:text-[#2D6A4F] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {downloadingZip ? <LoaderCircle size={14} className="animate-spin" /> : <Package size={14} />} 전체 ZIP
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" style={{ tableLayout: 'fixed' }}>
                    <colgroup>
                      <col style={{ width: 40 }} />
                      <col style={{ width: 160 }} />
                      <col style={{ width: 80 }} />
                      <col style={{ width: 90 }} />
                      <col style={{ width: 70 }} />
                      <col style={{ width: 170 }} />
                      <col style={{ width: 130 }} />
                      <col style={{ width: 80 }} />
                    </colgroup>
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="text-center px-3 py-3 font-semibold text-gray-400 text-xs">#</th>
                        <th className="text-left   px-3 py-3 font-semibold text-gray-400 text-xs">원명</th>
                        <th className="text-center px-3 py-3 font-semibold text-gray-400 text-xs">구분</th>
                        <th className="text-center px-3 py-3 font-semibold text-gray-400 text-xs">파일형식</th>
                        <th className="text-center px-3 py-3 font-semibold text-gray-400 text-xs">상태</th>
                        <th className="text-left   px-3 py-3 font-semibold text-gray-400 text-xs">배포이메일</th>
                        <th className="text-center px-3 py-3 font-semibold text-gray-400 text-xs">다운로드</th>
                        <th className="text-center px-3 py-3 font-semibold text-gray-400 text-xs">개별메일</th>
                      </tr>
                    </thead>
                    <tbody>
                      {GROUPS.map(g => {
                        const groupRows = displayRows.filter(r => normalizeGroup(r.groupTag) === g.tag)
                        if (groupRows.length === 0) return null
                        const isOpen = openGroups.has(g.tag)
                        return (
                          <Fragment key={g.tag}>
                            {/* 그룹 헤더 행 (branches/page.tsx와 동일 디자인) */}
                            <tr>
                              <td colSpan={8} className="p-0 border-0">
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
                                  <span className="text-sm text-slate-400">{groupRows.length}개원</span>
                                </div>
                              </td>
                            </tr>
                            {isOpen && groupRows.map((row, idx) => {
                        const badge     = getFileBadge(row.branchName)
                        const isManual  = MANUAL_PROCESS_CODES.has(row.branchName)
                        const isSep     = SEPARATE_CONTRACT_CODES.has(row.branchName)
                        const isSuccess = row.status === 'success' || ['generation_complete','approved','deployed'].includes(row.status)
                        const isError   = row.status === 'error'
                        const isProc    = !isSuccess && !isError
                        const canSendMail = isSuccess && !!row.deployEmail &&
                          (menuStatus === 'approved' || menuStatus === 'deployed')
                        const mailLabel = menuStatus === 'deployed' ? '재발송' : '발송'

                        return (
                          <tr
                            key={`${g.tag}-${row.branchName}-${idx}`}
                            className={`border-b border-gray-50 transition-colors hover:bg-[#DCF0E8] ${
                              isError ? 'bg-[#FEF2F2]'
                              : isProc ? 'bg-[#EFF6FF]'
                              : idx % 2 === 0 ? 'bg-white' : 'bg-[#F0F7F4]'
                            }`}
                          >
                            {/* 번호 (sort_order 전역 번호) */}
                            <td className="text-center px-3 py-[14px] text-xs text-gray-400">{row.sortOrder ?? '—'}</td>

                            {/* 원명 + 부가정보 */}
                            <td className="px-3 py-[14px]">
                              <p className="text-[15px] font-medium text-[#1C2B1E] truncate">{row.displayName}</p>
                              {row.deployEmail ? (
                                <p className="text-xs text-gray-400 truncate mt-0.5">{row.deployEmail}</p>
                              ) : row.branchId ? (
                                <Link
                                  href={`/board/admin/diet/branch-profile/${row.branchId}`}
                                  className="text-xs text-red-400 hover:underline mt-0.5 inline-block"
                                >
                                  이메일 미설정 →
                                </Link>
                              ) : (
                                <p className="text-xs text-red-400 mt-0.5">이메일 미설정</p>
                              )}
                            </td>

                            {/* 구분 */}
                            <td className="text-center px-3 py-[14px]">
                              <span
                                className="inline-block rounded-full px-2 py-0.5 text-xs font-medium"
                                style={isSep
                                  ? { color: '#444441', background: '#F1EFE8' }
                                  : { color: '#0C447C', background: '#E6F1FB' }}
                              >
                                {isSep ? '별도계약' : 'CK'}
                              </span>
                            </td>

                            {/* 파일형식 */}
                            <td className="text-center px-3 py-[14px]">
                              <span
                                className="inline-block rounded-full px-2 py-0.5 text-xs font-medium"
                                style={{ color: badge.color, background: badge.bg }}
                              >
                                {badge.label}
                              </span>
                            </td>

                            {/* 상태 */}
                            <td className="text-center px-3 py-[14px]">
                              {isSuccess ? (
                                <span className="inline-flex items-center gap-1 text-green-600 font-medium text-xs"><CircleCheck size={13} /> 성공</span>
                              ) : isError ? (
                                <span className="inline-flex items-center gap-1 text-red-600 text-xs cursor-help" title={row.errorMsg}><CircleX size={13} /> 실패</span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-blue-600 text-xs">
                                  <span className="w-3 h-3 border border-blue-400 border-t-transparent rounded-full animate-spin" />
                                  생성중
                                </span>
                              )}
                            </td>

                            {/* 배포이메일 */}
                            <td className="px-3 py-[14px]">
                              {row.deployEmail ? (
                                <span className="text-xs text-gray-500 truncate block">{row.deployEmail}</span>
                              ) : row.branchId ? (
                                <Link
                                  href={`/board/admin/diet/branch-profile/${row.branchId}`}
                                  className="inline-flex items-center gap-1 text-xs text-red-500 hover:underline"
                                  title="원 프로파일에서 이메일을 설정해주세요"
                                >
                                  ⚠ 미설정
                                </Link>
                              ) : (
                                <span className="text-xs text-red-400">⚠ 미설정</span>
                              )}
                            </td>

                            {/* 다운로드 */}
                            <td className="text-center px-3 py-[14px]">
                              {isManual ? (
                                <span className="text-gray-300">—</span>
                              ) : (
                                <div className="flex items-center justify-center gap-1 flex-wrap">
                                  {row.pptxUrl ? (
                                    <a
                                      href={`/api/download?url=${encodeURIComponent(row.pptxUrl)}&filename=${encodeURIComponent(`${row.displayName}_${pptxYear}${String(pptxMonth).padStart(2, '0')}.pptx`)}`}
                                      className="px-2 py-1 rounded text-[10px] font-medium transition-colors"
                                      style={{ color: '#0C447C', background: '#E6F1FB' }}
                                    >
                                      PPTX
                                    </a>
                                  ) : (
                                    <span className="px-2 py-1 rounded text-[10px] font-medium text-gray-300 bg-gray-50 cursor-not-allowed">PPTX</span>
                                  )}
                                  {row.pdfUrl ? (
                                    <a
                                      href={row.pdfUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="px-2 py-1 rounded text-[10px] font-medium transition-colors"
                                      style={{ color: '#27500A', background: '#EAF3DE' }}
                                    >
                                      PDF
                                    </a>
                                  ) : (
                                    <span className="px-2 py-1 rounded text-[10px] font-medium text-gray-300 bg-gray-50 cursor-not-allowed">PDF</span>
                                  )}
                                </div>
                              )}
                            </td>

                            {/* 개별메일 */}
                            <td className="text-center px-3 py-[14px]">
                              {isManual ? (
                                <span className="text-gray-300">—</span>
                              ) : canSendMail ? (
                                <button
                                  type="button"
                                  onClick={() => handleResendSingle(row.branchName)}
                                  title="이 원에만 개별 발송합니다"
                                  className="px-2.5 py-1.5 rounded-lg bg-[#2D6A4F] text-white text-[10px] font-medium hover:bg-[#1B4332] transition-colors"
                                >
                                  {mailLabel}
                                </button>
                              ) : isError ? (
                                <button
                                  type="button"
                                  onClick={() => handleRetry(row.branchId ?? null, row.branchName)}
                                  className="px-2.5 py-1.5 rounded-lg bg-amber-100 text-amber-700 text-[10px] font-medium hover:bg-amber-200 transition-colors"
                                >
                                  재시도
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  disabled
                                  title={!row.deployEmail ? '원 프로파일에서 이메일을 먼저 설정해주세요' : ''}
                                  className="px-2.5 py-1.5 rounded-lg bg-gray-100 text-gray-300 text-[10px] font-medium opacity-40 cursor-not-allowed"
                                >
                                  {mailLabel}
                                </button>
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
              </div>
            )}

            {/* 원본 vs 생성본 비교 다운로드 */}
            {canActivateBottom && compareRows.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-4 shadow-sm">
                <div className="mb-4">
                  <p className="text-sm font-bold text-[#1C2B1E]">원본 vs 생성본 비교 다운로드</p>
                  <p className="text-xs text-gray-400 mt-1">원본 템플릿과 생성본을 나란히 다운로드해서 비교 확인해주세요</p>
                </div>

                {/* 원 선택 드롭다운 */}
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-xs text-gray-500">원 선택</span>
                  <select
                    value={compareIdx}
                    onChange={e => setCompareIdx(Number(e.target.value))}
                    className="border border-gray-200 rounded-xl px-3 py-1.5 text-sm bg-white focus:outline-none focus:border-[#2D6A4F]"
                  >
                    {compareRows.map((row, i) => (
                      <option key={i} value={i}>{row.branchName}</option>
                    ))}
                  </select>
                  {compareRows.length > 1 && (
                    <div className="flex items-center gap-1 ml-auto">
                      <button
                        type="button"
                        onClick={() => setCompareIdx(i => (i - 1 + compareRows.length) % compareRows.length)}
                        className="px-2.5 py-1.5 rounded-lg bg-gray-100 text-gray-500 text-xs font-medium hover:bg-gray-200 transition-colors"
                      >← 이전</button>
                      <span className="text-xs text-gray-400 px-1">{compareIdx + 1}/{compareRows.length}</span>
                      <button
                        type="button"
                        onClick={() => setCompareIdx(i => (i + 1) % compareRows.length)}
                        className="px-2.5 py-1.5 rounded-lg bg-gray-100 text-gray-500 text-xs font-medium hover:bg-gray-200 transition-colors"
                      >다음 →</button>
                    </div>
                  )}
                </div>

                {compareRows[compareIdx] && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* 원본 템플릿 카드 */}
                    <div className="border border-gray-200 rounded-xl p-4">
                      <p className="text-xs font-bold text-gray-600 mb-1">📁 원본 템플릿</p>
                      <p className="text-xs text-gray-400 mb-3">디자이너가 제작한 원본 파일이에요</p>
                      <a
                        href={`https://raw.githubusercontent.com/yuher826/kizmeal-renewal/master/pptx-server/templates/${compareRows[compareIdx].shortCode ?? compareRows[compareIdx].branchName}.pptx`}
                        download
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gray-100 text-gray-700 text-xs font-semibold hover:bg-gray-200 transition-colors"
                      >
                        ⬇ 원본 템플릿 다운로드
                      </a>
                    </div>

                    {/* 자동 생성본 카드 */}
                    <div className="border border-[#B7E4C7] bg-[#F6FAF6] rounded-xl p-4">
                      <p className="text-xs font-bold text-[#2D6A4F] mb-1">✨ 자동 생성본</p>
                      <p className="text-xs text-gray-400 mb-3">자동 생성된 결과물이에요</p>
                      <div className="flex flex-wrap gap-2">
                        {compareRows[compareIdx].pptxUrl ? (
                          <a
                            href={compareRows[compareIdx].pptxUrl!}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#2D6A4F] text-white text-xs font-semibold hover:bg-[#1B4332] transition-colors"
                          >
                            ⬇ PPTX 다운로드
                          </a>
                        ) : (
                          <span className="text-xs text-gray-400">PPTX 없음</span>
                        )}
                        {compareRows[compareIdx].pdfUrl && (
                          <a
                            href={compareRows[compareIdx].pdfUrl!}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1565C0] text-white text-xs font-semibold hover:bg-[#0D47A1] transition-colors"
                          >
                            ⬇ PDF 다운로드
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 하단 액션바 */}
            {canActivateBottom && (
              <div className="bg-white rounded-2xl border border-gray-100 p-5 flex flex-wrap items-center justify-between gap-4 shadow-sm">
                {/* 왼쪽: 상황별 안내 문구 */}
                <p className="text-sm text-gray-500">
                  {menuStatus === 'generated' && '검토 요청 후 승인되면 이메일 배포가 가능해요'}
                  {menuStatus === 'correction_requested' && '수정 요청이 있습니다. 확인 후 재생성해주세요'}
                  {menuStatus === 'review_requested' && '검토 진행 중입니다. 승인을 기다려주세요 ⏳'}
                  {menuStatus === 'approved' && `승인 완료! 이제 ${totalActiveBranches ?? 49}개원에 이메일을 배포할 수 있어요 🎉`}
                  {menuStatus === 'deployed' && '배포 완료! 필요시 개별 원에 재발송할 수 있어요 ✅'}
                </p>

                {/* 오른쪽: 상황별 버튼 */}
                <div className="flex items-center gap-2 flex-wrap">
                  {/* 검토 요청 */}
                  {['generated','correction_requested'].includes(menuStatus ?? '') && (
                    <button
                      type="button"
                      onClick={handleReviewRequest}
                      disabled={reviewSent || sendingReview}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#2D6A4F] text-white text-sm font-semibold hover:bg-[#1B4332] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {sendingReview ? <span className="inline-flex items-center gap-1"><LoaderCircle size={14} className="animate-spin" /> 전송 중...</span> : reviewSent ? <span className="inline-flex items-center gap-1"><CircleCheck size={14} /> 검토 요청 완료</span> : <span className="inline-flex items-center gap-1"><Send size={14} /> 검토 요청</span>}
                    </button>
                  )}

                  {/* 검토 페이지 이동 */}
                  {menuStatus === 'review_requested' && (
                    <Link
                      href={`/erp/review?year=${pptxYear}&month=${pptxMonth}`}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-orange-300 text-orange-700 text-sm font-semibold hover:bg-orange-50 transition-colors"
                    >
                      👀 검토 페이지로 이동
                    </Link>
                  )}

                  {/* 승인 완료: 일괄 발송 */}
                  {menuStatus === 'approved' && (
                    <button
                      type="button"
                      onClick={() => showToast('🚧 이메일 배포 기능 준비 중입니다. 곧 제공될 예정이에요!')}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-[#2D6A4F] text-[#2D6A4F] text-sm font-semibold hover:bg-[#F6FAF6] transition-colors"
                    >
                      📧 {totalActiveBranches ?? 49}개원 일괄 발송
                    </button>
                  )}

                  {/* 배포 완료: 전체 재발송 */}
                  {menuStatus === 'deployed' && (
                    <button
                      type="button"
                      onClick={() => showToast('🚧 이메일 배포 기능 준비 중입니다. 곧 제공될 예정이에요!')}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-gray-300 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition-colors"
                    >
                      <span className="inline-flex items-center gap-1"><RefreshCw size={14} /> 전체 재발송</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
          {/* ═══════════════ PPTX 자동생성 섹션 끝 ═══════════════ */}
        </div>
      )}

      {tab === 'notifications' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-[#1C2B1E]">알림 센터</h2>
            <button
              type="button"
              onClick={fetchNotifications}
              disabled={notificationsLoading}
              className="text-xs text-gray-400 hover:text-[#2D6A4F] transition-colors disabled:opacity-40"
            >
              {notificationsLoading ? '로딩 중...' : '↻ 새로고침'}
            </button>
          </div>
          {notifications.length === 0 && !notificationsLoading ? (
            <div className="flex flex-col items-center py-8">
              <button
                type="button"
                onClick={fetchNotifications}
                className="px-5 py-2.5 rounded-xl bg-[#F6FAF6] border border-[#B7E4C7] text-sm font-medium text-[#2D6A4F] hover:bg-[#E8F5E9] transition-colors mb-2"
              >
                알림 불러오기
              </button>
              <p className="text-xs text-gray-400">식단 관련 알림이 여기 표시됩니다</p>
            </div>
          ) : (
            <DietNotificationPanel
              notifications={notifications}
              onMarkRead={handleMarkRead}
            />
          )}
        </div>
      )}

      {/* ── 테스트 초기화 (super_admin 전용) ───────────────────────────── */}
      {userRole === ROLES.SUPER_ADMIN && (
        <div className="flex justify-center pb-6">
          <button
            type="button"
            onClick={handleResetDemo}
            className="text-xs text-gray-300 hover:text-gray-400 transition-colors"
          >
            🔧 테스트 초기화
          </button>
        </div>
      )}

      {/* ── 토스트 ───────────────────────────────────────────────────── */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-sm rounded-2xl px-5 py-3 shadow-lg z-50 whitespace-nowrap">
          {toast}
        </div>
      )}
    </main>
  )
}

export default function DietAutomationPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#F6FAF6] flex items-center justify-center">
        <div className="flex items-center gap-3">
          <span className="w-6 h-6 border-2 border-[#2D6A4F]/30 border-t-[#2D6A4F] rounded-full animate-spin" />
          <p className="text-gray-400 text-sm">로딩 중...</p>
        </div>
      </div>
    }>
      <DietAutomationContent />
    </Suspense>
  )
}
