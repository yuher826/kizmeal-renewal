'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { KIZMEAL_LOGO_PATH } from '@/lib/brand'

export default function CustomerChangePasswordPage() {
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [show, setShow] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (newPw.length < 8) {
      setError('비밀번호는 최소 8자 이상이어야 합니다.')
      return
    }
    if (!/[!@#$%^&*]/.test(newPw)) {
      setError('특수문자(!@#$%^&*)를 포함해야 합니다.')
      return
    }
    if (newPw !== confirmPw) {
      setError('비밀번호가 일치하지 않습니다.')
      return
    }

    setLoading(true)
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError('세션이 만료되었습니다. 다시 로그인해주세요.')
      setLoading(false)
      return
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: newPw })
    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }

    try {
      await fetch('/api/branches/complete-password-change', { method: 'POST' })
    } catch {}

    window.location.href = '/board/login'
  }

  return (
    <div className="min-h-screen bg-[#F6FAF6] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
          <div className="text-center mb-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={KIZMEAL_LOGO_PATH} alt="키즈밀 로고" className="h-12 w-auto object-contain mx-auto mb-4" />
            <h1 className="text-xl font-bold text-[#1C2B1E]">비밀번호 변경</h1>
            <p className="text-sm text-gray-400 mt-1">첫 로그인 시 새 비밀번호를 설정해주세요</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">새 비밀번호</label>
              <div className="relative">
                <input
                  type={show ? 'text' : 'password'}
                  value={newPw}
                  onChange={e => setNewPw(e.target.value)}
                  placeholder="8자 이상, 특수문자 포함"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F] pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShow(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs"
                >
                  {show ? '숨기기' : '보기'}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">비밀번호 확인</label>
              <input
                type={show ? 'text' : 'password'}
                value={confirmPw}
                onChange={e => setConfirmPw(e.target.value)}
                placeholder="비밀번호 재입력"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]"
                required
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <div className="bg-[#F0F7F4] rounded-xl px-4 py-3 text-xs text-[#2D6A4F] space-y-1">
              <p className={newPw.length >= 8 ? 'text-green-600' : ''}>✓ 최소 8자 이상</p>
              <p className={/[!@#$%^&*]/.test(newPw) ? 'text-green-600' : ''}>✓ 특수문자 포함 (!@#$%^&*)</p>
              <p className={newPw && newPw === confirmPw ? 'text-green-600' : ''}>✓ 비밀번호 일치</p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#2D6A4F] hover:bg-[#1B4332] disabled:opacity-50 text-white font-semibold py-3.5 rounded-xl transition-colors text-sm"
            >
              {loading ? '변경 중...' : '비밀번호 변경하기'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
