'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import type { Branch } from '@/lib/types'

interface DietUpload { id: string; year_month: string; status: string; created_at: string }

function getMealConfig(b: Branch) {
  const mc = b.meal_config as Record<string, unknown> | undefined
  if (!mc || typeof mc !== 'object') return null
  if (!mc.간식) return null
  return mc
}

function getSnackBadges(mc: Record<string, unknown>): string[] {
  const s = mc.간식 as Record<string, unknown>
  const badges: string[] = []
  if (s.오전)   badges.push('오전')
  if (s.오후)   badges.push('오후')
  if (s.방과후) badges.push('방과후')
  if (s.돌봄)   badges.push('돌봄')
  const extra = (s.기타 as string[]) || []
  return [...badges, ...extra]
}

function getAllergyCount(mc: Record<string, unknown>): number {
  return ((mc.알레르기아이 as unknown[]) || []).length
}

function getPptxSlide(mc: Record<string, unknown>): 1 | 3 {
  return (mc.pptx슬라이드 as 1 | 3) || 1
}

export default function AdminDietPage() {
  const [branches,   setBranches]   = useState<Branch[]>([])
  const [lastUpload, setLastUpload] = useState<DietUpload | null>(null)
  const [loading,    setLoading]    = useState(true)

  const load = useCallback(async () => {
    const supabase = createClient()
    const [branchRes, uploadRes] = await Promise.all([
      supabase.from('branches').select('*, brands(*)').eq('is_active', true).order('name'),
      supabase.from('diet_uploads').select('id, year_month, status, created_at')
        .order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ])
    if (branchRes.data) setBranches(branchRes.data as Branch[])
    if (uploadRes.data) setLastUpload(uploadRes.data as DietUpload)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const configured  = branches.filter(b => getMealConfig(b) !== null)
  const unset       = branches.filter(b => getMealConfig(b) === null)
  const allergyTotal = branches.reduce((s, b) => {
    const mc = getMealConfig(b)
    return s + (mc ? getAllergyCount(mc) : 0)
  }, 0)

  return (
    <div className="min-h-screen bg-[#F6FAF6] font-sans">
      <header className="bg-white border-b border-gray-100 px-4 sm:px-6 h-16 hidden sm:flex items-center justify-between sticky top-0 z-10">
        <div>
          <div className="flex items-center gap-1 text-xs text-gray-400 mb-0.5">
            <Link href="/board/admin" className="hover:text-[#2D6A4F] transition-colors">소통채널</Link>
            <span>›</span>
            <span>운영관리</span>
            <span>›</span>
            <span className="text-[#2D6A4F] font-medium">식단표 배포</span>
          </div>
          <h1 className="font-bold text-[#1C2B1E] text-base">식단표 배포</h1>
          <p className="text-gray-400 text-xs">원별 프로파일 설정 · 엑셀 업로드 · PDF 배포</p>
        </div>
        <div className="flex gap-2">
          <Link href="/board/admin/diet/templates"
            className="inline-flex items-center gap-1.5 bg-white border border-[#2D6A4F] text-[#2D6A4F] hover:bg-[#E8F5E9] text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
            🎨 템플릿 관리
          </Link>
          <Link href="/board/admin/diet/upload"
            className="inline-flex items-center gap-2 bg-[#2D6A4F] hover:bg-[#1B4332] text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
            📑 엑셀 업로드
          </Link>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* 프로파일 미설정 경고 배너 */}
        {!loading && unset.length > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-2xl px-4 py-4">
            <div className="flex items-start gap-3">
              <span className="text-lg shrink-0">⚠️</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-orange-800">
                  {unset.length}개 원 프로파일 미설정 — 배포 전 설정 필요
                </p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {unset.map(b => (
                    <Link key={b.id} href={`/board/admin/diet/${b.id}`}
                      className="text-xs bg-orange-100 hover:bg-orange-200 text-orange-700 font-medium px-2.5 py-1 rounded-full transition-colors">
                      {b.name} →
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 통계 카드 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: '전체 원',       value: loading ? '—' : branches.length,    icon: '🏫' },
            { label: '설정 완료',     value: loading ? '—' : configured.length,  icon: '✅' },
            { label: '프로파일 미설정', value: loading ? '—' : unset.length,      icon: '⏳' },
            { label: '알레르기 아동', value: loading ? '—' : allergyTotal,        icon: '⚠️' },
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
          <div className="bg-white rounded-2xl border border-gray-100 p-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-bold text-[#1C2B1E]">최근 업로드: {lastUpload.year_month}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                상태: {lastUpload.status === 'deployed' ? '✅ 배포완료' : lastUpload.status === 'generated' ? '📄 생성완료' : '📥 업로드됨'}
                &nbsp;· {new Date(lastUpload.created_at).toLocaleDateString('ko-KR')}
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
              <p className="text-gray-400 text-xs mt-0.5">원 이름 옆 버튼으로 프로파일 설정</p>
            </div>
          </div>

          {/* 모바일 카드 */}
          <div className="sm:hidden divide-y divide-gray-50">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="p-4"><div className="h-14 bg-gray-50 rounded-xl animate-pulse"/></div>
              ))
            ) : branches.length === 0 ? (
              <div className="py-10 text-center text-gray-400 text-sm">등록된 원이 없습니다</div>
            ) : branches.map(b => {
              const mc = getMealConfig(b)
              const snacks = mc ? getSnackBadges(mc) : []
              const allergyCount = mc ? getAllergyCount(mc) : 0
              const slide = mc ? getPptxSlide(mc) : null
              const isConfigured = mc !== null
              return (
                <div key={b.id} className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-[#1C2B1E] text-sm truncate">{b.name}</p>
                      <p className="text-xs text-gray-400">{b.brands?.name || ''}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {isConfigured ? (
                        <span className="text-xs bg-green-100 text-green-700 font-semibold px-2 py-0.5 rounded-full">설정완료</span>
                      ) : (
                        <span className="text-xs bg-orange-100 text-orange-600 font-semibold px-2 py-0.5 rounded-full">미설정</span>
                      )}
                    </div>
                  </div>
                  {mc && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${b.diet_type === 'catering' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                        {b.diet_type === 'catering' ? '위탁' : 'CK'}
                      </span>
                      {slide !== null && (
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">Slide {slide}</span>
                      )}
                      {allergyCount > 0 && (
                        <span className="text-xs bg-red-100 text-red-700 font-semibold px-2 py-0.5 rounded-full">⚠️ {allergyCount}명</span>
                      )}
                      {snacks.map(s => (
                        <span key={s} className="text-[11px] bg-[#E8F5E9] text-[#2D6A4F] font-medium px-1.5 py-0.5 rounded-full">{s}</span>
                      ))}
                    </div>
                  )}
                  <Link href={`/board/admin/diet/${b.id}`}
                    className="inline-block text-xs bg-[#2D6A4F] hover:bg-[#1B4332] text-white font-medium px-3 py-1.5 rounded-lg transition-colors">
                    프로파일 설정
                  </Link>
                </div>
              )
            })}
          </div>

          {/* 데스크탑 테이블 */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[#F8FDF8]">
                  {['원 이름', '타입', '간식 구성', 'Slide', '알레르기', '특이사항', '상태', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-bold text-gray-400 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i}><td colSpan={8} className="px-4 py-4"><div className="h-5 bg-gray-50 rounded animate-pulse"/></td></tr>
                  ))
                ) : branches.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-400 text-sm">등록된 원이 없습니다</td></tr>
                ) : branches.map(b => {
                  const mc = getMealConfig(b)
                  const snacks = mc ? getSnackBadges(mc) : []
                  const allergyCount = mc ? getAllergyCount(mc) : 0
                  const slide = mc ? getPptxSlide(mc) : null
                  const notes = mc ? (mc.특이사항 as string) || '' : ''
                  const isConfigured = mc !== null
                  return (
                    <tr key={b.id} className="hover:bg-[#F8FDF8] transition-colors">
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <p className="text-sm font-semibold text-[#1C2B1E] whitespace-nowrap">{b.name}</p>
                        <p className="text-xs text-gray-400 whitespace-nowrap">{b.brands?.name || ''}</p>
                      </td>
                      <td className="px-4 py-3.5">
                        {isConfigured ? (
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${b.diet_type === 'catering' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                            {b.diet_type === 'catering' ? '위탁' : 'CK'}
                          </span>
                        ) : <span className="text-xs text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex flex-wrap gap-1">
                          {snacks.length > 0
                            ? snacks.map(s => (
                                <span key={s} className="text-[11px] bg-[#E8F5E9] text-[#2D6A4F] font-medium px-2 py-0.5 rounded-full">{s}</span>
                              ))
                            : <span className="text-xs text-gray-300">미설정</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        {slide !== null
                          ? <span className="text-xs font-semibold bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">Slide {slide}</span>
                          : <span className="text-xs text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3.5">
                        {allergyCount > 0
                          ? <span className="text-xs bg-red-100 text-red-700 font-semibold px-2 py-0.5 rounded-full">⚠️ {allergyCount}명</span>
                          : <span className="text-xs text-gray-300">없음</span>}
                      </td>
                      <td className="px-4 py-3.5 max-w-[150px]">
                        <p className="text-xs text-gray-500 truncate">{notes || '—'}</p>
                      </td>
                      <td className="px-4 py-3.5">
                        {isConfigured
                          ? <span className="text-xs bg-green-100 text-green-700 font-semibold px-2 py-0.5 rounded-full">설정완료</span>
                          : <span className="text-xs bg-orange-100 text-orange-600 font-semibold px-2 py-0.5 rounded-full">미설정</span>}
                      </td>
                      <td className="px-4 py-3.5">
                        <Link href={`/board/admin/diet/${b.id}`}
                          className="text-xs bg-[#2D6A4F] hover:bg-[#1B4332] text-white font-medium px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">
                          프로파일 설정
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="px-5 py-3 border-t border-gray-100">
            <p className="text-xs text-gray-400">총 {branches.length}개 원 · 설정완료 {configured.length}개</p>
          </div>
        </div>
      </div>
    </div>
  )
}
