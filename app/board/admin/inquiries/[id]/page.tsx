'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import type {
  Inquiry, Message, Admin, SlaRule,
  InquiryNote, ReplyTemplate, InquiryStatus,
} from '@/lib/types'
import {
  CATEGORY_COLORS, CATEGORY_ICONS, CATEGORY_LABELS,
  STATUS_COLORS, STATUS_LABELS,
} from '@/lib/types'
import { getSlaStatus, getSlaRemaining, getSlaBadgeColor } from '@/lib/sla'
import MessageBubble from '@/components/board/MessageBubble'
import StatusBadge from '@/components/board/StatusBadge'
import ReplyTemplates from '@/components/board/ReplyTemplates'
import InternalNote from '@/components/board/InternalNote'
import FileUpload from '@/components/board/FileUpload'

export default function AdminInquiryDetailPage({ params }: { params: { id: string } }) {
  const { id } = params
  const [inquiry, setInquiry] = useState<Inquiry | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [admins, setAdmins] = useState<Admin[]>([])
  const [slaRule, setSlaRule] = useState<SlaRule | undefined>()
  const [notes, setNotes] = useState<InquiryNote[]>([])
  const [templates, setTemplates] = useState<ReplyTemplate[]>([])
  const [currentAdmin, setCurrentAdmin] = useState<Admin | null>(null)
  const [loading, setLoading] = useState(true)

  const [content, setContent] = useState('')
  const [isInternal, setIsInternal] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [showAttach, setShowAttach] = useState(false)
  const [sending, setSending] = useState(false)
  const [toast, setToast] = useState('')

  const [generatingAi, setGeneratingAi] = useState(false)
  const [showPhoneLog, setShowPhoneLog] = useState(false)
  const [phoneMemo, setPhoneMemo] = useState('')
  const [phoneDuration, setPhoneDuration] = useState('')

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    const supabase = createClient()

    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const [inqRes, msgsRes, adminsRes, slaRes, notesRes, templatesRes, myAdminRes] = await Promise.all([
        supabase.from('inquiries').select('*, branches(*, brands(*)), admins(*)').eq('id', id).single(),
        supabase.from('messages').select('*, message_attachments(*)').eq('inquiry_id', id).order('created_at', { ascending: true }),
        supabase.from('admins').select('*').eq('is_active', true),
        supabase.from('sla_rules').select('*'),
        supabase.from('inquiry_notes').select('*, admins(name)').eq('inquiry_id', id).order('created_at', { ascending: false }),
        supabase.from('reply_templates').select('*').order('usage_count', { ascending: false }),
        supabase.from('admins').select('*').eq('auth_id', user.id).maybeSingle(),
      ])

      if (inqRes.data) setInquiry(inqRes.data as unknown as Inquiry)
      if (msgsRes.data) setMessages(msgsRes.data as unknown as Message[])
      if (adminsRes.data) setAdmins(adminsRes.data as Admin[])
      if (slaRes.data) {
        const inqData = inqRes.data as unknown as Inquiry
        if (inqData) {
          const rule = slaRes.data.find(r => r.category === inqData.category)
          if (rule) setSlaRule(rule as SlaRule)
        }
      }
      if (notesRes.data) setNotes(notesRes.data as unknown as InquiryNote[])
      if (templatesRes.data) setTemplates(templatesRes.data as unknown as ReplyTemplate[])
      if (myAdminRes.data) setCurrentAdmin(myAdminRes.data as Admin)

      // Mark admin unread as 0
      await supabase.from('inquiries').update({ unread_count_admin: 0 }).eq('id', id)

      setLoading(false)
    }

    load()

    // Realtime
    const channel = supabase
      .channel(`admin-chat-${id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `inquiry_id=eq.${id}`,
      }, async (payload) => {
        const newMsg = payload.new as Message
        const { data: full } = await supabase
          .from('messages')
          .select('*, message_attachments(*)')
          .eq('id', newMsg.id)
          .single()
        if (full) {
          setMessages(prev => prev.find(m => m.id === full.id) ? prev : [...prev, full as unknown as Message])
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'inquiries',
        filter: `id=eq.${id}`,
      }, (payload) => {
        setInquiry(prev => prev ? { ...prev, ...payload.new } : null)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [id])

  useEffect(() => { scrollToBottom() }, [messages, scrollToBottom])

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`
    }
  }, [content])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 10000)
  }

  async function sendMessage() {
    if (!content.trim() && files.length === 0) return
    if (sending || !currentAdmin) return
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
          sender_type: 'admin',
          content: msgContent,
          is_internal: isInternal,
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

      if (!isInternal) {
        const updates: Partial<Inquiry> = {
          last_message_at: new Date().toISOString(),
          unread_count_branch: (inquiry?.unread_count_branch ?? 0) + 1,
        }
        if (inquiry?.status === 'pending') {
          (updates as Record<string, unknown>).status = 'in_progress'
          ;(updates as Record<string, unknown>).first_response_at = new Date().toISOString()
        }
        await supabase.from('inquiries').update(updates).eq('id', id)
      }

      setContent('')
      setFiles([])
      setShowAttach(false)
      setIsInternal(false)
    } catch (err) {
      console.error('전송 에러 상세:', JSON.stringify(err, null, 2))
      const errMsg = err instanceof Error ? err.message
        : typeof err === 'object' && err !== null && 'message' in err
        ? (err as { message: string }).message
        : '전송에 실패했습니다.'
      showToast(errMsg)
    } finally {
      setSending(false)
    }
  }

  async function updateStatus(status: InquiryStatus) {
    const supabase = createClient()
    const updates: Record<string, unknown> = { status }
    if (status === 'resolved') updates.resolved_at = new Date().toISOString()
    if (status === 'closed') updates.closed_at = new Date().toISOString()
    await supabase.from('inquiries').update(updates).eq('id', id)
    setInquiry(prev => prev ? { ...prev, status } : null)

    // System message
    const supabase2 = createClient()
    await supabase2.from('messages').insert({
      inquiry_id: id,
      sender_type: 'system',
      content: `상태가 '${STATUS_LABELS[status]}'(으)로 변경되었습니다.`,
      is_internal: false,
    })
  }

  async function assignAdmin(adminId: string) {
    const supabase = createClient()
    await supabase.from('inquiries').update({ assigned_admin_id: adminId || null }).eq('id', id)
    const assigned = admins.find(a => a.id === adminId) || null
    setInquiry(prev => prev ? { ...prev, assigned_admin_id: adminId, admins: assigned || undefined } : null)
  }

  async function addNote(noteContent: string) {
    if (!currentAdmin) return
    const supabase = createClient()
    const { data } = await supabase
      .from('inquiry_notes')
      .insert({ inquiry_id: id, admin_id: currentAdmin.id, content: noteContent })
      .select('*, admins(name)')
      .single()
    if (data) setNotes(prev => [data as unknown as InquiryNote, ...prev])
  }

  async function savePhoneLog() {
    if (!currentAdmin || !phoneMemo.trim()) return
    const supabase = createClient()
    await supabase.from('phone_logs').insert({
      inquiry_id: id,
      admin_id: currentAdmin.id,
      memo: phoneMemo.trim(),
      duration_minutes: phoneDuration ? parseInt(phoneDuration) : null,
    })

    // System message
    await supabase.from('messages').insert({
      inquiry_id: id,
      sender_type: 'system',
      content: `전화 처리 기록됨 — ${phoneDuration ? `${phoneDuration}분` : ''}`,
      is_internal: false,
    })

    setPhoneMemo('')
    setPhoneDuration('')
    setShowPhoneLog(false)
  }

  async function generateAiDraft() {
    if (!inquiry) return
    setGeneratingAi(true)
    try {
      const res = await fetch('/api/board/ai-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: inquiry.category,
          content: messages.filter(m => m.sender_type === 'branch').map(m => m.content).join('\n'),
          branchName: inquiry.branches?.name,
        }),
      })
      if (res.ok) {
        const { draft } = await res.json()
        setContent(draft)
        textareaRef.current?.focus()
      }
    } finally {
      setGeneratingAi(false)
    }
  }

  const slaStatus = inquiry && slaRule ? getSlaStatus(inquiry, slaRule) : 'ok'
  const slaRemaining = inquiry && slaRule ? getSlaRemaining(inquiry, slaRule) : '—'

  return (
    <div className="h-screen flex bg-[#F6FAF6] font-sans overflow-hidden">
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-red-500 text-white px-5 py-2.5 rounded-xl shadow-lg text-sm font-medium whitespace-nowrap">
          {toast}
        </div>
      )}
      {/* 좌측: 채팅 영역 (70%) */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 채팅 헤더 */}
        <header className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 flex-shrink-0">
          <Link href="/board/admin/inquiries" className="text-gray-400 hover:text-gray-600 flex-shrink-0">
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
                <span className="text-xs text-gray-400">· {inquiry?.branches?.name}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {inquiry && <StatusBadge status={inquiry.status} />}
            {inquiry && slaRule && (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${getSlaBadgeColor(slaStatus)}`}>
                {slaStatus === 'ok' ? '🟢' : slaStatus === 'warning' ? '🟡' : '🔴'} {slaRemaining}
              </span>
            )}
          </div>
        </header>

        {/* 메시지 목록 */}
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
                  {inquiry ? ` · 접수 #${inquiry.id.slice(0, 8).toUpperCase()}` : ''}
                </span>
              </div>
              {messages.map(msg => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  branchName={inquiry?.branches?.name}
                  adminName={inquiry?.admins?.name || currentAdmin?.name || '키즈밀'}
                />
              ))}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* 전화 처리 로그 패널 */}
        {showPhoneLog && (
          <div className="bg-blue-50 border-t border-blue-200 px-4 py-3 flex-shrink-0 space-y-2">
            <p className="text-xs font-bold text-blue-700">📞 전화 처리 기록</p>
            <div className="flex gap-2">
              <input
                type="number"
                value={phoneDuration}
                onChange={e => setPhoneDuration(e.target.value)}
                placeholder="통화 시간(분)"
                className="w-28 px-3 py-2 rounded-xl border border-blue-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
              <input
                type="text"
                value={phoneMemo}
                onChange={e => setPhoneMemo(e.target.value)}
                placeholder="처리 내용 메모"
                className="flex-1 px-3 py-2 rounded-xl border border-blue-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
              <button onClick={savePhoneLog}
                disabled={!phoneMemo.trim()}
                className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold disabled:bg-gray-300 transition-colors">
                저장
              </button>
              <button onClick={() => setShowPhoneLog(false)}
                className="text-blue-600 hover:text-blue-800 px-2 py-2 text-sm">취소</button>
            </div>
          </div>
        )}

        {/* 파일 첨부 패널 */}
        {showAttach && (
          <div className="bg-white border-t border-gray-100 px-4 py-3 flex-shrink-0">
            <FileUpload files={files} onFilesChange={setFiles} maxFiles={5} />
          </div>
        )}

        {/* 답변 입력창 */}
        <div className="bg-white border-t border-gray-100 px-4 py-3 flex-shrink-0">
          {/* 상단 액션 버튼 */}
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <ReplyTemplates
              templates={templates}
              category={inquiry?.category}
              onSelect={t => setContent(prev => prev ? `${prev}\n${t}` : t)}
            />
            <button
              type="button"
              onClick={generateAiDraft}
              disabled={generatingAi || !inquiry}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-purple-100 text-purple-700 font-medium hover:bg-purple-200 disabled:bg-gray-100 disabled:text-gray-400 transition-colors"
            >
              {generatingAi ? (
                <span className="w-3 h-3 border-2 border-purple-300 border-t-purple-700 rounded-full animate-spin" />
              ) : <span>✨</span>}
              AI 초안 생성
            </button>
            <button
              type="button"
              onClick={() => setShowPhoneLog(v => !v)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-blue-100 text-blue-700 font-medium hover:bg-blue-200 transition-colors"
            >
              📞 전화 처리
            </button>
            <button
              type="button"
              onClick={() => setIsInternal(v => !v)}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                isInternal ? 'bg-yellow-200 text-yellow-800' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              🔒 내부 메모
            </button>
          </div>

          {isInternal && (
            <div className="mb-2 text-xs bg-yellow-50 text-yellow-700 px-3 py-1.5 rounded-lg border border-yellow-200">
              내부 메모 모드: 고객에게 보이지 않습니다
            </div>
          )}

          <div className="flex gap-2 items-end">
            <button
              type="button"
              onClick={() => setShowAttach(v => !v)}
              className={`flex-shrink-0 pb-2 transition-colors ${showAttach ? 'text-[#2D6A4F]' : 'text-gray-400 hover:text-[#2D6A4F]'}`}
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
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
              }}
              placeholder={isInternal ? '내부 메모를 입력하세요...' : '답변을 입력하세요... (Enter 전송)'}
              className={`flex-1 px-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:border-transparent resize-none ${
                isInternal
                  ? 'border-yellow-300 bg-yellow-50 focus:ring-yellow-300'
                  : 'border-gray-200 focus:ring-[#2D6A4F]'
              }`}
              style={{ minHeight: '42px', maxHeight: '150px' }}
            />
            <button
              onClick={sendMessage}
              disabled={(!content.trim() && files.length === 0) || sending}
              className="bg-[#2D6A4F] hover:bg-[#1B4332] disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors flex-shrink-0"
            >
              {sending ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin block" />
              ) : '전송'}
            </button>
          </div>
        </div>
      </div>

      {/* 우측 패널 (30%) */}
      <div className="w-72 xl:w-80 flex-shrink-0 bg-white border-l border-gray-100 overflow-y-auto hidden lg:block">
        <div className="p-5 space-y-5">
          {/* 문의 정보 */}
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">문의 정보</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">분류</span>
                {inquiry && (
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${CATEGORY_COLORS[inquiry.category]}`}>
                    {CATEGORY_ICONS[inquiry.category]} {CATEGORY_LABELS[inquiry.category]}
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">상태</span>
                {inquiry && <StatusBadge status={inquiry.status} />}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">SLA</span>
                {inquiry && slaRule ? (
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${getSlaBadgeColor(slaStatus)}`}>
                    {slaRemaining}
                  </span>
                ) : <span className="text-xs text-gray-400">—</span>}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">접수일</span>
                <span className="text-xs text-gray-700">
                  {inquiry ? new Date(inquiry.created_at).toLocaleDateString('ko-KR') : '—'}
                </span>
              </div>
            </div>
          </div>

          {/* 상태 변경 */}
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">상태 변경</h3>
            <div className="grid grid-cols-2 gap-1.5">
              {(Object.entries(STATUS_LABELS) as [InquiryStatus, string][]).map(([k, v]) => (
                <button
                  key={k}
                  onClick={() => updateStatus(k)}
                  disabled={inquiry?.status === k}
                  className={`text-xs py-1.5 rounded-lg font-medium transition-colors ${
                    inquiry?.status === k
                      ? `${STATUS_COLORS[k]} cursor-default`
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          {/* 담당자 배정 */}
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">담당자 배정</h3>
            <select
              value={inquiry?.assigned_admin_id || ''}
              onChange={e => assignAdmin(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]"
            >
              <option value="">미배정</option>
              {admins.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>

          {/* 고객사 정보 */}
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">고객사 정보</h3>
            <div className="space-y-2">
              {[
                { label: '브랜드', value: inquiry?.branches?.brands?.name },
                { label: '지점명', value: inquiry?.branches?.name },
                { label: 'KOS ID', value: inquiry?.branches?.kos_id },
                { label: '대표자', value: inquiry?.branches?.owner_name },
                { label: '연락처', value: inquiry?.branches?.phone },
                { label: '이메일', value: inquiry?.branches?.email },
                { label: '식수', value: inquiry?.branches?.meal_count ? `${inquiry.branches.meal_count}명` : undefined },
              ].map(item => (
                <div key={item.label} className="flex justify-between gap-2">
                  <span className="text-xs text-gray-400 flex-shrink-0">{item.label}</span>
                  <span className="text-xs text-[#1C2B1E] font-medium truncate text-right">{item.value || '—'}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 계약 정보 */}
          {(inquiry?.branches?.contract_start || inquiry?.branches?.contract_end) && (
            <div>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">계약</h3>
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-xs text-gray-400">계약 기간</span>
                  <span className="text-xs text-gray-700">
                    {inquiry.branches?.contract_start?.slice(0, 10)} ~{' '}
                    {inquiry.branches?.contract_end?.slice(0, 10)}
                  </span>
                </div>
                {inquiry.branches?.contract_end && (() => {
                  const daysLeft = Math.ceil(
                    (new Date(inquiry.branches!.contract_end!).getTime() - Date.now()) / 86400000
                  )
                  return (
                    <div className={`text-xs font-semibold px-2 py-1 rounded-lg ${
                      daysLeft < 14 ? 'bg-red-100 text-red-700'
                      : daysLeft < 30 ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-green-100 text-green-700'
                    }`}>
                      D-{daysLeft}
                    </div>
                  )
                })()}
              </div>
            </div>
          )}

          {/* 내부 메모 */}
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">내부 메모</h3>
            {currentAdmin && (
              <InternalNote notes={notes} onAdd={addNote} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
