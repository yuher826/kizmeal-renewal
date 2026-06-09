'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import DietNotificationPanel, { type DietNotification } from '@/components/board/DietNotificationPanel'

// ── 데모 데이터 (실제 Supabase 연동은 B-2 이후) ──────────────────
const DEMO_STATS = {
  totalBranches:      23,
  pendingInput:        8,
  pendingReview:       4,
  deployedThisMonth:  12,
}

const STATUS_COLUMNS = [
  { key: 'draft',                label: '작성 중',       color: '#9E9E9E', bg: '#F5F5F5',  count: 4 },
  { key: 'input_complete',       label: '입력 완료',     color: '#1976D2', bg: '#E3F2FD',  count: 6 },
  { key: 'reviewing',            label: '검토 중',       color: '#E65100', bg: '#FFF3E0',  count: 3 },
  { key: 'correction_requested', label: '수정 요청',     color: '#C62828', bg: '#FFEBEE',  count: 1 },
  { key: 'approved',             label: '승인 완료',     color: '#2E7D32', bg: '#E8F5E9',  count: 2 },
  { key: 'generating',           label: 'PPTX 생성 중', color: '#6A1B9A', bg: '#F3E5F5',  count: 0 },
  { key: 'generated',            label: '파일 준비 완료', color: '#00838F', bg: '#E0F7FA', count: 5 },
  { key: 'deployed',             label: '배포 완료',     color: '#2D6A4F', bg: '#F6FAF6',  count: 12 },
]

const STAT_CARDS = [
  {
    label:    '계약원 현황',
    value:    DEMO_STATS.totalBranches,
    unit:     '개',
    icon:     '🏫',
    subLabel: '활성 계약원',
    color:    '#2D6A4F',
    bg:       '#F6FAF6',
  },
  {
    label:    '이번달 입력 대기',
    value:    DEMO_STATS.pendingInput,
    unit:     '개',
    icon:     '📝',
    subLabel: '식단 미입력 원',
    color:    '#1565C0',
    bg:       '#E3F2FD',
  },
  {
    label:    '검토·승인 대기',
    value:    DEMO_STATS.pendingReview,
    unit:     '개',
    icon:     '👀',
    subLabel: '검토/수정 요청 합산',
    color:    '#E65100',
    bg:       '#FFF3E0',
  },
  {
    label:    '이번달 배포 완료',
    value:    DEMO_STATS.deployedThisMonth,
    unit:     '개',
    icon:     '🚀',
    subLabel: '이메일 발송 완료',
    color:    '#2D6A4F',
    bg:       '#E8F5E9',
  },
]

// ── PPTX 관련 상수 ────────────────────────────────────────────────
const SEPARATE_CONTRACT_CODES = new Set(['로티스', '잉글리쉬파크', '잉파', 'KIS', 'KPI', '송파MB'])
const MANUAL_PROCESS_CODES    = new Set(['덕양P'])
const JPG_ONLY_CODES          = new Set(['정발P'])
const PDF_JPG_CODES           = new Set(['엘란'])

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

function formatGeneratedAt(iso: string) {
  try {
    const d = new Date(iso)
    return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
  } catch { return iso }
}

export default function DietAutomationPage() {
  const router = useRouter()
  const [tab, setTab] = useState<HubTab>('workflow')
  const [toast, setToast] = useState<string | null>(null)

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 4000)
  }, [])

  // ── PPTX 상태 ─────────────────────────────────────────────────
  const now = new Date()
  const [pptxYear,    setPptxYear]    = useState(now.getFullYear())
  const [pptxMonth,   setPptxMonth]   = useState(now.getMonth() + 1)
  const [pptxWeekNum, setPptxWeekNum] = useState(0) // 0 = 전체

  const [menuRowId,   setMenuRowId]   = useState<string | null>(null)
  const [menuStatus,  setMenuStatus]  = useState<string | null>(null)
  const [hasMenuData, setHasMenuData] = useState(false)

  const [genStatus,  setGenStatus]  = useState<PptxGenStatus>('idle')
  const [genError,   setGenError]   = useState<string | null>(null)
  const [genResults, setGenResults] = useState<GenerationResults | null>(null)

  const [downloadingZip, setDownloadingZip] = useState(false)
  const [deploying,      setDeploying]      = useState(false)
  const [sendingReview,  setSendingReview]  = useState(false)
  const [reviewSent,     setReviewSent]     = useState(false)

  // ── 알림 상태 ─────────────────────────────────────────────────
  const [notifications,        setNotifications]        = useState<DietNotification[]>([])
  const [notificationsLoading, setNotificationsLoading] = useState(false)

  // ── weekly_menus 조회 ─────────────────────────────────────────
  const fetchMenuRow = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('weekly_menus')
      .select('id, status, menu_data, generation_results')
      .eq('year', pptxYear)
      .eq('month', pptxMonth)
      .eq('diet_type', 'CK')
      .is('branch_id', null)
      .maybeSingle()

    if (data) {
      setMenuRowId(data.id)
      setMenuStatus(data.status)
      setHasMenuData(!!data.menu_data)
      if (data.generation_results) {
        setGenResults(data.generation_results as GenerationResults)
        if (['generated','review_requested','approved','deployed'].includes(data.status)) {
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

  useEffect(() => { fetchMenuRow() }, [fetchMenuRow])

  // ── PPTX 생성 ─────────────────────────────────────────────────
  async function handleGenerate() {
    setGenStatus('waking')
    setGenError(null)

    // 70초 후 '생성 중' 상태로 전환 (서버 wake-up 완료 예상)
    const wakeTimer = setTimeout(() => setGenStatus('generating'), 70_000)

    try {
      const res = await fetch('/api/pptx/generate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          weekly_menu_id: menuRowId,
        }),
      })
      clearTimeout(wakeTimer)
      const data = await res.json()
      if (!res.ok) {
        setGenError(data.error || '생성 오류가 발생했습니다.')
        setGenStatus('error')
      } else {
        setGenResults({
          generated_at: new Date().toISOString(),
          succeeded:    data.succeeded,
          failed:       data.failed,
          results:      data.results ?? [],
        })
        setGenStatus('done')
        showToast(`${data.succeeded}개원 생성 완료! ✅`)
        await fetchMenuRow()
      }
    } catch (err) {
      clearTimeout(wakeTimer)
      setGenError(String(err))
      setGenStatus('error')
    }
  }

  // ── 재시도 ────────────────────────────────────────────────────
  async function handleRetry(_branchId: string | null, branchName: string) {
    showToast(`${branchName} 재생성 중...`)
    try {
      const res = await fetch('/api/pptx/generate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          weekly_menu_id: menuRowId,
        }),
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

  // ── 이메일 배포 ───────────────────────────────────────────────
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

  // ── 알림 fetch ────────────────────────────────────────────────
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

  // ── ZIP 다운로드 ──────────────────────────────────────────────
  async function handleDownloadZip() {
    if (!genResults) return
    setDownloadingZip(true)
    try {
      const files = genResults.results
        .filter(r => r.status === 'success')
        .map(r => ({
          branch_name: r.branch_name,
          pptx_url:    r.pptx_url || undefined,
          pdf_url:     r.pdf_url  || undefined,
        }))

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

  // ── 검토 요청 ─────────────────────────────────────────────────
  async function handleReviewRequest() {
    if (!menuRowId || reviewSent || sendingReview) return
    setSendingReview(true)
    try {
      const supabase = createClient()
      await supabase
        .from('weekly_menus')
        .update({ status: 'review_requested' })
        .eq('id', menuRowId)
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

  // ── 결과 행 렌더링 헬퍼 ───────────────────────────────────────
  function getFileBadge(branchName: string) {
    if (MANUAL_PROCESS_CODES.has(branchName)) return { label: '수동처리', color: '#E65100', bg: '#FFF3E0' }
    if (JPG_ONLY_CODES.has(branchName))       return { label: 'JPG',      color: '#7B1FA2', bg: '#F3E5F5' }
    if (PDF_JPG_CODES.has(branchName))        return { label: 'PDF+JPG',  color: '#1565C0', bg: '#E3F2FD' }
    return { label: 'PDF', color: '#2E7D32', bg: '#E8F5E9' }
  }

  const isGenerating = genStatus === 'waking' || genStatus === 'generating'
  const canActivateBottom =
    ['generated','review_requested','approved','deployed'].includes(menuStatus ?? '') && !!genResults

  return (
    <main className="min-h-screen bg-[#F6FAF6] px-4 sm:px-6 py-6 sm:py-8">
      {/* ── 헤더 ────────────────────────────────────────────────────────── */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-2xl">🍱</span>
          <h1 className="text-xl sm:text-2xl font-bold text-[#1C2B1E]">식단표 자동화</h1>
        </div>
        <p className="text-sm text-gray-500 ml-9">
          입력 → 검토 → 승인 → PPTX 생성 → 배포 전 과정을 한 곳에서 관리합니다
        </p>
      </div>

      {/* ── 통계 카드 4개 ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {STAT_CARDS.map(c => (
          <div
            key={c.label}
            className="rounded-2xl p-4 flex flex-col gap-1"
            style={{ background: c.bg }}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-gray-500">{c.label}</span>
              <span className="text-lg leading-none">{c.icon}</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold" style={{ color: c.color }}>
                {c.value}
              </span>
              <span className="text-sm font-medium" style={{ color: c.color }}>{c.unit}</span>
            </div>
            <span className="text-[11px] text-gray-400">{c.subLabel}</span>
          </div>
        ))}
      </div>

      {/* ── 탭 바 ──────────────────────────────────────────────────────── */}
      <div className="flex gap-1 mb-4 bg-white rounded-2xl p-1 border border-gray-100 w-fit">
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

      {/* ── 탭 콘텐츠 ──────────────────────────────────────────────────── */}
      {tab === 'workflow' && (
        <div>
          {/* 워크플로우 칸반 */}
          <div className="overflow-x-auto pb-4">
            <div className="flex gap-3 min-w-max">
              {STATUS_COLUMNS.map(col => (
                <div
                  key={col.key}
                  className="w-36 rounded-2xl border border-gray-100 bg-white overflow-hidden flex-shrink-0"
                >
                  <div
                    className="px-3 py-2.5 text-center"
                    style={{ background: col.bg }}
                  >
                    <p
                      className="text-xs font-bold leading-snug"
                      style={{ color: col.color }}
                    >
                      {col.label}
                    </p>
                    <p
                      className="text-2xl font-bold mt-1"
                      style={{ color: col.color }}
                    >
                      {col.count}
                    </p>
                    <p className="text-[10px] text-gray-400">개</p>
                  </div>
                  <div className="px-3 py-4 text-center">
                    {col.count === 0 ? (
                      <p className="text-[11px] text-gray-300">없음</p>
                    ) : (
                      <p className="text-[11px] text-gray-400 leading-relaxed">
                        B-2 구현 후<br />원 목록 표시
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 식단 업로드 CTA */}
          <div className="mt-4 bg-[#F6FAF6] border border-[#B7E4C7] rounded-2xl p-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-[#1C2B1E] mb-0.5">📤 이번 달 CK 식단 업로드</p>
              <p className="text-xs text-gray-500">기준폼 엑셀 파일을 업로드하여 식단을 등록합니다</p>
            </div>
            <Link
              href="/board/admin/diet-automation/upload"
              className="shrink-0 px-5 py-2.5 rounded-xl bg-[#2D6A4F] text-white text-sm font-semibold hover:bg-[#1B4332] transition-colors whitespace-nowrap"
            >
              ↑ 엑셀 업로드
            </Link>
          </div>

          {/* 빠른 이동 */}
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href="/board/admin/diet-automation/history"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-gray-200 text-sm font-medium text-gray-700 hover:border-[#2D6A4F] hover:text-[#2D6A4F] transition-colors"
            >
              <span>📋</span>
              배포 이력
            </Link>
            <Link
              href="/board/admin/diet/branch-profile"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-gray-200 text-sm font-medium text-gray-700 hover:border-[#2D6A4F] hover:text-[#2D6A4F] transition-colors"
            >
              <span>🏫</span>
              원 프로파일 설정
            </Link>
          </div>

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* PPTX 자동생성 섹션                                            */}
          {/* ══════════════════════════════════════════════════════════════ */}
          <div className="mt-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">🖨️</span>
              <h2 className="text-sm font-bold text-[#1C2B1E]">PPTX 자동 생성</h2>
            </div>

            {/* 컨트롤 카드 */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-3">
              <div className="flex flex-wrap items-end gap-3">
                {/* 연도 */}
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-gray-500">연도</span>
                  <select
                    value={pptxYear}
                    onChange={e => setPptxYear(Number(e.target.value))}
                    disabled={isGenerating}
                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#2D6A4F] disabled:opacity-50"
                  >
                    {[2024,2025,2026,2027,2028,2029,2030].map(y =>
                      <option key={y} value={y}>{y}년</option>
                    )}
                  </select>
                </div>

                {/* 월 */}
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-gray-500">월</span>
                  <select
                    value={pptxMonth}
                    onChange={e => setPptxMonth(Number(e.target.value))}
                    disabled={isGenerating}
                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#2D6A4F] disabled:opacity-50"
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(m =>
                      <option key={m} value={m}>{m}월</option>
                    )}
                  </select>
                </div>

                {/* 주차 */}
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-gray-500">주차</span>
                  <select
                    value={pptxWeekNum}
                    onChange={e => setPptxWeekNum(Number(e.target.value))}
                    disabled={isGenerating}
                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#2D6A4F] disabled:opacity-50"
                  >
                    <option value={0}>전체</option>
                    {[1,2,3,4,5].map(w => <option key={w} value={w}>{w}주차</option>)}
                  </select>
                </div>

                {/* 생성 버튼 */}
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={!hasMenuData || isGenerating}
                  className="px-8 py-2.5 rounded-xl bg-[#2E7D32] text-white text-sm font-bold hover:bg-[#1B5E20] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isGenerating ? '생성 중...' : '▶ PPTX 생성 시작'}
                </button>
              </div>

              {/* menu_data 없음 경고 */}
              {!hasMenuData && (
                <div className="mt-3 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <span className="text-sm mt-0.5">⚠️</span>
                  <div>
                    <p className="text-xs font-bold text-amber-800">
                      엑셀을 먼저 업로드해주세요
                    </p>
                    <p className="text-xs text-amber-700 mt-0.5">
                      {pptxYear}년 {pptxMonth}월 식단 데이터가 없습니다.{' '}
                      <button
                        type="button"
                        onClick={() => router.push('/board/admin/diet-automation/upload')}
                        className="underline font-semibold"
                      >
                        업로드 페이지로 이동
                      </button>
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* 상태 표시 영역 */}
            <div className="mb-3">
              {genStatus === 'idle' && (
                <div className="bg-gray-50 rounded-2xl border border-gray-100 p-4 text-center">
                  <p className="text-sm text-gray-400">생성 버튼을 눌러 PPTX 생성을 시작하세요</p>
                </div>
              )}

              {genStatus === 'waking' && (
                <div className="bg-orange-50 rounded-2xl border border-orange-200 p-4 flex items-center gap-3">
                  <span className="text-xl animate-spin inline-block">🟠</span>
                  <div>
                    <p className="text-sm font-bold text-orange-700">Render 서버 준비 중...</p>
                    <p className="text-xs text-orange-600 mt-0.5">최대 60초 소요됩니다</p>
                  </div>
                </div>
              )}

              {genStatus === 'generating' && (
                <div className="bg-blue-50 rounded-2xl border border-blue-200 p-4 flex items-center gap-3">
                  <span className="text-xl animate-spin inline-block">🔵</span>
                  <div>
                    <p className="text-sm font-bold text-blue-700">49개원 PPTX 생성 중...</p>
                    <p className="text-xs text-blue-600 mt-0.5">5~10분 소요됩니다. 페이지를 닫지 마세요.</p>
                  </div>
                </div>
              )}

              {genStatus === 'done' && genResults && (
                <div className="bg-green-50 rounded-2xl border border-green-200 p-4 flex items-center gap-3">
                  <span className="text-xl">🟢</span>
                  <div>
                    <p className="text-sm font-bold text-green-700">
                      완료! 성공 {genResults.succeeded}개 / 실패 {genResults.failed}개
                    </p>
                    <p className="text-xs text-green-600 mt-0.5">
                      {formatGeneratedAt(genResults.generated_at)} 생성
                    </p>
                  </div>
                </div>
              )}

              {genStatus === 'error' && (
                <div className="bg-red-50 rounded-2xl border border-red-200 p-4 flex items-start gap-3">
                  <span className="text-xl">🔴</span>
                  <div>
                    <p className="text-sm font-bold text-red-700">생성 오류</p>
                    <p className="text-xs text-red-600 mt-0.5 break-all">{genError}</p>
                  </div>
                </div>
              )}
            </div>

            {/* 결과 테이블 */}
            {genResults && genResults.results.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-3">
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                  <span className="text-xs font-bold text-[#1C2B1E]">생성 결과</span>
                  <span className="text-xs text-gray-400">{genResults.results.length}개원</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="text-center px-3 py-2.5 font-semibold text-gray-500 w-8">#</th>
                        <th className="text-left   px-3 py-2.5 font-semibold text-gray-500">원명</th>
                        <th className="text-center px-3 py-2.5 font-semibold text-gray-500">구분</th>
                        <th className="text-center px-3 py-2.5 font-semibold text-gray-500">파일형식</th>
                        <th className="text-center px-3 py-2.5 font-semibold text-gray-500">상태</th>
                        <th className="text-center px-3 py-2.5 font-semibold text-gray-500">다운로드</th>
                        <th className="text-center px-3 py-2.5 font-semibold text-gray-500">액션</th>
                      </tr>
                    </thead>
                    <tbody>
                      {genResults.results.map((row, idx) => {
                        const badge     = getFileBadge(row.branch_name)
                        const isManual  = MANUAL_PROCESS_CODES.has(row.branch_name)
                        const isJpgOnly = JPG_ONLY_CODES.has(row.branch_name)
                        const isSep     = SEPARATE_CONTRACT_CODES.has(row.branch_name)
                        const isSuccess = row.status === 'success'

                        return (
                          <tr
                            key={row.branch_name}
                            className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}
                          >
                            {/* 번호 */}
                            <td className="text-center px-3 py-2.5 text-gray-400">{idx + 1}</td>

                            {/* 원명 */}
                            <td className="px-3 py-2.5 font-medium text-[#1C2B1E] whitespace-nowrap">
                              {row.branch_name}
                            </td>

                            {/* 구분 */}
                            <td className="text-center px-3 py-2.5">
                              <span
                                className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold"
                                style={
                                  isSep
                                    ? { color: '#616161', background: '#F5F5F5' }
                                    : { color: '#1565C0', background: '#E3F2FD' }
                                }
                              >
                                {isSep ? '별도계약' : 'CK'}
                              </span>
                            </td>

                            {/* 파일형식 */}
                            <td className="text-center px-3 py-2.5">
                              <span
                                className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold"
                                style={{ color: badge.color, background: badge.bg }}
                              >
                                {badge.label}
                              </span>
                            </td>

                            {/* 상태 */}
                            <td className="text-center px-3 py-2.5">
                              {isSuccess ? (
                                <span className="text-green-600 font-bold">✅ 성공</span>
                              ) : row.status === 'error' ? (
                                <span
                                  className="text-red-600 font-bold cursor-help"
                                  title={row.error_msg}
                                >
                                  ❌ 실패
                                </span>
                              ) : (
                                <span className="text-blue-600 font-bold">🔄 생성중</span>
                              )}
                            </td>

                            {/* 다운로드 */}
                            <td className="text-center px-3 py-2.5">
                              {isManual ? (
                                <span className="text-gray-300 text-[10px]">—</span>
                              ) : isSuccess ? (
                                <div className="flex items-center justify-center gap-1">
                                  {row.pptx_url && (
                                    <a
                                      href={row.pptx_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="px-2 py-1 rounded-lg bg-[#E3F2FD] text-[#1565C0] text-[10px] font-bold hover:bg-[#BBDEFB] transition-colors"
                                    >
                                      PPTX
                                    </a>
                                  )}
                                  {(row.pdf_url && !isJpgOnly) && (
                                    <a
                                      href={row.pdf_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="px-2 py-1 rounded-lg bg-[#E8F5E9] text-[#2E7D32] text-[10px] font-bold hover:bg-[#C8E6C9] transition-colors"
                                    >
                                      PDF
                                    </a>
                                  )}
                                </div>
                              ) : (
                                <span className="text-gray-300 text-[10px]">—</span>
                              )}
                            </td>

                            {/* 액션 */}
                            <td className="text-center px-3 py-2.5">
                              {isManual ? (
                                <span className="text-gray-300 text-[10px]">—</span>
                              ) : !isSuccess ? (
                                <button
                                  type="button"
                                  onClick={() => handleRetry(row.branch_id, row.branch_name)}
                                  className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-700 text-[10px] font-bold hover:bg-amber-200 transition-colors"
                                >
                                  재시도
                                </button>
                              ) : (
                                <span className="text-gray-300 text-[10px]">—</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 하단 액션 바 */}
            {canActivateBottom && (
              <div className="bg-white rounded-2xl border border-gray-100 p-4 flex flex-wrap items-center gap-3">
                {/* 전체 ZIP 다운로드 */}
                <button
                  type="button"
                  onClick={handleDownloadZip}
                  disabled={downloadingZip}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1C2B1E] text-white text-sm font-semibold hover:bg-black transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {downloadingZip ? '⏳ 다운로드 중...' : '📦 전체 ZIP 다운로드'}
                </button>

                {/* 권팀장 검토 요청 (generated 상태) */}
                {['generated', 'correction_requested'].includes(menuStatus ?? '') && (
                  <button
                    type="button"
                    onClick={handleReviewRequest}
                    disabled={reviewSent || sendingReview}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1565C0] text-white text-sm font-semibold hover:bg-[#0D47A1] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {sendingReview ? '⏳ 전송 중...' : reviewSent ? '✅ 검토 요청 완료' : '📩 권팀장 검토 요청'}
                  </button>
                )}

                {/* 검토 중일 때: 검토 페이지 링크 */}
                {menuStatus === 'review_requested' && (
                  <Link
                    href={`/board/admin/diet-automation/review?year=${pptxYear}&month=${pptxMonth}`}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-100 text-orange-700 text-sm font-semibold hover:bg-orange-200 transition-colors"
                  >
                    👀 검토 페이지로 이동
                  </Link>
                )}

                {/* 승인 완료: 이메일 배포 버튼 */}
                {menuStatus === 'approved' && (
                  <button
                    type="button"
                    onClick={handleDeploy}
                    disabled={deploying}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#2E7D32] text-white text-sm font-semibold hover:bg-[#1B5E20] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {deploying ? '⏳ 발송 중...' : '📧 이메일 배포 시작'}
                  </button>
                )}

                {/* 배포 완료 */}
                {menuStatus === 'deployed' && (
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-[#2D6A4F]">
                    🚀 배포 완료
                  </span>
                )}
              </div>
            )}
          </div>
          {/* ═══════════════ PPTX 자동생성 섹션 끝 ═══════════════ */}
        </div>
      )}

      {tab === 'notifications' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-6">
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

      {/* ── 토스트 ─────────────────────────────────────────────────────── */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-sm rounded-2xl px-5 py-3 shadow-lg z-50 whitespace-nowrap">
          {toast}
        </div>
      )}
    </main>
  )
}
