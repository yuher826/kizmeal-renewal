'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

type HistoryRow = {
  id:                 string
  year:               number
  month:              number
  status:             string
  deployed_at:        string | null
  updated_at:         string
  generation_results: {
    generated_at: string
    succeeded:    number
    failed:       number
  } | null
}

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  draft:                { label: '작성 중',      color: '#9E9E9E', bg: '#F5F5F5' },
  uploaded:             { label: '업로드 완료',  color: '#1976D2', bg: '#E3F2FD' },
  generating:           { label: '생성 중',      color: '#6A1B9A', bg: '#F3E5F5' },
  generated:            { label: '파일 준비',    color: '#00838F', bg: '#E0F7FA' },
  review_requested:     { label: '검토 요청',    color: '#E65100', bg: '#FFF3E0' },
  approved:             { label: '승인 완료',    color: '#2E7D32', bg: '#E8F5E9' },
  correction_requested: { label: '수정 요청',    color: '#C62828', bg: '#FFEBEE' },
  deployed:             { label: '배포 완료',    color: '#2D6A4F', bg: '#F6FAF6' },
}

function formatDate(iso: string | null) {
  if (!iso) return '-'
  try {
    const d = new Date(iso)
    return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`
  } catch { return iso }
}

export default function DietHistoryPage() {
  const [rows,    setRows]    = useState<HistoryRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await supabase
        .from('weekly_menus')
        .select('id, year, month, status, deployed_at, updated_at, generation_results')
        .eq('diet_type', 'CK')
        .is('branch_id', null)
        .order('year',  { ascending: false })
        .order('month', { ascending: false })
        .limit(24)
      setRows((data ?? []) as HistoryRow[])
      setLoading(false)
    }
    load()
  }, [])

  return (
    <main className="min-h-screen bg-[#F6FAF6] px-4 sm:px-6 py-6 sm:py-8">
      {/* 헤더 */}
      <div className="mb-6">
        <Link
          href="/board/admin/diet-automation"
          className="text-gray-400 hover:text-gray-600 text-sm inline-block mb-2"
        >
          ← 식단표 자동화
        </Link>
        <div className="flex items-center gap-2">
          <span className="text-2xl">📋</span>
          <h1 className="text-xl sm:text-2xl font-bold text-[#1C2B1E]">배포 이력</h1>
        </div>
        <p className="text-sm text-gray-500 ml-9 mt-1">
          CK 식단표 업로드·생성·배포 이력 (최근 24개월)
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <p className="text-gray-400 text-sm">로딩 중...</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <p className="text-5xl mb-4">📋</p>
          <p className="text-sm font-medium text-gray-600 mb-1">아직 이력이 없습니다</p>
          <p className="text-xs text-gray-400 mb-6">엑셀 업로드 후 이력이 여기 표시됩니다</p>
          <Link
            href="/board/admin/diet-automation/upload"
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#2D6A4F] text-white text-sm font-semibold hover:bg-[#1B4332] transition-colors"
          >
            📤 엑셀 업로드
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-3 font-semibold text-gray-500">대상 월</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-500">상태</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-500">생성 결과</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-500">배포일</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-500">최근 수정</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-500">바로가기</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => {
                  const meta = STATUS_META[row.status] ?? { label: row.status, color: '#9E9E9E', bg: '#F5F5F5' }
                  const gen  = row.generation_results
                  return (
                    <tr
                      key={row.id}
                      className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}
                    >
                      {/* 대상 월 */}
                      <td className="px-4 py-3">
                        <span className="font-bold text-[#1C2B1E]">{row.year}년 {row.month}월</span>
                      </td>

                      {/* 상태 */}
                      <td className="text-center px-4 py-3">
                        <span
                          className="inline-block px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap"
                          style={{ color: meta.color, background: meta.bg }}
                        >
                          {meta.label}
                        </span>
                      </td>

                      {/* 생성 결과 */}
                      <td className="text-center px-4 py-3 text-xs text-gray-500">
                        {gen
                          ? <span>✅ {gen.succeeded}개{gen.failed > 0 && <span className="text-red-500 ml-1">❌ {gen.failed}개</span>}</span>
                          : <span className="text-gray-300">-</span>
                        }
                      </td>

                      {/* 배포일 */}
                      <td className="text-center px-4 py-3 text-xs text-gray-500">
                        {row.deployed_at
                          ? <span className="text-[#2D6A4F] font-medium">{formatDate(row.deployed_at)}</span>
                          : <span className="text-gray-300">-</span>
                        }
                      </td>

                      {/* 최근 수정 */}
                      <td className="text-center px-4 py-3 text-xs text-gray-400">
                        {formatDate(row.updated_at)}
                      </td>

                      {/* 바로가기 */}
                      <td className="text-center px-4 py-3">
                        <div className="flex items-center justify-center gap-1.5">
                          {['generated','review_requested','approved','correction_requested'].includes(row.status) && (
                            <Link
                              href={`/board/admin/diet-automation/review?year=${row.year}&month=${row.month}`}
                              className="px-2.5 py-1 rounded-lg bg-orange-100 text-orange-700 text-[11px] font-bold hover:bg-orange-200 transition-colors"
                            >
                              검토
                            </Link>
                          )}
                          {row.status === 'deployed' && gen && (
                            <Link
                              href={`/board/admin/diet-automation/review?year=${row.year}&month=${row.month}`}
                              className="px-2.5 py-1 rounded-lg bg-[#E8F5E9] text-[#2E7D32] text-[11px] font-bold hover:bg-[#C8E6C9] transition-colors"
                            >
                              상세
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  )
}
