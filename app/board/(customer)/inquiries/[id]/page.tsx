'use client'

import { useEffect, useState, useRef, useCallback, Fragment } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import type { Inquiry, Message } from '@/lib/types'
import { CATEGORY_ICONS, CUSTOMER_STATUS_LABELS } from '@/lib/types'
import MessageBubble from '@/components/board/MessageBubble'
import StatusBadge from '@/components/board/StatusBadge'
import FileUpload from '@/components/board/FileUpload'
import { useNotifier } from '@/lib/useNotifier'
import NotifyToggleButton from '@/components/NotifyToggleButton'
import { logChannelStatus } from '@/lib/realtime-debug'

const STATUS_STEPS = [
  { key: 'pending', label: '접수' },
  { key: 'in_progress', label: '처리중' },
  { key: 'resolved', label: '완료' },
]

export default function CustomerInquiryDetailPage({ params }: { params: { id: string } }) {
  const { id } = params
  const [inquiry, setInquiry] = useState<Inquiry | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [content, setContent] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [sending, setSending] = useState(false)
  const [showAttach, setShowAttach] = useState(false)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  // auth_id → 발신자 이름(+직책). admins는 RLS로 못 읽으므로 서버 API
  // (/api/board/inquiries/[id]/senders)를 거쳐서만 채운다.
  const [senderMap, setSenderMap] = useState<Record<string, { name: string; role?: string }>>({})
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // 관리자 답변 알림 (소리+팝업, 기본 ON)
  const { enabled: notifyOn, toggle: toggleNotify, notify } = useNotifier()

  const scrollToBottom = useCallback(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight
    }
  }, [])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

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
      }

      const { data: msgs } = await supabase
        .from('messages')
        .select('*, message_attachments(*)')
        .eq('inquiry_id', id)
        .eq('is_internal', false)
        .order('created_at', { ascending: true })

      if (msgs) setMessages(msgs as unknown as Message[])

      // 발신자 이름 — setLoading(false)보다 먼저 채운다. 뒤에 채우면 첫
      // 렌더에서 전부 '키즈밀'/'고객사'로 보였다가 이름으로 바뀌는 깜빡임이 난다.
      try {
        const res = await fetch(`/api/board/inquiries/${id}/senders`)
        if (res.ok) {
          const { senders } = await res.json()
          setSenderMap(senders || {})
        }
      } catch (e) {
        console.error('[CS] 발신자 이름 조회 실패:', e)
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        // 안 읽음 카운트 리셋과 함께 "마지막으로 이 대화방을 연 시각"도 기록.
        // 이 시각이 관리자 메시지 수정·삭제 가능 여부의 기준이 된다(권팀장 요청 7번).
        await supabase
          .from('inquiries')
          .update({ unread_count_branch: 0, branch_last_read_at: new Date().toISOString() })
          .eq('id', id)
      }

      setLoading(false)
    }

    load()

    const channel = supabase
      .channel(`chat-${id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `inquiry_id=eq.${id}`,
      }, async (payload) => {
        const newMsg = payload.new as Message
        if (newMsg.is_internal) return
        const { data: full } = await supabase
          .from('messages')
          .select('*, message_attachments(*)')
          .eq('id', newMsg.id)
          .single()
        if (full) {
          setMessages(prev => prev.find(m => m.id === full.id) ? prev : [...prev, full as unknown as Message])
        }
        // ★ "관리자가 보낸 답변"일 때만 알림 (고객 본인 발신 제외)
        if (newMsg.sender_type === 'admin') {
          const preview = newMsg.content.length > 40
            ? `${newMsg.content.slice(0, 40)}…` : newMsg.content
          notify(newMsg.id, '키즈밀 답변 도착', preview)
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
      // 권팀장 요청 7번: 관리자가 아직 이쪽이 안 읽은 메시지를 수정·삭제할 수 있게
      // 되면서, 화면을 이미 열어둔 상태에서 실시간으로 그 변경이 반영돼야 한다
      // (안 그러면 새로고침 전까지 수정 전 내용이 그대로 보이는 모순이 생김).
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
        filter: `inquiry_id=eq.${id}`,
      }, (payload) => {
        const updated = payload.new as Message
        setMessages(prev => prev.map(m => (m.id === updated.id ? { ...m, ...updated } : m)))
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'messages',
        filter: `inquiry_id=eq.${id}`,
      }, (payload) => {
        const deletedId = (payload.old as { id: string }).id
        setMessages(prev => prev.filter(m => m.id !== deletedId))
      })
      .subscribe(logChannelStatus(`chat-${id}`))

    return () => { supabase.removeChannel(channel) }
  }, [id, notify])

  useEffect(() => { scrollToBottom() }, [messages, scrollToBottom])

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
    if (!user) { setSending(false); return }

    try {
      // 1. 파일 먼저 업로드
      const uploaded: { path: string; url: string; name: string; size: number; type: string }[] = []
      for (const file of files) {
        const ext = file.name.split('.').pop()?.toLowerCase() || 'bin'
        const safeFileName = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`
        const storagePath = `${id}/${safeFileName}`
        const { data: up, error: upErr } = await supabase.storage
          .from('kizmeal-files')
          .upload(storagePath, file, { upsert: true })
        if (upErr) {
          console.error('Storage 에러 전체:', upErr.message, upErr.statusCode, JSON.stringify(upErr))
          throw new Error(upErr.message || '파일 업로드 실패')
        }
        if (up) {
          const { data: urlData } = supabase.storage.from('kizmeal-files').getPublicUrl(storagePath)
          uploaded.push({ path: storagePath, url: urlData?.publicUrl ?? '', name: file.name, size: file.size, type: file.type })
        }
      }

      // 2. 메시지 INSERT
      const msgContent = content.trim() || (uploaded.length > 0 ? `[파일 ${uploaded.length}개 첨부]` : '')
      const { data: msg, error: msgErr } = await supabase
        .from('messages')
        .insert({
          inquiry_id: id,
          sender_id: user.id,
          sender_type: 'branch',
          content: msgContent,
          is_internal: false,
        })
        .select()
        .single()
      if (msgErr) throw msgErr

      // 3. 첨부파일 메타데이터 INSERT
      for (const f of uploaded) {
        const { error: attErr } = await supabase.from('message_attachments').insert({
          message_id: msg.id,
          file_name: f.name,
          file_size: f.size,
          file_type: f.type,
          storage_path: f.path,
          file_url: f.url || null,
          mime_type: f.type,
        })
        if (attErr) console.error('첨부파일 INSERT 에러:', JSON.stringify(attErr, null, 2))
      }

      // 4. 문의 업데이트
      // ★완료된 문의에 고객사가 메시지를 보내면 처리중으로 되돌린다 — 이미
      //   in_progress면 불필요하게 덮어쓰지 않는다(realtime UPDATE 스팸 방지).
      const inquiryUpdates: Record<string, unknown> = {
        last_message_at: new Date().toISOString(),
        unread_count_admin: (inquiry?.unread_count_admin ?? 0) + 1,
      }
      if (inquiry && inquiry.status !== 'in_progress') {
        inquiryUpdates.status = 'in_progress'
      }
      await supabase.from('inquiries').update(inquiryUpdates).eq('id', id)

      // 관리자에게 새 메시지 이메일 알림 (실패해도 전송에 영향 없음)
      try {
        await fetch('/api/cs/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'new_inquiry',
            branchName: inquiry?.branches?.name ?? '(지점명 없음)',
            content: msgContent,
            inquiryId: id,
          }),
        })
      } catch (e) {
        console.error('[CS] 지점 메시지 이메일 알림 실패:', e)
      }

      // CS 담당자별 알림 목록(cs_notifications) 생성.
      // ★ERP 목록의 realtime 구독에 붙이지 않는 이유는 위 새 문의 등록 화면과 동일 —
      //   그 화면을 아무도 열어두지 않으면 알림이 안 쌓인다. 고객이 실제로 보낸
      //   이 시점엔 항상 실행되므로 여기서 만든다.
      try {
        await fetch('/api/cs/notifications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kind: 'new_message',
            inquiryId: id,
            messageId: msg.id,
            branchName: inquiry?.branches?.name ?? '(지점명 없음)',
            preview: msgContent.slice(0, 60),
          }),
        })
      } catch (e) {
        console.error('[CS] 알림 목록 생성 실패:', e)
      }

      setContent('')
      setFiles([])
      setShowAttach(false)
    } catch (err) {
      const errMsg = err instanceof Error ? err.message
        : typeof err === 'object' && err !== null && 'message' in err
        ? (err as { message: string }).message
        : '전송에 실패했습니다.'
      showToast(errMsg)
    } finally {
      setSending(false)
    }
  }

  // 발신자 이름 해석 — inquiry.admins.name(담당자)은 "이 문의 담당자"이지
  // "이 메시지를 쓴 사람"이 아니라 쓰지 않는다. sender_type은 'parent'가
  // 아니라 'branch'다(헷갈리면 좌우가 뒤집힌다).
  function resolveSenderName(msg: Message): string {
    const sender = msg.sender_id ? senderMap[msg.sender_id] : undefined
    if (sender) return sender.name
    return msg.sender_type === 'admin' ? '키즈밀' : '고객사'
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const stepIndex = !inquiry ? 0
    : inquiry.status === 'resolved' ? 2
    : inquiry.status === 'in_progress' ? 1
    : 0

  return (
    <div className="h-screen flex flex-col bg-[#F6FAF6] font-sans">
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-red-500 text-white px-5 py-2.5 rounded-xl shadow-lg text-sm font-medium whitespace-nowrap">
          {toast}
        </div>
      )}

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
            <NotifyToggleButton enabled={notifyOn} onToggle={toggleNotify} />
            {inquiry && <StatusBadge status={inquiry.status} labels={CUSTOMER_STATUS_LABELS} />}
          </div>
        </div>

        {/* 진행 타임라인 */}
        {inquiry && (
          <div className="mt-3 pb-1">
            {/* 원(숫자)과 라벨을 한 덩어리로 묶어 세로로 쌓는다.
                예전엔 원 행과 라벨 행을 따로 그렸는데, 라벨 행의 각 칸은
                [원+연결선] 전체 폭을 차지하는 반면 원은 그 칸의 왼쪽 끝에
                붙어 있어서 가운데 라벨('처리중')만 오른쪽으로 밀려 보였다
                (권팀장 요청 6번). 이제 원과 라벨이 같은 컨테이너를 공유해
                항상 정렬된다. */}
            <div className="flex items-start px-1">
              {STATUS_STEPS.map((step, i) => (
                <Fragment key={step.key}>
                  <div className="flex flex-col items-center flex-shrink-0">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      i < stepIndex ? 'bg-[#2D6A4F] text-white'
                      : i === stepIndex ? 'bg-[#2D6A4F] text-white ring-2 ring-[#B7E4C7]'
                      : 'bg-gray-200 text-gray-400'
                    }`}>
                      {i < stepIndex ? '✓' : i + 1}
                    </div>
                    <span className={`mt-1.5 text-[10px] whitespace-nowrap font-medium ${
                      i <= stepIndex ? 'text-[#2D6A4F]' : 'text-gray-400'
                    }`}>
                      {step.label}
                    </span>
                  </div>
                  {i < STATUS_STEPS.length - 1 && (
                    // 원 세로 중앙(24px의 절반 = 12px)에 선을 맞춘다
                    <div className={`flex-1 h-0.5 mx-1 mt-[11px] ${
                      i < stepIndex ? 'bg-[#2D6A4F]' : 'bg-gray-200'
                    }`} />
                  )}
                </Fragment>
              ))}
            </div>
          </div>
        )}
      </header>

      {/* 메시지 영역 */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
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
                senderName={resolveSenderName(msg)}
                senderRole={msg.sender_id ? senderMap[msg.sender_id]?.role : undefined}
              />
            ))}
          </>
        )}
      </div>

      {/* 파일 첨부 패널 */}
      {showAttach && (
        <div className="bg-white border-t border-gray-100 px-4 py-3 flex-shrink-0">
          <FileUpload files={files} onFilesChange={setFiles} maxFiles={5} />
        </div>
      )}

      {/* 입력창 — ★완료된 문의도 계속 메시지를 보낼 수 있다(3단계 전환, 2026-09-17).
          추가 질문이 있으면 전화가 오던 것을 막기 위해 차단을 없앴다.
          보내면 sendMessage()가 status를 'in_progress'로 되돌린다. */}
      <div className="bg-white border-t border-gray-100 px-4 py-3 flex-shrink-0">
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
      </div>
    </div>
  )
}
