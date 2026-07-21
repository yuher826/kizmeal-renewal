'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

type Notice = {
  id: string
  title: string
  content: string | null
  branch_id: string | null
  is_pinned: boolean
  attachment_url: string | null
  created_at: string
}

export default function CustomerNoticesPage() {
  const [notices, setNotices]     = useState<Notice[]>([])
  const [readSet, setReadSet]     = useState<Set<string>>(new Set())
  const [expanded, setExpanded]   = useState<Set<string>>(new Set())
  const [branchName, setBranchName] = useState<string | null>(null)
  const [userId, setUserId]       = useState<string | null>(null)
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    const supabase = createClient()

    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      setUserId(user.id)

      // branch_id 확인
      let branchId: string | null = null
      const { data: branchRow } = await supabase
        .from('branches').select('id, name').eq('auth_id', user.id).maybeSingle()
      if (branchRow) {
        branchId = branchRow.id
        setBranchName(branchRow.name || null)
      } else {
        const { data: mem } = await supabase
          .from('branch_members').select('branch_id').eq('auth_id', user.id).maybeSingle()
        if (mem) {
          branchId = mem.branch_id
          const { data: b } = await supabase
            .from('branches').select('name').eq('id', branchId).maybeSingle()
          if (b) setBranchName(b.name || null)
        }
      }

      const filter = branchId
        ? `branch_id.is.null,branch_id.eq.${branchId}`
        : 'branch_id.is.null'

      const [{ data: rows }, { data: reads }] = await Promise.all([
        supabase
          .from('parent_notices')
          .select('id, title, content, branch_id, is_pinned, attachment_url, created_at')
          .or(filter)
          .order('is_pinned', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('parent_notice_reads')
          .select('notice_id')
          .eq('user_id', user.id),
      ])

      setNotices((rows || []) as Notice[])
      setReadSet(new Set((reads || []).map(r => r.notice_id as string)))
      setLoading(false)
    }
    load()
  }, [])

  async function handleToggle(noticeId: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(noticeId)) { next.delete(noticeId) } else { next.add(noticeId) }
      return next
    })
    // 처음 열 때 읽음 처리
    if (!readSet.has(noticeId) && userId) {
      const supabase = createClient()
      await supabase
        .from('parent_notice_reads')
        .upsert({ notice_id: noticeId, user_id: userId }, { onConflict: 'notice_id,user_id' })
      setReadSet(prev => new Set(Array.from(prev).concat(noticeId)))
    }
  }

  const unreadCount = notices.filter(n => !readSet.has(n.id)).length

  return (
    <div className="min-h-screen bg-[#F6FAF6] font-sans">
      <header className="bg-white border-b border-gray-100 px-4 sm:px-6 h-16 hidden sm:flex items-center sticky top-0 z-10">
        <div className="flex-1">
          <div className="flex items-center gap-1 text-xs text-gray-400 mb-0.5">
            <span>{branchName || '소통채널'}</span>
            <span>›</span>
            <span className="text-[#2D6A4F] font-medium">공지사항</span>
          </div>
          <h1 className="font-bold text-[#1C2B1E] text-base">공지사항</h1>
          <p className="text-gray-400 text-xs">키즈밀 본사 공지를 확인하세요</p>
        </div>
        {unreadCount > 0 && (
          <span className="text-xs text-gray-400">{unreadCount}개 미읽음</span>
        )}
      </header>

      <div className="px-4 sm:px-6 py-6 space-y-3">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl h-16 animate-pulse border border-gray-100" />
          ))
        ) : notices.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 px-6 py-16 text-center">
            <p className="text-5xl mb-4">📢</p>
            <p className="text-gray-500 font-medium">등록된 공지사항이 없습니다.</p>
          </div>
        ) : (
          notices.map(notice => {
            const isRead = readSet.has(notice.id)
            const isOpen = expanded.has(notice.id)

            return (
              <div
                key={notice.id}
                className={`bg-white rounded-2xl border transition-all ${
                  notice.is_pinned ? 'border-[#2D6A4F]/30' : 'border-gray-100'
                }`}
              >
                <button
                  type="button"
                  onClick={() => handleToggle(notice.id)}
                  className="w-full text-left px-5 py-4 flex items-center gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      {notice.is_pinned && (
                        <span className="text-[10px] bg-[#2D6A4F] text-white font-bold px-1.5 py-0.5 rounded-full flex-shrink-0">
                          📌 고정
                        </span>
                      )}
                      {!isRead && (
                        <span className="w-1.5 h-1.5 bg-red-500 rounded-full flex-shrink-0" />
                      )}
                    </div>
                    <p className={`text-sm font-semibold truncate ${isRead ? 'text-gray-500' : 'text-[#1C2B1E]'}`}>
                      {notice.title}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(notice.created_at).toLocaleDateString('ko-KR', {
                        year: 'numeric', month: 'long', day: 'numeric',
                      })}
                    </p>
                  </div>
                  <svg
                    width="16" height="16"
                    viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                    className={`flex-shrink-0 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {isOpen && (
                  <div className="px-5 pb-5 border-t border-gray-50">
                    <p className="text-sm text-gray-600 whitespace-pre-wrap pt-4 leading-relaxed">
                      {notice.content || '(내용 없음)'}
                    </p>
                    {notice.attachment_url && (
                      <a
                        href={notice.attachment_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 mt-3 text-xs text-[#2D6A4F] font-medium hover:underline"
                      >
                        📎 첨부파일 다운로드
                      </a>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      <div className="h-14 sm:hidden" />
    </div>
  )
}
