'use client'

import Link from 'next/link'

export default function AdminNoticesNewPage() {
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
            placeholder="공지 제목을 입력하세요"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F] focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">대상</label>
          <select className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F] focus:border-transparent">
            <option>전체</option>
            <option>학부모</option>
            <option>원장</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">내용</label>
          <textarea
            rows={10}
            placeholder="공지 내용을 입력하세요"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F] focus:border-transparent resize-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <input type="checkbox" id="pinned" className="w-4 h-4 accent-[#2D6A4F]" />
          <label htmlFor="pinned" className="text-sm text-gray-600 cursor-pointer">상단 고정</label>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700">
          공지 저장 기능은 준비 중입니다. 조만간 업데이트됩니다.
        </div>

        <div className="flex gap-3 pt-2">
          <Link
            href="/board/admin/notices"
            className="flex-1 flex items-center justify-center py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            취소
          </Link>
          <button
            type="button"
            disabled
            className="flex-1 py-3 rounded-xl bg-gray-200 text-sm font-semibold text-gray-400 cursor-not-allowed"
          >
            저장 (준비 중)
          </button>
        </div>
      </div>
    </div>
  )
}
