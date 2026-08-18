'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { ROUTES } from '@/lib/routes'
import {
  CATEGORY_ICONS,
  CATEGORY_LABELS,
  COMPLAINT_SUB_LABELS,
  type ComplaintSubcategory,
  type InquiryCategory,
} from '@/lib/types'
import FileUpload from '@/components/board/FileUpload'
import AccountMismatchNotice from '@/components/board/AccountMismatchNotice'

// 2026-08-18 권팀장 요청으로 재정의된 문의 유형(6종).
// 컴플레인만 하위분류를 한 번 더 고르는 2단계 구조(A안).
const FORM_CATEGORIES: InquiryCategory[] = [
  'SCHEDULE_OPS', 'DELIVERY', 'COMPLAINT', 'ACCOUNTING', 'ALLERGY', 'OTHER',
]

const COMPLAINT_SUBS: ComplaintSubcategory[] = [
  'MENU', 'QUANTITY', 'HYGIENE_SAFETY', 'DELIVERY',
  'ORDER_SYSTEM', 'CUSTOMER_SERVICE', 'ETC',
]

export default function NewInquiryPage() {
  const router = useRouter()
  const [branchName, setBranchName] = useState('')
  const [category, setCategory] = useState<InquiryCategory | null>(null)
  const [subcategory, setSubcategory] = useState<ComplaintSubcategory | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [checking, setChecking] = useState(true)
  const [noBranch, setNoBranch] = useState(false)
  const [submitNoBranch, setSubmitNoBranch] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    async function fetchBranch() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace(ROUTES.BOARD_LOGIN); return }
      setUserEmail(user.email ?? null)

      try {
        const { data: branchRow } = await supabase
          .from('branches')
          .select('name')
          .eq('auth_id', user.id)
          .maybeSingle()
        if (branchRow?.name) { setBranchName(branchRow.name); return }
        const { data: memberRow } = await supabase
          .from('branch_members')
          .select('branches(name)')
          .eq('auth_id', user.id)
          .maybeSingle()
        if (memberRow?.branches) {
          const b = memberRow.branches as unknown as { name: string }
          setBranchName(b.name)
        } else {
          setNoBranch(true)
        }
      } finally {
        setChecking(false)
      }
    }
    fetchBranch()
  }, [router])

  /** 유형을 바꾸면 하위분류는 초기화(컴플레인 → 다른 유형으로 옮길 때 잔값 방지) */
  const handleCategorySelect = useCallback((cat: InquiryCategory) => {
    setCategory(cat)
    if (cat !== 'COMPLAINT') setSubcategory(null)
  }, [])

  const canSubmit = !!category
    && (category !== 'COMPLAINT' || !!subcategory)
    && title.trim().length > 0
    && content.trim().length > 0
    && !submitting

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit || !category) return
    setSubmitting(true)
    setError('')
    setSubmitNoBranch(false)

    const supabase = createClient()

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace(ROUTES.BOARD_LOGIN); return }

      let branchId: string | null = null
      let brandId: string | null = null

      const { data: branchRow } = await supabase
        .from('branches')
        .select('id, brand_id')
        .eq('auth_id', user.id)
        .maybeSingle()

      if (branchRow) {
        branchId = branchRow.id
        brandId = branchRow.brand_id
      } else {
        const { data: memberRow } = await supabase
          .from('branch_members')
          .select('branch_id, branches(brand_id)')
          .eq('auth_id', user.id)
          .maybeSingle()
        if (memberRow) {
          branchId = memberRow.branch_id
          brandId = (memberRow.branches as unknown as { brand_id: string })?.brand_id || null
        }
      }

      if (!branchId) {
        // ★폼 내용을 지우지 않는다 — throw로 catch에 보내는 대신
        // 여기서 바로 상태만 세팅하고 폼(입력값·첨부파일)은 그대로 유지한다.
        setSubmitNoBranch(true)
        setSubmitting(false)
        return
      }

      if (!brandId) {
        const { data: b } = await supabase
          .from('branches')
          .select('brand_id')
          .eq('id', branchId)
          .maybeSingle()
        brandId = b?.brand_id || null
      }

      const { data: inquiry, error: inqError } = await supabase
        .from('inquiries')
        .insert({
          branch_id: branchId,
          brand_id: brandId,
          // 2026-08-18 이전에는 CATEGORY_LABELS[category]로 제목을 자동 고정해
          // 사용자가 제목을 쓸 수 없었다(권팀장 요청 1번). 직접 입력값으로 변경.
          title: title.trim(),
          category,
          subcategory: category === 'COMPLAINT' ? subcategory : null,
          status: 'pending',
          priority: 'medium',
          created_by_type: 'branch',
          created_by_id: user.id,
          // 카테고리별 고정 양식(품목명·발생일·인원수)을 폐기해 저장할 값이 없음.
          // 컬럼 자체는 과거 데이터 조회를 위해 유지.
          form_data: null,
          last_message_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (inqError) throw inqError

      const { data: message, error: msgError } = await supabase
        .from('messages')
        .insert({
          inquiry_id: inquiry.id,
          sender_id: user.id,
          sender_type: 'branch',
          content: content.trim(),
          is_internal: false,
        })
        .select()
        .single()

      if (msgError) throw msgError

      if (files.length > 0 && message) {
        for (const file of files) {
          const path = `${branchId}/${inquiry.id}/${message.id}/${file.name}`
          const { data: uploaded } = await supabase.storage
            .from('kizmeal-files')
            .upload(path, file, { upsert: true })

          if (uploaded) {
            await supabase.from('message_attachments').insert({
              message_id: message.id,
              file_name: file.name,
              file_size: file.size,
              file_type: file.type,
              storage_path: uploaded.path,
            })
          }
        }
      }

      // 관리자에게 새 문의 접수 이메일 알림 (실패해도 등록 자체에 영향 없음)
      try {
        await fetch('/api/cs/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'new_inquiry',
            branchName: branchName || '(지점명 없음)',
            content: content.trim(),
            inquiryId: inquiry.id,
          }),
        })
      } catch (e) {
        console.error('[CS] 새 문의 이메일 알림 실패:', e)
      }

      setToast('문의가 접수되었습니다! 🎉')
      setTimeout(() => router.push(`/board/inquiries/${inquiry.id}`), 1200)
    } catch (err) {
      const msg =
        err instanceof Error ? err.message
        : typeof err === 'object' && err !== null && 'message' in err
        ? (err as { message: string }).message
        : '문의 등록에 실패했습니다.'
      setError(msg)
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F6FAF6] font-sans">
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-[#2D6A4F] text-white px-6 py-3 rounded-2xl shadow-lg text-sm font-semibold animate-fade-in">
          {toast}
        </div>
      )}

      <header className="bg-white border-b border-gray-100 px-4 sm:px-6 py-4 hidden sm:flex items-center gap-3 sticky top-0 z-10">
        <Link href="/board/inquiries" className="text-gray-400 hover:text-gray-600">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5m7-7l-7 7 7 7" />
          </svg>
        </Link>
        <h1 className="font-bold text-[#1C2B1E]">새 문의 작성</h1>
      </header>

      <div className="px-4 sm:px-6 py-6">
        {checking ? null : noBranch ? (
          <AccountMismatchNotice email={userEmail} />
        ) : (
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
          {/* 지점명 (read-only) */}
          {branchName && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">지점명</label>
              <div className="w-full px-4 py-2.5 rounded-xl border border-gray-100 bg-gray-50 text-sm text-gray-600 font-medium">
                {branchName}
              </div>
            </div>
          )}

          {/* 문의 유형 선택 (1단계) */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">
              문의 유형 <span className="text-red-500">*</span>
            </label>
            <p className="text-xs text-gray-400 mb-3">유형을 선택하면 입력 항목이 나타납니다</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {FORM_CATEGORIES.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => handleCategorySelect(cat)}
                  className={`flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl border text-sm font-medium transition-all ${
                    category === cat
                      ? 'bg-[#2D6A4F] border-[#2D6A4F] text-white shadow-md'
                      : 'bg-white border-gray-200 text-gray-600 hover:border-[#52B788] hover:text-[#2D6A4F]'
                  }`}
                >
                  <span className="text-xl">{CATEGORY_ICONS[cat]}</span>
                  <span className="text-xs leading-tight text-center">{CATEGORY_LABELS[cat]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 컴플레인 하위분류 (2단계) — 컴플레인 선택 시에만 노출 */}
          <div className={`overflow-hidden transition-all duration-300 ${
            category === 'COMPLAINT' ? 'max-h-[400px] opacity-100' : 'max-h-0 opacity-0'
          }`}>
            {category === 'COMPLAINT' && (
              <div className="border-t border-gray-100 pt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  세부 유형 <span className="text-red-500">*</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {COMPLAINT_SUBS.map(sub => (
                    <button
                      key={sub}
                      type="button"
                      onClick={() => setSubcategory(sub)}
                      className={`px-3.5 py-2 rounded-full border text-xs font-medium transition-all ${
                        subcategory === sub
                          ? 'bg-[#2D6A4F] border-[#2D6A4F] text-white shadow-sm'
                          : 'bg-white border-gray-200 text-gray-600 hover:border-[#52B788] hover:text-[#2D6A4F]'
                      }`}
                    >
                      {COMPLAINT_SUB_LABELS[sub]}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 제목·내용·첨부 — 유형 선택 후 노출 */}
          <div className={`overflow-hidden transition-all duration-300 ${
            category ? 'max-h-[1200px] opacity-100' : 'max-h-0 opacity-0'
          }`}>
            {category && (
              <div className="space-y-4 border-t border-gray-100 pt-4">
                {/* 제목 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    제목 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    maxLength={100}
                    placeholder="문의 제목을 입력해 주세요"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F] focus:border-transparent"
                  />
                </div>

                {/* 내용 (자유 서술) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    내용 <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={content}
                    onChange={e => setContent(e.target.value)}
                    rows={7}
                    placeholder="문의 내용을 자유롭게 입력해 주세요"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F] focus:border-transparent resize-none"
                  />
                  <p className="text-xs text-gray-400 mt-1 text-right">{content.length}자</p>
                </div>

                {/* 사진 첨부 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    사진 첨부 <span className="text-gray-400">(선택)</span>
                  </label>
                  <p className="text-xs text-[#2D6A4F] bg-[#E8F5E9] rounded-lg px-3 py-2 mb-2">
                    관련 사진이나 파일을 첨부하실 수 있습니다
                  </p>
                  <FileUpload files={files} onFilesChange={setFiles} maxFiles={5} maxSizeMB={10} />
                </div>
              </div>
            )}
          </div>

          {submitNoBranch && (
            <AccountMismatchNotice email={userEmail} title="지점 정보를 찾을 수 없습니다" />
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full bg-[#F97316] hover:bg-[#EA6C0A] disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                문의 등록 중...
              </>
            ) : '문의 제출'}
          </button>
        </form>
        )}
      </div>
    </div>
  )
}
