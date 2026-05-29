'use client'

import { useState } from 'react'
import type { InquiryNote } from '@/lib/types'

interface Props {
  notes: InquiryNote[]
  onAdd: (content: string) => Promise<void>
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('ko-KR', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export default function InternalNote({ notes, onAdd }: Props) {
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!content.trim() || saving) return
    setSaving(true)
    await onAdd(content.trim())
    setContent('')
    setSaving(false)
  }

  return (
    <div className="space-y-3">
      <form onSubmit={handleSubmit} className="space-y-2">
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="내부 메모를 입력하세요 (고객에게 보이지 않음)"
          rows={3}
          className="w-full px-3 py-2 rounded-xl border border-yellow-200 bg-yellow-50 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-yellow-300 resize-none placeholder:text-gray-400"
        />
        <button
          type="submit"
          disabled={!content.trim() || saving}
          className="w-full py-2 rounded-xl text-sm font-medium bg-yellow-100 text-yellow-800 hover:bg-yellow-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? '저장 중...' : '🔒 메모 저장'}
        </button>
      </form>

      {notes.length > 0 && (
        <div className="space-y-2">
          {notes.map(note => (
            <div key={note.id} className="bg-yellow-50 border border-yellow-100 rounded-xl px-3 py-2.5">
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{note.content}</p>
              <p className="text-xs text-yellow-600 mt-1.5">
                {note.admins?.name || '관리자'} · {formatTime(note.created_at)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
