'use client'

import Link from 'next/link'
import { Plus } from 'lucide-react'

type Notice = {
  id: string
  title: string
  date: string
  target: string
  pinned: boolean
}

const SAMPLE: Notice[] = [
  { id: '1', title: '2026년 1학기 식자재 단가 안내', date: '2026-05-28', target: '전체 원', pinned: true },
  { id: '3', title: '5월 신메뉴 레시피 업데이트',    date: '2026-05-12', target: '유치원',  pinned: false },
]

export default function AdminNoticesPage() {
  const pinned = SAMPLE.filter(n => n.pinned)
  const normal = SAMPLE.filter(n => !n.pinned)

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

      {/* 고정 공지 */}
      {pinned.length > 0 && (
        <div className="space-y-3 mb-4">
          {pinned.map(n => (
            <div key={n.id} className="bg-white rounded-xl border-2 border-emerald-200 p-5 flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[11px] bg-emerald-600 text-white font-bold px-2 py-0.5 rounded-full">📌 고정</span>
                  <span className="text-[11px] bg-emerald-50 text-emerald-700 font-medium px-2 py-0.5 rounded-full">{n.target}</span>
                </div>
                <h3 className="font-semibold text-slate-800 truncate">{n.title}</h3>
                <p className="text-xs text-slate-400 mt-1">{n.date}</p>
              </div>
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
                {['제목', '대상', '작성일', '고정'].map(h => (
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
                <tr key={n.id} className="hover:bg-slate-50 transition-colors cursor-pointer">
                  <td className="px-5 py-4 text-sm font-medium text-slate-800">{n.title}</td>
                  <td className="px-5 py-4">
                    <span className="text-[11px] bg-emerald-50 text-emerald-700 font-medium px-2 py-0.5 rounded-full">{n.target}</span>
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-500">{n.date}</td>
                  <td className="px-5 py-4 text-sm text-slate-300">—</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  )
}
