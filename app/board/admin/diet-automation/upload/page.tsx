'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { UPLOAD_ROLES } from '@/lib/roles'
import { getYearOptions } from '@/lib/diet-utils'

// ── 타입 ───────────────────────────────────────────────────────────────
type ValidationIssue = { location: string; message: string; suggestion: string }
type WeekSummary = { week_num: number; day_count: number; dosirak_count: number; is_skipped: boolean }
type UploadResult = {
  success: boolean
  year: number
  month: number
  summary: {
    total_weeks: number
    total_days: number
    holiday_days: number
    dosirak_count: number
  }
  weeks: WeekSummary[]
  errors: ValidationIssue[]
  warnings: ValidationIssue[]
}

const ALLOWED_ROLES = UPLOAD_ROLES

export default function DietUploadPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [adminRole, setAdminRole] = useState<string | null>(null)
  const [loadingRole, setLoadingRole] = useState(true)

  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [existingData, setExistingData] = useState(false)
  const [checkingExisting, setCheckingExisting] = useState(false)

  const [file, setFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<UploadResult | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  // ── 권한 확인 ─────────────────────────────────────────────────────
  useEffect(() => {
    async function checkAuth() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/board/login'); return }
      const { data: admin } = await supabase
        .from('admins').select('role').eq('auth_id', user.id).maybeSingle()
      setAdminRole(admin?.role ?? null)
      setLoadingRole(false)
    }
    checkAuth()
  }, [router])

  // ── 기존 데이터 확인 ──────────────────────────────────────────────
  useEffect(() => {
    async function checkExisting() {
      setCheckingExisting(true)
      const supabase = createClient()
      const { data } = await supabase
        .from('weekly_menus').select('id')
        .eq('year', year).eq('month', month).eq('diet_type', 'CK')
        .is('branch_id', null).maybeSingle()
      setExistingData(!!data)
      setCheckingExisting(false)
    }
    checkExisting()
  }, [year, month])

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }, [])

  function handleFileSelect(f: File) {
    if (!f.name.endsWith('.xlsx')) {
      showToast('xlsx 파일만 업로드 가능합니다')
      return
    }
    setFile(f)
    setResult(null)
  }

  async function handleUpload() {
    if (!file) return
    if (existingData) {
      if (!confirm(
        `${year}년 ${month}월 식단이 이미 존재합니다.\n업로드 시 기존 데이터가 삭제됩니다.\n계속하시겠습니까?`
      )) return
    }
    setUploading(true)
    setResult(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('year', year.toString())
      formData.append('month', month.toString())
      const res = await fetch('/api/diet-automation/upload', { method: 'POST', body: formData })
      const data: UploadResult = await res.json()
      setResult(data)
      if (data.success) {
        setExistingData(true)
        setToast('✅ 업로드 완료! 잠시 후 허브로 이동합니다...')
        setTimeout(() => {
          router.push(`/board/admin/diet-automation?year=${data.year}&month=${data.month}`)
        }, 3000)
      }
    } catch (err) {
      const error = err as { message?: string }
      showToast(`업로드 오류: ${error?.message || '알 수 없는 오류'}`)
    } finally {
      setUploading(false)
    }
  }

  // ── 로딩 / 권한 없음 ─────────────────────────────────────────────
  if (loadingRole) {
    return (
      <main className="min-h-screen bg-[#F6FAF6] flex items-center justify-center">
        <div className="text-gray-500 text-sm">로딩 중...</div>
      </main>
    )
  }

  if (!ALLOWED_ROLES.includes(adminRole || '')) {
    return (
      <main className="min-h-screen bg-[#F6FAF6] flex items-center justify-center">
        <div className="bg-white rounded-2xl p-8 shadow-sm text-center">
          <p className="text-2xl mb-2">🔒</p>
          <p className="font-bold text-gray-800 mb-1">접근 권한 없음</p>
          <p className="text-sm text-gray-500 mb-4">CK 식단 입력 권한이 필요합니다</p>
          <Link href="/board/admin/diet-automation" className="text-[#2D6A4F] text-sm underline">
            돌아가기
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#F6FAF6] px-4 sm:px-6 py-6 sm:py-8">
      {/* ── 헤더 ─────────────────────────────────────────────────── */}
      <div className="mb-6">
        <Link
          href="/board/admin/diet-automation"
          className="text-gray-400 hover:text-gray-600 text-sm inline-block mb-2"
        >
          ← 식단표 자동화
        </Link>
        <div className="flex items-center gap-2">
          <span className="text-2xl">📤</span>
          <h1 className="text-xl sm:text-2xl font-bold text-[#1C2B1E]">월별 식단표 엑셀 업로드</h1>
        </div>
        <p className="text-sm text-gray-500 ml-9 mt-1">
          기준폼 엑셀 파일을 업로드하면 자동으로 파싱·검증 후 저장됩니다
        </p>
      </div>

      <div className="max-w-2xl mx-auto space-y-4">
        {/* ── 연월 선택 ─────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <p className="text-sm font-bold text-[#1C2B1E] mb-3">대상 연월 선택</p>
          <div className="flex gap-3 items-center">
            <select
              value={year}
              onChange={e => { setYear(Number(e.target.value)); setFile(null); setResult(null) }}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#2D6A4F]"
            >
              {getYearOptions(year).map(y => <option key={y} value={y}>{y}년</option>)}
            </select>
            <select
              value={month}
              onChange={e => { setMonth(Number(e.target.value)); setFile(null); setResult(null) }}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#2D6A4F]"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                <option key={m} value={m}>{m}월</option>
              ))}
            </select>
            {checkingExisting && <span className="text-xs text-gray-400">확인 중...</span>}
          </div>
        </div>

        {/* ── 중복 경고 ─────────────────────────────────────────── */}
        {existingData && !checkingExisting && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
            <span className="text-lg mt-0.5">⚠️</span>
            <div>
              <p className="text-sm font-bold text-amber-800">
                {year}년 {month}월 식단이 이미 존재합니다
              </p>
              <p className="text-xs text-amber-700 mt-0.5">
                업로드 시 기존 데이터가 삭제됩니다. 재업로드 버튼을 클릭하면 확인 후 진행합니다.
              </p>
            </div>
          </div>
        )}

        {/* ── 파일 업로드 ───────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <p className="text-sm font-bold text-[#1C2B1E] mb-3">엑셀 파일 선택</p>
          <div
            onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={e => {
              e.preventDefault()
              setIsDragging(false)
              const f = e.dataTransfer.files[0]
              if (f) handleFileSelect(f)
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
              isDragging
                ? 'border-[#2D6A4F] bg-[#F6FAF6]'
                : 'border-gray-200 hover:border-[#2D6A4F] hover:bg-[#F6FAF6]'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f) }}
            />
            {file ? (
              <div className="flex flex-col items-center gap-2">
                <span className="text-3xl">📊</span>
                <p className="font-medium text-[#1C2B1E] text-sm">{file.name}</p>
                <p className="text-xs text-gray-400">{(file.size / 1024).toFixed(1)} KB</p>
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); setFile(null); setResult(null) }}
                  className="text-xs text-red-400 hover:text-red-600 mt-1"
                >
                  파일 제거
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <span className="text-3xl">☁️</span>
                <p className="text-sm font-medium text-gray-700">
                  xlsx 파일을 드래그하거나 클릭해서 선택
                </p>
                <p className="text-xs text-gray-400">.xlsx 파일만 허용됩니다</p>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleUpload}
            disabled={!file || uploading}
            className="mt-4 w-full py-3 rounded-xl bg-[#2D6A4F] text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#1B4332] transition-colors"
          >
            {uploading
              ? '⏳ 파싱 · 검증 중...'
              : existingData
              ? '📤 재업로드'
              : '📤 업로드 · 검증 시작'}
          </button>
        </div>

        {/* ── 검증 결과 ─────────────────────────────────────────── */}
        {result && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            {result.errors.length === 0 ? (
              /* ── 통과 ── */
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-2xl">✅</span>
                  <div>
                    <p className="font-bold text-[#2D6A4F]">검증 완료!</p>
                    <p className="text-xs text-gray-500">
                      총 {result.summary.total_weeks}주차, {result.summary.total_days}일 데이터 파싱 완료
                      {result.summary.dosirak_count > 0 && ` · 도시락 ${result.summary.dosirak_count}건`}
                    </p>
                  </div>
                </div>

                {/* 주차별 요약 */}
                <div className="space-y-2 mb-4">
                  {result.weeks.map(w => (
                    <div
                      key={w.week_num}
                      className="flex items-center justify-between bg-[#F6FAF6] rounded-xl px-4 py-2.5"
                    >
                      <span className="text-sm font-medium text-[#1C2B1E]">{w.week_num}주차</span>
                      {w.is_skipped ? (
                        <span className="text-xs text-gray-400">해당없음</span>
                      ) : (
                        <span className="text-xs text-gray-600">
                          {w.day_count}일
                          {w.dosirak_count > 0 && (
                            <span className="ml-2 text-orange-600">도시락 {w.dosirak_count}건</span>
                          )}
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                {/* 경고 */}
                {result.warnings.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs font-bold text-amber-700 mb-2">
                      ⚠️ 경고 {result.warnings.length}건 (업로드 허용됨)
                    </p>
                    <div className="space-y-1.5">
                      {result.warnings.map((w, i) => (
                        <div key={i} className="bg-amber-50 rounded-xl px-3 py-2">
                          <p className="text-xs font-medium text-amber-800">{w.location}</p>
                          <p className="text-xs text-amber-700">{w.message}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* PPTX 생성 버튼 */}
                <button
                  type="button"
                  onClick={() => router.push('/board/admin/diet-automation')}
                  className="w-full py-3 rounded-xl bg-[#1565C0] text-white text-sm font-semibold hover:bg-[#0D47A1] transition-colors"
                >
                  🖨️ PPTX 생성 페이지로 이동
                </button>
              </div>
            ) : (
              /* ── 오류 ── */
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-2xl">❌</span>
                  <div>
                    <p className="font-bold text-red-600">
                      검증 오류 {result.errors.length}건 발견 — 수정 후 재업로드 해주세요
                    </p>
                    <p className="text-xs text-gray-500">저장되지 않았습니다</p>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-xl border border-gray-100">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="text-left px-3 py-2.5 font-semibold text-gray-600">위치</th>
                        <th className="text-left px-3 py-2.5 font-semibold text-gray-600">오류 내용</th>
                        <th className="text-left px-3 py-2.5 font-semibold text-gray-600">수정 방법</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.errors.map((e, i) => (
                        <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-red-50/40'}>
                          <td className="px-3 py-2 text-gray-700 whitespace-nowrap font-medium">
                            {e.location}
                          </td>
                          <td className="px-3 py-2 text-red-700">{e.message}</td>
                          <td className="px-3 py-2 text-gray-600">{e.suggestion}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <button
                  type="button"
                  onClick={() => { setFile(null); setResult(null) }}
                  className="mt-4 w-full py-3 rounded-xl bg-gray-100 text-gray-700 text-sm font-semibold hover:bg-gray-200 transition-colors"
                >
                  재업로드
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── 토스트 ────────────────────────────────────────────────── */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-sm rounded-2xl px-5 py-3 shadow-lg z-50 whitespace-nowrap">
          {toast}
        </div>
      )}
    </main>
  )
}
