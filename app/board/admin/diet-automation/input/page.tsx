'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function DietInputIndexPage() {
  const router = useRouter()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)

  return (
    <div className="min-h-screen bg-[#F6FAF6] p-4 sm:p-6">
      <div className="max-w-md mx-auto">
        {/* 헤더 */}
        <div className="mb-6 flex items-center gap-3">
          <Link
            href="/board/admin/diet-automation"
            className="text-gray-400 hover:text-[#2D6A4F] transition-colors"
          >
            ← 뒤로
          </Link>
          <div>
            <h1 className="text-xl font-bold text-[#1C2B1E]">📋 월별 식단 입력</h1>
            <p className="text-sm text-gray-500 mt-0.5">CK 공통 식단 입력</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-5 shadow-sm">
          {/* 연도 선택 */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">연도</label>
            <div className="flex gap-2">
              {[2025, 2026, 2027].map(y => (
                <button
                  key={y}
                  type="button"
                  onClick={() => setYear(y)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors border ${
                    year === y
                      ? 'bg-[#2D6A4F] text-white border-[#2D6A4F]'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-[#2D6A4F] hover:text-[#2D6A4F]'
                  }`}
                >
                  {y}년
                </button>
              ))}
            </div>
          </div>

          {/* 월 선택 */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">월</label>
            <div className="grid grid-cols-6 gap-1.5">
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMonth(m)}
                  className={`py-2 rounded-lg text-sm font-medium transition-colors ${
                    month === m
                      ? 'bg-[#2D6A4F] text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-[#E8F5E9] hover:text-[#2D6A4F]'
                  }`}
                >
                  {m}월
                </button>
              ))}
            </div>
          </div>

          {/* 확인 카드 */}
          <div className="bg-[#F6FAF6] border border-[#B7E4C7] rounded-xl p-4 text-center">
            <p className="text-sm text-gray-500 mb-1">입력할 식단</p>
            <p className="text-2xl font-bold text-[#2D6A4F]">
              {year}년 {month}월
            </p>
            <p className="text-xs text-gray-400 mt-1">CK 공통 식단</p>
          </div>

          <button
            type="button"
            onClick={() => router.push(`/board/admin/diet-automation/input/${year}/${month}`)}
            className="w-full bg-[#2D6A4F] text-white py-3.5 rounded-xl font-semibold hover:bg-[#1B4332] transition-colors text-sm"
          >
            {year}년 {month}월 식단 입력하기 →
          </button>
        </div>
      </div>
    </div>
  )
}
