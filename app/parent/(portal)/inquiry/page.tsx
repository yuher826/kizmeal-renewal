'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { getParentProfile } from '@/lib/parent-auth'
import BottomNav from '@/components/parent/BottomNav'
import { PARENT_INQ_CATEGORY_MAP as CAT_MAP } from '@/lib/parent-inquiry'

const STATUS_BADGES: Record<string, { label: string; color: string }> = {
  pending:     { label: '접수중',   color: 'bg-yellow-100 text-yellow-800' },
  in_progress: { label: '답변중',   color: 'bg-blue-100 text-blue-800' },
  resolved:    { label: '답변완료', color: 'bg-green-100 text-green-800' },
  closed:      { label: '종료',     color: 'bg-gray-100 text-gray-600' },
}

type ParentInquiry = {
  id: string
  category: string
  title: string
  status: string
  created_at: string
  last_message_at: string | null
  unread_count_parent: number
}

export default function ParentInquiryListPage() {
  const [inquiries, setInquiries] = useState<ParentInquiry[]>([])
  const [loading, setLoading] = useState(true)
  const [parentName, setParentName] = useState('')

  useEffect(() => {
    async function load() {
      const { parent } = await getParentProfile()
      if (parent) setParentName(parent.name)

      const supabase = createClient()
      const { data, error } = await supabase
        .from('parent_inquiries')
        .select('id, category, title, status, created_at, last_message_at, unread_count_parent')
        .order('created_at', { ascending: false })

      if (!error && data) setInquiries(data as ParentInquiry[])
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div className="min-h-screen bg-[#F6FAF6] pb-32">
      <header className="bg-white border-b border-gray-100 px-4 py-4 flex items-center gap-3 sticky top-16 z-10">
        <Link href="/parent/dashboard" className="text-gray-400 hover:text-gray-600">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5m7-7l-7 7 7 7" />
          </svg>
        </Link>
        <div>
          <h1 className="font-bold text-[#1C2B1E] text-sm">1:1 문의</h1>
          <p className="text-gray-400 text-xs">{parentName ? `${parentName} 님` : '급식 관련 문의'}</p>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-3">
        {loading ? (
          [1, 2, 3].map(i => <div key={i} className="h-20 bg-white rounded-2xl border border-gray-100 animate-pulse" />)
        ) : inquiries.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 px-6 py-16 text-center">
            <div className="text-4xl mb-3">💬</div>
            <p className="text-sm font-semibold text-[#1C2B1E] mb-1">아직 문의 내역이 없습니다</p>
            <p className="text-xs text-gray-400">급식 관련 궁금한 점을 편하게 문의해주세요</p>
          </div>
        ) : (
          inquiries.map(inq => {
            const cat = CAT_MAP[inq.category] || CAT_MAP.GENERAL
            const badge = STATUS_BADGES[inq.status] || STATUS_BADGES.pending
            return (
              <Link
                key={inq.id}
                href={`/parent/inquiry/${inq.id}`}
                className="block bg-white rounded-2xl border border-gray-100 p-4 hover:border-[#2D6A4F] transition-colors"
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500">
                    <span>{cat.icon}</span>{cat.label}
                  </span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${badge.color}`}>{badge.label}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {inq.unread_count_parent > 0 && (
                    <span className="w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center flex-shrink-0">
                      {inq.unread_count_parent}
                    </span>
                  )}
                  <p className="text-sm font-medium text-[#1C2B1E] truncate">{inq.title}</p>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  {new Date(inq.last_message_at || inq.created_at).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}
                </p>
              </Link>
            )
          })
        )}
      </div>

      {/* 문의하기 버튼 (하단 고정) */}
      <div className="fixed bottom-[72px] left-0 right-0 px-4 z-20 pointer-events-none">
        <div className="max-w-2xl mx-auto">
          <Link
            href="/parent/inquiry/new"
            className="pointer-events-auto flex items-center justify-center gap-2 w-full bg-[#2D6A4F] hover:bg-[#1B4332] text-white font-bold py-3.5 rounded-2xl shadow-lg transition-colors"
          >
            <span className="text-lg">✏️</span> 문의하기
          </Link>
        </div>
      </div>

      <BottomNav />
    </div>
  )
}
