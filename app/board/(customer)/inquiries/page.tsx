'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import type { Inquiry, InquiryStatus, SlaRule } from '@/lib/types'
import { STATUS_LABELS } from '@/lib/types'
import InquiryCard from '@/components/board/InquiryCard'

const TABS: { label: string; value: InquiryStatus | 'all' }[] = [
  { label: '전체', value: 'all' },
  { label: '대기중', value: 'pending' },
  { label: '처리중', value: 'in_progress' },
  { label: '해결됨', value: 'resolved' },
  { label: '종료', value: 'closed' },
]

export default function CustomerInquiriesPage() {
  const [inquiries, setInquiries] = useState<Inquiry[]>([])
  const [slaRules, setSlaRules] = useState<Record<string, SlaRule>>({})
  const [activeTab, setActiveTab] = useState<InquiryStatus | 'all'>('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      let branchId: string | null = null

      const { data: branchRow } = await supabase
        .from('branches')
        .select('id')
        .eq('auth_id', user.id)
        .maybeSingle()

      if (branchRow) {
        branchId = branchRow.id
      } else {
        const { data: memberRow } = await supabase
          .from('branch_members')
          .select('branch_id')
          .eq('auth_id', user.id)
          .maybeSingle()
        if (memberRow) branchId = memberRow.branch_id
      }

      if (!branchId) return

      const { data: rules } = await supabase.from('sla_rules').select('*')
      if (rules) {
        const map: Record<string, SlaRule> = {}
        rules.forEach(r => { map[r.category] = r })
        setSlaRules(map)
      }

      const { data: inq } = await supabase
        .from('inquiries')
        .select('*, messages(content, sender_type, created_at, is_internal)')
        .eq('branch_id', branchId)
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })

      if (inq) setInquiries(inq as unknown as Inquiry[])
      setLoading(false)
    }

    load()

    // Realtime — unread count updates
    const supabase2 = createClient()
    const channel = supabase2
      .channel('inquiries-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inquiries' }, () => load())
      .subscribe()

    return () => { supabase2.removeChannel(channel) }
  }, [])

  const filtered = activeTab === 'all'
    ? inquiries
    : inquiries.filter(i => i.status === activeTab)

  return (
    <div className="min-h-screen bg-[#F6FAF6] font-sans">
      <header className="bg-white border-b border-gray-100 px-4 sm:px-6 py-4 flex items-center gap-3 sticky top-0 z-10">
        <Link href="/board/dashboard" className="text-gray-400 hover:text-gray-600">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5m7-7l-7 7 7 7" />
          </svg>
        </Link>
        <h1 className="font-bold text-[#1C2B1E] flex-1">내 문의 목록</h1>
        <span className="text-xs text-gray-400">{inquiries.length}건</span>
      </header>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        {/* 상태 필터 탭 */}
        <div className="flex gap-2 mb-5 overflow-x-auto pb-1 scrollbar-none">
          {TABS.map(tab => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                activeTab === tab.value
                  ? 'bg-[#2D6A4F] text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-[#2D6A4F] hover:text-[#2D6A4F]'
              }`}
            >
              {tab.label}
              {tab.value !== 'all' && (
                <span className="ml-1.5 opacity-70">
                  {inquiries.filter(i => i.status === tab.value).length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* 문의 목록 */}
        <div className="space-y-3">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl h-24 animate-pulse border border-gray-100" />
            ))
          ) : filtered.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 px-6 py-10 text-center">
              <p className="text-gray-400 text-sm">
                {activeTab === 'all' ? '문의 내역이 없습니다.' : `${STATUS_LABELS[activeTab as InquiryStatus]} 문의가 없습니다.`}
              </p>
            </div>
          ) : (
            filtered.map(inq => (
              <InquiryCard
                key={inq.id}
                inquiry={inq}
                slaRules={slaRules}
                href={`/board/inquiries/${inq.id}`}
                unreadCount={inq.unread_count_branch}
              />
            ))
          )}
        </div>
      </div>

      {/* 새 문의 FAB */}
      <Link
        href="/board/inquiries/new"
        className="fixed bottom-6 right-6 w-14 h-14 bg-[#F97316] hover:bg-[#EA6C0A] text-white rounded-full flex items-center justify-center shadow-lg shadow-orange-200 transition-colors text-2xl font-light z-20"
        aria-label="새 문의 작성"
      >
        +
      </Link>
    </div>
  )
}
