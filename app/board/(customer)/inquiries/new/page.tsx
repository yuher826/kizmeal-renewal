'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { CATEGORY_ICONS, CATEGORY_LABELS, type InquiryCategory } from '@/lib/types'
import FileUpload from '@/components/board/FileUpload'

const FORM_CATEGORIES: InquiryCategory[] = [
  'DELIVERY', 'MENU', 'STAFF_MEAL', 'HYGIENE', 'COMPLAINT', 'CONTRACT', 'OTHER',
]

interface CatConfig {
  showItemName?: boolean
  showDate?: boolean
  dateLabel?: string
  showStaffCount?: boolean
  showContent: boolean
  contentLabel: string
  showFile?: boolean
  fileHint?: string
}

const CAT_CONFIG: Record<string, CatConfig> = {
  DELIVERY: {
    showItemName: true,
    showDate: true, dateLabel: '발생일',
    showContent: true, contentLabel: '구체적 내용',
    showFile: true, fileHint: '📸 불량 사진을 첨부하면 더 빠르게 처리됩니다',
  },
  MENU: {
    showDate: true, dateLabel: '해당 날짜',
    showContent: true, contentLabel: '구체적 요청사항',
  },
  STAFF_MEAL: {
    showDate: true, dateLabel: '해당 날짜',
    showStaffCount: true,
    showContent: true, contentLabel: '컴플레인 내용',
    showFile: true,
  },
  HYGIENE: {
    showDate: true, dateLabel: '발생일',
    showContent: true, contentLabel: '구체적 내용',
    showFile: true, fileHint: '📸 이물질·위생 관련 사진을 첨부하면 더 빠르게 처리됩니다',
  },
  COMPLAINT: {
    showDate: true, dateLabel: '발생일',
    showContent: true, contentLabel: '컴플레인 내용',
    showFile: true, fileHint: '📸 관련 사진을 첨부하면 더 빠르게 처리됩니다',
  },
  CONTRACT: {
    showContent: true, contentLabel: '문의 내용',
  },
  OTHER: {
    showContent: true, contentLabel: '문의 내용',
  },
}

export default function NewInquiryPage() {
  const router = useRouter()
  const [branchName, setBranchName] = useState('')
  const [category, setCategory] = useState<InquiryCategory | null>(null)
  const [formData, setFormData] = useState<Record<string, string>>({})
  const [content, setContent] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  useEffect(() => {
    const supabase = createClient()
    async function fetchBranch() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
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
      }
    }
    fetchBranch()
  }, [])

  const handleFieldChange = useCallback((key: string, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }))
  }, [])

  const cfg = category ? CAT_CONFIG[category as string] : null

  const canSubmit = !!cfg
    && (!cfg.showItemName || !!formData.item_name?.trim())
    && (!cfg.showDate || !!formData.incident_date)
    && (!cfg.showStaffCount || !!formData.staff_count?.trim())
    && content.trim().length > 0
    && !submitting

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit || !category) return
    setSubmitting(true)
    setError('')

    const supabase = createClient()

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('로그인이 필요합니다.')

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

      if (!branchId) throw new Error('지점 정보를 찾을 수 없습니다. 관리자에게 문의하세요.')

      if (!brandId) {
        const { data: b } = await supabase
          .from('branches')
          .select('brand_id')
          .eq('id', branchId)
          .maybeSingle()
        brandId = b?.brand_id || null
      }

      const storedFormData = Object.keys(formData).length > 0 ? formData : null

      const { data: inquiry, error: inqError } = await supabase
        .from('inquiries')
        .insert({
          branch_id: branchId,
          brand_id: brandId,
          title: CATEGORY_LABELS[category],
          category,
          status: 'pending',
          priority: 'medium',
          created_by_type: 'branch',
          created_by_id: user.id,
          form_data: storedFormData,
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

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
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

          {/* 카테고리 선택 */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">
              문의 분류 <span className="text-red-500">*</span>
            </label>
            <p className="text-xs text-gray-400 mb-3">분류를 선택하면 입력 항목이 나타납니다</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {FORM_CATEGORIES.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    setCategory(cat)
                    setFormData({})
                    setContent('')
                    setFiles([])
                  }}
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

          {/* 카테고리별 동적 필드 */}
          <div className={`overflow-hidden transition-all duration-300 ${cfg ? 'max-h-[1200px] opacity-100' : 'max-h-0 opacity-0'}`}>
            {cfg && (
              <div className="space-y-4 border-t border-gray-100 pt-4">
                {/* 품목명 (배송/납품 문제) */}
                {cfg.showItemName && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      품목명 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.item_name || ''}
                      onChange={e => handleFieldChange('item_name', e.target.value)}
                      placeholder="불량 품목명을 입력하세요"
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F] focus:border-transparent"
                    />
                  </div>
                )}

                {/* 날짜 선택 */}
                {cfg.showDate && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      {cfg.dateLabel} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={formData.incident_date || ''}
                      onChange={e => handleFieldChange('incident_date', e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F] focus:border-transparent"
                    />
                  </div>
                )}

                {/* 교직원 식수 */}
                {cfg.showStaffCount && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      교직원 식수 <span className="text-red-500">*</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        value={formData.staff_count || ''}
                        onChange={e => handleFieldChange('staff_count', e.target.value)}
                        placeholder="인원 수"
                        className="w-36 px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F] focus:border-transparent"
                      />
                      <span className="text-sm text-gray-500">명분</span>
                    </div>
                  </div>
                )}

                {/* 내용 텍스트 */}
                {cfg.showContent && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      {cfg.contentLabel} <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={content}
                      onChange={e => setContent(e.target.value)}
                      rows={5}
                      placeholder={`${cfg.contentLabel}을 자세히 입력해 주세요`}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F] focus:border-transparent resize-none"
                    />
                    <p className="text-xs text-gray-400 mt-1 text-right">{content.length}자</p>
                  </div>
                )}

                {/* 사진 첨부 */}
                {cfg.showFile && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      사진 첨부 <span className="text-gray-400">(선택)</span>
                    </label>
                    {cfg.fileHint && (
                      <p className="text-xs text-[#2D6A4F] bg-[#E8F5E9] rounded-lg px-3 py-2 mb-2">
                        {cfg.fileHint}
                      </p>
                    )}
                    <FileUpload files={files} onFilesChange={setFiles} maxFiles={5} maxSizeMB={10} />
                  </div>
                )}
              </div>
            )}
          </div>

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
      </div>
    </div>
  )
}
