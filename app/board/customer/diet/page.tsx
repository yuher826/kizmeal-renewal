'use client'

import { useState } from 'react'

const TABS = [
  { key: 'this', label: '이번달' },
  { key: 'last', label: '지난달' },
]

export default function CustomerDietPage() {
  const [tab, setTab] = useState<'this' | 'last'>('this')

  return (
    <div className="min-h-screen bg-[#F6FAF6] font-sans">
      <header className="bg-white border-b border-gray-100 px-4 sm:px-6 h-16 flex items-center sticky top-0 z-10">
        <div>
          <h1 className="font-bold text-[#1C2B1E] text-base">식단표</h1>
          <p className="text-gray-400 text-xs">우리 원 월별 식단표를 확인하세요</p>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* 월별 탭 */}
        <div className="flex gap-2">
          {TABS.map(t => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key as 'this' | 'last')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                tab === t.key
                  ? 'bg-[#2D6A4F] text-white'
                  : 'bg-white text-gray-500 border border-gray-200 hover:bg-[#E8F5E9] hover:text-[#2D6A4F]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* PDF 뷰어 영역 */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="aspect-[3/4] flex flex-col items-center justify-center text-center p-8 bg-[#F8FDF8]">
            <div className="text-5xl mb-4">🍱</div>
            <h2 className="font-bold text-[#1C2B1E] text-lg mb-1">
              {tab === 'this' ? '이번달' : '지난달'} 식단표를 준비 중입니다
            </h2>
            <p className="text-sm text-gray-400 leading-relaxed">
              영양사 선생님이 식단표를 업로드하면<br />
              이곳에서 바로 확인하실 수 있습니다.
            </p>
          </div>
        </div>

        {/* 다운로드 */}
        <button
          type="button"
          disabled
          className="w-full bg-[#2D6A4F] disabled:bg-gray-200 disabled:cursor-not-allowed text-white font-semibold py-3.5 rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
        >
          <span>⬇️</span> 식단표 다운로드
        </button>
        <p className="text-center text-xs text-gray-400">식단표가 등록되면 다운로드 버튼이 활성화됩니다</p>
      </div>
    </div>
  )
}
