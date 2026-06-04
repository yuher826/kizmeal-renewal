'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

const STATUS_TABS = [
  { key: 'all', label: '전체' },
  { key: 'pending', label: '접수중' },
  { key: 'in_progress', label: '검토중' },
  { key: 'resolved', label: '답변완료' },
]

const STATUS_BADGES: Record<string, { label: string; color: string }> = {
  pending: { label: '접수중', color: 'bg-yellow-100 text-yellow-800' },
  in_progress: { label: '검토중', color: 'bg-blue-100 text-blue-800' },
  resolved: { label: '답변완료', color: 'bg-green-100 text-green-800' },
}

const CATEGORY_LABELS: Record<string, string> = {
  service: '서비스',
  price: '가격',
  menu: '메뉴',
  facility: '시설',
  other: '기타',
}

type Inquiry = {
  id: string
  inquiry_number: string
  name: string
  contact: string
  contact_type: string
  category: string
  title: string
  status: string
  is_notified: boolean
  created_at: string
}

export default function PublicInquiriesPage() {
  const [status, setStatus] = useState('all')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [inquiries, setInquiries] = useState<Inquiry[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ status, search })
    const res = await fetch(`/api/public-inquiry/admin?${params}`)
    if (res.ok) {
      const data = await res.json()
      setInquiries(data.data || [])
      setTotal(data.count || 0)
    }
    setLoading(false)
  }, [status, search])

  useEffect(() => { load() }, [load])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setSearch(searchInput)
  }

  const phoneNeedsCall = inquiries.filter(
    i => i.contact_type === 'phone' && i.status !== 'resolved' && !i.is_notified
  )
  const unansweredCount = inquiries.filter(i => i.status !== 'resolved').length

  return (
    <div className="min-h-screen bg-[#F0F4F0]">
      <header className="bg-white border-b border-gray-100 px-4 sm:px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/board/admin" className="text-[#2D6A4F] hover:underline text-sm whitespace-nowrap">
            ← 대시보드
          </Link>
          <span className="text-gray-300">/</span>
          <h1 className="font-bold text-[#1C2B1E] truncate">일반 문의 관리</h1>
          {unansweredCount > 0 && (
            <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0">
              {unansweredCount}
            </span>
          )}
        </div>
        <button onClick={load} className="text-sm text-gray-400 hover:text-[#2D6A4F] flex-shrink-0">
          새로고침
        </button>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">

        {/* Phone call needed - pinned */}
        {phoneNeedsCall.length > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4">
            <p className="text-orange-700 font-bold text-sm mb-3">
              📞 전화 연락 필요 ({phoneNeedsCall.length}건)
            </p>
            <div className="space-y-2">
              {phoneNeedsCall.map(i => (
                <Link
                  key={i.id}
                  href={`/board/admin/public-inquiries/${i.id}`}
                  className="flex items-center justify-between bg-white rounded-xl px-4 py-3 hover:bg-orange-50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-sm font-semibold text-[#1C2B1E] flex-shrink-0">{i.name}</span>
                    <span className="text-xs text-gray-400 truncate">{i.title}</span>
                  </div>
                  <span className="text-sm font-bold text-orange-600 flex-shrink-0 ml-3">{i.contact}</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-2xl p-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="flex gap-1 flex-wrap">
            {STATUS_TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setStatus(tab.key)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                  status === tab.key
                    ? 'bg-[#2D6A4F] text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <form onSubmit={handleSearch} className="flex-1 flex gap-2 w-full sm:w-auto">
            <input
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="이름, 연락처, 문의번호, 제목 검색"
              className="flex-1 border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]"
            />
            <button
              type="submit"
              className="bg-[#2D6A4F] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#1B4332] transition-colors"
            >
              검색
            </button>
          </form>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
          {loading ? (
            <div className="p-12 text-center text-gray-400">불러오는 중...</div>
          ) : inquiries.length === 0 ? (
            <div className="p-12 text-center text-gray-400">문의가 없습니다.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#F8FDF8] border-b border-gray-100">
                    {['문의번호', '이름', '유형', '제목', '연락처', '접수일', '상태'].map(h => (
                      <th key={h} className="text-left px-5 py-3 text-xs font-bold text-gray-400 whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {inquiries.map(inq => {
                    const badge = STATUS_BADGES[inq.status] || STATUS_BADGES.pending
                    return (
                      <tr key={inq.id} className="hover:bg-[#F8FDF8] transition-colors">
                        <td className="px-5 py-4">
                          <Link
                            href={`/board/admin/public-inquiries/${inq.id}`}
                            className="text-xs font-mono text-gray-500 hover:text-[#2D6A4F]"
                          >
                            {inq.inquiry_number}
                          </Link>
                        </td>
                        <td className="px-5 py-4 text-sm font-semibold text-[#1C2B1E] whitespace-nowrap">
                          <Link href={`/board/admin/public-inquiries/${inq.id}`} className="hover:text-[#2D6A4F]">
                            {inq.name}
                          </Link>
                        </td>
                        <td className="px-5 py-4 text-sm text-gray-500">
                          {CATEGORY_LABELS[inq.category] || inq.category}
                        </td>
                        <td className="px-5 py-4 max-w-xs">
                          <Link
                            href={`/board/admin/public-inquiries/${inq.id}`}
                            className="text-sm text-[#1C2B1E] hover:text-[#2D6A4F] block truncate"
                          >
                            {inq.title}
                          </Link>
                        </td>
                        <td className="px-5 py-4 text-sm text-gray-500 whitespace-nowrap">
                          {inq.contact_type === 'phone' ? '📞 ' : '✉️ '}
                          {inq.contact}
                        </td>
                        <td className="px-5 py-4 text-sm text-gray-400 whitespace-nowrap">
                          {new Date(inq.created_at).toLocaleDateString('ko-KR')}
                        </td>
                        <td className="px-5 py-4">
                          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${badge.color}`}>
                            {badge.label}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p className="text-xs text-gray-400 text-right">총 {total}건</p>
      </div>
    </div>
  )
}
