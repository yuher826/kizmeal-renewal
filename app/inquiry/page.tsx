'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

const CATEGORIES = [
  { value: 'service', label: '서비스 문의', icon: '🏢' },
  { value: 'price', label: '가격 문의', icon: '💰' },
  { value: 'menu', label: '메뉴 문의', icon: '🥗' },
  { value: 'facility', label: '시설 문의', icon: '🏭' },
  { value: 'other', label: '기타', icon: '📋' },
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
  const [showPassword, setShowPassword] = useState(false)

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

  const passwordMatch = form.password_confirm.length > 0 && form.password === form.password_confirm
  const passwordMismatch = form.password_confirm.length > 0 && form.password !== form.password_confirm

  if (success) {
    return (
      <div className="min-h-screen bg-[#F8FDF8] flex flex-col">
        <div className="h-32 bg-gradient-to-br from-[#1B4332] via-[#2D6A4F] to-[#3d8b5f]" />

        <div className="flex-1 flex items-center justify-center px-4 py-16">
          <div className="w-full max-w-md">
            <div className="bg-white rounded-3xl shadow-2xl shadow-[#2D6A4F]/10 border border-gray-100 p-10 text-center">
              <div className="w-20 h-20 rounded-full bg-[#E8F5E9] flex items-center justify-center mx-auto mb-6 animate-bounce">
                <svg className="w-10 h-10 text-[#2D6A4F]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>

              <h2 className="text-2xl font-bold text-[#1C2B1E] mb-3">문의가 접수되었습니다!</h2>
              <p className="text-gray-400 text-sm mb-8">
                답변이 등록되면 입력하신 연락처로 알림을 드립니다.
              </p>

              <div className="bg-gradient-to-r from-[#1B4332] to-[#2D6A4F] rounded-2xl p-6 text-center mb-6">
                <p className="text-white/60 text-xs font-semibold tracking-widest uppercase mb-2">문의번호</p>
                <p className="text-3xl font-bold text-white tracking-widest">{success.inquiry_number}</p>
                <p className="text-white/60 text-xs mt-3">이 번호를 꼭 메모해두세요 📋</p>
              </div>

              <div className="space-y-3">
                <Link
                  href="/inquiry/check"
                  className="block w-full bg-[#2D6A4F] hover:bg-[#1B4332] text-white font-bold py-4 rounded-2xl transition-colors text-center"
                >
                  내 문의 확인하기
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setSuccess(null)
                    setForm({ name: '', contact_type: 'email', contact: '', password: '', password_confirm: '', category: 'service', title: '', content: '', website: '' })
                    setError('')
                  }}
                  className="block w-full border-2 border-[#2D6A4F] text-[#2D6A4F] hover:bg-[#E8F5E9] font-bold py-4 rounded-2xl transition-colors text-center"
                >
                  새 문의 작성하기
                </button>
              </div>
            </div>
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

      <div className="min-h-screen bg-white">
        {/* Hero */}
        <div
          className="relative h-80 flex flex-col items-center justify-center overflow-hidden pt-16"
          style={{ background: 'linear-gradient(135deg, #1B4332 0%, #2D6A4F 50%, #3d8b5f 100%)' }}
        >
          <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-3xl mb-4">
            ✉️
          </div>
          <h1
            className="text-5xl font-bold text-white mb-3"
            style={{ fontFamily: '"Noto Serif KR", serif' }}
          >
            문의하기
          </h1>
          <p className="text-white/80 text-lg">궁금한 점을 편하게 물어보세요</p>

          <div className="absolute bottom-0 inset-x-0 leading-[0]">
            <svg viewBox="0 0 1440 72" preserveAspectRatio="none" className="w-full h-[48px] sm:h-[72px] block">
              <path
                d="M0,36 C120,72 240,0 360,36 C480,72 600,0 720,36 C840,72 960,0 1080,36 C1200,72 1320,0 1440,36 L1440,72 L0,72 Z"
                fill="white"
              />
            </svg>
          </div>
        </div>

        {/* Form card */}
        <div className="relative z-10 max-w-2xl mx-auto px-4 -mt-12 pb-16">
          <div className="bg-white rounded-3xl shadow-2xl shadow-[#2D6A4F]/10 border border-gray-100 p-8 md:p-12">
            <div className="mb-8">
              <p className="text-xs text-[#2D6A4F] font-semibold tracking-widest uppercase mb-2">NEW INQUIRY</p>
              <h2 className="text-2xl font-bold text-[#1C2B1E]">무엇이 궁금하신가요?</h2>
              <div className="border-b border-[#E8F5E9] mt-4" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* 이름 */}
              <div>
                <label className="text-sm font-semibold text-[#3D5A41] mb-1.5 block">
                  이름 <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={set('name')}
                  placeholder="홍길동"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30 focus:border-[#2D6A4F] transition-all duration-200"
                />
              </div>

              {/* 연락처 유형 + 입력 */}
              <div className="grid grid-cols-5 gap-3">
                <div className="col-span-2">
                  <label className="text-sm font-semibold text-[#3D5A41] mb-1.5 block">
                    연락처 유형 <span className="text-red-400">*</span>
                  </label>
                  <div className="flex flex-col gap-2 pt-1">
                    {[{ value: 'email', label: '이메일' }, { value: 'phone', label: '전화번호' }].map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, contact_type: opt.value, contact: '' }))}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          form.contact_type === opt.value
                            ? 'bg-[#2D6A4F] text-white'
                            : 'bg-gray-50 text-gray-600 hover:bg-[#E8F5E9]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="col-span-3">
                  <label className="text-sm font-semibold text-[#3D5A41] mb-1.5 block">
                    {form.contact_type === 'email' ? '이메일' : '전화번호'} <span className="text-red-400">*</span>
                  </label>
                  <input
                    type={form.contact_type === 'email' ? 'email' : 'tel'}
                    required
                    value={form.contact}
                    onChange={set('contact')}
                    placeholder={form.contact_type === 'email' ? 'example@email.com' : '010-0000-0000'}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30 focus:border-[#2D6A4F] transition-all duration-200"
                  />
                </div>
              </div>

              {/* 비밀번호 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-semibold text-[#3D5A41] mb-1.5 block">
                    비밀번호 <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={4}
                      maxLength={8}
                      value={form.password}
                      onChange={set('password')}
                      placeholder="4~8자리"
                      className="w-full px-4 py-3 pr-10 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30 focus:border-[#2D6A4F] transition-all duration-200"
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
                <div>
                  <label className="text-sm font-semibold text-[#3D5A41] mb-1.5 block">
                    비밀번호 확인 <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      required
                      minLength={4}
                      maxLength={8}
                      value={form.password_confirm}
                      onChange={set('password_confirm')}
                      placeholder="다시 입력"
                      className={`w-full px-4 py-3 pr-10 border rounded-xl focus:outline-none focus:ring-2 transition-all duration-200 ${
                        passwordMatch
                          ? 'border-green-400 focus:ring-green-300'
                          : passwordMismatch
                          ? 'border-red-400 focus:ring-red-300'
                          : 'border-gray-200 focus:ring-[#2D6A4F]/30 focus:border-[#2D6A4F]'
                      }`}
                    />
                    {passwordMatch && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500 font-bold text-sm">✓</span>
                    )}
                    {passwordMismatch && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-red-500 font-bold text-sm">✗</span>
                    )}
                  </div>
                </div>
              </div>

              {/* 문의 유형 카드 그리드 */}
              <div>
                <label className="text-sm font-semibold text-[#3D5A41] mb-3 block">
                  문의 유형 <span className="text-red-400">*</span>
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, category: cat.value }))}
                      className={`border rounded-xl p-3 text-center cursor-pointer transition-colors ${
                        form.category === cat.value
                          ? 'border-[#2D6A4F] bg-[#E8F5E9] text-[#2D6A4F]'
                          : 'border-gray-200 text-gray-600 hover:border-[#2D6A4F]/50'
                      }`}
                    >
                      <div className="text-xl mb-1">{cat.icon}</div>
                      <div className="font-medium text-xs">{cat.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 제목 */}
              <div>
                <label className="text-sm font-semibold text-[#3D5A41] mb-1.5 block">
                  제목 <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={set('title')}
                  placeholder="문의 제목을 입력해주세요"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30 focus:border-[#2D6A4F] transition-all duration-200"
                />
              </div>

              {/* 내용 */}
              <div>
                <label className="text-sm font-semibold text-[#3D5A41] mb-1.5 block">
                  내용 <span className="text-red-400">*</span>
                </label>
                <textarea
                  required
                  rows={6}
                  value={form.content}
                  onChange={set('content')}
                  placeholder={"문의 내용을 자세히 적어주세요.\n담당자가 꼼꼼히 검토 후 답변드리겠습니다."}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30 focus:border-[#2D6A4F] transition-all duration-200 resize-none"
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

              {error && (
                <p className="text-red-500 text-sm bg-red-50 rounded-xl px-4 py-3">{error}</p>
              )}

              <button
                type="submit"
                disabled={submitting || cooldown > 0}
                className="w-full py-4 rounded-2xl bg-[#2D6A4F] hover:bg-[#1B4332] disabled:opacity-60 text-white font-bold text-lg shadow-lg shadow-[#2D6A4F]/30 transition-all duration-200 active:scale-[0.99]"
              >
                {submitting
                  ? '접수 중...'
                  : cooldown > 0
                  ? `잠시 후 다시 시도해주세요 (${cooldown}초)`
                  : '문의 접수하기 →'}
              </button>

              <p className="text-xs text-gray-400 text-center">
                🔒 입력하신 정보는 안전하게 보호됩니다
              </p>
            </form>
          </div>
        </div>
      </div>
    </>
  )
}
