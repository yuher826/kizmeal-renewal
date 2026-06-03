'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import type { Branch } from '@/lib/types'

interface ProfileData {
  branch_type: string; snack_slots: string[]
  special_notes: string; allergy_children: { name: string }[]
}
interface BranchWithProfile extends Branch { profile_data?: ProfileData }
interface DietUpload { id: string; year_month: string; status: string; created_at: string }

const SLOT_LABELS: Record<string, string> = {
  morning: '오전', afternoon: '오후', afterschool: '방과후',
  care: '돌봄', teacher_extra: '교.추',
}

export default function AdminDietPage() {
  const [branches, setBranches] = useState<BranchWithProfile[]>([])
  const [lastUpload, setLastUpload] = useState<DietUpload | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const supabase = createClient()
    const [branchRes, uploadRes] = await Promise.all([
      supabase.from('branches').select('*, brands(*), profile_data').eq('is_active', true).order('name'),
      supabase.from('diet_uploads').select('id, year_month, status, created_at').order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ])
    if (branchRes.data) setBranches(branchRes.data as BranchWithProfile[])
    if (uploadRes.data) setLastUpload(uploadRes.data as DietUpload)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const withProfile    = branches.filter(b => b.profile_data?.branch_type)
  const withAllergy    = branches.filter(b => (b.profile_data?.allergy_children?.length || 0) > 0)

  return (
    <div className="min-h-screen bg-[#F6FAF6] font-sans">
      <header className="bg-white border-b border-gray-100 px-4 sm:px-6 h-16 flex items-center justify-between sticky top-0 z-10">
        <div>
          <h1 className="font-bold text-[#1C2B1E] text-base">식단표 관리</h1>
          <p className="text-gray-400 text-xs">원별 프로파일 · 업로드 · PDF 배포</p>
        </div>
        <Link href="/board/admin/diet/upload"
          className="inline-flex items-center gap-2 bg-[#2D6A4F] hover:bg-[#1B4332] text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
          <span>📑</span> 엑셀 업로드
        </Link>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* 통계 카드 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: '전체 원', value: loading ? '—' : branches.length, icon: '🏫' },
            { label: '프로파일 설정', value: loading ? '—' : withProfile.length, icon: '✅' },
            { label: '프로파일 미설정', value: loading ? '—' : branches.length - withProfile.length, icon: '⏳' },
            { label: '알레르기 아동', value: loading ? '—' : withAllergy.length, icon: '⚠️' },
          ].map(card => (
            <div key={card.label} className="bg-white rounded-2xl border border-gray-100 p-4">
              <div className="text-xl mb-1">{card.icon}</div>
              <div className="text-2xl font-bold text-[#1C2B1E]">{card.value}</div>
              <div className="text-xs text-gray-400 mt-0.5">{card.label}</div>
            </div>
          ))}
        </div>

        {/* 최근 업로드 */}
        {lastUpload && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5 flex items-center justify-between">
            <div>
              <p className="font-bold text-[#1C2B1E]">최근 업로드: {lastUpload.year_month}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                상태: {lastUpload.status === 'deployed' ? '✅ 배포완료' : lastUpload.status === 'generated' ? '📄 생성완료' : '📥 업로드됨'}
                · {new Date(lastUpload.created_at).toLocaleDateString('ko-KR')}
              </p>
            </div>
            <div className="flex gap-2">
              <Link href={`/board/admin/diet/generate?upload_id=${lastUpload.id}&year_month=${lastUpload.year_month}`}
                className="text-sm bg-[#E8F5E9] text-[#2D6A4F] font-semibold px-4 py-2 rounded-xl hover:bg-[#C8E6C9] transition-colors">
                생성
              </Link>
              <Link href={`/board/admin/diet/deploy?upload_id=${lastUpload.id}&year_month=${lastUpload.year_month}`}
                className="text-sm bg-[#F97316] text-white font-semibold px-4 py-2 rounded-xl hover:bg-[#EA6C0A] transition-colors">
                배포
              </Link>
            </div>
          </div>
        )}

        {/* 원별 프로파일 테이블 */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div>
              <h2 className="font-bold text-[#1C2B1E]">원별 식단표 프로파일</h2>
              <p className="text-gray-400 text-xs mt-0.5">원 이름을 클릭해 프로파일 설정</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[#F8FDF8]">
                  {['원 이름', '타입', '간식 구성', '알레르기 아동', '특이사항', ''].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-bold text-gray-400 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i}><td colSpan={6} className="px-5 py-4"><div className="h-5 bg-gray-50 rounded animate-pulse"/></td></tr>
                  ))
                ) : branches.length === 0 ? (
                  <tr><td colSpan={6} className="px-5 py-10 text-center text-gray-400 text-sm">등록된 원이 없습니다</td></tr>
                ) : (
                  branches.map(b => {
                    const prof = b.profile_data
                    const slots = prof?.snack_slots || []
                    const allergyCount = prof?.allergy_children?.length || 0
                    return (
                      <tr key={b.id} className="hover:bg-[#F8FDF8] transition-colors">
                        <td className="px-5 py-3.5">
                          <p className="text-sm font-semibold text-[#1C2B1E]">{b.name}</p>
                          <p className="text-xs text-gray-400">{b.brands?.name || ''}</p>
                        </td>
                        <td className="px-5 py-3.5">
                          {prof?.branch_type ? (
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${prof.branch_type === 'CK' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                              {prof.branch_type}
                            </span>
                          ) : <span className="text-xs text-gray-300">미설정</span>}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex flex-wrap gap-1">
                            {slots.length > 0
                              ? slots.map(k => (
                                  <span key={k} className="text-[11px] bg-[#E8F5E9] text-[#2D6A4F] font-medium px-2 py-0.5 rounded-full">
                                    {SLOT_LABELS[k] || k}
                                  </span>
                                ))
                              : <span className="text-xs text-gray-300">미설정</span>}
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          {allergyCount > 0
                            ? <span className="text-xs bg-red-100 text-red-700 font-semibold px-2 py-0.5 rounded-full">⚠️ {allergyCount}명</span>
                            : <span className="text-xs text-gray-300">없음</span>}
                        </td>
                        <td className="px-5 py-3.5 max-w-[180px]">
                          <p className="text-xs text-gray-500 truncate">{prof?.special_notes || '—'}</p>
                        </td>
                        <td className="px-5 py-3.5">
                          <Link href={`/board/admin/branches/${b.id}/profile`}
                            className="text-xs bg-[#2D6A4F] hover:bg-[#1B4332] text-white font-medium px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">
                            설정
                          </Link>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 border-t border-gray-100">
            <p className="text-xs text-gray-400">총 {branches.length}개 원</p>
          </div>
        </div>
      </div>
    </div>
  )
}
