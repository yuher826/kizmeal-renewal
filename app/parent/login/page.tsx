'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function ParentLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      setError('이메일 또는 비밀번호가 올바르지 않습니다.')
      setLoading(false)
      return
    }

    // Check parent status
    const { data: parent } = await supabase
      .from('parents')
      .select('status')
      .maybeSingle()

    if (!parent) {
      setError('학부모 계정이 없습니다. 회원가입을 진행해주세요.')
      await supabase.auth.signOut()
      setLoading(false)
      return
    }

    if (parent.status === 'pending') {
      router.replace('/parent/pending')
    } else if (parent.status === 'rejected') {
      router.replace('/parent/rejected')
    } else {
      router.replace('/parent/dashboard')
    }
  }

  return (
    <div className="min-h-screen bg-[#F6FAF6] flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-[#2D6A4F] to-[#52B788] rounded-2xl flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4 shadow-lg">
            K
          </div>
          <h1 className="text-2xl font-bold text-[#1C2B1E]">학부모 포털</h1>
          <p className="text-sm text-gray-500 mt-1">키즈밀 학부모 서비스에 오신 것을 환영합니다</p>
        </div>

        <form onSubmit={handleLogin} className="bg-white rounded-3xl p-6 shadow-sm space-y-4">
          {error && (
            <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl">{error}</div>
          )}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">이메일</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="이메일 주소"
              required
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="비밀번호"
              required
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#2D6A4F] hover:bg-[#1B4332] disabled:bg-gray-300 text-white font-bold py-3.5 rounded-xl text-sm transition-colors"
          >
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>

        <div className="flex items-center justify-center gap-4 mt-5 text-sm">
          <Link href="/parent/forgot-password" className="text-gray-500 hover:text-[#2D6A4F]">
            비밀번호 찾기
          </Link>
          <span className="text-gray-200">|</span>
          <Link href="/parent/register" className="text-[#2D6A4F] font-semibold hover:underline">
            회원가입
          </Link>
        </div>
      </div>
    </div>
  )
}
