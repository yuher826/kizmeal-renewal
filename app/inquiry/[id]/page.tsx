'use client'

import { Suspense, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { KIZMEAL_LOGO_PATH } from '@/lib/brand'

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
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <div
        className="relative h-64 flex flex-col items-center justify-center overflow-hidden pt-16"
        style={{ background: 'linear-gradient(135deg, #1B4332 0%, #2D6A4F 50%, #3d8b5f 100%)' }}
      >
        <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-3xl mb-4">
          ✉️
        </div>
        <h1
          className="text-4xl font-bold text-white mb-3"
          style={{ fontFamily: '"Noto Serif KR", serif' }}
        >
          문의 상세
        </h1>
        <p className="text-white/80 text-base">문의 내용과 답변을 확인하세요</p>

        <div className="absolute bottom-0 inset-x-0 leading-[0]">
          <svg viewBox="0 0 1440 72" preserveAspectRatio="none" className="w-full h-[48px] sm:h-[72px] block">
            <path
              d="M0,36 C120,72 240,0 360,36 C480,72 600,0 720,36 C840,72 960,0 1080,36 C1200,72 1320,0 1440,36 L1440,72 L0,72 Z"
              fill="white"
            />
          </svg>
        </div>
      </div>

      {/* Main content */}
      <div className="relative z-10 max-w-lg mx-auto px-4 -mt-8 pb-16 space-y-4">
        {!inquiry ? (
          <div className="bg-white rounded-3xl shadow-2xl shadow-[#2D6A4F]/10 border border-gray-100 p-8">
            <div className="mb-6">
              <p className="text-xs text-[#2D6A4F] font-semibold tracking-widest uppercase mb-2">INQUIRY DETAIL</p>
              <h2 className="text-2xl font-bold text-[#1C2B1E]">본인 확인</h2>
              <div className="border-b border-[#E8F5E9] mt-4" />
            </div>

            <form onSubmit={handleVerify} className="space-y-5">
              <div>
                <label className="text-sm font-semibold text-[#3D5A41] mb-1.5 block">연락처</label>
                <input
                  type="text"
                  required
                  value={contact}
                  onChange={e => setContact(e.target.value)}
                  placeholder="문의 시 입력한 이메일 또는 전화번호"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30 focus:border-[#2D6A4F] transition-all duration-200"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-[#3D5A41] mb-1.5 block">비밀번호</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="문의 시 설정한 비밀번호"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30 focus:border-[#2D6A4F] transition-all duration-200"
                />
              </div>
              {error && <p className="text-red-500 text-sm bg-red-50 rounded-xl px-4 py-3">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#2D6A4F] hover:bg-[#1B4332] disabled:opacity-60 text-white font-bold py-4 rounded-2xl transition-colors shadow-lg shadow-[#2D6A4F]/20"
              >
                {loading ? '확인 중...' : '확인하기'}
              </button>
              <div className="text-center">
                <Link href="/inquiry/check" className="text-sm text-[#2D6A4F] hover:underline">
                  ← 내 문의 목록으로
                </Link>
              </div>
            </form>
          </div>
        ) : (
          <>
            {/* Progress bar */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
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
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                <span className="text-xs font-bold bg-[#E8F5E9] text-[#2D6A4F] px-2.5 py-1 rounded-full">
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
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={KIZMEAL_LOGO_PATH} alt="키즈밀 로고" className="h-7 w-auto object-contain" />
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
              <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-gray-100">
                <p className="text-gray-500 text-sm leading-relaxed">
                  검토 중입니다.<br />
                  빠른 시일 내 답변드리겠습니다. 😊
                </p>
              </div>
            )}

            <div className="text-center pt-2">
              <Link
                href="/inquiry/check"
                className="inline-flex items-center gap-2 border-2 border-[#2D6A4F] text-[#2D6A4F] hover:bg-[#E8F5E9] font-semibold px-6 py-3 rounded-2xl transition-colors text-sm"
              >
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
