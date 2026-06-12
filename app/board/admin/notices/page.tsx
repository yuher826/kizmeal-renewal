'use client'

import Link from 'next/link'

type Notice = {
  id: string
  title: string
  date: string
  target: string
  pinned: boolean
}

const SAMPLE: Notice[] = [
  { id: '2', title: '여름철 식중독 예방 가이드 배포', date: '2026-05-20', target: '전체', pinned: false },
]

export default function AdminNoticesPage() {
  const pinned = SAMPLE.filter(n => n.pinned)
  const normal = SAMPLE.filter(n => !n.pinned)

  return (
    <div className="min-h-screen bg-[#F6FAF6] font-sans">
      <header className="bg-white border-b border-gray-100 px-4 sm:px-6 h-16 hidden sm:flex items-center justify-between sticky top-0 z-10">
        <div>
          <div className="flex items-center gap-1 text-xs text-gray-400 mb-0.5">
            <Link href="/board/admin" className="hover:text-[#2D6A4F] transition-colors">소통채널</Link>
            <span>›</span>
            <span>홈페이지&포털</span>
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

        {/* 공지 목록 */}
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
                      홈페이지 공지가 없습니다
                    </td>
                  </tr>
                ) : normal.map(n => (
                  <tr key={n.id} className="hover:bg-[#F8FDF8] transition-colors cursor-pointer">
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
      </div>
    </div>
  )
}
