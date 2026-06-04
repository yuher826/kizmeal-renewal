'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

const CAT_MAP: Record<string, { icon: string; label: string }> = {
  ALLERGY:   { icon: '🚨', label: '알레르기' },
  MENU:      { icon: '🍱', label: '식단' },
  PHOTO:     { icon: '📸', label: '급식사진' },
  COMPLAINT: { icon: '😤', label: '불만/건의' },
  GENERAL:   { icon: '💬', label: '일반' },
}

const CATEGORIES = ['ALLERGY', 'MENU', 'PHOTO', 'COMPLAINT', 'GENERAL']

const STATUS_BADGES: Record<string, { label: string; color: string }> = {
  pending:     { label: '접수중',   color: 'bg-yellow-100 text-yellow-800' },
  in_progress: { label: '답변중',   color: 'bg-blue-100 text-blue-800' },
  resolved:    { label: '답변완료', color: 'bg-green-100 text-green-800' },
  closed:      { label: '종료',     color: 'bg-gray-100 text-gray-600' },
}

const STATUS_TABS = [
  { key: '', label: '전체' },
  { key: 'pending', label: '접수중' },
  { key: 'in_progress', label: '답변중' },
  { key: 'resolved', label: '답변완료' },
]

type ParentInquiry = {
  id: string
  category: string
  title: string
  status: string
  created_at: string
  last_message_at: string | null
  unread_count_admin: number
  parents: { name: string } | null
  children: { name_ko: string } | null
  branches: { name: string; brands: { name: string } | null } | null
}

export default function AdminParentInquiriesPage() {
  const [inquiries, setInquiries] = useState<ParentInquiry[]>([])
  const [loading, setLoading] = useState(true)
  const [tableMissing, setTableMissing] = useState(false)
  const [status, setStatus] = useState('')
  const [category, setCategory] = useState('')
  const [branch, setBranch] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('parent_inquiries')
      .select('id, category, title, status, created_at, last_message_at, unread_count_admin, parents(name), children(name_ko), branches(name, brands(name))')
      .order('created_at', { ascending: false })
    if (error) {
      setTableMissing(true)
      setInquiries([])
    } else {
      setInquiries((data || []) as unknown as ParentInquiry[])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const supabase = createClient()
    const channel = supabase
      .channel('admin-parent-inquiries')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'parent_inquiries' }, () => load())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [load])

  const branchNames = Array.from(
    new Set(inquiries.map(i => i.branches?.name).filter(Boolean) as string[])
  )

  const filtered = inquiries
    .filter(i => {
      if (status && i.status !== status) return false
      if (category && i.category !== category) return false
      if (branch && i.branches?.name !== branch) return false
      return true
    })
    .sort((a, b) => {
      // 알레르기 최상단 고정
      const aAllergy = a.category === 'ALLERGY' && a.status !== 'resolved' && a.status !== 'closed'
      const bAllergy = b.category === 'ALLERGY' && b.status !== 'resolved' && b.status !== 'closed'
      if (aAllergy !== bAllergy) return aAllergy ? -1 : 1
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })

  const allergyPending = inquiries.filter(i => i.category === 'ALLERGY' && i.status !== 'resolved' && i.status !== 'closed').length

  return (
    <div className="min-h-screen bg-[#F6FAF6]">
      <header className="bg-white border-b border-gray-100 px-4 sm:px-6 py-4 hidden sm:flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <span className="text-2xl">💚</span>
          <div>
            <h1 className="font-bold text-[#1C2B1E]">학부모 문의</h1>
            <p className="text-gray-400 text-xs">학부모 포털을 통한 급식 관련 문의</p>
          </div>
        </div>
        {allergyPending > 0 && (
          <span className="text-xs bg-red-100 text-red-700 font-semibold px-2.5 py-1 rounded-full">
            🚨 알레르기 {allergyPending}건
          </span>
        )}
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">

        {tableMissing && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-2xl px-4 py-3 text-sm text-yellow-800">
            학부모 문의 테이블이 아직 생성되지 않았습니다. <code className="font-mono text-xs">inquiry_restructure.sql</code> 마이그레이션을 실행해주세요.
          </div>
        )}

        {/* 필터 */}
        <div className="bg-white rounded-2xl p-4 space-y-3">
          <div className="flex gap-1 flex-wrap">
            {STATUS_TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setStatus(t.key)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                  status === t.key ? 'bg-[#2D6A4F] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2 flex-wrap">
            <select value={category} onChange={e => setCategory(e.target.value)}
              className="px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]">
              <option value="">전체 분류</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{CAT_MAP[c].icon} {CAT_MAP[c].label}</option>)}
            </select>
            <select value={branch} onChange={e => setBranch(e.target.value)}
              className="px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]">
              <option value="">전체 원</option>
              {branchNames.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>

        {/* 목록 */}
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
          {loading ? (
            <div className="p-12 text-center text-gray-400">불러오는 중...</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-gray-400">학부모 문의가 없습니다.</div>
          ) : (
            <>
              {/* 모바일 카드 */}
              <div className="sm:hidden divide-y divide-gray-50">
                {filtered.map(inq => <Card key={inq.id} inq={inq} />)}
              </div>
              {/* 데스크탑 테이블 */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-[#F8FDF8] border-b border-gray-100">
                      {['분류', '제목', '학부모', '원', '접수일', '상태'].map(h => (
                        <th key={h} className="text-left px-5 py-3 text-xs font-bold text-gray-400 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filtered.map(inq => {
                      const cat = CAT_MAP[inq.category] || CAT_MAP.GENERAL
                      const badge = STATUS_BADGES[inq.status] || STATUS_BADGES.pending
                      const urgent = inq.category === 'ALLERGY' && inq.status !== 'resolved' && inq.status !== 'closed'
                      const branchLabel = [inq.branches?.brands?.name, inq.branches?.name].filter(Boolean).join(' ')
                      return (
                        <tr key={inq.id} className={`transition-colors ${urgent ? 'bg-red-50 hover:bg-red-100/60' : 'hover:bg-[#F8FDF8]'}`}>
                          <td className="px-5 py-4 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 text-sm text-gray-600">
                              <span>{cat.icon}</span>{cat.label}
                            </span>
                            {urgent && <span className="ml-1.5 text-[10px] font-bold text-white bg-red-500 px-1.5 py-0.5 rounded-full">긴급</span>}
                          </td>
                          <td className="px-5 py-4 max-w-xs">
                            <Link href={`/board/admin/parent-inquiries/${inq.id}`} className="flex items-center gap-1.5">
                              {inq.unread_count_admin > 0 && (
                                <span className="w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center flex-shrink-0">{inq.unread_count_admin}</span>
                              )}
                              <span className="text-sm text-[#1C2B1E] hover:text-[#2D6A4F] truncate">{inq.title}</span>
                            </Link>
                          </td>
                          <td className="px-5 py-4 text-sm font-semibold text-[#1C2B1E] whitespace-nowrap">
                            {inq.parents?.name || '—'}
                            {inq.children?.name_ko && <span className="text-xs text-gray-400 font-normal"> · {inq.children.name_ko}</span>}
                          </td>
                          <td className="px-5 py-4 text-sm text-gray-500 whitespace-nowrap">{branchLabel || '—'}</td>
                          <td className="px-5 py-4 text-sm text-gray-400 whitespace-nowrap">{new Date(inq.created_at).toLocaleDateString('ko-KR')}</td>
                          <td className="px-5 py-4">
                            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${badge.color}`}>{badge.label}</span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        <p className="text-xs text-gray-400 text-right">총 {filtered.length}건</p>
      </div>
    </div>
  )
}

function Card({ inq }: { inq: ParentInquiry }) {
  const cat = CAT_MAP[inq.category] || CAT_MAP.GENERAL
  const badge = STATUS_BADGES[inq.status] || STATUS_BADGES.pending
  const urgent = inq.category === 'ALLERGY' && inq.status !== 'resolved' && inq.status !== 'closed'
  const branchLabel = [inq.branches?.brands?.name, inq.branches?.name].filter(Boolean).join(' ')
  return (
    <Link href={`/board/admin/parent-inquiries/${inq.id}`} className={`block p-4 space-y-1.5 ${urgent ? 'bg-red-50' : 'active:bg-[#F8FDF8]'}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500">
          <span>{cat.icon}</span>{cat.label}
          {urgent && <span className="ml-1 text-[10px] font-bold text-white bg-red-500 px-1.5 py-0.5 rounded-full">긴급</span>}
        </span>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${badge.color}`}>{badge.label}</span>
      </div>
      <div className="flex items-center gap-1.5">
        {inq.unread_count_admin > 0 && (
          <span className="w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center flex-shrink-0">{inq.unread_count_admin}</span>
        )}
        <p className="text-sm font-medium text-[#1C2B1E] truncate">{inq.title}</p>
      </div>
      <p className="text-xs text-gray-400">
        {inq.parents?.name || '—'}{inq.children?.name_ko ? ` · ${inq.children.name_ko}` : ''} · {branchLabel || '원 미지정'}
      </p>
    </Link>
  )
}
