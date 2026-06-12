'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type Notice = {
  id: string
  title: string
  content: string | null
  is_pinned: boolean
  attachment_url: string | null
  created_at: string
}

export default function AdminNoticesPage() {
  const [notices, setNotices] = useState<Notice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/board/notices')
      .then(r => r.json())
      .then(data => {
        if (data.notices) setNotices(data.notices)
        else setError('공지를 불러오지 못했습니다.')
      })
      .catch(() => setError('공지를 불러오지 못했습니다.'))
      .finally(() => setLoading(false))
  }, [])

  async function handleTogglePin(notice: Notice) {
    const next = !notice.is_pinned
    setNotices(prev => prev.map(n => n.id === notice.id ? { ...n, is_pinned: next } : n))
    const res = await fetch('/api/board/notices', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: notice.id, is_pinned: next }),
    })
    if (!res.ok) {
      setNotices(prev => prev.map(n => n.id === notice.id ? { ...n, is_pinned: notice.is_pinned } : n))
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('정말 삭제하시겠습니까?')) return
    setNotices(prev => prev.filter(n => n.id !== id))
    const res = await fetch(`/api/board/notices?id=${id}`, { method: 'DELETE' })
    if (!res.ok) {
      fetch('/api/board/notices').then(r => r.json()).then(data => {
        if (data.notices) setNotices(data.notices)
      })
    }
  }

  const pinned = notices.filter(n => n.is_pinned)
  const normal = notices.filter(n => !n.is_pinned)

  return (
    <div className="min-h-screen bg-[#F6FAF6] font-sans">
      <header className="bg-white border-b border-gray-100 px-4 sm:px-6 h-16 hidden sm:flex items-center justify-between sticky top-0 z-10">
        <div>
          <div className="flex items-center gap-1 text-xs text-gray-400 mb-0.5">
            <Link href="/board/admin" className="hover:text-[#2D6A4F] transition-colors">소통채널</Link>
            <span>›</span>
            <span>홈페이지&amp;포털</span>
            <span>›</span>
            <span className="text-[#2D6A4F] font-medium">홈페이지 공지</span>
          </div>
          <h1 className="font-bold text-[#1C2B1E] text-base">홈페이지 공지</h1>
          <p className="text-gray-400 text-xs">학부모 포털에 게시되는 공지를 관리합니다</p>
        </div>
        <Link
          href="/board/admin/notices/new"
          className="bg-[#2D6A4F] hover:bg-[#1B4332] text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors inline-flex items-center gap-1.5"
        >
          <span>✏️</span> 공지 작성
        </Link>
      </header>

      <div className="px-4 sm:px-6 py-6 space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">{error}</div>
        )}

        {loading && (
          <div className="text-sm text-gray-400 text-center py-10">불러오는 중...</div>
        )}

        {!loading && (
          <>
            {/* 고정 공지 */}
            {pinned.length > 0 && (
              <div className="space-y-3">
                {pinned.map(n => (
                  <div key={n.id} className="bg-white rounded-2xl border-2 border-[#2D6A4F]/20 p-5 flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[11px] bg-[#2D6A4F] text-white font-bold px-2 py-0.5 rounded-full">📌 고정</span>
                      </div>
                      <h3 className="font-semibold text-[#1C2B1E] truncate">{n.title}</h3>
                      <p className="text-xs text-gray-400 mt-1">{n.created_at.slice(0, 10)}</p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleTogglePin(n)}
                        className="text-xs px-3 py-1.5 rounded-lg border border-[#2D6A4F] text-[#2D6A4F] hover:bg-[#E8F5E9] transition-colors"
                      >
                        고정 해제
                      </button>
                      <button
                        onClick={() => handleDelete(n.id)}
                        className="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-colors"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 공지 목록 */}
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-[#F8FDF8]">
                      {['제목', '작성일', '고정', ''].map((h, i) => (
                        <th key={i} className="text-left px-5 py-3 text-xs font-bold text-gray-400 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {normal.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-5 py-10 text-center text-gray-400 text-sm">
                          홈페이지 공지가 없습니다
                        </td>
                      </tr>
                    ) : normal.map(n => (
                      <tr key={n.id} className="hover:bg-[#F8FDF8] transition-colors">
                        <td className="px-5 py-4 text-sm font-medium text-[#1C2B1E]">{n.title}</td>
                        <td className="px-5 py-4 text-sm text-gray-500 whitespace-nowrap">{n.created_at.slice(0, 10)}</td>
                        <td className="px-5 py-4">
                          <button
                            onClick={() => handleTogglePin(n)}
                            className="text-xs px-3 py-1 rounded-lg border border-gray-200 text-gray-500 hover:border-[#2D6A4F] hover:text-[#2D6A4F] transition-colors"
                          >
                            상단 고정
                          </button>
                        </td>
                        <td className="px-5 py-4">
                          <button
                            onClick={() => handleDelete(n.id)}
                            className="text-xs px-3 py-1 rounded-lg border border-red-200 text-red-400 hover:bg-red-50 transition-colors"
                          >
                            삭제
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 모바일 공지 작성 버튼 */}
            <div className="sm:hidden">
              <Link
                href="/board/admin/notices/new"
                className="w-full flex items-center justify-center gap-2 bg-[#2D6A4F] text-white text-sm font-semibold py-3 rounded-2xl transition-colors hover:bg-[#1B4332]"
              >
                <span>✏️</span> 공지 작성
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
