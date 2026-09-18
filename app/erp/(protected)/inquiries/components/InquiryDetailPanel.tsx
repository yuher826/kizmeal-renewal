'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import type {
  Inquiry, Message, MessageAttachment, Admin, SlaRule,
  InquiryNote, ReplyTemplate, InquiryStatus, PhoneLog,
} from '@/lib/types'
import {
  CATEGORY_COLORS, CATEGORY_ICONS, CATEGORY_LABELS,
  STATUS_COLORS, STATUS_LABELS, CUSTOMER_STATUS_LABELS, formatCategory,
} from '@/lib/types'
import { getSlaStatus, getSlaRemaining, getSlaBadgeColor, getSlaIcon } from '@/lib/sla'
import StatusBadge from '@/components/board/StatusBadge'
import ReplyTemplates from '@/components/board/ReplyTemplates'
import InternalNote from '@/components/board/InternalNote'
import FileUpload from '@/components/board/FileUpload'
import { useErpUser } from '@/components/erp/ErpUserProvider'
import { canHandleCs } from '@/lib/roles'
import { toKoreanErrorMessage } from '@/lib/supabase-error'
import { logChannelStatus } from '@/lib/realtime-debug'
import { subscribeAfterAuth } from '@/lib/realtime-auth'

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

// 초안 변경 이벤트 디스패치 (page.tsx의 ✏️ 아이콘 동기화용)
function dispatchDraftEvent(inquiryId: string, hasDraft: boolean) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('cs-draft-change', {
      detail: { inquiryId, hasDraft },
    }))
  }
}

// 현재 시각 HH:MM 반환
function nowHHMM(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// ── 라이트박스 오버레이 ──────────────────────────────────────────
interface LightboxImage {
  url: string
  name: string
}

function LightboxOverlay({
  images,
  index,
  onClose,
  onNavigate,
}: {
  images: LightboxImage[]
  index: number
  onClose: () => void
  onNavigate: (delta: -1 | 1) => void
}) {
  const [imgStatus, setImgStatus] = useState<'loading' | 'loaded' | 'error'>('loading')
  const current = images[index]
  const hasMultiple = images.length > 1

  // 이미지 인덱스 변경 시 로딩 초기화
  useEffect(() => {
    setImgStatus('loading')
  }, [index])

  // 배경 스크롤 잠금
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  // 키보드 이벤트 (Esc 닫기, ← → 탐색)
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') onNavigate(-1)
      if (e.key === 'ArrowRight') onNavigate(1)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose, onNavigate])

  async function handleDownload() {
    try {
      const res = await fetch(current.url)
      const blob = await res.blob()
      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objectUrl
      a.download = current.name
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(objectUrl)
    } catch {
      // CORS 실패 시 새 탭으로 열기
      window.open(current.url, '_blank')
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      {/* 우상단 닫기/다운로드 버튼 */}
      <div
        className="absolute top-4 right-4 flex items-center gap-2 z-10"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={handleDownload}
          title="다운로드"
          className="w-9 h-9 flex items-center justify-center bg-white/10 hover:bg-white/25 rounded-full text-white text-sm transition-colors"
        >
          📥
        </button>
        <button
          onClick={onClose}
          title="닫기"
          className="w-9 h-9 flex items-center justify-center bg-white/10 hover:bg-white/25 rounded-full text-white text-lg font-bold transition-colors"
        >
          ✕
        </button>
      </div>

      {/* 이미지 영역 */}
      <div
        className="relative flex items-center justify-center"
        onClick={e => e.stopPropagation()}
      >
        {/* 로딩 스피너 */}
        {imgStatus === 'loading' && (
          <div className="w-20 h-20 flex items-center justify-center">
            <span className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin block" />
          </div>
        )}
        {/* 에러 */}
        {imgStatus === 'error' && (
          <div className="text-white text-center px-8 py-6 bg-white/10 rounded-xl">
            이미지를 불러올 수 없습니다
          </div>
        )}
        {/* 실제 이미지 */}
        {imgStatus !== 'error' && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={current.url}
            alt={current.name}
            onLoad={() => setImgStatus('loaded')}
            onError={() => setImgStatus('error')}
            className={`max-w-[90vw] max-h-[90vh] object-contain rounded-lg transition-opacity duration-200 ${
              imgStatus === 'loaded' ? 'opacity-100' : 'opacity-0 absolute'
            }`}
          />
        )}
      </div>

      {/* 좌우 화살표 */}
      {hasMultiple && (
        <>
          <button
            onClick={e => { e.stopPropagation(); onNavigate(-1) }}
            disabled={index === 0}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-white/10 hover:bg-white/25 rounded-full text-white text-xl disabled:opacity-30 transition-colors"
          >
            ←
          </button>
          <button
            onClick={e => { e.stopPropagation(); onNavigate(1) }}
            disabled={index === images.length - 1}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-white/10 hover:bg-white/25 rounded-full text-white text-xl disabled:opacity-30 transition-colors"
          >
            →
          </button>
        </>
      )}

      {/* 현재 위치 표시 (여러 장일 때) */}
      {hasMultiple && (
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 text-white text-xs bg-black/50 px-3 py-1 rounded-full">
          {index + 1} / {images.length}
        </div>
      )}
    </div>
  )
}

// ── 첨부파일 블록 ───────────────────────────────────────────────
function AttachmentBlock({
  attachments,
  onImageClick,
}: {
  attachments: MessageAttachment[]
  onImageClick?: (images: LightboxImage[], idx: number) => void
}) {
  if (!attachments?.length) return null

  // 이미지 첨부만 추출 (라이트박스 인덱스 매핑용)
  const imageAtts = attachments.filter(isImageAttachment)

  return (
    <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
      {attachments.map(att => {
        const url = `${STORAGE_BASE}/${att.storage_path}`

        if (isImageAttachment(att)) {
          const imgIdx = imageAtts.findIndex(ia => ia.id === att.id)
          const images: LightboxImage[] = imageAtts.map(ia => ({
            url: `${STORAGE_BASE}/${ia.storage_path}`,
            name: ia.file_name,
          }))

          if (onImageClick) {
            // 라이트박스 클릭
            return (
              <button
                key={att.id}
                type="button"
                onClick={() => onImageClick(images, imgIdx)}
                className="block text-left"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={att.file_name}
                  loading="lazy"
                  className="max-w-[240px] max-h-[240px] w-auto rounded-lg border border-gray-200 object-cover hover:opacity-80 transition-opacity cursor-zoom-in"
                />
              </button>
            )
          }

          // 폴백: 새 탭으로 열기
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
  error,
  saving = false,
}: {
  value: string
  onChange: (v: string) => void
  onSave: () => void
  onCancel: () => void
  error?: string
  saving?: boolean
}) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = 'auto'
      ref.current.style.height = `${ref.current.scrollHeight}px`
      ref.current.focus()
      ref.current.setSelectionRange(value.length, value.length)
    }
  // 초기화 시 한 번만 실행
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
        disabled={saving}
        className="w-full px-3 py-2 rounded-lg border border-blue-300 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none leading-relaxed disabled:bg-gray-50 disabled:text-gray-400"
        style={{ minHeight: '60px' }}
      />
      {/* 실패해도 입력값은 그대로 둔다 — 사용자가 쓴 내용이 날아가면 안 됨 */}
      {error && (
        <div className="mt-1.5 flex items-center gap-1.5 text-xs text-red-600">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}
      <div className="flex gap-2 mt-1.5">
        <button
          onClick={onSave}
          disabled={!value.trim() || saving}
          className="text-xs px-3 py-1.5 rounded-lg bg-[#2D6A4F] text-white font-semibold disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? '저장 중...' : '저장'}
        </button>
        <button
          onClick={onCancel}
          disabled={saving}
          className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-50 transition-colors"
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
  // 원 담당자가 이미 읽어서 수정/삭제 버튼이 사라진 것인지 알려주는 표시용(권팀장 요청 7번)
  readByBranch?: boolean
  isEditing?: boolean
  editContent?: string
  editError?: string
  editSaving?: boolean
  isDeleting?: boolean
  deleteError?: string
  deleting?: boolean
  onEditStart?: () => void
  onEditChange?: (v: string) => void
  onEditSave?: () => void
  onEditCancel?: () => void
  onDeleteStart?: () => void
  onDeleteConfirm?: () => void
  onDeleteCancel?: () => void
  // 라이트박스
  onImageClick?: (images: LightboxImage[], idx: number) => void
}

function ThreadMessage({
  message,
  branchName,
  adminName,
  canEditDelete = false,
  readByBranch = false,
  isEditing = false,
  editContent = '',
  editError,
  editSaving = false,
  isDeleting = false,
  deleteError,
  deleting = false,
  onEditStart,
  onEditChange,
  onEditSave,
  onEditCancel,
  onDeleteStart,
  onDeleteConfirm,
  onDeleteCancel,
  onImageClick,
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

  // 삭제 확인 패널 — admin/internal 메시지에만 표시.
  // ★ 실패해도 이 패널을 닫지 않는다(= 메시지를 화면에서 지우지 않는다).
  //   DB delete 성공을 확인하기 전까지는 "삭제 확인" 상태 그대로 유지해,
  //   화면과 DB가 어긋나는 상태(화면엔 없는데 DB엔 남음)를 만들지 않는다.
  if (isDeleting) {
    return (
      <div className="border border-red-200 rounded-lg p-4 mb-3 bg-red-50">
        <p className="text-sm font-semibold text-red-700 mb-3">이 답변을 삭제하시겠습니까?</p>
        {deleteError && (
          <div className="mb-3 flex items-center gap-1.5 text-xs text-red-700 bg-red-100 rounded-lg px-3 py-2">
            <span>⚠️</span>
            <span>{deleteError}</span>
          </div>
        )}
        <div className="flex gap-2">
          <button
            onClick={onDeleteConfirm}
            disabled={deleting}
            className="text-xs px-4 py-1.5 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 disabled:bg-red-300 disabled:cursor-not-allowed transition-colors"
          >
            {deleting ? '삭제 중...' : '삭제 확인'}
          </button>
          <button
            onClick={onDeleteCancel}
            disabled={deleting}
            className="text-xs px-4 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-50 transition-colors"
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
          <div className="absolute top-2 right-2 flex gap-1 z-10">
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
              error={editError}
              saving={editSaving}
            />
          ) : (
            <>
              <p className="text-sm text-amber-900 whitespace-pre-wrap leading-relaxed">{content}</p>
              <p className="text-[11px] text-amber-500 mt-2">고객사에게 보이지 않습니다.</p>
            </>
          )}
        </div>
        {!isEditing && <AttachmentBlock attachments={attachments} onImageClick={onImageClick} />}
      </div>
    )
  }

  // [2] 관리자 답변 — sender_type = 'admin', is_internal = false
  // 포털(MessageBubble.tsx)과 좌우가 반대다: 포털은 지점이 보는 화면이라
  // branch가 오른쪽, 여기는 키즈밀이 보는 화면이라 admin이 오른쪽이다.
  if (sender_type === 'admin') {
    const name = adminName || '키즈밀'
    return (
      <div className="flex justify-end mb-3">
        <div className="relative group bg-white border border-gray-200 border-l-[3px] border-l-green-600 rounded-lg p-4 max-w-[75%]">
          {/* 수정/삭제 버튼 (hover 시 표시) */}
          {canEditDelete && !isEditing && (
            <div className="absolute top-2 right-2 flex gap-1 z-10">
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
              {readByBranch && !isEditing && (
                <span
                  className="inline-flex items-center gap-0.5 ml-1.5 text-[10px] font-medium text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded-full align-middle"
                  title="원 담당자가 읽어 더 이상 수정·삭제할 수 없습니다"
                >
                  ✓ 읽음
                </span>
              )}
            </span>
          </div>
          <div className="border-t border-gray-100 pt-2">
            {isEditing ? (
              <EditTextarea
                value={editContent}
                onChange={v => onEditChange?.(v)}
                onSave={() => onEditSave?.()}
                onCancel={() => onEditCancel?.()}
                error={editError}
                saving={editSaving}
              />
            ) : (
              <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{content}</p>
            )}
          </div>
          {!isEditing && <AttachmentBlock attachments={attachments} onImageClick={onImageClick} />}
        </div>
      </div>
    )
  }

  // [1] 원(고객사) 메시지 — sender_type = 'branch' / 'branch_member'
  const name = branchName || '지점'
  return (
    <div className="flex justify-start mb-3">
      <div className="bg-white border border-gray-200 rounded-lg p-4 max-w-[75%]">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold flex-shrink-0">{avatarInitial(name)}</span>
          <span className="text-sm font-semibold text-[#1C2B1E]">{name}</span>
          <span className="text-xs text-gray-400">원 담당자</span>
          <span className="ml-auto text-xs text-gray-400 flex-shrink-0">{time}</span>
        </div>
        <div className="border-t border-gray-100 pt-2">
          <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{content}</p>
        </div>
        <AttachmentBlock attachments={attachments} onImageClick={onImageClick} />
      </div>
    </div>
  )
}

interface Props {
  /** 현재 선택된 문의 ID (없으면 빈 안내 화면) */
  inquiryId: string | null
  /** 담당자·상태 등 목록에 보이는 값이 바뀌었을 때 호출 (2026-09-17).
   *  왼쪽 목록의 realtime 구독은 "다른 사람 화면"을 위한 것이라, 내 화면에서
   *  낸 변경은 그 구독과 무관하게 여기서 직접 재조회를 트리거해 확실히 반영한다. */
  onInquiryChanged?: () => void
}

export default function InquiryDetailPanel({ inquiryId, onInquiryChanged }: Props) {
  const id = inquiryId
  // realtime UPDATE 핸들러에서 "담당자가 실제로 바뀌었는지" 판정할 때 쓰는 ref.
  // setInquiry의 업데이터 함수 안에서 판정하면 안 된다 — React 18은 업데이터를
  // 나중에(때로는 두 번) 실행할 수 있어, 그 결과를 바로 다음 줄에서 읽으면
  // 그 시점엔 아직 false일 수 있다(2026-09-17 발견, 1f3cdce에서 이 버그로
  // refreshAssignedAdmin()이 안 불리는 문제가 있었다). ref는 즉시 갱신되므로
  // 업데이터 밖에서 비교해야 타이밍 문제가 없다.
  const assignedIdRef = useRef<string | null>(null)

  const [inquiry, setInquiry] = useState<Inquiry | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [admins, setAdmins] = useState<Admin[]>([])
  // auth_id → name. 담당자 드롭다운용 admins 목록(is_active=true 필터)과는
  // 별도 쿼리다 — 그 목록을 재사용하면 퇴사·비활성 관리자가 쓴 옛
  // 메시지의 이름을 잃는다. 이름 표시 전용이라 필터를 걸지 않는다.
  const [senderNameMap, setSenderNameMap] = useState<Record<string, string>>({})
  const [slaRule, setSlaRule] = useState<SlaRule | undefined>()
  const [notes, setNotes] = useState<InquiryNote[]>([])
  const [phoneLogs, setPhoneLogs] = useState<PhoneLog[]>([])
  const [templates, setTemplates] = useState<ReplyTemplate[]>([])
  const currentAdmin = useErpUser()
  // 화면 가드용 판정 — DB(RLS)와 같은 기준(super_admin 또는 can_handle_cs
  // 플래그)을 재사용한다. 여기서 새 기준을 만들면 서버 판정과 갈라진다.
  const canWriteCs = canHandleCs(currentAdmin)
  const [loading, setLoading] = useState(true)
  // 원 로고 로드 실패 시 폴백 (문의 전환 시 초기화)
  const [detailLogoError, setDetailLogoError] = useState(false)
  const [branchComplaints, setBranchComplaints] = useState(0)

  const [content, setContent] = useState('')
  const [isInternal, setIsInternal] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [showAttach, setShowAttach] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  // 상태변경·담당자배정·내부메모·전화처리 공용 에러 배너 (우측 패널에 표시)
  const [actionError, setActionError] = useState('')

  const [generatingAi, setGeneratingAi] = useState(false)
  const [showPhoneLog, setShowPhoneLog] = useState(false)
  const [phoneMemo, setPhoneMemo] = useState('')
  const [phoneDuration, setPhoneDuration] = useState('')

  // ── 이어받기(2026-09-17) ──────────────────────────────────────
  const [showTakeoverConfirm, setShowTakeoverConfirm] = useState(false)
  const [takeoverError, setTakeoverError] = useState('')
  const [takingOver, setTakingOver] = useState(false)

  // ── 수정/삭제 상태 ────────────────────────────────────────────
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [editError, setEditError] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState('')
  const [deleting, setDeleting] = useState(false)

  // ── 초안 자동저장 상태 ────────────────────────────────────────
  const [draftStatus, setDraftStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [draftSavedAt, setDraftSavedAt] = useState('')

  // ── 전송 후 해결됨 제안 배너 ──────────────────────────────────
  const [showResolvedBanner, setShowResolvedBanner] = useState(false)

  // ── 이미지 라이트박스 ─────────────────────────────────────────
  const [lightbox, setLightbox] = useState<{ images: LightboxImage[]; index: number } | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // 초안 저장 디바운스 타이머
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // id 전환 직후 초안 저장 효과 한 번 스킵 (로드된 초안을 즉시 덮어쓰지 않기 위해)
  const skipNextDraftSave = useRef(false)
  // 해결됨 배너 자동 닫기 타이머
  const resolvedBannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  // ── 라이트박스 핸들러 ─────────────────────────────────────────
  const closeLightbox = useCallback(() => setLightbox(null), [])

  const navigateLightbox = useCallback((delta: -1 | 1) => {
    setLightbox(prev => {
      if (!prev) return null
      const newIdx = Math.max(0, Math.min(prev.images.length - 1, prev.index + delta))
      return { ...prev, index: newIdx }
    })
  }, [])

  const openLightbox = useCallback((images: LightboxImage[], idx: number) => {
    setLightbox({ images, index: idx })
  }, [])

  // 수정/삭제 권한 계산 — super_admin은 전체, 그 외는 본인 메시지만.
  // + 권팀장 요청 7번: 원 담당자에게 실제로 보이는 메시지(is_internal=false)는
  //   상대가 이미 대화방을 열어봤으면(branch_last_read_at 이후) 수정·삭제 금지.
  //   내부메모(is_internal=true)는 원 담당자에게 애초에 안 보이므로 이 제한 예외.
  function canEditDeleteMessage(msg: Message): boolean {
    if (!currentAdmin) return false
    if (msg.sender_type !== 'admin') return false
    if (currentAdmin.role !== 'super_admin' && msg.sender_id !== currentAdmin.auth_id) return false
    if (msg.is_internal) return true
    const lastRead = inquiry?.branch_last_read_at
    if (!lastRead) return true // 원 담당자가 이 대화방을 아직 한 번도 안 연 상태
    return new Date(msg.created_at).getTime() > new Date(lastRead).getTime()
  }

  // 발신자 이름 해석 — inquiry.admins.name(담당자)을 쓰면 안 된다. 그건
  // "이 문의에 배정된 사람"이지 "이 메시지를 쓴 사람"이 아니다. 이름을
  // 못 찾았을 때 담당자 이름을 대신 보여주는 것은 틀린 정보이고, 고객사에까지
  // 나가는 텍스트라 잘못된 이름보다 회사명이 낫다.
  function resolveSenderName(senderId: string | undefined): string {
    if (senderId && senderNameMap[senderId]) return senderNameMap[senderId]
    if (senderId && senderId === currentAdmin.auth_id) return currentAdmin.name
    return '키즈밀'
  }

  // 원 담당자에게 이미 읽힌 메시지인지(수정·삭제 버튼이 사라진 이유를 알려주는 용도)
  function isReadByBranch(msg: Message): boolean {
    if (msg.sender_type !== 'admin' || msg.is_internal) return false
    const lastRead = inquiry?.branch_last_read_at
    if (!lastRead) return false
    return new Date(msg.created_at).getTime() <= new Date(lastRead).getTime()
  }

  // ── 수정 핸들러 ───────────────────────────────────────────────
  function handleEditStart(msg: Message) {
    setEditingId(msg.id)
    setEditContent(msg.content)
    setEditError('')
    setDeletingId(null)
    setDeleteError('')
  }

  function handleEditCancel() {
    setEditingId(null)
    setEditContent('')
    setEditError('')
  }

  async function handleEditSave(msgId: string) {
    const trimmed = editContent.trim()
    if (!trimmed || editSaving) return
    setEditError('')
    setEditSaving(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('messages')
      .update({ content: trimmed })
      .eq('id', msgId)
    setEditSaving(false)
    if (error) {
      // ★ 실패해도 편집 상태를 유지한다 — 사용자가 쓴 내용이 날아가면
      //   안 된다. 42501은 "권한 없음"과 "상대가 이미 읽어 RESTRICTIVE
      //   정책(messages_block_edit_after_read)에 막힘" 둘 다일 수 있는데
      //   에러 코드만으로는 어느 쪽인지 구분이 안 되므로, 둘 다 사실일
      //   수 있는 문구로 안내한다.
      setEditError(toKoreanErrorMessage(
        error,
        '수정에 실패했습니다. 다시 시도해주세요.',
        '수정할 수 없습니다 — 권한이 없거나, 고객사가 이미 확인한 답변입니다.'
      ))
      return
    }
    const now = new Date().toISOString()
    setMessages(prev => prev.map(m =>
      m.id === msgId ? { ...m, content: trimmed, updated_at: now } : m
    ))
    setEditingId(null)
    setEditContent('')
  }

  // ── 삭제 핸들러 ───────────────────────────────────────────────
  function handleDeleteStart(msgId: string) {
    setDeletingId(msgId)
    setDeleteError('')
    setEditingId(null)
    setEditContent('')
    setEditError('')
  }

  function handleDeleteCancel() {
    setDeletingId(null)
    setDeleteError('')
  }

  async function handleDeleteConfirm(msgId: string) {
    if (deleting) return
    setDeleteError('')
    setDeleting(true)
    const supabase = createClient()
    const { error } = await supabase.from('messages').delete().eq('id', msgId)
    setDeleting(false)
    if (error) {
      // ★ 낙관적 업데이트를 하지 않는다 — DB delete 성공을 확인하기
      //   전까지 화면에서 메시지를 지우지 않는다. 먼저 지우고 실패하면
      //   "화면엔 없는데 DB엔 남아있는" 상태가 되는데, 이게 가장 위험한
      //   어긋남이다. 삭제확인 패널은 열어둔 채로 에러만 보여준다.
      setDeleteError(toKoreanErrorMessage(
        error,
        '삭제에 실패했습니다. 다시 시도해주세요.',
        '삭제할 수 없습니다 — 권한이 없거나, 고객사가 이미 확인한 답변입니다.'
      ))
      return
    }
    setMessages(prev => prev.filter(m => m.id !== msgId))
    setDeletingId(null)
  }

  useEffect(() => {
    assignedIdRef.current = inquiry?.assigned_admin_id ?? null
  }, [inquiry?.assigned_admin_id])

  // ── 문의 로드 + Realtime 구독 ──────────────────────────────────
  useEffect(() => {
    if (!id) {
      setInquiry(null)
      setMessages([])
      setLoading(false)
      return
    }

    // 문의 전환 시 이전 내용 초기화
    setInquiry(null)
    setMessages([])
    setNotes([])
    setPhoneLogs([])
    setBranchComplaints(0)
    setFiles([])
    setShowAttach(false)
    setShowPhoneLog(false)
    setShowTakeoverConfirm(false)
    setTakeoverError('')
    setEditingId(null)
    setEditContent('')
    setDeletingId(null)
    setDraftStatus('idle')
    setDraftSavedAt('')
    setShowResolvedBanner(false)
    setLoading(true)
    setDetailLogoError(false) // 문의 전환 시 로고 폴백 상태 초기화

    // 초안 로드 (id 전환 시 localStorage에서 바로 복원)
    skipNextDraftSave.current = true
    const internalDraft = localStorage.getItem(`cs_draft_internal_${id}`)
    const regularDraft = localStorage.getItem(`cs_draft_${id}`)
    if (internalDraft) {
      setContent(internalDraft)
      setIsInternal(true)
    } else if (regularDraft) {
      setContent(regularDraft)
      setIsInternal(false)
    } else {
      setContent('')
      setIsInternal(false)
    }

    panelRef.current?.scrollTo({ top: 0 })

    const supabase = createClient()

    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const [inqRes, msgsRes, adminsRes, slaRes, notesRes, phoneLogsRes, templatesRes, namesRes] = await Promise.all([
        supabase.from('inquiries').select('*, branches(*, brands(*)), admins(*)').eq('id', id).single(),
        supabase.from('messages').select('*, message_attachments(*)').eq('inquiry_id', id).order('created_at', { ascending: true }),
        supabase.from('admins').select('*').eq('is_active', true),
        supabase.from('sla_rules').select('*'),
        supabase.from('inquiry_notes').select('*, admins(name)').eq('inquiry_id', id).order('created_at', { ascending: false }),
        supabase.from('phone_logs').select('*, admins(name)').eq('inquiry_id', id).order('created_at', { ascending: false }),
        supabase.from('reply_templates').select('*').order('usage_count', { ascending: false }),
        supabase.from('admins').select('auth_id, name'),
      ])

      if (inqRes.data) {
        setInquiry(inqRes.data as unknown as Inquiry)
      }
      if (msgsRes.data) setMessages(msgsRes.data as unknown as Message[])

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
          setSlaRule(rule ? rule as SlaRule : undefined)
        }
      }
      if (notesRes.data) setNotes(notesRes.data as unknown as InquiryNote[])
      if (phoneLogsRes.data) setPhoneLogs(phoneLogsRes.data as unknown as PhoneLog[])
      if (templatesRes.data) setTemplates(templatesRes.data as unknown as ReplyTemplate[])
      // setLoading(false)보다 반드시 먼저 채운다 — 뒤에서 채우면 첫 렌더에서
      // 관리자 답변 전부가 '키즈밀'로 잠깐 보였다가 이름으로 바뀌는 깜빡임이 난다.
      if (namesRes.data) {
        const map: Record<string, string> = {}
        for (const a of namesRes.data as { auth_id: string | null; name: string }[]) {
          if (a.auth_id) map[a.auth_id] = a.name
        }
        setSenderNameMap(map)
      }

      await supabase.from('inquiries').update({ unread_count_admin: 0 }).eq('id', id)
      // CS 알림 목록(cs_notifications)도 같은 시점에 읽음 처리 — 문의를 열어봤다는
      // 사실 자체가 확인의 증거이므로 위 unread_count_admin 리셋과 짝을 맞춘다.
      fetch('/api/cs/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inquiryId: id }),
      }).catch(() => { /* 읽음 처리 실패해도 화면 진입엔 영향 없음 */ })
      setLoading(false)
    }

    load()

    const unsubscribe = subscribeAfterAuth(supabase, () => supabase
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
          // 소리·팝업은 ErpHeader 폴링 한 곳에서만 낸다(2026-09-18) — 여기서는 더 이상 알리지 않는다
        })
        .on('postgres_changes', {
          event: 'UPDATE', schema: 'public', table: 'messages',
          filter: `inquiry_id=eq.${id}`,
        }, (payload) => {
          const updated = payload.new as Message
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
          setMessages(prev => prev.filter(m => m.id !== deletedId))
        })
        .on('postgres_changes', {
          event: 'UPDATE', schema: 'public', table: 'inquiries',
          filter: `id=eq.${id}`,
        }, (payload) => {
          // payload.new는 컬럼 값만 담고 있고 admins(join) 정보가 없어, 담당자가
          // 바뀌어도 이름은 옛 값으로 남는다(예: A가 열어둔 화면에서 B가 이어받으면
          // assigned_admin_id는 B인데 admins.name은 여전히 A로 보임).
          // ★assignedIdRef와 비교해 실제로 바뀐 경우에만 이름까지 다시 조회한다.
          //   setInquiry의 업데이터 함수 안에서 판정하지 않는다 — React 18은
          //   업데이터를 나중에 실행할 수 있어 바로 다음 줄에서 읽으면 아직
          //   반영 전(false)일 수 있다. ref는 즉시 갱신되므로 이 문제가 없다.
          const newAssignee = (payload.new as { assigned_admin_id?: string | null }).assigned_admin_id ?? null
          const changed = newAssignee !== assignedIdRef.current
          setInquiry(prev => prev ? { ...prev, ...payload.new } : null)
          if (changed) refreshAssignedAdmin()
        })
        .subscribe(logChannelStatus(`erp-chat-${id}`))
    )

    return unsubscribe
  }, [id])

  // ── 초안 자동저장 (debounce 1초) ─────────────────────────────
  useEffect(() => {
    if (!id) return

    // id 전환 직후 한 번 스킵 (로드된 초안을 즉시 재저장하지 않기 위해)
    if (skipNextDraftSave.current) {
      skipNextDraftSave.current = false
      return
    }

    if (draftTimerRef.current) clearTimeout(draftTimerRef.current)

    if (!content.trim()) {
      // 내용이 없으면 초안 삭제
      localStorage.removeItem(`cs_draft_${id}`)
      localStorage.removeItem(`cs_draft_internal_${id}`)
      setDraftStatus('idle')
      dispatchDraftEvent(id, false)
      return
    }

    setDraftStatus('saving')

    draftTimerRef.current = setTimeout(() => {
      const key = isInternal ? `cs_draft_internal_${id}` : `cs_draft_${id}`
      // 반대 키 삭제 (내부 메모 ↔ 일반 답변 전환 시)
      const oppositeKey = isInternal ? `cs_draft_${id}` : `cs_draft_internal_${id}`
      localStorage.setItem(key, content)
      localStorage.removeItem(oppositeKey)
      setDraftSavedAt(nowHHMM())
      setDraftStatus('saved')
      dispatchDraftEvent(id, true)
    }, 1000)

    return () => {
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current)
    }
  }, [content, isInternal, id])

  // ── 타이머 정리 (컴포넌트 언마운트 시) ───────────────────────
  useEffect(() => {
    return () => {
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current)
      if (resolvedBannerTimerRef.current) clearTimeout(resolvedBannerTimerRef.current)
    }
  }, [])

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

    // 전송 전 상태 캡처 (해결됨 배너 표시 판단용)
    const statusBeforeSend = inquiry?.status

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSending(false); return }

    try {
      const uploaded: { path: string; url: string; name: string; size: number; type: string }[] = []
      for (const file of files) {
        const ext = file.name.split('.').pop()?.toLowerCase() || 'bin'
        const safeFileName = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`
        const storagePath = `${id}/${safeFileName}`
        const { data: up, error: upErr } = await supabase.storage
          .from('kizmeal-files')
          .upload(storagePath, file, { upsert: true })
        // ★ upErr.message를 그대로 보여주지 않는다 — 스토리지 RLS 위반
        //   메시지도 버킷/정책명을 그대로 노출한다.
        if (upErr) throw new Error('파일 업로드에 실패했습니다.', { cause: '__safe__' })
        if (up) {
          const { data: urlData } = supabase.storage.from('kizmeal-files').getPublicUrl(storagePath)
          uploaded.push({ path: storagePath, url: urlData?.publicUrl ?? '', name: file.name, size: file.size, type: file.type })
        }
      }

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

        // 답변 시 담당자 자동 지정(2026-09-17, 전화 처리도 동일 — savePhoneLog() 참고)
        await autoAssignIfEmpty()
        // 목록의 상태·담당자 배지는 realtime 구독(다른 사람 화면용)과 무관하게
        // 내 화면에서 직접 재조회를 트리거해 확실히 반영한다.
        onInquiryChanged?.()
      }

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

      // 전송 성공 — 초안 삭제
      localStorage.removeItem(`cs_draft_${id}`)
      localStorage.removeItem(`cs_draft_internal_${id}`)
      dispatchDraftEvent(id, false)
      setDraftStatus('idle')

      // 관리자 답변이면 지점에 이메일 알림 발송 (실패해도 메시지 전송에 영향 없음)
      if (!isInternal) {
        try {
          await fetch('/api/cs/notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'admin_reply',
              branchName: inquiry?.branches?.name ?? '',
              branchEmail: inquiry?.branches?.email ?? '',
              content: msgContent,
              inquiryId: id,
            }),
          })
        } catch (e) {
          console.error('[CS] 관리자 답변 이메일 알림 실패:', e)
        }
      }

      setContent('')
      setFiles([])
      setShowAttach(false)
      setIsInternal(false)

      // pending/in_progress 상태였으면 해결됨 변경 제안 배너 표시
      if (statusBeforeSend === 'pending' || statusBeforeSend === 'in_progress') {
        setShowResolvedBanner(true)
        if (resolvedBannerTimerRef.current) clearTimeout(resolvedBannerTimerRef.current)
        resolvedBannerTimerRef.current = setTimeout(() => setShowResolvedBanner(false), 5000)
      }
    } catch (err) {
      // ★ Supabase 원본 에러 메시지를 그대로 보여주지 않는다 — RLS 위반 시
      //   Postgres가 `new row violates row-level security policy for table
      //   "messages"`처럼 테이블명을 그대로 뱉어낸다. 위에서 직접 만들어
      //   던진(cause: '__safe__') 메시지만 그대로 쓰고, 나머지는 전부
      //   toKoreanErrorMessage로 한 번 걸러서 보여준다.
      const errMsg = err instanceof Error && err.cause === '__safe__'
        ? err.message
        : toKoreanErrorMessage(err, '전송에 실패했습니다. 다시 시도해주세요.')
      setSendError(errMsg)
    } finally {
      setSending(false)
    }
  }

  async function updateStatus(status: InquiryStatus) {
    if (!id) return
    setActionError('')
    const supabase = createClient()
    const updates: Record<string, unknown> = { status }
    if (status === 'resolved') updates.resolved_at = new Date().toISOString()
    const { error } = await supabase.from('inquiries').update(updates).eq('id', id)
    // 실패 시 낙관적 업데이트를 하지 않는다 — 화면 상태와 DB가 어긋나면
    // "바뀐 것처럼 보이는데 실제로는 안 바뀐" 상태로 남는다.
    if (error) { setActionError(toKoreanErrorMessage(error)); return }
    setInquiry(prev => prev ? { ...prev, status } : null)
    onInquiryChanged?.()

    await supabase.from('messages').insert({
      inquiry_id: id,
      sender_type: 'system',
      // ★is_internal: false — 고객사에게 그대로 보인다. STATUS_LABELS(ERP용, '확인중' 등)를
      //   쓰면 내부 사정이 새어나가므로 반드시 CUSTOMER_STATUS_LABELS를 쓴다.
      content: `상태가 '${CUSTOMER_STATUS_LABELS[status]}'(으)로 변경되었습니다.`,
      is_internal: false,
    })
  }

  async function assignAdmin(adminId: string) {
    if (!id) return
    setActionError('')
    const supabase = createClient()
    const { error } = await supabase.from('inquiries').update({ assigned_admin_id: adminId || null }).eq('id', id)
    if (error) { setActionError(toKoreanErrorMessage(error)); return }
    const assigned = admins.find(a => a.id === adminId) || null
    setInquiry(prev => prev ? { ...prev, assigned_admin_id: adminId, admins: assigned || undefined } : null)
    onInquiryChanged?.()
  }

  /** 다른 사람이 먼저 잡았거나 로컬 admins 목록에 없을 때, DB에 반영된
   *  담당자로 화면을 다시 맞춘다(sendMessage()의 담당자 자동 지정에서 사용). */
  async function refreshAssignedAdmin() {
    if (!id) return
    const supabase = createClient()
    const { data } = await supabase
      .from('inquiries')
      .select('assigned_admin_id, admins(id, name)')
      .eq('id', id)
      .maybeSingle()
    if (!data) return
    const assignedAdmin = Array.isArray(data.admins) ? data.admins[0] : data.admins
    setInquiry(prev => prev ? {
      ...prev,
      assigned_admin_id: data.assigned_admin_id || undefined,
      admins: (assignedAdmin as unknown as Admin) || undefined,
    } : null)
  }

  /** 답변(전화 처리 포함) 시 담당자가 비어 있으면 나를 자동으로 지정한다
   *  (2026-09-17). sendMessage()·savePhoneLog() 양쪽에서 쓴다.
   *  ★화면의 inquiry.assigned_admin_id로 판단하지 않는다★ — 두 사람이 같은
   *  문의를 동시에 열어두면 둘 다 "비어있음"으로 보여 나중 사람이 덮어쓴다.
   *  DB에 조건부 UPDATE로 맡겨(is('assigned_admin_id', null)) 먼저 답변한
   *  사람만 잡히게 한다. */
  async function autoAssignIfEmpty() {
    if (!id || !currentAdmin) return
    const supabase = createClient()
    const { data: assignResult, error: assignErr } = await supabase
      .from('inquiries')
      .update({ assigned_admin_id: currentAdmin.id })
      .eq('id', id)
      .is('assigned_admin_id', null)
      .select('assigned_admin_id')

    // 답변/전화기록은 이미 처리됐으므로 이 실패를 actionError·sendError로 띄우지
    // 않는다 — 기록만.
    if (assignErr) {
      console.error('담당자 자동 지정 실패:', assignErr.message)
      return
    }
    if (assignResult && assignResult.length > 0) {
      // 1행 — 내가 이번에 처음으로 잡았다. assignAdmin()과 같은 모양으로 즉시 반영.
      const assigned = admins.find(a => a.id === currentAdmin.id)
      if (assigned) {
        setInquiry(prev => prev ? { ...prev, assigned_admin_id: currentAdmin.id, admins: assigned } : null)
        return
      }
    }
    // 0행(이미 배정됨) 또는 로컬 admins 목록에 없으면(드묾) DB 값으로 화면을
    // 맞춘다(드롭다운·"담당자" 표시가 실제 배정과 어긋나면 안 된다).
    await refreshAssignedAdmin()
  }

  /** 이어받기 확인 — 서버가 담당자 변경·내부 기록·원 담당자 알림을 한번에 처리한다. */
  async function confirmTakeover() {
    if (!id || !inquiry?.assigned_admin_id) return
    setTakingOver(true)
    setTakeoverError('')
    try {
      const res = await fetch(`/api/cs/inquiries/${id}/takeover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expectedAssigneeId: inquiry.assigned_admin_id }),
      })
      const json = await res.json()
      if (!res.ok) {
        if (res.status === 409) {
          setTakeoverError('그 사이 담당자가 바뀌었습니다. 최신 상태로 맞췄습니다.')
          await refreshAssignedAdmin()
          onInquiryChanged?.()
        } else {
          setTakeoverError(json.error || '이어받기에 실패했습니다')
        }
        return
      }
      const assignee = json.assignee as { id: string; name: string }
      setInquiry(prev => prev ? {
        ...prev,
        assigned_admin_id: assignee.id,
        admins: { id: assignee.id, name: assignee.name } as unknown as Admin,
      } : null)
      setShowTakeoverConfirm(false)
      onInquiryChanged?.()
    } catch {
      setTakeoverError('이어받기에 실패했습니다')
    } finally {
      setTakingOver(false)
    }
  }

  async function addNote(noteContent: string) {
    if (!id || !currentAdmin) return
    setActionError('')
    const supabase = createClient()
    const [noteRes, { data: { user } }] = await Promise.all([
      supabase
        .from('inquiry_notes')
        .insert({ inquiry_id: id, admin_id: currentAdmin.id, content: noteContent })
        .select('*, admins(name)')
        .single(),
      supabase.auth.getUser(),
    ])
    if (noteRes.error) { setActionError(toKoreanErrorMessage(noteRes.error)); return }
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
    setActionError('')
    const supabase = createClient()
    const { data: logData, error } = await supabase.from('phone_logs').insert({
      inquiry_id: id,
      admin_id: currentAdmin.id,
      memo: phoneMemo.trim(),
      duration_minutes: phoneDuration ? parseInt(phoneDuration) : null,
    }).select('*, admins(name)').single()

    if (error) { setActionError(toKoreanErrorMessage(error)); return }

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

    // 전화 처리도 고객사에 보이는 실제 대응(is_internal: false)이다 — 답변과
    // 동일하게 상태 전환·담당자 자동 지정 대상으로 취급한다(2026-09-17).
    if (inquiry?.status === 'pending') {
      const { error: statusErr } = await supabase.from('inquiries').update({
        status: 'in_progress',
        first_response_at: new Date().toISOString(),
      }).eq('id', id)
      // 전화 기록 자체는 이미 저장됐으므로 actionError는 띄우지 않는다 — 기록만.
      // 실패했는데 화면만 in_progress로 바뀌면 DB와 어긋난다.
      if (statusErr) {
        console.error('전화 처리 후 상태 전환 실패:', statusErr.message)
      } else {
        setInquiry(prev => prev ? { ...prev, status: 'in_progress' } : null)
      }
    }
    await autoAssignIfEmpty()
    onInquiryChanged?.()

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
        setContent(draft) // AI 초안도 debounce에 의해 자동저장됨
        textareaRef.current?.focus()
      }
    } finally {
      setGeneratingAi(false)
    }
  }

  // slaRule이 없어도(카테고리에 SLA 기준 미설정) getSlaStatus/getSlaRemaining이
  // 내부적으로 'unknown'/'미설정'을 반환하므로 여기서 따로 분기하지 않는다.
  // inquiry 자체가 아직 로드 전일 때만 '—'로 방어한다.
  const slaStatus = inquiry ? getSlaStatus(inquiry, slaRule) : 'unknown'
  const slaRemaining = inquiry ? getSlaRemaining(inquiry, slaRule) : '—'

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
    <>
      {/* ── 이미지 라이트박스 오버레이 ─────────────────────────── */}
      {lightbox && (
        <LightboxOverlay
          images={lightbox.images}
          index={lightbox.index}
          onClose={closeLightbox}
          onNavigate={navigateLightbox}
        />
      )}

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
              {/* slaRule 유무로 숨기지 않는다 — 규칙 미설정도 '미설정' 회색
                  배지로 명시해야 초록(ok)과 안 헷갈린다 */}
              {inquiry && (
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${getSlaBadgeColor(slaStatus)}`}>
                  {getSlaIcon(slaStatus)} {slaRemaining}
                </span>
              )}
            </div>
          </header>

          {/* 메시지 영역 (독립 스크롤) — 이메일 스레드 */}
          <div className="flex-1 overflow-y-auto px-4 py-4 bg-[#F6FAF6]">
            {loading ? (
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
              <div className="h-full flex flex-col items-center justify-center text-center">
                <div className="text-4xl mb-3">📭</div>
                <p className="text-sm text-gray-400">아직 대화 내용이 없습니다</p>
              </div>
            ) : (
              <>
                {messages.map((msg, idx) => {
                  const prev = messages[idx - 1]
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
                        adminName={resolveSenderName(msg.sender_id)}
                        canEditDelete={canEditDeleteMessage(msg)}
                        readByBranch={isReadByBranch(msg)}
                        isEditing={editingId === msg.id}
                        editContent={editingId === msg.id ? editContent : ''}
                        editError={editingId === msg.id ? editError : ''}
                        editSaving={editingId === msg.id && editSaving}
                        isDeleting={deletingId === msg.id}
                        deleteError={deletingId === msg.id ? deleteError : ''}
                        deleting={deletingId === msg.id && deleting}
                        onEditStart={() => handleEditStart(msg)}
                        onEditChange={v => setEditContent(v)}
                        onEditSave={() => handleEditSave(msg.id)}
                        onEditCancel={handleEditCancel}
                        onDeleteStart={() => handleDeleteStart(msg.id)}
                        onDeleteConfirm={() => handleDeleteConfirm(msg.id)}
                        onDeleteCancel={handleDeleteCancel}
                        onImageClick={openLightbox}
                      />
                    </div>
                  )
                })}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* 전화 처리 로그 패널 — 토글 버튼이 답변 입력창 안에 있어 canWriteCs일
              때만 열리지만, 방어적으로 여기서도 한 번 더 막는다 */}
          {canWriteCs && showPhoneLog && (
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

          {/* 전송 후 해결됨 변경 제안 배너 */}
          {showResolvedBanner && (
            <div className="bg-green-50 border-t border-green-200 px-4 py-2 flex-shrink-0 flex items-center gap-2 flex-wrap">
              <span className="text-xs text-green-700 font-medium">✅ 답변을 전송했습니다. 해결됨으로 변경하시겠습니까?</span>
              <div className="flex gap-1.5 ml-auto">
                <button
                  onClick={() => { setShowResolvedBanner(false); updateStatus('resolved') }}
                  className="text-xs px-3 py-1 rounded-lg bg-green-600 text-white font-semibold hover:bg-green-700 transition-colors"
                >
                  변경
                </button>
                <button
                  onClick={() => setShowResolvedBanner(false)}
                  className="text-xs px-3 py-1 rounded-lg bg-white border border-green-200 text-green-700 hover:bg-green-50 transition-colors"
                >
                  유지
                </button>
              </div>
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

          {/* 답변 입력창 (고정) — CS 쓰기 권한(canWriteCs) 없으면 아예 숨긴다.
              전송·AI초안·전화처리·내부메모 버튼이 전부 여기 한 덩어리에
              있어 통째로 감추는 편이 개별 버튼마다 막는 것보다 확실하다. */}
          {!canWriteCs ? (
            <div className="bg-white border-t border-gray-100 px-4 py-3 flex-shrink-0 flex items-center gap-2 text-sm text-gray-400">
              <span>🔒</span>
              <span>이 문의에 답변할 권한이 없습니다. CS 담당자로 배정된 관리자만 답변할 수 있습니다.</span>
            </div>
          ) : (
          <div className={`bg-white border-t border-gray-100 px-4 py-3 flex-shrink-0 ${isAnyEditing ? 'opacity-50 pointer-events-none' : ''}`}>
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

            {/* 초안 자동저장 상태 표시 (입력창 우하단) */}
            {draftStatus !== 'idle' && (
              <div className="flex justify-end mt-1">
                <span className="text-[11px] text-gray-400">
                  {draftStatus === 'saving' ? '저장 중...' : `임시저장됨 ${draftSavedAt}`}
                </span>
              </div>
            )}
          </div>
          )}
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
                      {CATEGORY_ICONS[inquiry.category]} {formatCategory(inquiry.category, inquiry.subcategory)}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">상태</span>
                  {inquiry && <StatusBadge status={inquiry.status} />}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">SLA</span>
                  {inquiry ? (
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

            {/* 쓰기 액션 공용 에러 배너 — 상태변경·담당자배정·내부메모·전화처리 */}
            {actionError && (
              <div className="flex items-center gap-2 text-xs bg-red-50 text-red-700 px-3 py-2 rounded-lg border border-red-200">
                <span>⚠️</span>
                <span className="flex-1">{actionError}</span>
                <button type="button" onClick={() => setActionError('')} className="text-red-400 hover:text-red-600 font-bold">✕</button>
              </div>
            )}

            {/* 상태 변경 — canWriteCs 없으면 섹션 자체를 숨긴다. 현재 상태는
                위 "문의 정보"에 이미 표시돼 있어 읽기 기능은 그대로 유지된다. */}
            {canWriteCs && (
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
            )}

            {/* 담당자 배정 — 쓰기 권한 없으면 select 대신 현재 담당자만 읽기로 보여준다 */}
            <div>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">담당자 배정</h3>
              {canWriteCs ? (
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
              ) : (
                <p className="text-sm text-gray-700 px-1">{inquiry?.admins?.name || '미배정'}</p>
              )}

              {/* 이어받기 — 미배정·본인 담당·쓰기 권한 없음(director 등)에는 안 보인다 */}
              {canWriteCs && inquiry?.assigned_admin_id && inquiry.assigned_admin_id !== currentAdmin?.id && (
                showTakeoverConfirm ? (
                  <div className="mt-2 border border-amber-200 rounded-lg p-3 bg-amber-50">
                    <p className="text-sm text-amber-900 mb-3">
                      {inquiry.admins?.is_active === false
                        ? '비활성 계정이 담당한 문의입니다. 이어받으시겠습니까?'
                        : `${inquiry.admins?.name || '담당자'}님이 담당 중입니다. 이어받으면 ${inquiry.admins?.name || '담당자'}님께 알림이 갑니다.`}
                    </p>
                    {takeoverError && (
                      <div className="mb-3 flex items-center gap-1.5 text-xs text-red-700 bg-red-100 rounded-lg px-3 py-2">
                        <span>⚠️</span>
                        <span>{takeoverError}</span>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={confirmTakeover}
                        disabled={takingOver}
                        className="text-xs px-4 py-1.5 rounded-lg bg-[#2D6A4F] text-white font-semibold hover:bg-[#1B4332] disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                      >
                        {takingOver ? '처리 중...' : '이어받기'}
                      </button>
                      <button
                        onClick={() => { setShowTakeoverConfirm(false); setTakeoverError('') }}
                        disabled={takingOver}
                        className="text-xs px-4 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-50 transition-colors"
                      >
                        취소
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowTakeoverConfirm(true)}
                    className="mt-2 text-xs text-[#2D6A4F] font-medium hover:underline"
                  >
                    🔄 이어받기
                  </button>
                )
              )}
            </div>

            {/* 고객사 정보 */}
            <div>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">고객사 정보</h3>
              {/* 원 로고 (logo_url 있고 로드 성공 시에만 — NULL/실패면 아래 정보 텍스트만) */}
              {inquiry?.branches?.logo_url && !detailLogoError && (
                <div className="inline-flex items-center bg-[#F5F6F4] border border-gray-200 rounded-lg px-2.5 py-1.5 mb-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={inquiry.branches.logo_url}
                    alt={inquiry.branches.name ? `${inquiry.branches.name} 로고` : '원 로고'}
                    className="w-auto h-auto object-contain max-h-8 max-w-[120px]"
                    onError={() => setDetailLogoError(true)}
                  />
                </div>
              )}
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
                <InternalNote notes={notes} onAdd={addNote} readOnly={!canWriteCs} />
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
