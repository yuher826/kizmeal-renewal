'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { KIZMEAL_LOGO_PATH } from '@/lib/brand'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'

const CAT_MAP: Record<string, { icon: string; label: string }> = {
  ALLERGY:   { icon: '🚨', label: '알레르기 관련' },
  MENU:      { icon: '🍱', label: '식단 관련' },
  PHOTO:     { icon: '📸', label: '급식사진 관련' },
  COMPLAINT: { icon: '😤', label: '불만/건의' },
  GENERAL:   { icon: '💬', label: '일반 문의' },
}

const STATUS_LABELS: Record<string, string> = {
  pending: '접수중', in_progress: '답변중', resolved: '답변완료', closed: '종료',
}
const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800', in_progress: 'bg-blue-100 text-blue-800',
  resolved: 'bg-green-100 text-green-800', closed: 'bg-gray-100 text-gray-600',
}

type Inquiry = {
  id: string
  category: string
  title: string
  status: string
  created_at: string
  parents: { name: string; email: string } | null
  children: { name_ko: string } | null
  branches: { name: string; brands: { name: string } | null } | null
}
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

export default function AdminParentInquiryDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [inquiry, setInquiry] = useState<Inquiry | null>(null)
  const [messages, setMessages] = useState<Msg[]>([])
  const [loading, setLoading] = useState(true)
  const [content, setContent] = useState('')
  const [sending, setSending] = useState(false)
  const [toast, setToast] = useState('')
  const endRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = useCallback(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [])

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const [inqRes, msgRes] = await Promise.all([
        supabase.from('parent_inquiries').select('id, category, title, status, created_at, parents(name, email), children(name_ko), branches(name, brands(name))').eq('id', id).single(),
        supabase.from('parent_inquiry_messages').select('id, sender_type, content, image_urls, created_at').eq('inquiry_id', id).order('created_at', { ascending: true }),
      ])
      if (inqRes.data) setInquiry(inqRes.data as unknown as Inquiry)
      if (msgRes.data) setMessages(msgRes.data as Msg[])
      await supabase.from('parent_inquiries').update({ unread_count_admin: 0 }).eq('id', id)
      setLoading(false)
    }
    load()

    const channel = supabase
      .channel(`admin-parent-inq-${id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'parent_inquiry_messages', filter: `inquiry_id=eq.${id}`,
      }, (payload) => {
        const m = payload.new as Msg
        setMessages(prev => prev.find(x => x.id === m.id) ? prev : [...prev, m])
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [id])

  useEffect(() => { scrollToBottom() }, [messages, scrollToBottom])

  function showToast(m: string) { setToast(m); setTimeout(() => setToast(''), 4000) }

  async function sendMessage() {
    if (!content.trim() || sending) return
    setSending(true)
    const supabase = createClient()
    const replyText = content.trim()
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const now = new Date().toISOString()
      const { error } = await supabase.from('parent_inquiry_messages').insert({
        inquiry_id: id, sender_type: 'admin', sender_id: user.id, content: replyText,
      })
      if (error) throw error
      await supabase.from('parent_inquiries').update({
        last_message_at: now,
        unread_count_parent: 1,
        status: inquiry?.status === 'pending' ? 'in_progress' : inquiry?.status,
      }).eq('id', id)
      setInquiry(prev => prev ? { ...prev, status: prev.status === 'pending' ? 'in_progress' : prev.status } : null)
      setContent('')

      // 이메일 알림 발송
      try {
        const res = await fetch('/api/parent-inquiry/notify', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ inquiry_id: id, reply: replyText }),
        })
        const data = await res.json()
        showToast(data.notified ? '답변 전송 + 이메일 알림 발송 완료 ✅' : '답변이 전송되었습니다.')
      } catch {
        showToast('답변이 전송되었습니다.')
      }
    } catch {
      showToast('전송에 실패했습니다.')
    } finally {
      setSending(false)
    }
  }

  async function updateStatus(status: string) {
    const supabase = createClient()
    await supabase.from('parent_inquiries').update({ status }).eq('id', id)
    setInquiry(prev => prev ? { ...prev, status } : null)
  }

  const cat = inquiry ? (CAT_MAP[inquiry.category] || CAT_MAP.GENERAL) : null
  const branchLabel = inquiry ? [inquiry.branches?.brands?.name, inquiry.branches?.name].filter(Boolean).join(' ') : ''

  return (
    <div className="h-screen flex bg-[#F6FAF6] overflow-hidden">
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-[#2D6A4F] text-white px-5 py-2.5 rounded-xl shadow-lg text-sm font-medium">{toast}</div>
      )}

      {/* 채팅 영역 */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 flex-shrink-0">
          <Link href="/board/admin/parent-inquiries" className="text-gray-400 hover:text-gray-600 flex-shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5m7-7l-7 7 7 7" />
            </svg>
          </Link>
          <div className="flex-1 min-w-0">
            {cat && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs">{cat.icon}</span>
                <span className="text-sm font-bold text-[#1C2B1E] truncate">{inquiry?.title}</span>
                <span className="text-xs text-gray-400">· {inquiry?.parents?.name}</span>
              </div>
            )}
          </div>
          {inquiry && (
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${STATUS_COLORS[inquiry.status]}`}>
              {STATUS_LABELS[inquiry.status]}
            </span>
          )}
        </header>

        {/* 알레르기 배너 */}
        {inquiry?.category === 'ALLERGY' && (
          <div className="bg-red-50 border-b border-red-200 px-4 py-2 text-xs font-semibold text-red-700 flex-shrink-0">
            🚨 알레르기 관련 문의입니다. 최우선으로 처리해주세요.
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {loading ? (
            <div className="flex justify-center py-8"><span className="w-6 h-6 border-2 border-[#2D6A4F]/30 border-t-[#2D6A4F] rounded-full animate-spin" /></div>
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
                const isParent = msg.sender_type === 'parent'
                // 학부모 = 오른쪽 초록 / 키즈밀(admin) = 왼쪽 흰색
                return (
                  <div key={msg.id} className={`flex mb-3 ${isParent ? 'justify-end' : 'justify-start gap-2'}`}>
                    {!isParent && (
                      <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0 mt-1">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={KIZMEAL_LOGO_PATH} alt="키즈밀 로고" className="w-full h-full object-contain" />
                      </div>
                    )}
                    <div className="max-w-[75%]">
                      <div className={`rounded-2xl px-4 py-3 shadow-sm ${
                        isParent ? 'bg-[#2D6A4F] text-white rounded-tr-sm' : 'bg-white border border-gray-100 text-gray-800 rounded-tl-sm'
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
                      <div className={isParent ? 'text-right mt-1' : 'mt-1'}>
                        <span className="text-xs text-gray-400">{isParent ? (inquiry?.parents?.name || '학부모') : '키즈밀'} · {formatTime(msg.created_at)}</span>
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
              placeholder="답변을 입력하세요... (Enter 전송, 학부모에게 이메일 알림)"
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

      {/* 우측 패널 */}
      <div className="w-72 xl:w-80 flex-shrink-0 bg-white border-l border-gray-100 overflow-y-auto hidden lg:block">
        <div className="p-5 space-y-5">
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">문의 정보</h3>
            <div className="space-y-2">
              <Row label="분류" value={cat ? `${cat.icon} ${cat.label}` : '—'} />
              <Row label="상태" value={inquiry ? STATUS_LABELS[inquiry.status] : '—'} />
              <Row label="접수일" value={inquiry ? new Date(inquiry.created_at).toLocaleDateString('ko-KR') : '—'} />
            </div>
          </div>

          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">학부모 정보</h3>
            <div className="space-y-2">
              <Row label="학부모" value={inquiry?.parents?.name} />
              <Row label="자녀" value={inquiry?.children?.name_ko} />
              <Row label="소속 원" value={branchLabel} />
              <Row label="이메일" value={inquiry?.parents?.email} />
            </div>
          </div>

          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">상태 변경</h3>
            <div className="grid grid-cols-2 gap-1.5">
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <button
                  key={k}
                  onClick={() => updateStatus(k)}
                  disabled={inquiry?.status === k}
                  className={`text-xs py-1.5 rounded-lg font-medium transition-colors ${
                    inquiry?.status === k ? `${STATUS_COLORS[k]} cursor-default` : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-xs text-gray-400 flex-shrink-0">{label}</span>
      <span className="text-xs text-[#1C2B1E] font-medium truncate text-right">{value || '—'}</span>
    </div>
  )
}
