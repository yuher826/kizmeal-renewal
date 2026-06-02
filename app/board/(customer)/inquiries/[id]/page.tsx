'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import type { Inquiry, Message, SlaRule } from '@/lib/types'
import { CATEGORY_ICONS } from '@/lib/types'
import MessageBubble from '@/components/board/MessageBubble'
import StatusBadge from '@/components/board/StatusBadge'
import SlaBadge from '@/components/board/SlaBadge'
import FileUpload from '@/components/board/FileUpload'

const STATUS_STEPS = [
  { key: 'pending', label: '접수' },
  { key: 'in_progress', label: '처리중' },
  { key: 'resolved', label: '완료' },
]

export default function CustomerInquiryDetailPage({ params }: { params: { id: string } }) {
  const { id } = params
  const [inquiry, setInquiry] = useState<Inquiry | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [slaRule, setSlaRule] = useState<SlaRule | undefined>()
  const [content, setContent] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [sending, setSending] = useState(false)
  const [showAttach, setShowAttach] = useState(false)
  const [loading, setLoading] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    const supabase = createClient()

    async function load() {
      const { data: inq } = await supabase
        .from('inquiries')
        .select('*, branches(*, brands(*)), admins(*)')
        .eq('id', id)
        .single()

      if (inq) {
        setInquiry(inq as unknown as Inquiry)

        // Load SLA rule
        const { data: rule } = await supabase
          .from('sla_rules')
          .select('*')
          .eq('category', inq.category)
          .maybeSingle()
        if (rule) setSlaRule(rule as SlaRule)
      }

      const { data: msgs } = await supabase
        .from('messages')
        .select('*, message_attachments(*)')
        .eq('inquiry_id', id)
        .eq('is_internal', false)
        .order('created_at', { ascending: true })

      if (msgs) setMessages(msgs as unknown as Message[])

      // Mark branch unread as 0
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase
          .from('inquiries')
          .update({ unread_count_branch: 0 })
          .eq('id', id)
      }

      setLoading(false)
    }

    load()

    // Realtime subscription
    const channel = supabase
      .channel(`chat-${id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `inquiry_id=eq.${id}`,
      }, (payload) => {
        const newMsg = payload.new as Message
        if (!newMsg.is_internal) {
          setMessages(prev => {
            if (prev.find(m => m.id === newMsg.id)) return prev
            return [...prev, newMsg]
          })
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'inquiries',
        filter: `id=eq.${id}`,
      }, (payload) => {
        setInquiry(prev => prev ? { ...prev, ...payload.new } : null)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [id])

  useEffect(() => { scrollToBottom() }, [messages, scrollToBottom])

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`
    }
  }, [content])

  async function sendMessage() {
    if (!content.trim() && files.length === 0) return
    if (sending) return
    setSending(true)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    try {
      const { data: msg } = await supabase
        .from('messages')
        .insert({
          inquiry_id: id,
          sender_id: user.id,
          sender_type: 'branch',
          content: content.trim() || '(파일 첨부)',
          is_internal: false,
        })
        .select()
        .single()

      if (msg && files.length > 0) {
        const branchId = inquiry?.branch_id
        for (const file of files) {
          const path = `${branchId}/${id}/${msg.id}/${file.name}`
          const { data: uploaded } = await supabase.storage
            .from('kizmeal-files')
            .upload(path, file, { upsert: true })

          if (uploaded) {
            await supabase.from('message_attachments').insert({
              message_id: msg.id,
              file_name: file.name,
              file_size: file.size,
              file_type: file.type,
              storage_path: uploaded.path,
            })
          }
        }
      }

      // Update inquiry last_message_at
      await supabase
        .from('inquiries')
        .update({ last_message_at: new Date().toISOString(), unread_count_admin: (inquiry?.unread_count_admin ?? 0) + 1 })
        .eq('id', id)

      setContent('')
      setFiles([])
      setShowAttach(false)
    } finally {
      setSending(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const stepIndex = !inquiry ? 0
    : (inquiry.status === 'resolved' || inquiry.status === 'closed') ? 2
    : inquiry.status === 'in_progress' ? 1
    : 0

  return (
    <div className="h-screen flex flex-col bg-[#F6FAF6] font-sans">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-100 px-4 sm:px-6 py-3 flex-shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/board/inquiries" className="text-gray-400 hover:text-gray-600 flex-shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5m7-7l-7 7 7 7" />
            </svg>
          </Link>
          <div className="flex-1 min-w-0">
            {loading ? (
              <div className="h-4 bg-gray-100 rounded w-48 animate-pulse" />
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs">{CATEGORY_ICONS[inquiry?.category || 'OTHER']}</span>
                <span className="text-sm font-bold text-[#1C2B1E] truncate">{inquiry?.title}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {inquiry && <StatusBadge status={inquiry.status} />}
            {inquiry && slaRule && (
              <SlaBadge inquiry={inquiry} rule={slaRule} />
            )}
          </div>
        </div>

        {/* 진행 타임라인 */}
        {inquiry && (
          <div className="flex items-center mt-3 px-2">
            {STATUS_STEPS.map((step, i) => (
              <div key={step.key} className={`flex items-center ${i < STATUS_STEPS.length - 1 ? 'flex-1' : ''}`}>
                <div className="flex flex-col items-center">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    i < stepIndex
                      ? 'bg-[#2D6A4F] text-white'
                      : i === stepIndex
                        ? 'bg-[#2D6A4F] text-white ring-2 ring-[#B7E4C7]'
                        : 'bg-gray-200 text-gray-400'
                  }`}>
                    {i < stepIndex ? '✓' : i + 1}
                  </div>
                  <span className={`text-[10px] mt-1 whitespace-nowrap ${i <= stepIndex ? 'text-[#2D6A4F] font-semibold' : 'text-gray-400'}`}>
                    {step.label}
                  </span>
                </div>
                {i < STATUS_STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 mb-4 mx-2 ${i < stepIndex ? 'bg-[#2D6A4F]' : 'bg-gray-200'}`} />
                )}
              </div>
            ))}
          </div>
        )}
      </header>

      {/* 메시지 영역 */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
        {loading ? (
          <div className="flex justify-center py-8">
            <span className="w-6 h-6 border-2 border-[#2D6A4F]/30 border-t-[#2D6A4F] rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">
            아직 대화가 없습니다. 관리자가 곧 답변드립니다.
          </div>
        ) : (
          <>
            <div className="flex justify-center mb-4">
              <span className="text-xs text-gray-400 bg-white rounded-full px-3 py-1 border border-gray-100">
                {inquiry ? new Date(inquiry.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }) : ''}
                {inquiry ? ` · 접수 #${inquiry.id.slice(0, 8).toUpperCase()}` : ''}
              </span>
            </div>
            {messages.map(msg => (
              <MessageBubble
                key={msg.id}
                message={msg}
                branchName={inquiry?.branches?.name}
                adminName={inquiry?.admins?.name || '키즈밀'}
              />
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* 파일 첨부 패널 */}
      {showAttach && (
        <div className="bg-white border-t border-gray-100 px-4 py-3 flex-shrink-0">
          <FileUpload files={files} onFilesChange={setFiles} maxFiles={5} />
        </div>
      )}

      {/* 입력창 */}
      <div className="bg-white border-t border-gray-100 px-4 py-3 flex-shrink-0">
        {inquiry?.status === 'closed' ? (
          <p className="text-center text-sm text-gray-400 py-2">종료된 문의입니다.</p>
        ) : (
          <div className="flex gap-2 items-end">
            <button
              type="button"
              onClick={() => setShowAttach(v => !v)}
              className={`flex-shrink-0 pb-2 transition-colors ${showAttach ? 'text-[#2D6A4F]' : 'text-gray-400 hover:text-[#2D6A4F]'}`}
              aria-label="파일 첨부"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
              </svg>
            </button>
            <textarea
              ref={textareaRef}
              rows={1}
              value={content}
              onChange={e => setContent(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="메시지를 입력하세요... (Enter 전송, Shift+Enter 줄바꿈)"
              className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F] focus:border-transparent resize-none"
              style={{ minHeight: '42px', maxHeight: '120px' }}
            />
            <button
              onClick={sendMessage}
              disabled={(!content.trim() && files.length === 0) || sending}
              className="bg-[#2D6A4F] hover:bg-[#1B4332] disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors flex-shrink-0 flex items-center gap-1"
            >
              {sending ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : '전송'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
