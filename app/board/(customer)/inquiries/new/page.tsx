'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import {
  CATEGORY_ICONS, CATEGORY_LABELS,
  type InquiryCategory,
} from '@/lib/types'
import DynamicForm from '@/components/board/DynamicForm'
import FileUpload from '@/components/board/FileUpload'

const CATEGORIES: InquiryCategory[] = [
  'MEAL_COUNT', 'ALLERGY', 'DELIVERY', 'MENU', 'SCHEDULE', 'PHOTO', 'CONTRACT', 'OTHER',
]

export default function NewInquiryPage() {
  const router = useRouter()
  const [category, setCategory] = useState<InquiryCategory | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [formData, setFormData] = useState<Record<string, unknown>>({})
  const [files, setFiles] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleFormChange = useCallback((key: string, value: unknown) => {
    setFormData(prev => ({ ...prev, [key]: value }))
  }, [])

  const canSubmit = category && title.trim() && content.trim() && !submitting

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit || !category) return
    setSubmitting(true)
    setError('')

    const supabase = createClient()

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('로그인이 필요합니다.')

      // Get branch_id and brand_id
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

      if (!branchId || !brandId) throw new Error('지점 정보를 찾을 수 없습니다.')

      // Create inquiry
      const { data: inquiry, error: inqError } = await supabase
        .from('inquiries')
        .insert({
          branch_id: branchId,
          brand_id: brandId,
          title: title.trim(),
          category,
          status: 'pending',
          priority: 'normal',
          form_data: Object.keys(formData).length > 0 ? formData : null,
          last_message_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (inqError) throw inqError

      // Create first message
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

      // Upload files
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

      router.push(`/board/inquiries/${inquiry.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : '문의 등록에 실패했습니다.')
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F6FAF6] font-sans">
      <header className="bg-white border-b border-gray-100 px-4 sm:px-6 py-4 flex items-center gap-3 sticky top-0 z-10">
        <Link href="/board/inquiries" className="text-gray-400 hover:text-gray-600">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5m7-7l-7 7 7 7" />
          </svg>
        </Link>
        <h1 className="font-bold text-[#1C2B1E]">새 문의 작성</h1>
      </header>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
          {/* 카테고리 선택 */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-3">
              문의 분류 <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    setCategory(cat)
                    setFormData({})
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

          {/* 동적 폼 필드 */}
          {category && ['MEAL_COUNT', 'ALLERGY', 'DELIVERY', 'SCHEDULE'].includes(category) && (
            <DynamicForm
              category={category}
              values={formData}
              onChange={handleFormChange}
            />
          )}

          {/* 제목 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              제목 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="문의 제목을 입력하세요"
              maxLength={100}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F] focus:border-transparent"
            />
          </div>

          {/* 내용 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              내용 <span className="text-red-500">*</span>
            </label>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              rows={6}
              placeholder="문의 내용을 자세히 입력해주세요"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F] focus:border-transparent resize-none"
            />
            <p className="text-xs text-gray-400 mt-1 text-right">{content.length}자</p>
          </div>

          {/* 파일 첨부 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              파일 첨부 <span className="text-gray-400">(선택)</span>
            </label>
            <FileUpload files={files} onFilesChange={setFiles} maxFiles={5} maxSizeMB={10} />
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
