'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { getParentProfile, getContentsForBranch } from '@/lib/parent-auth'
import type { Parent, Child, Content, ParentNotification } from '@/lib/parent-auth'
import BottomNav from '@/components/parent/BottomNav'
import ChildTab from '@/components/parent/ChildTab'
import EmptyState from '@/components/parent/EmptyState'
import Link from 'next/link'

export default function ParentDashboardPage() {
  const [parent, setParent] = useState<Parent | null>(null)
  const [children, setChildren] = useState<Child[]>([])
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null)
  const [todayPhotos, setTodayPhotos] = useState<Content[]>([])
  const [latestMenu, setLatestMenu] = useState<Content | null>(null)
  const [notices, setNotices] = useState<Content[]>([])
  const [notifications, setNotifications] = useState<ParentNotification[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getParentProfile().then(({ parent, children }) => {
      setParent(parent)
      setChildren(children)
      if (children.length > 0) {
        const saved = localStorage.getItem('selectedChildId')
        const validId = children.find(c => c.id === saved)?.id || children[0].id
        setSelectedChildId(validId)
      }
    })
  }, [])

  useEffect(() => {
    if (!selectedChildId) return
    const child = children.find(c => c.id === selectedChildId)
    if (!child?.branch_id) return

    const today = new Date().toISOString().slice(0, 10)
    const month = today.slice(0, 7)
    const branchId = child.branch_id

    Promise.all([
      getContentsForBranch(branchId, 'photo', { date: today, limit: 3 }),
      getContentsForBranch(branchId, 'menu', { month, limit: 1 }),
      getContentsForBranch(branchId, 'notice', { limit: 3 }),
    ]).then(([photos, menus, noticeList]) => {
      setTodayPhotos(photos)
      setLatestMenu(menus[0] || null)
      setNotices(noticeList)
      setLoading(false)
    })

    // Load notifications inline to avoid dependency warning
    const supabase = createClient()
    supabase
      .from('parent_notifications')
      .select('*')
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(10)
      .then(({ data }) => { if (data) setNotifications(data as ParentNotification[]) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChildId, children])

  function handleSelectChild(id: string) {
    setSelectedChildId(id)
    localStorage.setItem('selectedChildId', id)
    setLoading(true)
  }

  const selectedChild = children.find(c => c.id === selectedChildId)
  const today = new Date()

  return (
    <div className="min-h-screen bg-[#F6FAF6] pb-20">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-4 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-[#2D6A4F] to-[#52B788] rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-sm">
            K
          </div>
          <div>
            <h1 className="font-bold text-[#1C2B1E] text-sm">키즈밀</h1>
            <p className="text-gray-400 text-xs">{parent?.name || ''} 님</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {notifications.length > 0 && (
            <div className="relative">
              <span className="w-6 h-6 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {notifications.length > 9 ? '9+' : notifications.length}
              </span>
            </div>
          )}
          <Link href="/parent/mypage" className="text-gray-400 hover:text-[#2D6A4F]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
            </svg>
          </Link>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-5">
        {/* Greeting */}
        <div className="bg-gradient-to-r from-[#2D6A4F] to-[#52B788] rounded-2xl px-5 py-4 text-white">
          <p className="text-sm opacity-80">안녕하세요!</p>
          <h2 className="text-lg font-bold mt-0.5">{selectedChild?.name_ko || '...'} 의 오늘 급식 🍽️</h2>
          {selectedChild?.branches && (
            <p className="text-xs opacity-80 mt-1">
              📍 {[selectedChild.branches.brands?.name, selectedChild.branches.name].filter(Boolean).join(' ')}
            </p>
          )}
          <p className="text-xs opacity-70 mt-1">
            {today.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
          </p>
        </div>

        {/* Child Tabs */}
        {children.length > 1 && (
          <ChildTab items={children} selectedId={selectedChildId} onSelect={handleSelectChild} />
        )}

        {/* Quick Links */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { href: '/parent/menu', icon: '🥗', label: '식단표' },
            { href: '/parent/photos', icon: '📸', label: '급식사진' },
            { href: '/parent/recipes', icon: '📖', label: '레시피' },
            { href: '/parent/mypage', icon: '👤', label: '마이페이지' },
          ].map(item => (
            <Link
              key={item.href}
              href={item.href}
              className="bg-white rounded-2xl p-3 flex flex-col items-center gap-1.5 border border-gray-100 hover:border-[#2D6A4F] transition-colors"
            >
              <span className="text-2xl">{item.icon}</span>
              <span className="text-[11px] text-gray-600 font-medium">{item.label}</span>
            </Link>
          ))}
        </div>

        {/* Today's Photos */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="font-bold text-[#1C2B1E] text-sm">오늘의 급식 사진</h2>
            <Link href="/parent/photos" className="text-xs text-[#2D6A4F] font-medium hover:underline">
              전체보기
            </Link>
          </div>
          {loading ? (
            <div className="p-4 grid grid-cols-3 gap-2">
              {[1,2,3].map(i => <div key={i} className="aspect-square bg-gray-100 rounded-xl animate-pulse" />)}
            </div>
          ) : todayPhotos.length === 0 ? (
            <EmptyState icon="📷" title="오늘 등록된 사진이 없습니다" />
          ) : (
            <div className="p-4 grid grid-cols-3 gap-2">
              {todayPhotos.flatMap(p => p.image_urls || []).slice(0, 6).map((url, i) => (
                <Link key={i} href="/parent/photos">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="aspect-square object-cover rounded-xl w-full" />
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Latest Menu */}
        {latestMenu && (
          <Link href="/parent/menu" className="block bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-bold text-[#1C2B1E] text-sm">이번 달 식단표</h2>
              <span className="text-xs text-[#2D6A4F] font-medium">보기 →</span>
            </div>
            <p className="text-sm text-gray-600 line-clamp-2">{latestMenu.title}</p>
          </Link>
        )}

        {/* Notices */}
        {notices.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-bold text-[#1C2B1E] text-sm">공지사항</h2>
            </div>
            <ul className="divide-y divide-gray-50">
              {notices.map(notice => (
                <li key={notice.id} className="px-5 py-3.5">
                  <p className="text-sm text-[#1C2B1E] font-medium line-clamp-1">{notice.title}</p>
                  {notice.date && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(notice.date).toLocaleDateString('ko-KR')}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  )
}
