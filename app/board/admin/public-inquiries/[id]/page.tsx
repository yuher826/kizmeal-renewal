'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

const CATEGORY_LABELS: Record<string, string> = {
  service: '서비스 문의',
  price: '가격 문의',
  menu: '메뉴 문의',
  facility: '시설 문의',
  other: '기타',
}

const STATUS_LABELS: Record<string, string> = {
  pending: '접수중',
  in_progress: '검토중',
  resolved: '답변완료',
}

type Inquiry = {
  id: string
  inquiry_number: string
  name: string
  contact: string
  contact_type: string
  category: string
  title: string
  content: string
  status: string
  admin_reply: string | null
  admin_memo: string | null
  replied_at: string | null
  is_notified: boolean
  created_at: string
}

export default function PublicInquiryDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [inquiry, setInquiry] = useState<Inquiry | null>(null)
  const [loading, setLoading] = useState(true)
  const [reply, setReply] = useState('')
  const [memo, setMemo] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    const res = await fetch(`/api/public-inquiry/admin?id=${id}`)
    if (res.ok) {
      const data = await res.json()
      setInquiry(data.data)
      setReply(data.data?.admin_reply || '')
      setMemo(data.data?.admin_memo || '')
    }
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  function showMessage(msg: string) {
    setMessage(msg)
    setTimeout(() => setMessage(''), 3000)
  }

  async function updateStatus(status: string) {
    setSaving(true)
    await fetch('/api/public-inquiry/admin', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    })
    setInquiry(prev => prev ? { ...prev, status } : null)
    setSaving(false)
    showMessage('상태가 변경되었습니다.')
  }

  async function saveMemo() {
    setSaving(true)
    await fetch('/api/public-inquiry/admin', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, admin_memo: memo }),
    })
    setSaving(false)
    showMessage('메모가 저장되었습니다.')
  }

  async function saveReplyAndNotify() {
    if (!reply.trim()) return
    setSaving(true)

    await fetch('/api/public-inquiry/admin', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, admin_reply: reply, admin_memo: memo }),
    })

    const notifyRes = await fetch('/api/public-inquiry/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inquiry_id: id }),
    })
    const notifyData = await notifyRes.json()

    setInquiry(prev =>
      prev ? { ...prev, admin_reply: reply, admin_memo: memo, status: 'resolved', is_notified: notifyData.notified } : null
    )
    setSaving(false)
    showMessage(
      notifyData.notified
        ? '답변이 저장되고 이메일 알림이 발송되었습니다. ✅'
        : inquiry?.contact_type === 'phone'
        ? '답변이 저장되었습니다. 전화로 직접 연락해주세요. 📞'
        : '답변이 저장되었습니다. ✅'
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F0F4F0] flex items-center justify-center">
        <div className="text-gray-400">불러오는 중...</div>
      </div>
    )
  }

  if (!inquiry) {
    return (
      <div className="min-h-screen bg-[#F0F4F0] flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-gray-500">문의를 찾을 수 없습니다.</p>
          <Link href="/board/admin/public-inquiries" className="text-[#2D6A4F] hover:underline text-sm">
            ← 목록으로
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F0F4F0]">
      <header className="bg-white border-b border-gray-100 px-4 sm:px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/board/admin/public-inquiries" className="text-[#2D6A4F] hover:underline text-sm whitespace-nowrap">
            ← 목록
          </Link>
          <span className="text-gray-300">/</span>
          <span className="font-mono text-sm text-gray-500 truncate">{inquiry.inquiry_number}</span>
        </div>
        {message && (
          <span className="text-sm text-[#2D6A4F] font-semibold flex-shrink-0 ml-3">{message}</span>
        )}
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">

        {/* Phone alert */}
        {inquiry.contact_type === 'phone' && inquiry.status !== 'resolved' && (
          <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <span className="text-orange-700 font-semibold text-sm">
              📞 직접 연락 후 완료 처리하세요
            </span>
            <span className="text-orange-800 font-bold text-lg">{inquiry.contact}</span>
          </div>
        )}

        {/* Inquiry info */}
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-xs font-mono text-gray-400">{inquiry.inquiry_number}</span>
                <span className="text-xs text-gray-300">·</span>
                <span className="text-xs text-gray-400">{CATEGORY_LABELS[inquiry.category] || inquiry.category}</span>
              </div>
              <h2 className="text-lg font-bold text-[#1C2B1E]">{inquiry.title}</h2>
            </div>
            <span className={`text-xs font-bold px-3 py-1.5 rounded-full flex-shrink-0 ${
              inquiry.status === 'resolved'
                ? 'bg-green-100 text-green-800'
                : inquiry.status === 'in_progress'
                ? 'bg-blue-100 text-blue-800'
                : 'bg-yellow-100 text-yellow-800'
            }`}>
              {STATUS_LABELS[inquiry.status] || inquiry.status}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm mb-4 pb-4 border-b border-gray-100">
            <div>
              <span className="text-gray-400 text-xs block mb-0.5">이름</span>
              <p className="font-semibold text-[#1C2B1E]">{inquiry.name}</p>
            </div>
            <div>
              <span className="text-gray-400 text-xs block mb-0.5">연락처</span>
              <p className="font-semibold text-[#1C2B1E]">
                {inquiry.contact_type === 'phone' ? '📞 ' : '✉️ '}
                {inquiry.contact}
              </p>
            </div>
            <div>
              <span className="text-gray-400 text-xs block mb-0.5">접수일</span>
              <p className="font-semibold text-[#1C2B1E] text-xs">
                {new Date(inquiry.created_at).toLocaleString('ko-KR')}
              </p>
            </div>
            {inquiry.replied_at && (
              <div>
                <span className="text-gray-400 text-xs block mb-0.5">답변일</span>
                <p className="font-semibold text-[#1C2B1E] text-xs">
                  {new Date(inquiry.replied_at).toLocaleString('ko-KR')}
                </p>
              </div>
            )}
          </div>

          <p className="text-gray-600 text-sm whitespace-pre-wrap leading-relaxed">{inquiry.content}</p>
        </div>

        {/* Status change */}
        {inquiry.status === 'pending' && (
          <div>
            <button
              onClick={() => updateStatus('in_progress')}
              disabled={saving}
              className="border-2 border-[#2D6A4F] text-[#2D6A4F] font-semibold px-6 py-2.5 rounded-xl hover:bg-[#E8F5E9] transition-colors disabled:opacity-50 text-sm"
            >
              검토중으로 변경
            </button>
          </div>
        )}

        {/* Reply area */}
        <div className="bg-white rounded-2xl p-6 shadow-sm space-y-4">
          <h3 className="font-bold text-[#1C2B1E]">답변 작성</h3>

          {inquiry.contact_type === 'phone' && (
            <div className="bg-orange-50 rounded-xl p-3 text-sm text-orange-700">
              📞 전화로 직접 연락 후 아래에 답변 내용을 기록하고 완료 처리하세요.
            </div>
          )}

          <textarea
            rows={6}
            value={reply}
            onChange={e => setReply(e.target.value)}
            placeholder="답변 내용을 입력해주세요"
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F] focus:border-transparent resize-none"
          />

          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1.5">
              내부 메모 (관리자만 보임)
            </label>
            <textarea
              rows={2}
              value={memo}
              onChange={e => setMemo(e.target.value)}
              placeholder="내부 참고용 메모..."
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm italic text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#2D6A4F] focus:border-transparent resize-none"
            />
          </div>

          <div className="flex gap-3 flex-wrap">
            <button
              onClick={saveMemo}
              disabled={saving}
              className="border border-gray-200 text-gray-600 font-medium px-5 py-2.5 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50 text-sm"
            >
              메모 저장
            </button>
            <button
              onClick={saveReplyAndNotify}
              disabled={saving || !reply.trim()}
              className="bg-[#2D6A4F] hover:bg-[#1B4332] disabled:opacity-50 text-white font-semibold px-6 py-2.5 rounded-xl transition-colors text-sm"
            >
              {saving ? '저장 중...' : '답변 저장 + 알림 발송'}
            </button>
          </div>
        </div>

        {/* Existing reply preview */}
        {inquiry.admin_reply && (
          <div className="bg-[#E8F5E9] rounded-2xl p-5">
            <p className="text-xs font-semibold text-[#52B788] mb-2">등록된 답변</p>
            <p className="text-sm text-[#1C2B1E] whitespace-pre-wrap leading-relaxed">{inquiry.admin_reply}</p>
          </div>
        )}
      </div>
    </div>
  )
}
