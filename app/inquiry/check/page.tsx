'use client'

import { useState } from 'react'
import Link from 'next/link'

const STATUS_BADGES: Record<string, { label: string; color: string }> = {
  pending: { label: '접수중 🟡', color: 'bg-yellow-100 text-yellow-800' },
  in_progress: { label: '검토중 🔵', color: 'bg-blue-100 text-blue-800' },
  resolved: { label: '답변완료 🟢', color: 'bg-green-100 text-green-800' },
}

const CATEGORY_LABELS: Record<string, string> = {
  service: '서비스 문의',
  price: '가격 문의',
  menu: '메뉴 문의',
  facility: '시설 문의',
  other: '기타',
}

type Inquiry = {
  id: string
  inquiry_number: string
  category: string
  title: string
  status: string
  created_at: string
}

export default function CheckPage() {
  const [contact, setContact] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [inquiries, setInquiries] = useState<Inquiry[] | null>(null)
  const [showForgotHint, setShowForgotHint] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
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

    setInquiries(data.inquiries)
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <div
        className="relative h-64 flex flex-col items-center justify-center overflow-hidden pt-16"
        style={{ background: 'linear-gradient(135deg, #1B4332 0%, #2D6A4F 50%, #3d8b5f 100%)' }}
      >
        <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-3xl mb-4">
          🔍
        </div>
        <h1
          className="text-4xl font-bold text-white mb-3"
          style={{ fontFamily: '"Noto Serif KR", serif' }}
        >
          내 문의 확인
        </h1>
        <p className="text-white/80 text-base">접수하신 문의 내용과 답변을 확인하세요</p>

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
      <div className="relative z-10 max-w-md mx-auto px-4 -mt-8 pb-16">
        {!inquiries ? (
          <div className="bg-white rounded-3xl shadow-2xl shadow-[#2D6A4F]/10 border border-gray-100 p-8">
            <div className="mb-6">
              <p className="text-xs text-[#2D6A4F] font-semibold tracking-widest uppercase mb-2">NEW INQUIRY CHECK</p>
              <h2 className="text-2xl font-bold text-[#1C2B1E]">문의 내용 확인하기</h2>
              <div className="border-b border-[#E8F5E9] mt-4" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
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
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="문의 시 설정한 비밀번호"
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30 focus:border-[#2D6A4F] transition-all duration-200"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-base"
                  >
                    {showPassword ? '🙈' : '👁'}
                  </button>
                </div>
              </div>

              {error && (
                <p className="text-red-500 text-sm bg-red-50 rounded-xl px-4 py-3">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#2D6A4F] hover:bg-[#1B4332] disabled:opacity-60 text-white font-bold py-4 rounded-2xl transition-colors shadow-lg shadow-[#2D6A4F]/20"
              >
                {loading ? '확인 중...' : '확인하기'}
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setShowForgotHint(v => !v)}
                  className="text-sm text-gray-400 hover:text-[#2D6A4F] underline"
                >
                  비밀번호를 잊으셨나요?
                </button>
                {showForgotHint && (
                  <div className="mt-3 bg-[#E8F5E9] rounded-xl p-4 text-sm text-[#2D6A4F] text-left">
                    <p className="font-semibold mb-1">비밀번호 찾기 안내</p>
                    <p className="text-[#52B788] text-xs leading-relaxed">
                      이메일로 문의하신 경우 관리자에게 재설정을 요청해주세요.<br />
                      전화번호로 문의하신 경우: <strong>031-388-3501</strong>로 문의해주세요.
                    </p>
                  </div>
                )}
              </div>
            </form>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between pt-2">
              <h2 className="font-bold text-[#1C2B1E]">내 문의 목록 ({inquiries.length}건)</h2>
              <button
                onClick={() => { setInquiries(null); setContact(''); setPassword('') }}
                className="text-sm text-gray-400 hover:text-gray-600 underline"
              >
                다시 확인
              </button>
            </div>

            {inquiries.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 text-center text-gray-400 shadow-sm border border-gray-100">
                문의 내역이 없습니다.
              </div>
            ) : (
              inquiries.map(inq => {
                const badge = STATUS_BADGES[inq.status] || STATUS_BADGES.pending
                return (
                  <Link
                    key={inq.id}
                    href={`/inquiry/${inq.id}?c=${encodeURIComponent(contact)}`}
                    className="block bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow p-5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className="text-xs font-bold bg-[#E8F5E9] text-[#2D6A4F] px-2.5 py-1 rounded-full">
                            {inq.inquiry_number}
                          </span>
                          <span className="text-xs text-gray-400">{CATEGORY_LABELS[inq.category] || inq.category}</span>
                        </div>
                        <h3 className="font-semibold text-[#1C2B1E] truncate">{inq.title}</h3>
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(inq.created_at).toLocaleDateString('ko-KR')}
                        </p>
                      </div>
                      <span className={`text-xs font-bold px-3 py-1 rounded-full flex-shrink-0 ${badge.color}`}>
                        {badge.label}
                      </span>
                    </div>
                  </Link>
                )
              })
            )}

            <div className="text-center pt-2">
              <Link href="/inquiry" className="text-sm text-[#2D6A4F] hover:underline">
                새 문의하기 →
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
