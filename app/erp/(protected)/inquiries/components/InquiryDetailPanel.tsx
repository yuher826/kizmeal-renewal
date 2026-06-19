'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import type {
  Inquiry, Message, MessageAttachment, Admin, SlaRule,
  InquiryNote, ReplyTemplate, InquiryStatus, PhoneLog,
} from '@/lib/types'
import {
  CATEGORY_COLORS, CATEGORY_ICONS, CATEGORY_LABELS,
  STATUS_COLORS, STATUS_LABELS,
} from '@/lib/types'
import { getSlaStatus, getSlaRemaining, getSlaBadgeColor } from '@/lib/sla'
import StatusBadge from '@/components/board/StatusBadge'
import ReplyTemplates from '@/components/board/ReplyTemplates'
import InternalNote from '@/components/board/InternalNote'
import FileUpload from '@/components/board/FileUpload'

// ── 이메일 스레드 유틸 ──────────────────────────────────────────
const STORAGE_BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/kizmeal-files`
const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'heic']

// 첨부가 이미지인지 판별
function isImageAttachment(att: MessageAttachment): boolean {
  if (att.file_type?.toLowerCase().startsWith('image/')) return true
  const ext = att.file_name.split('.').pop()?.toLowerCase() || ''
  return IMAGE_EXTS.includes(ext)
}

// 파일 용량 표기
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

// 같은 날짜인지 비교
function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate()
}

// 날짜 구분선 라벨 (오늘 / 2026년 6월 3일)
function formatDateDivider(iso: string): string {
  const d = new Date(iso)
  if (isSameDay(d, new Date())) return '오늘'
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
}

// 메시지 시간 (오늘: 오후 2:13 / 다른 날: 2026.06.03 오후 2:13)
function formatMsgTime(iso: string): string {
  const d = new Date(iso)
  const time = d.toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit', hour12: true })
  if (isSameDay(d, new Date())) return time
  const date = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
  return `${date} ${time}`
}

// 아바타 이니셜 (이름 첫 글자)
function avatarInitial(name?: string): string {
  const t = (name || '').trim()
  return t ? t[0] : '?'
}

// updated_at이 created_at보다 2초 이상 늦으면 수정된 메시지로 간주
function isEdited(msg: Message): boolean {
  if (!msg.updated_at) return false
  return new Date(msg.updated_at).getTime() - new Date(msg.created_at).getTime() > 2000
}

// ── 첨부파일 블록 ───────────────────────────────────────────────
function AttachmentBlock({ attachments }: { attachments: MessageAttachment[] }) {
  if (!attachments?.length) return null
  return (
    <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
      {attachments.map(att => {
        const url = `${STORAGE_BASE}/${att.storage_path}`
        // 이미지 — 썸네일 미리보기, 클릭 시 새 탭으로 열기
        if (isImageAttachment(att)) {
          return (
            <a key={att.id} href={url} target="_blank" rel="noopener noreferrer" className="block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={att.file_name}
                loading="lazy"
                className="max-w-[240px] max-h-[240px] w-auto rounded-lg border border-gray-200 object-cover hover:opacity-90 transition-opacity"
              />
            </a>
          )
        }
        // 일반 파일 — 📎 파일명 (용량) [다운로드]
        return (
          <a
            key={att.id}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            download={att.file_name}
            className="flex items-center gap-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-700 transition-colors"
          >
            <span>📎</span>
            <span className="flex-1 truncate">{att.file_name}</span>
            <span className="text-gray-400 flex-shrink-0">({formatFileSize(att.file_size)})</span>
            <span className="text-[#2D6A4F] font-semibold flex-shrink-0">다운로드</span>
          </a>
        )
      })}
    </div>
  )
}

// ── 인라인 편집 textarea ─────────────────────────────────────────
function EditTextarea({
  value,
  onChange,
  onSave,
  onCancel,
}: {
  value: string
  onChange: (v: string) => void
  onSave: () => void
  onCancel: () => void
}) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = 'auto'
      ref.current.style.height = `${ref.current.scrollHeight}px`
      ref.current.focus()
      // 커서를 끝으로 이동
      ref.current.setSelectionRange(value.length, value.length)
    }
  // value.length 의존 제거 — 초기화 한 번만 실행
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleInput(e: React.FormEvent<HTMLTextAreaElement>) {
    const el = e.currentTarget
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Ctrl+Enter 또는 Cmd+Enter → 저장
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      if (value.trim()) onSave()
    }
    // Esc → 취소
    if (e.key === 'Escape') {
      e.preventDefault()
      onCancel()
    }
    // 일반 Enter → 줄바꿈 (기본 동작 유지)
  }

  return (
    <div className="mt-2">
      <textarea
        ref={ref}
        value={value}
        onChange={e => onChange(e.target.value)}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        className="w-full px-3 py-2 rounded-lg border border-blue-300 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none leading-relaxed"
        style={{ minHeight: '60px' }}
      />
      <div className="flex gap-2 mt-1.5">
        <button
          onClick={onSave}
          disabled={!value.trim()}
          className="text-xs px-3 py-1.5 rounded-lg bg-[#2D6A4F] text-white font-semibold disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          저장
        </button>
        <button
          onClick={onCancel}
          className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
        >
          취소
        </button>
        <span className="text-[11px] text-gray-400 self-center">Ctrl+Enter 저장 · Esc 취소</span>
      </div>
    </div>
  )
}

// ── 이메일 스레드 메시지 카드 (4종) ─────────────────────────────
interface ThreadMessageProps {
  message: Message
  branchName?: string
  adminName?: string
  // 수정/삭제 권한 및 상태
  canEditDelete?: boolean
  isEditing?: boolean
  editContent?: string
  isDeleting?: boolean
  onEditStart?: () => void
  onEditChange?: (v: string) => void
  onEditSave?: () => void
  onEditCancel?: () => void
  onDeleteStart?: () => void
  onDeleteConfirm?: () => void
  onDeleteCancel?: () => void
}

function ThreadMessage({
  message,
  branchName,
  adminName,
  canEditDelete = false,
  isEditing = false,
  editContent = '',
  isDeleting = false,
  onEditStart,
  onEditChange,
  onEditSave,
  onEditCancel,
  onDeleteStart,
  onDeleteConfirm,
  onDeleteCancel,
}: ThreadMessageProps) {
  const { sender_type, content, created_at, is_internal, message_attachments } = message
  const time = formatMsgTime(created_at)
  const attachments = message_attachments || []
  const edited = isEdited(message)

  // [4] 시스템 메시지 — 카드 없이 중앙 텍스트
  if (sender_type === 'system') {
    return (
      <div className="flex items-center gap-3 my-4">
        <div className="flex-1 h-px bg-gray-100" />
        <span className="text-xs text-gray-400 text-center whitespace-pre-wrap flex-shrink-0">{content}</span>
        <div className="flex-1 h-px bg-gray-100" />
      </div>
    )
  }

  // 삭제 확인 패널 — admin/internal 메시지에만 표시
  if (isDeleting) {
    const bgBase = is_internal ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-200'
    return (
      <div className={`${bgBase} border rounded-lg p-4 mb-3 bg-red-50 border-red-200`}>
        <p className="text-sm font-semibold text-red-700 mb-3">이 답변을 삭제하시겠습니까?</p>
        <div className="flex gap-2">
          <button
            onClick={onDeleteConfirm}
            className="text-xs px-4 py-1.5 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 transition-colors"
          >
            삭제 확인
          </button>
          <button
            onClick={onDeleteCancel}
            className="text-xs px-4 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
          >
            취소
          </button>
        </div>
      </div>
    )
  }

  // [3] 내부 메모 — is_internal = true
  if (is_internal) {
    const name = adminName || '관리자'
    return (
      <div className="relative group bg-amber-50 border border-amber-200 rounded-lg p-4 mb-3">
        {/* 수정/삭제 버튼 (hover 시 표시) */}
        {canEditDelete && !isEditing && (
          <div className="absolute top-2 right-2 hidden group-hover:flex gap-1 z-10">
            <button
              onClick={onEditStart}
              title="수정"
              className="w-6 h-6 flex items-center justify-center rounded hover:bg-amber-200 text-amber-600 transition-colors text-xs"
            >
              ✏️
            </button>
            <button
              onClick={onDeleteStart}
              title="삭제"
              className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-100 text-red-500 transition-colors text-xs"
            >
              🗑️
            </button>
          </div>
        )}
        <div className="flex items-center gap-2 mb-2">
          <span className="w-7 h-7 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-bold flex-shrink-0">🔒</span>
          <span className="text-sm font-semibold text-amber-900">{name}</span>
          <span className="text-xs text-amber-600">내부메모</span>
          <span className="ml-auto text-xs text-amber-500 flex-shrink-0">
            {time}
            {edited && !isEditing && <span className="ml-1 text-gray-400">(수정됨)</span>}
          </span>
        </div>
        <div className="border-t border-amber-200 pt-2">
          {isEditing ? (
            <EditTextarea
              value={editContent}
              onChange={v => onEditChange?.(v)}
              onSave={() => onEditSave?.()}
              onCancel={() => onEditCancel?.()}
            />
          ) : (
            <>
              <p className="text-sm text-amber-900 whitespace-pre-wrap leading-relaxed">{content}</p>
              <p className="text-[11px] text-amber-500 mt-2">고객사에게 보이지 않습니다.</p>
            </>
          )}
        </div>
        {!isEditing && <AttachmentBlock attachments={attachments} />}
      </div>
    )
  }

  // [2] 관리자 답변 — sender_type = 'admin', is_internal = false
  if (sender_type === 'admin') {
    const name = adminName || '키즈밀'
    return (
      <div className="relative group bg-white border border-gray-200 border-l-[3px] border-l-green-600 rounded-lg p-4 mb-3">
        {/* 수정/삭제 버튼 (hover 시 표시) */}
        {canEditDelete && !isEditing && (
          <div className="absolute top-2 right-2 hidden group-hover:flex gap-1 z-10">
            <button
              onClick={onEditStart}
              title="수정"
              className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 text-gray-500 transition-colors text-xs"
            >
              ✏️
            </button>
            <button
              onClick={onDeleteStart}
              title="삭제"
              className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-100 text-red-500 transition-colors text-xs"
            >
              🗑️
            </button>
          </div>
        )}
        <div className="flex items-center gap-2 mb-2">
          <span className="w-7 h-7 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-xs font-bold flex-shrink-0">{avatarInitial(name)}</span>
          <span className="text-sm font-semibold text-[#1C2B1E]">{name}</span>
          <span className="text-xs text-gray-400">영양팀</span>
          <span className="ml-auto text-xs text-gray-400 flex-shrink-0">
            {time}
            {edited && !isEditing && <span className="ml-1 text-gray-400">(수정됨)</span>}
          </span>
        </div>
        <div className="border-t border-gray-100 pt-2">
          {isEditing ? (
            <EditTextarea
              value={editContent}
              onChange={v => onEditChange?.(v)}
              onSave={() => onEditSave?.()}
              onCancel={() => onEditCancel?.()}
            />
          ) : (
            <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{content}</p>
          )}
        </div>
        {!isEditing && <AttachmentBlock attachments={attachments} />}
      </div>
    )
  }

  // [1] 원(고객사) 메시지 — sender_type = 'branch' / 'branch_member'
  const name = branchName || '지점'
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 mb-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold flex-shrink-0">{avatarInitial(name)}</span>
        <span className="text-sm font-semibold text-[#1C2B1E]">{name}</span>
        <span className="text-xs text-gray-400">원 담당자</span>
        <span className="ml-auto text-xs text-gray-400 flex-shrink-0">{time}</span>
      </div>
      <div className="border-t border-gray-100 pt-2">
        <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{content}</p>
      </div>
      <AttachmentBlock attachments={attachments} />
    </div>
  )
}

interface Props {
  /** 현재 선택된 문의 ID (없으면 빈 안내 화면) */
  inquiryId: string | null
}

export default function InquiryDetailPanel({ inquiryId }: Props) {
  const id = inquiryId

  const [inquiry, setInquiry] = useState<Inquiry | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [admins, setAdmins] = useState<Admin[]>([])
  const [slaRule, setSlaRule] = useState<SlaRule | undefined>()
  const [notes, setNotes] = useState<InquiryNote[]>([])
  const [phoneLogs, setPhoneLogs] = useState<PhoneLog[]>([])
  const [templates, setTemplates] = useState<ReplyTemplate[]>([])
  const [currentAdmin, setCurrentAdmin] = useState<Admin | null>(null)
  const [loading, setLoading] = useState(true)
  const [branchComplaints, setBranchComplaints] = useState(0)

  const [content, setContent] = useState('')
  const [isInternal, setIsInternal] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [showAttach, setShowAttach] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')

  const [generatingAi, setGeneratingAi] = useState(false)
  const [showPhoneLog, setShowPhoneLog] = useState(false)
  const [phoneMemo, setPhoneMemo] = useState('')
  const [phoneDuration, setPhoneDuration] = useState('')

  // ── 수정/삭제 상태 ────────────────────────────────────────────
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  // 수정/삭제 권한 계산 — super_admin은 전체, 그 외는 본인 메시지만
  function canEditDeleteMessage(msg: Message): boolean {
    if (!currentAdmin) return false
    if (msg.sender_type !== 'admin') return false
    if (currentAdmin.role === 'super_admin') return true
    return msg.sender_id === currentAdmin.auth_id
  }

  // ── 수정 핸들러 ───────────────────────────────────────────────
  function handleEditStart(msg: Message) {
    setEditingId(msg.id)
    setEditContent(msg.content)
    setDeletingId(null)
  }

  function handleEditCancel() {
    setEditingId(null)
    setEditContent('')
  }

  async function handleEditSave(msgId: string) {
    const trimmed = editContent.trim()
    if (!trimmed) return
    const supabase = createClient()
    const { error } = await supabase
      .from('messages')
      .update({ content: trimmed })
      .eq('id', msgId)
    if (!error) {
      const now = new Date().toISOString()
      setMessages(prev => prev.map(m =>
        m.id === msgId ? { ...m, content: trimmed, updated_at: now } : m
      ))
      setEditingId(null)
      setEditContent('')
    }
  }

  // ── 삭제 핸들러 ───────────────────────────────────────────────
  function handleDeleteStart(msgId: string) {
    setDeletingId(msgId)
    setEditingId(null)
    setEditContent('')
  }

  function handleDeleteCancel() {
    setDeletingId(null)
  }

  async function handleDeleteConfirm(msgId: string) {
    // 낙관적 UI — 즉시 화면에서 제거
    setMessages(prev => prev.filter(m => m.id !== msgId))
    setDeletingId(null)
    const supabase = createClient()
    await supabase.from('messages').delete().eq('id', msgId)
  }

  // ── 문의 로드 + Realtime 구독 ──────────────────────────────────
  useEffect(() => {
    if (!id) {
      // 선택 해제 시 상태 초기화
      setInquiry(null)
      setMessages([])
      setLoading(false)
      return
    }

    // 문의 전환 시 이전 내용 즉시 비우고 로딩 표시
    setInquiry(null)
    setMessages([])
    setNotes([])
    setPhoneLogs([])
    setBranchComplaints(0)
    setContent('')
    setFiles([])
    setShowAttach(false)
    setIsInternal(false)
    setShowPhoneLog(false)
    setEditingId(null)
    setEditContent('')
    setDeletingId(null)
    setLoading(true)

    // 문의 전환 시 패널 스크롤 최상단으로 이동
    panelRef.current?.scrollTo({ top: 0 })

    const supabase = createClient()

    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const [inqRes, msgsRes, adminsRes, slaRes, notesRes, phoneLogsRes, templatesRes, myAdminRes] = await Promise.all([
        supabase.from('inquiries').select('*, branches(*, brands(*)), admins(*)').eq('id', id).single(),
        supabase.from('messages').select('*, message_attachments(*)').eq('inquiry_id', id).order('created_at', { ascending: true }),
        supabase.from('admins').select('*').eq('is_active', true),
        supabase.from('sla_rules').select('*'),
        supabase.from('inquiry_notes').select('*, admins(name)').eq('inquiry_id', id).order('created_at', { ascending: false }),
        supabase.from('phone_logs').select('*, admins(name)').eq('inquiry_id', id).order('created_at', { ascending: false }),
        supabase.from('reply_templates').select('*').order('usage_count', { ascending: false }),
        supabase.from('admins').select('*').eq('auth_id', user.id).maybeSingle(),
      ])

      if (inqRes.data) setInquiry(inqRes.data as unknown as Inquiry)
      if (msgsRes.data) setMessages(msgsRes.data as unknown as Message[])

      // 이 원의 컴플레인 누적 이력
      const inqBranchId = (inqRes.data as unknown as Inquiry)?.branch_id
      if (inqBranchId) {
        const { count } = await supabase
          .from('inquiries')
          .select('*', { count: 'exact', head: true })
          .eq('branch_id', inqBranchId)
          .eq('category', 'COMPLAINT')
        setBranchComplaints(count || 0)
      }
      if (adminsRes.data) setAdmins(adminsRes.data as Admin[])
      if (slaRes.data) {
        const inqData = inqRes.data as unknown as Inquiry
        if (inqData) {
          const rule = slaRes.data.find(r => r.category === inqData.category)
          if (rule) setSlaRule(rule as SlaRule)
          else setSlaRule(undefined)
        }
      }
      if (notesRes.data) setNotes(notesRes.data as unknown as InquiryNote[])
      if (phoneLogsRes.data) setPhoneLogs(phoneLogsRes.data as unknown as PhoneLog[])
      if (templatesRes.data) setTemplates(templatesRes.data as unknown as ReplyTemplate[])
      if (myAdminRes.data) setCurrentAdmin(myAdminRes.data as Admin)

      // 관리자 미읽음 카운트 0으로 리셋
      await supabase.from('inquiries').update({ unread_count_admin: 0 }).eq('id', id)

      setLoading(false)
    }

    load()

    // Realtime — 메시지/문의 변경 구독
    const channel = supabase
      .channel(`erp-chat-${id}`)
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
        event: 'UPDATE', schema: 'public', table: 'messages',
        filter: `inquiry_id=eq.${id}`,
      }, (payload) => {
        const updated = payload.new as Message
        // content와 updated_at만 갱신 (첨부파일은 수정 불가)
        setMessages(prev => prev.map(m =>
          m.id === updated.id
            ? { ...m, content: updated.content, updated_at: updated.updated_at }
            : m
        ))
      })
      .on('postgres_changes', {
        event: 'DELETE', schema: 'public', table: 'messages',
        filter: `inquiry_id=eq.${id}`,
      }, (payload) => {
        const deletedId = (payload.old as { id: string }).id
        // 낙관적 삭제 후 Realtime 이벤트가 다시 오더라도 중복 제거 방지 (filter는 멱등)
        setMessages(prev => prev.filter(m => m.id !== deletedId))
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

  async function sendMessage() {
    if (!id) return
    if (!content.trim() && files.length === 0) return
    if (sending || !currentAdmin) return
    setSending(true)
    setSendError('')

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

      // 첨부파일 INSERT 완료 후 메시지 전체 재조회 → 즉시 UI에 반영 (Realtime 지연 방지)
      const { data: fullMsg } = await supabase
        .from('messages')
        .select('*, message_attachments(*)')
        .eq('id', msg.id)
        .single()
      if (fullMsg) {
        setMessages(prev =>
          prev.find(m => m.id === (fullMsg as unknown as Message).id)
            ? prev
            : [...prev, fullMsg as unknown as Message]
        )
      }

      setContent('')
      setFiles([])
      setShowAttach(false)
      setIsInternal(false)
    } catch (err) {
      const errMsg = err instanceof Error ? err.message
        : typeof err === 'object' && err !== null && 'message' in err
        ? (err as { message: string }).message
        : '전송에 실패했습니다. 다시 시도해주세요.'
      // 입력 내용은 유지하고 입력창 위에 에러 표시
      setSendError(errMsg)
    } finally {
      setSending(false)
    }
  }

  async function updateStatus(status: InquiryStatus) {
    if (!id) return
    const supabase = createClient()
    const updates: Record<string, unknown> = { status }
    if (status === 'resolved') updates.resolved_at = new Date().toISOString()
    if (status === 'closed') updates.closed_at = new Date().toISOString()
    await supabase.from('inquiries').update(updates).eq('id', id)
    setInquiry(prev => prev ? { ...prev, status } : null)

    // 시스템 메시지 기록
    await supabase.from('messages').insert({
      inquiry_id: id,
      sender_type: 'system',
      content: `상태가 '${STATUS_LABELS[status]}'(으)로 변경되었습니다.`,
      is_internal: false,
    })
  }

  async function assignAdmin(adminId: string) {
    if (!id) return
    const supabase = createClient()
    await supabase.from('inquiries').update({ assigned_admin_id: adminId || null }).eq('id', id)
    const assigned = admins.find(a => a.id === adminId) || null
    setInquiry(prev => prev ? { ...prev, assigned_admin_id: adminId, admins: assigned || undefined } : null)
  }

  async function addNote(noteContent: string) {
    if (!id || !currentAdmin) return
    const supabase = createClient()
    const [noteRes, { data: { user } }] = await Promise.all([
      supabase
        .from('inquiry_notes')
        .insert({ inquiry_id: id, admin_id: currentAdmin.id, content: noteContent })
        .select('*, admins(name)')
        .single(),
      supabase.auth.getUser(),
    ])
    if (noteRes.data) setNotes(prev => [noteRes.data as unknown as InquiryNote, ...prev])
    if (user) {
      await supabase.from('messages').insert({
        inquiry_id: id,
        sender_id: user.id,
        sender_type: 'admin',
        content: noteContent,
        is_internal: true,
      })
    }
  }

  async function savePhoneLog() {
    if (!id || !currentAdmin || !phoneMemo.trim()) return
    const supabase = createClient()
    const { data: logData } = await supabase.from('phone_logs').insert({
      inquiry_id: id,
      admin_id: currentAdmin.id,
      memo: phoneMemo.trim(),
      duration_minutes: phoneDuration ? parseInt(phoneDuration) : null,
    }).select('*, admins(name)').single()

    if (logData) setPhoneLogs(prev => [logData as unknown as PhoneLog, ...prev])

    const chatContent = phoneDuration
      ? `📞 전화 처리 — ${phoneDuration}분 통화 | ${phoneMemo.trim()}`
      : `📞 전화 처리 | ${phoneMemo.trim()}`

    await supabase.from('messages').insert({
      inquiry_id: id,
      sender_type: 'system',
      content: chatContent,
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

  // 수정 중인 메시지가 있으면 하단 입력창 비활성화
  const isAnyEditing = editingId !== null

  // ── 빈 안내 화면 (선택된 문의 없음) ────────────────────────────
  if (!id) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center px-6 bg-[#F6FAF6]">
        <div className="w-16 h-16 rounded-2xl bg-[#E8F5E9] flex items-center justify-center text-3xl mb-4">
          💬
        </div>
        <p className="text-sm font-medium text-gray-500">왼쪽 목록에서 문의를 선택해주세요</p>
        <p className="text-xs text-gray-400 mt-1">선택한 문의의 대화와 처리 도구가 여기에 표시됩니다.</p>
      </div>
    )
  }

  return (
    <div className="h-full flex bg-[#F6FAF6] font-sans overflow-hidden">
      {/* 좌측: 채팅 영역 */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 채팅 헤더 (고정) — 지점명, 접수번호, SLA */}
        <header className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 flex-shrink-0">
          <div className="flex-1 min-w-0">
            {loading ? (
              <div className="h-4 bg-gray-100 rounded w-48 animate-pulse" />
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs">{CATEGORY_ICONS[inquiry?.category || 'OTHER']}</span>
                <span className="text-sm font-bold text-[#1C2B1E] truncate">{inquiry?.title}</span>
                <span className="text-xs text-gray-400">· {inquiry?.branches?.name}</span>
                {inquiry && (
                  <span className="text-xs text-gray-300">· 접수 #{inquiry.id.slice(0, 8).toUpperCase()}</span>
                )}
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

        {/* 메시지 영역 (독립 스크롤) — 이메일 스레드 */}
        <div className="flex-1 overflow-y-auto px-4 py-4 bg-[#F6FAF6]">
          {loading ? (
            // 로딩 스켈레톤 카드 2개
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 rounded-full bg-gray-100 animate-pulse" />
                    <div className="h-3 w-24 bg-gray-100 rounded animate-pulse" />
                  </div>
                  <div className="h-3 w-full bg-gray-50 rounded animate-pulse mb-1.5" />
                  <div className="h-3 w-2/3 bg-gray-50 rounded animate-pulse" />
                </div>
              ))}
            </div>
          ) : messages.length === 0 ? (
            // 빈 상태
            <div className="h-full flex flex-col items-center justify-center text-center">
              <div className="text-4xl mb-3">📭</div>
              <p className="text-sm text-gray-400">아직 대화 내용이 없습니다</p>
            </div>
          ) : (
            <>
              {messages.map((msg, idx) => {
                const prev = messages[idx - 1]
                // 날짜가 바뀔 때마다 구분선 표시
                const showDivider = !prev
                  || !isSameDay(new Date(prev.created_at), new Date(msg.created_at))
                return (
                  <div key={msg.id}>
                    {showDivider && (
                      <div className="flex items-center gap-3 my-4">
                        <div className="flex-1 h-px bg-gray-200" />
                        <span className="text-xs text-gray-400 font-medium flex-shrink-0">
                          {formatDateDivider(msg.created_at)}
                        </span>
                        <div className="flex-1 h-px bg-gray-200" />
                      </div>
                    )}
                    <ThreadMessage
                      message={msg}
                      branchName={inquiry?.branches?.name}
                      adminName={inquiry?.admins?.name || currentAdmin?.name || '키즈밀'}
                      canEditDelete={canEditDeleteMessage(msg)}
                      isEditing={editingId === msg.id}
                      editContent={editingId === msg.id ? editContent : ''}
                      isDeleting={deletingId === msg.id}
                      onEditStart={() => handleEditStart(msg)}
                      onEditChange={v => setEditContent(v)}
                      onEditSave={() => handleEditSave(msg.id)}
                      onEditCancel={handleEditCancel}
                      onDeleteStart={() => handleDeleteStart(msg.id)}
                      onDeleteConfirm={() => handleDeleteConfirm(msg.id)}
                      onDeleteCancel={handleDeleteCancel}
                    />
                  </div>
                )
              })}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* 전화 처리 로그 패널 */}
        {showPhoneLog && (
          <div className="bg-blue-50 border-t border-blue-200 px-4 py-3 flex-shrink-0 space-y-2">
            <p className="text-xs font-bold text-blue-700">📞 전화 처리 기록</p>
            <div className="flex gap-2">
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="0"
                  value={phoneDuration}
                  onChange={e => setPhoneDuration(e.target.value.replace(/\D/g, ''))}
                  placeholder="통화 시간 (분)"
                  className="w-28 px-3 py-2 rounded-xl border border-blue-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
                <span className="text-sm text-blue-700 font-medium flex-shrink-0">분</span>
              </div>
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

        {/* 수정 중 안내 배너 */}
        {isAnyEditing && (
          <div className="bg-blue-50 border-t border-blue-200 px-4 py-2 flex-shrink-0 flex items-center gap-2">
            <span className="text-xs text-blue-700 font-semibold">✏️ 메시지 수정 중</span>
            <span className="text-xs text-blue-500">수정을 완료하거나 취소한 후 새 답변을 입력할 수 있습니다.</span>
            <button
              onClick={handleEditCancel}
              className="ml-auto text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              수정 취소
            </button>
          </div>
        )}

        {/* 답변 입력창 (고정) */}
        <div className={`bg-white border-t border-gray-100 px-4 py-3 flex-shrink-0 ${isAnyEditing ? 'opacity-50 pointer-events-none' : ''}`}>
          {/* 전송 실패 에러 — 입력창 위 표시 (입력 내용은 유지) */}
          {sendError && (
            <div className="mb-2 flex items-center gap-2 text-xs bg-red-50 text-red-700 px-3 py-2 rounded-lg border border-red-200">
              <span>⚠️</span>
              <span className="flex-1">{sendError}</span>
              <button type="button" onClick={() => setSendError('')} className="text-red-400 hover:text-red-600 font-bold">✕</button>
            </div>
          )}

          {/* 상단 액션 버튼 */}
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <div className={sending ? 'opacity-50 pointer-events-none' : ''}>
              <ReplyTemplates
                templates={templates}
                category={inquiry?.category}
                onSelect={t => setContent(prev => prev ? `${prev}\n${t}` : t)}
              />
            </div>
            <button
              type="button"
              onClick={generateAiDraft}
              disabled={generatingAi || !inquiry || sending}
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
              disabled={sending}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-blue-100 text-blue-700 font-medium hover:bg-blue-200 disabled:bg-gray-100 disabled:text-gray-400 transition-colors"
            >
              📞 전화 처리
            </button>
            <button
              type="button"
              onClick={() => setIsInternal(v => !v)}
              disabled={sending}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50 ${
                isInternal ? 'bg-amber-200 text-amber-800' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              🔒 내부 메모
            </button>
          </div>

          {isInternal && (
            <div className="mb-2 text-xs bg-amber-50 text-amber-700 px-3 py-1.5 rounded-lg border border-amber-200">
              내부 메모 모드: 고객에게 보이지 않습니다
            </div>
          )}

          <div className="flex gap-2 items-end">
            <button
              type="button"
              onClick={() => setShowAttach(v => !v)}
              disabled={sending}
              className={`flex-shrink-0 pb-2 transition-colors disabled:opacity-40 ${showAttach ? 'text-[#2D6A4F]' : 'text-gray-400 hover:text-[#2D6A4F]'}`}
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
              placeholder={isInternal ? '내부 메모를 입력하세요...' : '답변을 입력하세요... (Enter 전송 / Shift+Enter 줄바꿈)'}
              className={`flex-1 px-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:border-transparent resize-none ${
                isInternal
                  ? 'border-amber-300 bg-amber-50 focus:ring-amber-300'
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
              ) : isInternal ? '메모 저장' : '전송'}
            </button>
          </div>
        </div>
      </div>

      {/* 우측: 정보/처리 패널 */}
      <div ref={panelRef} className="w-72 flex-shrink-0 bg-white border-l border-gray-100 overflow-y-auto hidden lg:block">
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

          {/* 이 원의 컴플레인 이력 */}
          <div className={`rounded-xl px-3.5 py-3 border ${
            branchComplaints >= 3 ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-100'
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500">😤 이 원의 컴플레인 이력</span>
              <span className={`text-sm font-bold ${branchComplaints >= 3 ? 'text-red-600' : 'text-gray-700'}`}>
                {branchComplaints}건
              </span>
            </div>
            {branchComplaints >= 3 && (
              <p className="text-[11px] text-red-600 mt-1.5">⚠️ 컴플레인이 누적된 원입니다. 주의가 필요합니다.</p>
            )}
          </div>

          {/* 전화 처리 이력 */}
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">📞 전화 처리 이력</h3>
            {phoneLogs.length === 0 ? (
              <p className="text-xs text-gray-400">전화 처리 기록 없음</p>
            ) : (
              <div className="space-y-2">
                {phoneLogs.map(log => (
                  <div key={log.id} className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-2">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs text-blue-700 font-semibold">
                        {log.duration_minutes ? `${log.duration_minutes}분 통화` : '통화'}
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(log.created_at).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    {log.memo && <p className="text-xs text-gray-700 whitespace-pre-wrap">{log.memo}</p>}
                  </div>
                ))}
              </div>
            )}
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
