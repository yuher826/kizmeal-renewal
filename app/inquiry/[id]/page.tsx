'use client'

import { Suspense, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'

const STATUS_STEPS = [
  { key: 'pending', label: '접수중' },
  { key: 'in_progress', label: '검토중' },
  { key: 'resolved', label: '답변완료' },
]

const CATEGORY_LABELS: Record<string, string> = {
  service: '서비스 문의',
  price: '가격 문의',
  menu: '메뉴 문의',
  facility: '시설 문의',
  other: '기타',
}

type InquiryDetail = {
  id: string
  inquiry_number: string
  name: string
  category: string
  title: string
  content: string
  status: string
  admin_reply: string | null
  replied_at: string | null
  created_at: string
}

function InquiryDetailContent() {
  const { id } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const prefilledContact = searchParams.get('c') || ''

  const [contact, setContact] = useState(prefilledContact)
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [inquiry, setInquiry] = useState<InquiryDetail | null>(null)

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/public-inquiry/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contact, password }),
    })

    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(data.error || '확인에 실패했습니다.')
      return
    }

    const found = (data.inquiries as InquiryDetail[])?.find(i => i.id === id)
    if (!found) {
      setError('해당 문의를 찾을 수 없습니다. 연락처를 확인해주세요.')
      return
    }
    setInquiry(found)
  }

  const currentStep = STATUS_STEPS.findIndex(s => s.key === inquiry?.status)
  const stepIndex = currentStep === -1 ? 0 : currentStep

  return (
    <div className="min-h-screen bg-[#F0F4F0]">
      <div className="bg-[#2D6A4F] pt-24 pb-12 px-4 text-center">
        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">문의 상세</h1>
        <p className="text-[#B7E4C7] text-sm">비밀번호로 본인 확인 후 내용을 확인하세요</p>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-4 pb-12 space-y-4">
        {!inquiry ? (
          <form onSubmit={handleVerify} className="bg-white rounded-2xl p-6 shadow-sm space-y-4">
            <h2 className="font-bold text-[#1C2B1E]">본인 확인</h2>
            <div>
              <label className="block text-sm font-semibold text-[#1C2B1E] mb-1.5">연락처</label>
              <input
                type="text"
                required
                value={contact}
                onChange={e => setContact(e.target.value)}
                placeholder="문의 시 입력한 이메일 또는 전화번호"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F] focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-[#1C2B1E] mb-1.5">비밀번호</label>
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="문의 시 설정한 비밀번호"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F] focus:border-transparent"
              />
            </div>
            {error && <p className="text-red-500 text-sm bg-red-50 rounded-xl px-4 py-3">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#2D6A4F] hover:bg-[#1B4332] disabled:opacity-60 text-white font-semibold py-3.5 rounded-xl transition-colors"
            >
              {loading ? '확인 중...' : '확인하기'}
            </button>
            <div className="text-center">
              <Link href="/inquiry/check" className="text-sm text-[#2D6A4F] hover:underline">
                ← 내 문의 목록으로
              </Link>
            </div>
          </form>
        ) : (
          <>
            {/* Progress bar */}
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <div className="relative flex items-center justify-between">
                <div className="absolute inset-x-0 top-4 h-0.5 bg-gray-200">
                  <div
                    className="h-full bg-[#2D6A4F] transition-all"
                    style={{ width: `${(stepIndex / (STATUS_STEPS.length - 1)) * 100}%` }}
                  />
                </div>
                {STATUS_STEPS.map((step, i) => (
                  <div key={step.key} className="flex flex-col items-center relative z-10">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm mb-1 ${
                      i <= stepIndex ? 'bg-[#2D6A4F] text-white' : 'bg-gray-200 text-gray-400'
                    }`}>
                      {i < stepIndex ? '✓' : i + 1}
                    </div>
                    <span className={`text-xs font-semibold ${i <= stepIndex ? 'text-[#2D6A4F]' : 'text-gray-400'}`}>
                      {step.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Inquiry content */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                <span className="text-xs font-mono text-gray-400 bg-gray-50 px-2.5 py-1 rounded-lg">
                  {inquiry.inquiry_number}
                </span>
                <span className="text-xs text-gray-400">{CATEGORY_LABELS[inquiry.category] || inquiry.category}</span>
                <span className="text-xs text-gray-300">·</span>
                <span className="text-xs text-gray-400">
                  {new Date(inquiry.created_at).toLocaleDateString('ko-KR')}
                </span>
              </div>
              <h2 className="font-bold text-[#1C2B1E] text-lg mb-3">{inquiry.title}</h2>
              <p className="text-gray-600 text-sm whitespace-pre-wrap leading-relaxed">{inquiry.content}</p>
            </div>

            {/* Reply */}
            {inquiry.status === 'resolved' && inquiry.admin_reply ? (
              <div className="bg-[#E8F5E9] rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 bg-[#2D6A4F] rounded-lg flex items-center justify-center text-white text-xs font-bold">K</div>
                  <span className="text-sm font-bold text-[#2D6A4F]">키즈밀 답변</span>
                  {inquiry.replied_at && (
                    <span className="text-xs text-[#52B788] ml-auto">
                      {new Date(inquiry.replied_at).toLocaleDateString('ko-KR')}
                    </span>
                  )}
                </div>
                <p className="text-[#1C2B1E] text-sm whitespace-pre-wrap leading-relaxed">{inquiry.admin_reply}</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
                <p className="text-gray-500 text-sm leading-relaxed">
                  검토 중입니다.<br />
                  빠른 시일 내 답변드리겠습니다. 😊
                </p>
              </div>
            )}

            <div className="text-center pt-2">
              <Link href="/inquiry/check" className="text-sm text-[#2D6A4F] hover:underline">
                ← 내 문의 목록으로
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function InquiryDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F0F4F0] flex items-center justify-center">
          <div className="text-gray-400">불러오는 중...</div>
        </div>
      }
    >
      <InquiryDetailContent />
    </Suspense>
  )
}
