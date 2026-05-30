'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const supabase = createClient()
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/parent/reset-password`,
    })

    if (err) {
      setError('이메일 전송에 실패했습니다. 다시 시도해주세요.')
    } else {
      setSent(true)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#F6FAF6] flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-gradient-to-br from-[#2D6A4F] to-[#52B788] rounded-2xl flex items-center justify-center text-white text-xl font-bold mx-auto mb-3 shadow-lg">
            K
          </div>
          <h1 className="text-xl font-bold text-[#1C2B1E]">비밀번호 찾기</h1>
        </div>

        {sent ? (
          <div className="bg-white rounded-3xl p-6 text-center">
            <div className="text-4xl mb-3">📧</div>
            <p className="font-bold text-[#1C2B1E] mb-1">이메일을 확인해주세요</p>
            <p className="text-sm text-gray-500">{email}으로 비밀번호 재설정 링크를 보냈습니다.</p>
            <Link href="/parent/login" className="mt-5 inline-block text-sm text-[#2D6A4F] font-semibold hover:underline">
              로그인으로 돌아가기
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white rounded-3xl p-6 space-y-4">
            <p className="text-sm text-gray-500">가입 시 사용한 이메일 주소를 입력하면 비밀번호 재설정 링크를 보내드립니다.</p>
            {error && (
              <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl">{error}</div>
            )}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">이메일</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="example@email.com"
                required
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#2D6A4F] hover:bg-[#1B4332] disabled:bg-gray-300 text-white font-bold py-3.5 rounded-xl text-sm transition-colors"
            >
              {loading ? '전송 중...' : '재설정 링크 보내기'}
            </button>
            <div className="text-center">
              <Link href="/parent/login" className="text-sm text-gray-500 hover:text-[#2D6A4F]">
                로그인으로 돌아가기
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
