'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

const CAT_MAP: Record<string, { icon: string; label: string }> = {
  ALLERGY:   { icon: '🚨', label: '알레르기 관련' },
  MENU:      { icon: '🍱', label: '식단 관련' },
  PHOTO:     { icon: '📸', label: '급식사진 관련' },
  COMPLAINT: { icon: '😤', label: '불만/건의' },
  GENERAL:   { icon: '💬', label: '일반 문의' },
}

const STATUS_BADGES: Record<string, { label: string; color: string }> = {
  pending:     { label: '접수중',   color: 'bg-yellow-100 text-yellow-800' },
  in_progress: { label: '답변중',   color: 'bg-blue-100 text-blue-800' },
  resolved:    { label: '답변완료', color: 'bg-green-100 text-green-800' },
  closed:      { label: '종료',     color: 'bg-gray-100 text-gray-600' },
}

type Inquiry = { id: string; category: string; title: string; status: string; created_at: string }
type Msg = {
  id: string
  sender_type: 'parent' | 'admin' | 'system'
  content: string
  image_urls: string[] | null
  created_at: string
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function ParentInquiryDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [inquiry, setInquiry] = useState<Inquiry | null>(null)
  const [messages, setMessages] = useState<Msg[]>([])
  const [loading, setLoading] = useState(true)
  const [content, setContent] = useState('')
  const [sending, setSending] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = useCallback(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    const supabase = createClient()

    async function load() {
      const [inqRes, msgRes] = await Promise.all([
        supabase.from('parent_inquiries').select('id, category, title, status, created_at').eq('id', id).single(),
        supabase.from('parent_inquiry_messages').select('id, sender_type, content, image_urls, created_at').eq('inquiry_id', id).order('created_at', { ascending: true }),
      ])
      if (inqRes.data) setInquiry(inqRes.data as Inquiry)
      if (msgRes.data) setMessages(msgRes.data as Msg[])
      // 학부모 미읽음 초기화
      await supabase.from('parent_inquiries').update({ unread_count_parent: 0 }).eq('id', id)
      setLoading(false)
    }
    load()

    const channel = supabase
      .channel(`parent-inq-${id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'parent_inquiry_messages',
        filter: `inquiry_id=eq.${id}`,
      }, (payload) => {
        const m = payload.new as Msg
        setMessages(prev => prev.find(x => x.id === m.id) ? prev : [...prev, m])
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'parent_inquiries',
        filter: `id=eq.${id}`,
      }, (payload) => {
        setInquiry(prev => prev ? { ...prev, ...payload.new } : null)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [id])

  useEffect(() => { scrollToBottom() }, [messages, scrollToBottom])

  async function sendMessage() {
    if (!content.trim() || sending) return
    setSending(true)
    const supabase = createClient()
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const now = new Date().toISOString()
      const { error } = await supabase.from('parent_inquiry_messages').insert({
        inquiry_id: id,
        sender_type: 'parent',
        sender_id: user.id,
        content: content.trim(),
      })
      if (error) throw error
      await supabase.from('parent_inquiries').update({
        last_message_at: now,
        unread_count_admin: 1,
        status: 'pending',
      }).eq('id', id)
      setContent('')
    } finally {
      setSending(false)
    }
  }

  const cat = inquiry ? (CAT_MAP[inquiry.category] || CAT_MAP.GENERAL) : null
  const badge = inquiry ? (STATUS_BADGES[inquiry.status] || STATUS_BADGES.pending) : null

  return (
    <div className="h-[calc(100vh-4rem)] mt-16 flex flex-col bg-[#F6FAF6]">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 flex-shrink-0">
        <Link href="/parent/inquiry" className="text-gray-400 hover:text-gray-600 flex-shrink-0">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5m7-7l-7 7 7 7" />
          </svg>
        </Link>
        <div className="flex-1 min-w-0">
          {cat && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs">{cat.icon}</span>
              <span className="text-sm font-bold text-[#1C2B1E] truncate">{inquiry?.title}</span>
            </div>
          )}
        </div>
        {badge && <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${badge.color}`}>{badge.label}</span>}
      </header>

      {/* 메시지 */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {loading ? (
          <div className="flex justify-center py-8">
            <span className="w-6 h-6 border-2 border-[#2D6A4F]/30 border-t-[#2D6A4F] rounded-full animate-spin" />
          </div>
        ) : (
          <>
            <div className="flex justify-center mb-4">
              <span className="text-xs text-gray-400 bg-white rounded-full px-3 py-1 border border-gray-100">
                {inquiry ? new Date(inquiry.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }) : ''}
              </span>
            </div>
            {messages.map(msg => {
              if (msg.sender_type === 'system') {
                return (
                  <div key={msg.id} className="flex justify-center my-3">
                    <span className="text-xs text-gray-400 italic bg-gray-100 rounded-full px-4 py-1.5">{msg.content}</span>
                  </div>
                )
              }
              const mine = msg.sender_type === 'parent'
              return (
                <div key={msg.id} className={`flex mb-3 ${mine ? 'justify-end' : 'justify-start gap-2'}`}>
                  {!mine && (
                    <div className="w-8 h-8 rounded-full bg-[#E8F5E9] flex items-center justify-center text-xs font-bold text-[#2D6A4F] flex-shrink-0 mt-1">K</div>
                  )}
                  <div className="max-w-[75%]">
                    <div className={`rounded-2xl px-4 py-3 shadow-sm ${
                      mine ? 'bg-[#2D6A4F] text-white rounded-tr-sm' : 'bg-white border border-gray-100 text-gray-800 rounded-tl-sm'
                    }`}>
                      {msg.content && <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>}
                      {msg.image_urls && msg.image_urls.length > 0 && (
                        <div className="mt-2 space-y-1.5">
                          {msg.image_urls.map((url, i) => (
                            <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={url} alt="" loading="lazy" className="max-w-[220px] max-h-[220px] w-auto rounded-xl border border-black/5 object-cover" />
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className={mine ? 'text-right mt-1' : 'mt-1'}>
                      <span className="text-xs text-gray-400">{mine ? '나' : '키즈밀'} · {formatTime(msg.created_at)}</span>
                    </div>
                  </div>
                </div>
              )
            })}
            <div ref={endRef} />
          </>
        )}
      </div>

      {/* 입력창 */}
      <div className="bg-white border-t border-gray-100 px-4 py-3 flex-shrink-0">
        <div className="flex gap-2 items-end">
          <textarea
            rows={1}
            value={content}
            onChange={e => setContent(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
            placeholder="메시지를 입력하세요..."
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F] resize-none"
            style={{ minHeight: '42px', maxHeight: '120px' }}
          />
          <button
            onClick={sendMessage}
            disabled={!content.trim() || sending}
            className="bg-[#2D6A4F] hover:bg-[#1B4332] disabled:bg-gray-300 text-white rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors flex-shrink-0"
          >
            {sending ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin block" /> : '전송'}
          </button>
        </div>
      </div>
    </div>
  )
}
