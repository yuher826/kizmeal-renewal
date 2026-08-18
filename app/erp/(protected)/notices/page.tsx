'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Loader2 } from 'lucide-react'

type Notice = {
  id: string
  title: string
  content: string | null
  branch_id: string | null
  is_pinned: boolean
  is_popup: boolean
  popup_until: string | null
  created_at: string
  target_label: string
}

export default function AdminNoticesPage() {
  const [notices, setNotices] = useState<Notice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [togglingId, setTogglingId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/notices')
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? '조회에 실패했습니다'); return }
      setNotices(data.notices ?? [])
    } catch {
      setError('네트워크 오류가 발생했습니다')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function turnOffPopup(id: string) {
    setTogglingId(id)
    try {
      const res = await fetch('/api/notices', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_popup: false }),
      })
      if (res.ok) {
        setNotices(prev => prev.map(n => (n.id === id ? { ...n, is_popup: false } : n)))
      }
    } finally {
      setTogglingId(null)
    }
  }

  const pinned = notices.filter(n => n.is_pinned)
  const normal = notices.filter(n => !n.is_pinned)

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
  }

  return (
    <main className="min-h-screen bg-[#F6FAF6] px-4 sm:px-6 py-6 sm:py-8">
      {/* 헤더 */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">고객사 공지</h1>
          <p className="text-sm text-slate-500 mt-0.5">계약 원 담당자에게 전달할 공지를 관리합니다</p>
        </div>
        <Link
          href="/erp/notices/new"
          className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors whitespace-nowrap flex-shrink-0"
        >
          <Plus size={15} />
          공지 작성
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400">
          <Loader2 size={20} className="animate-spin mr-2" /> 불러오는 중...
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">{error}</div>
      ) : (
        <>
          {/* 고정 공지 */}
          {pinned.length > 0 && (
            <div className="space-y-3 mb-4">
              {pinned.map(n => (
                <div key={n.id} className="bg-white rounded-xl border-2 border-emerald-200 p-5 flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-[11px] bg-emerald-600 text-white font-bold px-2 py-0.5 rounded-full">📌 고정</span>
                      {n.is_popup && (
                        <span className="text-[11px] bg-orange-500 text-white font-bold px-2 py-0.5 rounded-full">🔔 팝업 노출 중</span>
                      )}
                      <span className="text-[11px] bg-emerald-50 text-emerald-700 font-medium px-2 py-0.5 rounded-full">{n.target_label}</span>
                    </div>
                    <h3 className="font-semibold text-slate-800 truncate">{n.title}</h3>
                    <p className="text-xs text-slate-400 mt-1">{formatDate(n.created_at)}</p>
                  </div>
                  {n.is_popup && (
                    <button
                      type="button"
                      onClick={() => turnOffPopup(n.id)}
                      disabled={togglingId === n.id}
                      className="flex-shrink-0 text-xs font-medium text-orange-600 border border-orange-200 hover:bg-orange-50 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                    >
                      팝업 끄기
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* 일반 공지 */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    {['제목', '대상', '작성일', '팝업'].map(h => (
                      <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-slate-500 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {normal.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-5 py-10 text-center text-slate-400 text-sm">
                        고객사 공지가 없습니다
                      </td>
                    </tr>
                  ) : normal.map(n => (
                    <tr key={n.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-4 text-sm font-medium text-slate-800">{n.title}</td>
                      <td className="px-5 py-4">
                        <span className="text-[11px] bg-emerald-50 text-emerald-700 font-medium px-2 py-0.5 rounded-full">{n.target_label}</span>
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-500">{formatDate(n.created_at)}</td>
                      <td className="px-5 py-4 text-sm">
                        {n.is_popup ? (
                          <button
                            type="button"
                            onClick={() => turnOffPopup(n.id)}
                            disabled={togglingId === n.id}
                            className="text-xs font-medium text-orange-600 border border-orange-200 hover:bg-orange-50 px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50"
                          >
                            🔔 끄기
                          </button>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </main>
  )
}
