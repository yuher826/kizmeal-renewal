'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { getParentProfile } from '@/lib/parent-auth'
import type { Parent, Child } from '@/lib/parent-auth'
import { PARENT_INQ_CATEGORIES } from '@/lib/parent-inquiry'
import BottomNav from '@/components/parent/BottomNav'

export default function ParentInquiryNewPage() {
  const router = useRouter()
  const [parent, setParent] = useState<Parent | null>(null)
  const [children, setChildren] = useState<Child[]>([])
  const [childId, setChildId] = useState<string>('')

  const [category, setCategory] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getParentProfile().then(({ parent, children }) => {
      setParent(parent)
      setChildren(children)
      if (children.length > 0) {
        const saved = localStorage.getItem('selectedChildId')
        setChildId(children.find(c => c.id === saved)?.id || children[0].id)
      }
    })
  }, [])

  const selectedChild = children.find(c => c.id === childId)

  function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const list = Array.from(e.target.files || [])
    setFiles(prev => [...prev, ...list].slice(0, 3))
    e.target.value = ''
  }

  const canSubmit = !!category && title.trim().length > 0 && content.trim().length > 0 && !submitting

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit || !category || !parent) return
    setSubmitting(true)
    setError('')

    const supabase = createClient()
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('로그인이 필요합니다.')

      // 사진 업로드 (kizmeal-contents 버킷 — 인증 사용자 쓰기 허용)
      const imageUrls: string[] = []
      for (const file of files) {
        const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
        const path = `parent-inquiries/${parent.id}/${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`
        const { data: up, error: upErr } = await supabase.storage
          .from('kizmeal-contents')
          .upload(path, file, { upsert: true })
        if (upErr) throw new Error('사진 업로드에 실패했습니다.')
        if (up) {
          const { data: urlData } = supabase.storage.from('kizmeal-contents').getPublicUrl(path)
          if (urlData?.publicUrl) imageUrls.push(urlData.publicUrl)
        }
      }

      const now = new Date().toISOString()
      const { data: inquiry, error: inqErr } = await supabase
        .from('parent_inquiries')
        .insert({
          parent_id: parent.id,
          child_id: selectedChild?.id || null,
          branch_id: selectedChild?.branch_id || null,
          category,
          title: title.trim(),
          status: 'pending',
          last_message_at: now,
          unread_count_admin: 1,
        })
        .select()
        .single()
      if (inqErr) throw inqErr

      const { error: msgErr } = await supabase
        .from('parent_inquiry_messages')
        .insert({
          inquiry_id: inquiry.id,
          sender_type: 'parent',
          sender_id: user.id,
          content: content.trim(),
          image_urls: imageUrls.length > 0 ? imageUrls : null,
        })
      if (msgErr) throw msgErr

      router.push(`/parent/inquiry/${inquiry.id}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message
        : typeof err === 'object' && err !== null && 'message' in err
        ? (err as { message: string }).message
        : '문의 등록에 실패했습니다.'
      setError(msg)
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F6FAF6] pb-20">
      <header className="bg-white border-b border-gray-100 px-4 py-4 flex items-center gap-3 sticky top-16 z-10">
        <button type="button" onClick={() => router.back()} className="text-gray-400 hover:text-gray-600">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5m7-7l-7 7 7 7" />
          </svg>
        </button>
        <h1 className="font-bold text-[#1C2B1E]">문의하기</h1>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-5">
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 p-5 space-y-5">

          {/* 아이/원 자동 표시 */}
          {selectedChild && (
            <div className="bg-[#F6FAF6] rounded-xl px-4 py-3">
              {children.length > 1 ? (
                <select
                  value={childId}
                  onChange={e => setChildId(e.target.value)}
                  className="w-full bg-transparent text-sm font-medium text-[#1C2B1E] focus:outline-none"
                >
                  {children.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name_ko} · {[c.branches?.brands?.name, c.branches?.name].filter(Boolean).join(' ')}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-sm font-medium text-[#1C2B1E]">
                  {selectedChild.name_ko} · {[selectedChild.branches?.brands?.name, selectedChild.branches?.name].filter(Boolean).join(' ')}
                </p>
              )}
            </div>
          )}

          {/* 카테고리 */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              문의 분류 <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {PARENT_INQ_CATEGORIES.map(cat => (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => setCategory(cat.key)}
                  className={`flex items-center gap-2 px-3 py-3 rounded-xl border text-sm font-medium transition-all ${
                    category === cat.key
                      ? 'bg-[#2D6A4F] border-[#2D6A4F] text-white shadow-md'
                      : 'bg-white border-gray-200 text-gray-600 hover:border-[#52B788]'
                  }`}
                >
                  <span className="text-lg">{cat.icon}</span>
                  <span className="text-xs leading-tight text-left">{cat.label}</span>
                </button>
              ))}
            </div>
            {category === 'ALLERGY' && (
              <p className="mt-2 text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                🚨 알레르기 관련은 최우선으로 처리됩니다.
              </p>
            )}
          </div>

          {/* 제목 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              제목 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="제목을 입력해주세요"
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
              rows={5}
              placeholder="문의 내용을 자세히 입력해주세요"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F] focus:border-transparent resize-none"
            />
          </div>

          {/* 사진 첨부 (최대 3장) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              사진 첨부 <span className="text-gray-400">(선택 · 최대 3장)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {files.map((file, i) => (
                <div key={i} className="relative w-20 h-20">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={URL.createObjectURL(file)} alt="" className="w-20 h-20 object-cover rounded-xl border border-gray-100" />
                  <button
                    type="button"
                    onClick={() => setFiles(prev => prev.filter((_, idx) => idx !== i))}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center"
                  >×</button>
                </div>
              ))}
              {files.length < 3 && (
                <label className="w-20 h-20 border-2 border-dashed border-gray-200 rounded-xl flex items-center justify-center text-gray-300 cursor-pointer hover:border-[#52B788] hover:text-[#52B788] transition-colors">
                  <span className="text-2xl">+</span>
                  <input type="file" accept="image/*" multiple onChange={handleFiles} className="hidden" />
                </label>
              )}
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full bg-[#2D6A4F] hover:bg-[#1B4332] disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                등록 중...
              </>
            ) : '문의 등록'}
          </button>
        </form>
      </div>

      <BottomNav />
    </div>
  )
}
