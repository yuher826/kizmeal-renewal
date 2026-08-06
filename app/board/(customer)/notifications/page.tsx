'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { ROUTES } from '@/lib/routes'

interface Notif {
  id: string
  inquiry_id?: string
  type: string
  title: string
  body?: string
  content?: string
  is_read: boolean
  created_at: string
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(mins / 60)
  const days = Math.floor(hours / 24)
  if (days > 0) return `${days}일 전`
  if (hours > 0) return `${hours}시간 전`
  if (mins > 0) return `${mins}분 전`
  return '방금'
}

function typeIcon(type: string) {
  switch (type) {
    case 'new_message': return '💬'
    case 'status_changed': return '🔄'
    case 'assigned': return '👤'
    default: return '🔔'
  }
}

export default function NotificationsPage() {
  const router = useRouter()
  const [notifs, setNotifs] = useState<Notif[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace(ROUTES.BOARD_LOGIN); return }

      try {
        const { data } = await supabase
          .from('notifications')
          .select('*')
          .eq('recipient_auth_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50)

        if (data) setNotifs(data as Notif[])
      } finally {
        setLoading(false)
      }
    }

    load()

    // Realtime new notifications
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase
        .channel('notifications-page')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_auth_id=eq.${user.id}`,
        }, (payload) => {
          setNotifs(prev => [payload.new as Notif, ...prev])
        })
        .subscribe()
    })
  }, [])

  async function markRead(notif: Notif) {
    const supabase = createClient()
    if (!notif.is_read) {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notif.id)
      setNotifs(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n))
    }
    if (notif.inquiry_id) {
      router.push(`/board/inquiries/${notif.inquiry_id}`)
    }
  }

  async function markAllRead() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('recipient_auth_id', user.id)
      .eq('is_read', false)
    setNotifs(prev => prev.map(n => ({ ...n, is_read: true })))
  }

  const unreadCount = notifs.filter(n => !n.is_read).length

  return (
    <div className="min-h-screen bg-[#F6FAF6] font-sans">
      <header className="bg-white border-b border-gray-100 px-4 sm:px-6 py-4 hidden sm:flex items-center gap-3 sticky top-0 z-10">
        <Link href="/board/dashboard" className="text-gray-400 hover:text-gray-600">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5m7-7l-7 7 7 7" />
          </svg>
        </Link>
        <h1 className="font-bold text-[#1C2B1E] flex-1">알림</h1>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="text-xs text-[#2D6A4F] font-medium hover:underline"
          >
            모두 읽음 처리
          </button>
        )}
      </header>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl h-20 animate-pulse border border-gray-100" />
            ))}
          </div>
        ) : notifs.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 px-6 py-16 text-center">
            <p className="text-4xl mb-3">🔔</p>
            <p className="text-gray-500 font-medium">알림이 없습니다</p>
            <p className="text-gray-400 text-sm mt-1">관리자 답변이 도착하면 여기에 표시됩니다.</p>
            <Link href="/board/dashboard" className="inline-block mt-4 text-sm text-[#2D6A4F] font-medium hover:underline">
              홈으로 돌아가기
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {notifs.map(notif => (
              <button
                key={notif.id}
                onClick={() => markRead(notif)}
                className={`w-full text-left bg-white rounded-2xl border px-5 py-4 hover:border-[#52B788] hover:shadow-sm transition-all ${
                  notif.is_read ? 'border-gray-100 opacity-70' : 'border-[#B7E4C7]'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-xl flex-shrink-0 mt-0.5">{typeIcon(notif.type)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-[#1C2B1E] truncate">
                        {notif.title}
                      </span>
                      <span className="text-xs text-gray-400 flex-shrink-0">
                        {timeAgo(notif.created_at)}
                      </span>
                    </div>
                    {(notif.body || notif.content) && (
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                        {notif.body || notif.content}
                      </p>
                    )}
                  </div>
                  {!notif.is_read && (
                    <span className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0 mt-1.5" />
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 모바일 하단 네비게이션 */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex sm:hidden z-20">
        {[
          { href: '/board/dashboard', label: '홈', icon: '🏠' },
          { href: '/board/inquiries', label: '문의', icon: '💬' },
          { href: '/board/inquiries/new', label: '새 문의', icon: '✏️', highlight: true },
          { href: '/board/settings', label: '설정', icon: '⚙️' },
        ].map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex-1 flex flex-col items-center py-3 text-xs gap-1 ${
              item.highlight ? 'text-[#F97316] font-bold' : 'text-gray-500 hover:text-[#2D6A4F]'
            } transition-colors`}
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
      <div className="h-16 sm:hidden" />
    </div>
  )
}
