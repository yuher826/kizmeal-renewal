import type { Message, MessageAttachment } from '@/lib/types'

interface Props {
  message: Message
  branchName?: string
  adminName?: string
}

function formatTime(isoString: string) {
  return new Date(isoString).toLocaleString('ko-KR', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

function FileIcon({ type }: { type: string }) {
  if (type.includes('pdf')) return <span>📄</span>
  if (type.includes('image')) return <span>🖼️</span>
  if (type.includes('spreadsheet') || type.includes('excel')) return <span>📊</span>
  if (type.includes('word') || type.includes('document')) return <span>📝</span>
  return <span>📎</span>
}

const STORAGE_BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/kizmeal-files`

const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'heic']

function isImageAttachment(att: MessageAttachment) {
  if (att.file_type?.toLowerCase().startsWith('image/')) return true
  const ext = att.file_name.split('.').pop()?.toLowerCase() || ''
  return IMAGE_EXTS.includes(ext)
}

function AttachmentList({ attachments, variant }: { attachments: MessageAttachment[]; variant: 'dark' | 'light' }) {
  if (!attachments?.length) return null

  // 말풍선 배경에 따라 가독성 확보 (dark = 초록 말풍선, light = 흰 말풍선)
  const fileBox = variant === 'dark'
    ? 'bg-white/20 hover:bg-white/30 text-white'
    : 'bg-[#F0F4F0] hover:bg-[#E8F5E9] text-gray-700 border border-gray-100'
  const subColor = variant === 'dark' ? 'text-white/70' : 'text-gray-400'

  return (
    <div className="mt-2 space-y-1.5">
      {attachments.map((att) => {
        const url = `${STORAGE_BASE}/${att.storage_path}`

        // 이미지 — 썸네일로 표시, 클릭 시 새 탭에서 열기
        if (isImageAttachment(att)) {
          return (
            <a key={att.id} href={url} target="_blank" rel="noopener noreferrer" className="block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={att.file_name}
                loading="lazy"
                className="max-w-[220px] max-h-[220px] w-auto rounded-xl border border-black/5 object-cover hover:opacity-90 transition-opacity"
              />
            </a>
          )
        }

        // 일반 파일 — 아이콘 + 파일명 + 크기, 클릭 시 다운로드/새 탭
        return (
          <a
            key={att.id}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            download={att.file_name}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs transition-colors cursor-pointer ${fileBox}`}
          >
            <FileIcon type={att.file_type} />
            <span className="flex-1 truncate">{att.file_name}</span>
            <span className={subColor}>{formatFileSize(att.file_size)}</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={`flex-shrink-0 ${subColor}`}>
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
            </svg>
          </a>
        )
      })}
    </div>
  )
}

export default function MessageBubble({ message, branchName, adminName }: Props) {
  const { sender_type, content, created_at, is_internal, message_attachments } = message

  // System message — centered
  if (sender_type === 'system') {
    return (
      <div className="flex justify-center my-3">
        <span className="text-xs text-gray-400 italic bg-gray-100 rounded-full px-4 py-1.5">
          {content}
        </span>
      </div>
    )
  }

  // Internal admin note — yellow, full width
  if (is_internal) {
    return (
      <div className="flex justify-center my-2">
        <div className="max-w-[85%] bg-yellow-50 border border-yellow-200 rounded-2xl px-4 py-3 w-full">
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="text-xs">🔒</span>
            <span className="text-xs font-semibold text-yellow-700">내부 메모 — 고객에게 보이지 않음</span>
          </div>
          <p className="text-sm text-yellow-900 whitespace-pre-wrap">{content}</p>
          <div className="mt-1.5 text-right">
            <span className="text-xs text-yellow-600">{adminName || '관리자'} · {formatTime(created_at)}</span>
          </div>
        </div>
      </div>
    )
  }

  // Branch message — right aligned, green
  if (sender_type === 'branch') {
    return (
      <div className="flex justify-end mb-3">
        <div className="max-w-[75%]">
          <div className="bg-[#2D6A4F] text-white rounded-2xl rounded-tr-sm px-4 py-3 shadow-sm">
            <p className="text-sm whitespace-pre-wrap leading-relaxed">{content}</p>
            <AttachmentList attachments={message_attachments || []} variant="dark" />
          </div>
          <div className="text-right mt-1">
            <span className="text-xs text-gray-400">
              {branchName || '지점'} · {formatTime(created_at)}
            </span>
          </div>
        </div>
      </div>
    )
  }

  // Admin message — left aligned, white
  return (
    <div className="flex justify-start mb-3 gap-2">
      <div className="w-8 h-8 rounded-full bg-[#E8F5E9] flex items-center justify-center text-xs font-bold text-[#2D6A4F] flex-shrink-0 mt-1">
        K
      </div>
      <div className="max-w-[75%]">
        <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm border border-gray-100">
          <p className="text-sm whitespace-pre-wrap leading-relaxed text-gray-800">{content}</p>
          <AttachmentList attachments={message_attachments || []} variant="light" />
        </div>
        <div className="mt-1">
          <span className="text-xs text-gray-400">
            {adminName || '키즈밀'} · {formatTime(created_at)}
          </span>
        </div>
      </div>
    </div>
  )
}
