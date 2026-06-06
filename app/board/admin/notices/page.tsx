'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

type Notice = {
  id: string
  title: string
  date: string
  target: string
  pinned: boolean
  type: 'public' | 'branch'
}

const SAMPLE: Notice[] = [
  { id: '1', title: '2026년 1학기 식자재 단가 안내', date: '2026-05-28', target: '전체 원', pinned: true, type: 'branch' },
  { id: '2', title: '여름철 식중독 예방 가이드 배포', date: '2026-05-20', target: '전체 원', pinned: false, type: 'public' },
  { id: '3', title: '5월 신메뉴 레시피 업데이트', date: '2026-05-12', target: '유치원', pinned: false, type: 'branch' },
]

export default function AdminNoticesPage() {
  const searchParams = useSearchParams()
  const activeType = (searchParams.get('type') as 'public' | 'branch') || 'public'

  const filtered = SAMPLE.filter(n => n.type === activeType)
  const pinned = filtered.filter(n => n.pinned)
  const normal = filtered.filter(n => !n.pinned)

  return (
    <div className="min-h-screen bg-[#F6FAF6] font-sans">
      <header className="bg-white border-b border-gray-100 px-4 sm:px-6 h-16 hidden sm:flex items-center justify-between sticky top-0 z-10">
        <div>
          <div className="flex items-center gap-1 text-xs text-gray-400 mb-0.5">
            <Link href="/board/admin" className="hover:text-[#2D6A4F] transition-colors">소통채널</Link>
            <span>›</span>
            <span>{activeType === 'public' ? '홈페이지&포털' : '운영관리'}</span>
            <span>›</span>
            <span className="text-[#2D6A4F] font-medium">{activeType === 'public' ? '공지사항' : '고객사 공지'}</span>
          </div>
          <h1 className="font-bold text-[#1C2B1E] text-base">공지사항</h1>
          <p className="text-gray-400 text-xs">
            {activeType === 'public' ? '홈페이지에 게시될 공지를 관리합니다' : '계약 원 담당자에게 전달할 공지를 관리합니다'}
          </p>
        </div>
        <button
          type="button"
          className="bg-[#2D6A4F] hover:bg-[#1B4332] text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors inline-flex items-center gap-1.5"
        >
          <span>✏️</span> 공지 작성
        </button>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        {/* 탭 */}
        <div className="flex gap-1 bg-white border border-gray-100 rounded-2xl p-1 w-fit">
          <Link
            href="/board/admin/notices?type=public"
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
              activeType === 'public'
                ? 'bg-[#2D6A4F] text-white'
                : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            🌐 홈페이지 공지
          </Link>
          <Link
            href="/board/admin/notices?type=branch"
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
              activeType === 'branch'
                ? 'bg-[#2D6A4F] text-white'
                : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            📣 고객사 공지
          </Link>
        </div>

        {/* 고정 공지 */}
        {pinned.length > 0 && (
          <div className="space-y-3">
            {pinned.map(n => (
              <div key={n.id} className="bg-white rounded-2xl border-2 border-[#2D6A4F]/20 p-5 flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[11px] bg-[#2D6A4F] text-white font-bold px-2 py-0.5 rounded-full">📌 고정</span>
                    <span className="text-[11px] bg-[#E8F5E9] text-[#2D6A4F] font-medium px-2 py-0.5 rounded-full">{n.target}</span>
                  </div>
                  <h3 className="font-semibold text-[#1C2B1E] truncate">{n.title}</h3>
                  <p className="text-xs text-gray-400 mt-1">{n.date}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 일반 공지 */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[#F8FDF8]">
                  {['제목', '대상', '작성일', '고정'].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-bold text-gray-400 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {normal.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-10 text-center text-gray-400 text-sm">
                      {activeType === 'public' ? '홈페이지 공지가 없습니다' : '고객사 공지가 없습니다'}
                    </td>
                  </tr>
                ) : normal.map(n => (
                  <tr key={n.id} className="hover:bg-[#F8FDF8] transition-colors">
                    <td className="px-5 py-4 text-sm font-medium text-[#1C2B1E]">{n.title}</td>
                    <td className="px-5 py-4">
                      <span className="text-[11px] bg-[#E8F5E9] text-[#2D6A4F] font-medium px-2 py-0.5 rounded-full">{n.target}</span>
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-500">{n.date}</td>
                    <td className="px-5 py-4 text-sm text-gray-300">—</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 border-t border-gray-100">
            <p className="text-xs text-gray-400">공지 작성 및 저장 기능은 준비 중입니다</p>
          </div>
        </div>
      </div>
    </div>
  )
}
