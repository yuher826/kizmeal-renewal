'use client'

import { useState } from 'react'
import type { ReplyTemplate, InquiryCategory } from '@/lib/types'

interface Props {
  templates: ReplyTemplate[]
  category?: InquiryCategory
  onSelect: (content: string) => void
}

export default function ReplyTemplates({ templates, category, onSelect }: Props) {
  const [open, setOpen] = useState(false)

  const filtered = templates.filter(t => !t.category || t.category === category || !category)

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-[#E8F5E9] text-[#2D6A4F] font-medium hover:bg-[#D1F0DA] transition-colors"
      >
        <span>📋</span>
        <span>답변 템플릿</span>
        <span className="text-[10px]">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="absolute bottom-full mb-2 left-0 w-72 bg-white rounded-2xl border border-gray-200 shadow-lg z-50 max-h-64 overflow-y-auto">
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-xs font-bold text-gray-500">답변 템플릿 선택</p>
          </div>
          {filtered.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-gray-400">
              등록된 템플릿이 없습니다
            </div>
          ) : (
            <ul className="py-1">
              {filtered.map(t => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(t.content)
                      setOpen(false)
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-[#F8FDF8] transition-colors"
                  >
                    <p className="text-sm font-medium text-[#1C2B1E]">{t.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{t.content}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
