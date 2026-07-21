'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import type { Inquiry, Branch, Notification, SlaRule } from '@/lib/types'
import InquiryCard from '@/components/board/InquiryCard'

export default function CustomerDashboardPage() {
  const [branch, setBranch] = useState<Branch | null>(null)
  const [inquiries, setInquiries] = useState<Inquiry[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [slaRules, setSlaRules] = useState<Record<string, SlaRule>>({})
  const [loading, setLoading] = useState(true)
  const [hasDietThisMonth, setHasDietThisMonth] = useState<boolean | null>(null)
  const [logoError, setLogoError] = useState(false) // 로고 로드 실패 시 원 이름 텍스트로 폴백

  useEffect(() => {
    const supabase = createClient()

    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Get branch info (master or member)
      const { data: branchRow } = await supabase
        .from('branches')
        .select('*, brands(*)')
        .eq('auth_id', user.id)
        .maybeSingle()

      let branchId = branchRow?.id
      if (!branchRow) {
        const { data: memberRow } = await supabase
          .from('branch_members')
          .select('branch_id, branches(*, brands(*))')
          .eq('auth_id', user.id)
          .maybeSingle()
        if (memberRow) {
          branchId = memberRow.branch_id
          setBranch(memberRow.branches as unknown as Branch)
        }
      } else {
        setBranch(branchRow as Branch)
      }

      if (!branchId) return

      // Load SLA rules
      const { data: rules } = await supabase.from('sla_rules').select('*')
      if (rules) {
        const rulesMap: Record<string, SlaRule> = {}
        rules.forEach(r => { rulesMap[r.category] = r })
        setSlaRules(rulesMap)
      }

      // Load recent inquiries (last 5)
      const { data: inq } = await supabase
        .from('inquiries')
        .select('*, messages(content, sender_type, created_at, is_internal)')
        .eq('branch_id', branchId)
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(5)

      if (inq) setInquiries(inq as unknown as Inquiry[])

      // Load unread notifications
      const { data: notifs } = await supabase
        .from('notifications')
        .select('*')
        .eq('recipient_auth_id', user.id)
        .eq('is_read', false)
        .order('created_at', { ascending: false })
        .limit(10)

      if (notifs) setNotifications(notifs as Notification[])

      // 이번달 식단표 확인
      const nowYear  = new Date().getFullYear()
      const nowMonth = new Date().getMonth() + 1
      const { data: dietCheck } = await supabase
        .from('weekly_menus')
        .select('id')
        .eq('branch_id', branchId)
        .in('status', ['generation_complete', 'review_requested', 'approved', 'deployed'])
        .eq('year', nowYear)
        .eq('month', nowMonth)
        .limit(1)
      setHasDietThisMonth((dietCheck?.length ?? 0) > 0)

      setLoading(false)
    }

    load()
  }, [])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/board/login'
  }

  const stats = {
    total: inquiries.length,
    inProgress: inquiries.filter(i => i.status === 'in_progress').length,
    resolved: inquiries.filter(i => i.status === 'resolved' || i.status === 'closed').length,
    unread: notifications.length,
  }

  return (
    <div className="min-h-screen bg-[#F6FAF6] font-sans">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-4 sm:px-6 py-4 hidden sm:flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-[#2D6A4F] to-[#52B788] rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-sm">
            K
          </div>
          <div>
            <h1 className="font-bold text-[#1C2B1E] text-sm">키즈밀 소통채널</h1>
            <p className="text-gray-400 text-xs">{branch?.name || '로딩 중...'}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/board/notifications" className="relative text-gray-400 hover:text-[#2D6A4F] transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {notifications.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {notifications.length > 9 ? '9+' : notifications.length}
              </span>
            )}
          </Link>
          <Link href="/board/settings" className="text-gray-400 hover:text-[#2D6A4F] transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
            </svg>
          </Link>
          <button
            onClick={handleLogout}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            로그아웃
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* 환영 메시지 */}
        <div className="bg-gradient-to-r from-[#2D6A4F] to-[#52B788] rounded-2xl px-6 py-5 text-white">
          {/* 원 로고 (logo_url 있고 로드 성공 시에만 — 실패/NULL이면 아래 원 이름 텍스트로 폴백) */}
          {branch?.logo_url && !logoError && (
            <div className="inline-flex items-center bg-white rounded-lg px-3 py-1.5 mb-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={branch.logo_url}
                alt={`${branch.name} 로고`}
                className="h-10 w-auto object-contain"
                onError={() => setLogoError(true)}
              />
            </div>
          )}
          <p className="text-sm opacity-80 mb-1">안녕하세요!</p>
          <h2 className="text-xl font-bold">{branch?.name || '...'} 님 👋</h2>
          <p className="text-sm opacity-70 mt-1">
            {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: '전체 문의', value: loading ? '—' : String(stats.total), color: 'text-[#1C2B1E]', icon: '📋', href: '/board/inquiries' },
            { label: '처리 중', value: loading ? '—' : String(stats.inProgress), color: 'text-blue-600', icon: '⚡', href: '/board/inquiries?status=in_progress' },
            { label: '해결 완료', value: loading ? '—' : String(stats.resolved), color: 'text-[#2D6A4F]', icon: '✅', href: '/board/inquiries?status=resolved' },
            { label: '미확인 알림', value: loading ? '—' : String(stats.unread), color: 'text-red-500', icon: '🔔', href: '/board/inquiries', alert: stats.unread > 0 },
          ].map(card => (
            <Link key={card.label} href={card.href} className={`block bg-white rounded-2xl border p-4 hover:shadow-sm transition-shadow ${card.alert ? 'border-red-200' : 'border-gray-100'}`}>
              <div className="text-xl mb-1">{card.icon}</div>
              <div className={`text-2xl font-bold ${card.color}`}>{card.value}</div>
              <div className="text-xs text-gray-400 mt-0.5">{card.label}</div>
            </Link>
          ))}
        </div>

        {/* 새 문의 CTA 버튼 */}
        <Link
          href="/board/inquiries/new"
          className="flex items-center justify-center gap-2 w-full bg-[#F97316] hover:bg-[#EA6C0A] text-white font-bold py-4 rounded-2xl transition-colors shadow-md shadow-orange-200 text-base"
        >
          <span className="text-xl">+</span>
          <span>새 문의 작성하기</span>
        </Link>

        {/* 최근 문의 목록 */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="font-bold text-[#1C2B1E]">최근 문의</h2>
            <Link href="/board/inquiries" className="text-xs text-[#2D6A4F] font-medium hover:underline">
              전체 보기
            </Link>
          </div>
          <div className="p-4 space-y-3">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="bg-gray-50 rounded-xl h-20 animate-pulse" />
              ))
            ) : inquiries.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-gray-400 text-sm">아직 문의 내역이 없습니다.</p>
                <Link href="/board/inquiries/new" className="text-sm text-[#2D6A4F] font-medium hover:underline mt-2 inline-block">
                  첫 문의 작성하기 →
                </Link>
              </div>
            ) : (
              inquiries.map(inq => (
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
        {/* 이번달 식단표 */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="font-bold text-[#1C2B1E]">이번달 식단표</h2>
            <Link href="/board/customer/diet" className="text-xs text-[#2D6A4F] font-medium hover:underline">
              전체 보기
            </Link>
          </div>
          <div className="p-4">
            {hasDietThisMonth === null ? (
              <div className="h-10 bg-gray-50 rounded-xl animate-pulse" />
            ) : hasDietThisMonth ? (
              <Link
                href="/board/customer/diet"
                className="flex items-center justify-center gap-2 w-full bg-[#2D6A4F] hover:bg-[#1B4332] text-white font-semibold py-3 rounded-xl transition-colors text-sm"
              >
                <span>📄</span>
                <span>이번달 식단표 확인</span>
              </Link>
            ) : (
              <p className="text-gray-400 text-sm text-center py-2">이번달 식단표 준비 중입니다</p>
            )}
          </div>
        </div>
      </div>

      <div className="h-14 sm:hidden" />
    </div>
  )
}
