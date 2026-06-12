'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function AdminNoticesNewPage() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [isPinned, setIsPinned] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    if (!title.trim()) return
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/board/notices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), content: content.trim() || null, is_pinned: isPinned }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? '저장에 실패했습니다.')
        return
      }
      router.push('/board/admin/notices')
    } catch {
      setError('네트워크 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F6FAF6] font-sans">
      <header className="bg-white border-b border-gray-100 px-4 sm:px-6 h-16 hidden sm:flex items-center gap-3 sticky top-0 z-10">
        <Link
          href="/board/admin/notices"
          className="text-gray-400 hover:text-[#2D6A4F] transition-colors text-sm flex items-center gap-1"
        >
          ← 목록
        </Link>
        <div className="border-l border-gray-200 pl-3">
          <h1 className="font-bold text-[#1C2B1E] text-base">홈페이지 공지 작성</h1>
        </div>
      </header>

      <div className="px-4 sm:px-6 py-6 max-w-2xl mx-auto space-y-4">
        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">제목</label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="공지 제목을 입력하세요"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F] focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">내용</label>
          <textarea
            rows={10}
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="공지 내용을 입력하세요"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F] focus:border-transparent resize-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="pinned"
            checked={isPinned}
            onChange={e => setIsPinned(e.target.checked)}
            className="w-4 h-4 accent-[#2D6A4F]"
          />
          <label htmlFor="pinned" className="text-sm text-gray-600 cursor-pointer">상단 고정</label>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">{error}</div>
        )}

        <div className="flex gap-3 pt-2">
          <Link
            href="/board/admin/notices"
            className="flex-1 flex items-center justify-center py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            취소
          </Link>
          <button
            type="button"
            onClick={handleSave}
            disabled={!title.trim() || saving}
            className="flex-1 py-3 rounded-xl bg-[#2D6A4F] text-white text-sm font-semibold transition-colors hover:bg-[#1B4332] disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed"
          >
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}
