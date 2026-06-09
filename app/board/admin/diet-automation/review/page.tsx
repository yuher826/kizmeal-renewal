'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'

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

type MenuRow = {
  id:                 string
  status:             string
  year:               number
  month:              number
  generation_results: GenerationResults | null
}

const STATUS_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  draft:               { label: '작성 중',       color: '#9E9E9E', bg: '#F5F5F5' },
  generated:           { label: '파일 준비 완료', color: '#00838F', bg: '#E0F7FA' },
  review_requested:    { label: '검토 요청됨',   color: '#E65100', bg: '#FFF3E0' },
  approved:            { label: '승인 완료',     color: '#2E7D32', bg: '#E8F5E9' },
  correction_requested:{ label: '수정 요청',     color: '#C62828', bg: '#FFEBEE' },
  deployed:            { label: '배포 완료',     color: '#2D6A4F', bg: '#F6FAF6' },
}

function formatDate(iso: string) {
  try {
    const d = new Date(iso)
    return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
  } catch { return iso }
}

export default function DietReviewPage() {
  const searchParams = useSearchParams()
  const yearParam  = Number(searchParams.get('year')  || new Date().getFullYear())
  const monthParam = Number(searchParams.get('month') || new Date().getMonth() + 1)

  const [menuRow,    setMenuRow]    = useState<MenuRow | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [approving,  setApproving]  = useState(false)
  const [rejecting,  setRejecting]  = useState(false)
  const [deploying,  setDeploying]  = useState(false)
  const [toast,      setToast]      = useState<string | null>(null)

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 4000)
  }, [])

  const fetchRow = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('weekly_menus')
      .select('id, status, year, month, generation_results')
      .eq('year', yearParam).eq('month', monthParam).eq('diet_type', 'CK').is('branch_id', null)
      .maybeSingle()
    setMenuRow(data ? { ...data, generation_results: data.generation_results as GenerationResults | null } : null)
    setLoading(false)
  }, [yearParam, monthParam])

  useEffect(() => { fetchRow() }, [fetchRow])

  // ── 승인 ──────────────────────────────────────────────────────
  async function handleApprove() {
    if (!menuRow) return
    setApproving(true)
    try {
      const supabase = createClient()
      await supabase
        .from('weekly_menus')
        .update({ status: 'approved' })
        .eq('id', menuRow.id)
      await supabase.from('diet_notifications').insert({
        type:           'approve_complete',
        title:          `${yearParam}년 ${monthParam}월 식단표 승인 완료`,
        message:        '검토가 완료되어 승인되었습니다. 이제 이메일 배포를 진행할 수 있습니다.',
        recipient_role: 'nutritionist_ck',
        weekly_menu_id: menuRow.id,
        year:           yearParam,
        month:          monthParam,
      })
      showToast('승인 완료! 이메일 배포를 진행해주세요.')
      await fetchRow()
    } catch (err) {
      showToast(`승인 오류: ${err}`)
    } finally {
      setApproving(false)
    }
  }

  // ── 수정 요청 ─────────────────────────────────────────────────
  async function handleReject() {
    if (!menuRow) return
    setRejecting(true)
    try {
      const supabase = createClient()
      await supabase
        .from('weekly_menus')
        .update({ status: 'correction_requested' })
        .eq('id', menuRow.id)
      await supabase.from('diet_notifications').insert({
        type:           'correction_request',
        title:          `${yearParam}년 ${monthParam}월 식단표 수정 요청`,
        message:        '검토 결과 수정이 필요합니다. 내용을 확인해주세요.',
        recipient_role: 'nutritionist_ck',
        weekly_menu_id: menuRow.id,
        year:           yearParam,
        month:          monthParam,
      })
      showToast('수정 요청이 전송되었습니다.')
      await fetchRow()
    } catch (err) {
      showToast(`수정 요청 오류: ${err}`)
    } finally {
      setRejecting(false)
    }
  }

  // ── 이메일 배포 ───────────────────────────────────────────────
  async function handleDeploy() {
    if (!menuRow) return
    if (!confirm(`${yearParam}년 ${monthParam}월 식단표를 각 원 담당자 이메일로 발송합니다.\n계속하시겠습니까?`)) return
    setDeploying(true)
    try {
      const res = await fetch('/api/pptx/deploy', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ year: yearParam, month: monthParam }),
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(`배포 오류: ${data.error}`)
      } else {
        showToast(`배포 완료! ${data.sent}개원 발송 성공${data.failed > 0 ? `, ${data.failed}개 실패` : ''}`)
        await fetchRow()
      }
    } catch (err) {
      showToast(`배포 오류: ${err}`)
    } finally {
      setDeploying(false)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#F6FAF6] flex items-center justify-center">
        <p className="text-gray-400 text-sm">로딩 중...</p>
      </main>
    )
  }

  const statusMeta = STATUS_LABEL[menuRow?.status ?? ''] ?? { label: menuRow?.status ?? '-', color: '#9E9E9E', bg: '#F5F5F5' }
  const genResults = menuRow?.generation_results
  const isApproved = menuRow?.status === 'approved'
  const isDeployed = menuRow?.status === 'deployed'

  return (
    <main className="min-h-screen bg-[#F6FAF6] px-4 sm:px-6 py-6 sm:py-8">
      {/* 헤더 */}
      <div className="mb-6">
        <Link
          href="/board/admin/diet-automation"
          className="text-gray-400 hover:text-gray-600 text-sm inline-block mb-2"
        >
          ← 식단표 자동화
        </Link>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-2xl">👀</span>
            <h1 className="text-xl sm:text-2xl font-bold text-[#1C2B1E]">
              {yearParam}년 {monthParam}월 식단표 검토
            </h1>
          </div>
          <span
            className="inline-block px-3 py-1 rounded-full text-xs font-bold"
            style={{ color: statusMeta.color, background: statusMeta.bg }}
          >
            {statusMeta.label}
          </span>
        </div>
        {genResults && (
          <p className="text-xs text-gray-500 ml-9 mt-1">
            생성 {formatDate(genResults.generated_at)} · 성공 {genResults.succeeded}개 / 실패 {genResults.failed}개
          </p>
        )}
      </div>

      {/* 데이터 없음 */}
      {!menuRow && (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
          <p className="text-gray-400 text-sm">
            {yearParam}년 {monthParam}월 식단 데이터가 없습니다.
          </p>
          <Link
            href="/board/admin/diet-automation/upload"
            className="mt-4 inline-block text-[#2D6A4F] text-sm underline"
          >
            엑셀 업로드하기
          </Link>
        </div>
      )}

      {/* 결과 테이블 */}
      {genResults && genResults.results.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-4">
          <div className="px-4 py-3 border-b border-gray-100">
            <span className="text-xs font-bold text-[#1C2B1E]">PPTX 생성 결과 ({genResults.results.length}개원)</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-center px-3 py-2.5 font-semibold text-gray-500 w-8">#</th>
                  <th className="text-left   px-3 py-2.5 font-semibold text-gray-500">원명</th>
                  <th className="text-center px-3 py-2.5 font-semibold text-gray-500">상태</th>
                  <th className="text-center px-3 py-2.5 font-semibold text-gray-500">파일 확인</th>
                </tr>
              </thead>
              <tbody>
                {genResults.results.map((row, idx) => (
                  <tr key={row.branch_name} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                    <td className="text-center px-3 py-2.5 text-gray-400">{idx + 1}</td>
                    <td className="px-3 py-2.5 font-medium text-[#1C2B1E]">{row.branch_name}</td>
                    <td className="text-center px-3 py-2.5">
                      {row.status === 'success'
                        ? <span className="text-green-600 font-bold">✅ 성공</span>
                        : <span className="text-red-600 font-bold" title={row.error_msg}>❌ 실패</span>
                      }
                    </td>
                    <td className="text-center px-3 py-2.5">
                      {row.status === 'success' && (
                        <div className="flex items-center justify-center gap-1">
                          {row.pptx_url && (
                            <a href={row.pptx_url} target="_blank" rel="noopener noreferrer"
                              className="px-2 py-1 rounded-lg bg-[#E3F2FD] text-[#1565C0] text-[10px] font-bold hover:bg-[#BBDEFB]">
                              PPTX
                            </a>
                          )}
                          {row.pdf_url && (
                            <a href={row.pdf_url} target="_blank" rel="noopener noreferrer"
                              className="px-2 py-1 rounded-lg bg-[#E8F5E9] text-[#2E7D32] text-[10px] font-bold hover:bg-[#C8E6C9]">
                              PDF
                            </a>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 액션 바 */}
      {menuRow && !isDeployed && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 flex flex-wrap gap-3 items-center">
          {/* 검토 요청 상태 or generated: 승인 + 수정요청 */}
          {['generated', 'review_requested', 'correction_requested'].includes(menuRow.status) && (
            <>
              <button
                type="button"
                onClick={handleApprove}
                disabled={approving}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#2E7D32] text-white text-sm font-semibold hover:bg-[#1B5E20] transition-colors disabled:opacity-40"
              >
                {approving ? '⏳ 처리 중...' : '✅ 승인'}
              </button>
              <button
                type="button"
                onClick={handleReject}
                disabled={rejecting}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-red-100 text-red-700 text-sm font-semibold hover:bg-red-200 transition-colors disabled:opacity-40"
              >
                {rejecting ? '⏳ 처리 중...' : '✏️ 수정 요청'}
              </button>
            </>
          )}

          {/* 승인 완료 상태: 이메일 배포 */}
          {isApproved && (
            <button
              type="button"
              onClick={handleDeploy}
              disabled={deploying}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#1565C0] text-white text-sm font-semibold hover:bg-[#0D47A1] transition-colors disabled:opacity-40"
            >
              {deploying ? '⏳ 발송 중...' : '📧 이메일 배포 시작'}
            </button>
          )}

          <p className="text-xs text-gray-400 ml-auto">
            {isApproved
              ? '승인 완료. 각 원 배포 이메일로 발송됩니다.'
              : '식단표 내용을 확인한 후 승인하거나 수정을 요청해주세요.'}
          </p>
        </div>
      )}

      {/* 배포 완료 */}
      {isDeployed && (
        <div className="bg-[#E8F5E9] rounded-2xl border border-[#A5D6A7] p-4 flex items-center gap-3">
          <span className="text-xl">🚀</span>
          <div>
            <p className="text-sm font-bold text-[#2D6A4F]">배포 완료</p>
            <p className="text-xs text-green-700 mt-0.5">각 원 담당자 이메일로 식단표가 발송되었습니다.</p>
          </div>
        </div>
      )}

      {/* 토스트 */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-sm rounded-2xl px-5 py-3 shadow-lg z-50 whitespace-nowrap">
          {toast}
        </div>
      )}
    </main>
  )
}
