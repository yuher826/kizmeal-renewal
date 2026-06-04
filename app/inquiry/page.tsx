'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

const CATEGORIES = [
  { value: 'service', label: '서비스 문의' },
  { value: 'price', label: '가격 문의' },
  { value: 'menu', label: '메뉴 문의' },
  { value: 'facility', label: '시설 문의' },
  { value: 'other', label: '기타' },
]

type FormState = {
  name: string
  contact_type: string
  contact: string
  password: string
  password_confirm: string
  category: string
  title: string
  content: string
  website: string
}

export default function InquiryPage() {
  const [form, setForm] = useState<FormState>({
    name: '',
    contact_type: 'email',
    contact: '',
    password: '',
    password_confirm: '',
    category: 'service',
    title: '',
    content: '',
    website: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState<{ inquiry_number: string } | null>(null)
  const [cooldown, setCooldown] = useState(0)
  const [spamModal, setSpamModal] = useState<{ title: string; message: string } | null>(null)

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  function set(field: keyof FormState) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm(f => ({ ...f, [field]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (cooldown > 0) return
    if (form.password !== form.password_confirm) {
      setError('비밀번호가 일치하지 않습니다.')
      return
    }
    if (form.password.length < 4 || form.password.length > 8) {
      setError('비밀번호는 4~8자리로 입력해주세요.')
      return
    }

    setSubmitting(true)
    setError('')

    const res = await fetch('/api/public-inquiry/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        contact: form.contact,
        contact_type: form.contact_type,
        password: form.password,
        category: form.category,
        title: form.title,
        content: form.content,
        website: form.website,
      }),
    })

    const data = await res.json()
    setSubmitting(false)

    if (!res.ok) {
      if (data.error === 'spam') {
        setSpamModal({ title: data.title, message: data.message })
        return
      }
      setError(data.error || '오류가 발생했습니다.')
      return
    }

    setSuccess({ inquiry_number: data.inquiry_number })
    setCooldown(30)
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[#F0F4F0] pt-20 pb-12 px-4">
        <div className="max-w-lg mx-auto pt-8">
          <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
            <div className="w-16 h-16 bg-[#E8F5E9] rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-[#2D6A4F]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-[#1C2B1E] mb-2">문의가 접수되었습니다! ✅</h2>
            <p className="text-gray-500 text-sm mb-6">빠른 시일 내에 답변드리겠습니다.</p>
            <div className="bg-[#E8F5E9] rounded-xl p-6 mb-3">
              <p className="text-xs text-[#52B788] font-semibold mb-2">문의 번호</p>
              <p className="text-2xl font-bold text-[#2D6A4F]">{success.inquiry_number}</p>
            </div>
            <p className="text-amber-600 text-sm font-semibold mb-6">이 번호를 꼭 메모해두세요!</p>
            <Link
              href="/inquiry/check"
              className="block w-full bg-[#2D6A4F] hover:bg-[#1B4332] text-white font-semibold py-3.5 rounded-xl transition-colors text-center"
            >
              내 문의 확인하기
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      {spamModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
            <h3 className="font-bold text-[#1C2B1E] text-lg mb-3">{spamModal.title}</h3>
            <p className="text-gray-600 text-sm whitespace-pre-wrap mb-6">{spamModal.message}</p>
            <button
              onClick={() => setSpamModal(null)}
              className="w-full bg-[#2D6A4F] text-white font-semibold py-3 rounded-xl"
            >
              확인
            </button>
          </div>
        </div>
      )}

      <div className="min-h-screen bg-[#F0F4F0]">
        <div className="bg-[#2D6A4F] pt-24 pb-12 px-4 text-center">
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">문의하기</h1>
          <p className="text-[#B7E4C7] text-sm">궁금한 점을 편하게 물어보세요</p>
        </div>

        <div className="max-w-lg mx-auto px-4 -mt-4 pb-12">
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 shadow-sm space-y-5">
            <div>
              <label className="block text-sm font-semibold text-[#1C2B1E] mb-1.5">
                이름 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={form.name}
                onChange={set('name')}
                placeholder="이름을 입력해주세요"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F] focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#1C2B1E] mb-2">
                연락처 유형 <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-6">
                {[{ value: 'email', label: '이메일' }, { value: 'phone', label: '전화번호' }].map(opt => (
                  <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="contact_type"
                      value={opt.value}
                      checked={form.contact_type === opt.value}
                      onChange={e => setForm(f => ({ ...f, contact_type: e.target.value, contact: '' }))}
                      className="accent-[#2D6A4F]"
                    />
                    <span className="text-sm text-[#1C2B1E]">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#1C2B1E] mb-1.5">
                {form.contact_type === 'email' ? '이메일' : '전화번호'} <span className="text-red-500">*</span>
              </label>
              <input
                type={form.contact_type === 'email' ? 'email' : 'tel'}
                required
                value={form.contact}
                onChange={set('contact')}
                placeholder={form.contact_type === 'email' ? 'example@email.com' : '010-0000-0000'}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F] focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#1C2B1E] mb-1.5">
                비밀번호 <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                required
                minLength={4}
                maxLength={8}
                value={form.password}
                onChange={set('password')}
                placeholder="4~8자리"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F] focus:border-transparent"
              />
              <p className="text-xs text-gray-400 mt-1">문의 확인 시 사용합니다</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#1C2B1E] mb-1.5">
                비밀번호 확인 <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                required
                minLength={4}
                maxLength={8}
                value={form.password_confirm}
                onChange={set('password_confirm')}
                placeholder="비밀번호를 다시 입력해주세요"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F] focus:border-transparent"
              />
            </div>

            {/* Honeypot - hidden */}
            <input
              type="text"
              name="website"
              value={form.website}
              onChange={set('website')}
              style={{ display: 'none' }}
              tabIndex={-1}
              autoComplete="off"
            />

            <div>
              <label className="block text-sm font-semibold text-[#1C2B1E] mb-2">
                문의 유형 <span className="text-red-500">*</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, category: cat.value }))}
                    className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                      form.category === cat.value
                        ? 'bg-[#2D6A4F] text-white border-[#2D6A4F]'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-[#2D6A4F] hover:text-[#2D6A4F]'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#1C2B1E] mb-1.5">
                제목 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={form.title}
                onChange={set('title')}
                placeholder="문의 제목을 입력해주세요"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F] focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#1C2B1E] mb-1.5">
                내용 <span className="text-red-500">*</span>
              </label>
              <textarea
                required
                rows={6}
                value={form.content}
                onChange={set('content')}
                placeholder="문의 내용을 상세히 입력해주세요"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F] focus:border-transparent resize-none"
              />
            </div>

            {error && (
              <p className="text-red-500 text-sm bg-red-50 rounded-xl px-4 py-3">{error}</p>
            )}

            <button
              type="submit"
              disabled={submitting || cooldown > 0}
              className="w-full bg-[#2D6A4F] hover:bg-[#1B4332] disabled:opacity-60 text-white font-semibold py-3.5 rounded-xl transition-colors"
            >
              {submitting ? '접수 중...' : cooldown > 0 ? `재접수 가능 (${cooldown}초)` : '문의하기'}
            </button>

            <p className="text-center text-sm text-gray-400">
              이미 문의하셨나요?{' '}
              <Link href="/inquiry/check" className="text-[#2D6A4F] underline">
                내 문의 확인하기
              </Link>
            </p>
          </form>
        </div>
      </div>
    </>
  )
}
