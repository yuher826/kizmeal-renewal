'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import type { Branch } from '@/lib/types'

const SNACK_SLOTS = [
  { key: 'morning', label: '오전' },
  { key: 'afternoon', label: '오후' },
  { key: 'afterschool', label: '방과후' },
  { key: 'care', label: '돌봄' },
]

export default function AdminDietPage() {
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('branches')
      .select('*, brands(*)')
      .eq('is_active', true)
      .order('name', { ascending: true })
    if (data) setBranches(data as Branch[])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div className="min-h-screen bg-[#F6FAF6] font-sans">
      <header className="bg-white border-b border-gray-100 px-4 sm:px-6 h-16 flex items-center justify-between sticky top-0 z-10">
        <div>
          <h1 className="font-bold text-[#1C2B1E] text-base">식단표 관리</h1>
          <p className="text-gray-400 text-xs">원별 식단표 프로파일 · 배포 관리</p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-2 bg-white border border-[#2D6A4F] text-[#2D6A4F] hover:bg-[#E8F5E9] text-sm font-medium px-4 py-2 rounded-xl transition-colors"
        >
          <span>📑</span> 엑셀 업로드
        </button>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* 이번달 배포 현황 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: '전체 원', value: loading ? '—' : branches.length, icon: '🏫' },
            { label: '이번달 배포 완료', value: loading ? '—' : 0, icon: '✅' },
            { label: '배포 대기', value: loading ? '—' : branches.length, icon: '⏳' },
            { label: '특이사항 등록', value: loading ? '—' : 0, icon: '📝' },
          ].map(card => (
            <div key={card.label} className="bg-white rounded-2xl border border-gray-100 p-4">
              <div className="text-xl mb-1">{card.icon}</div>
              <div className="text-2xl font-bold text-[#1C2B1E]">{card.value}</div>
              <div className="text-xs text-gray-400 mt-0.5">{card.label}</div>
            </div>
          ))}
        </div>

        {/* 원별 프로파일 */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div>
              <h2 className="font-bold text-[#1C2B1E]">원별 식단표 프로파일</h2>
              <p className="text-gray-400 text-xs mt-0.5">간식 구성 · 특이사항 · 배포 이력</p>
            </div>
            <button
              type="button"
              className="bg-[#2D6A4F] hover:bg-[#1B4332] text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
            >
              전체 배포하기
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[#F8FDF8]">
                  {['원 이름', '간식 구성', '특이사항', '마지막 배포일'].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-bold text-gray-400 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i}><td colSpan={4} className="px-5 py-4"><div className="h-5 bg-gray-50 rounded animate-pulse" /></td></tr>
                  ))
                ) : branches.length === 0 ? (
                  <tr><td colSpan={4} className="px-5 py-10 text-center text-gray-400 text-sm">등록된 원이 없습니다</td></tr>
                ) : (
                  branches.map(b => (
                    <tr key={b.id} className="hover:bg-[#F8FDF8] transition-colors">
                      <td className="px-5 py-4">
                        <span className="text-sm font-semibold text-[#1C2B1E]">{b.name}</span>
                        <p className="text-xs text-gray-400">{b.brands?.name || ''}</p>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-1.5">
                          {SNACK_SLOTS.map(s => (
                            <span key={s.key} className="text-[11px] bg-[#E8F5E9] text-[#2D6A4F] font-medium px-2 py-0.5 rounded-full">
                              {s.label}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-400">—</td>
                      <td className="px-5 py-4 text-sm text-gray-400">—</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 border-t border-gray-100">
            <p className="text-xs text-gray-400">총 {branches.length}개 원 · 엑셀 업로드 및 자동 배포 기능은 준비 중입니다</p>
          </div>
        </div>
      </div>
    </div>
  )
}
