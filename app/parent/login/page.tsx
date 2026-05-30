'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

const SAVE_EMAIL_KEY = 'parent_saved_email'

export default function ParentLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [saveEmail, setSaveEmail] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [kakaoPopup, setKakaoPopup] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem(SAVE_EMAIL_KEY)
    if (saved) {
      setEmail(saved)
      setSaveEmail(true)
    }
  }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (saveEmail) {
      localStorage.setItem(SAVE_EMAIL_KEY, email)
    } else {
      localStorage.removeItem(SAVE_EMAIL_KEY)
    }

    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      setError('이메일 또는 비밀번호가 올바르지 않습니다.')
      setLoading(false)
      return
    }

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
      {/* 카카오 준비중 팝업 */}
      {kakaoPopup && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-7 w-full max-w-xs text-center shadow-2xl">
            <div className="text-4xl mb-3">🚧</div>
            <h2 className="font-bold text-[#1C2B1E] text-base mb-2">카카오 로그인 준비 중입니다</h2>
            <p className="text-sm text-gray-500 leading-relaxed">
              곧 더 편리한 서비스로 찾아뵙겠습니다! 😊
            </p>
            <button
              type="button"
              onClick={() => setKakaoPopup(false)}
              className="mt-5 w-full bg-[#2D6A4F] hover:bg-[#1B4332] text-white font-bold py-3 rounded-xl text-sm transition-colors"
            >
              확인
            </button>
          </div>
        </div>
      )}

      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/login">
            <div className="w-16 h-16 bg-gradient-to-br from-[#2D6A4F] to-[#52B788] rounded-2xl flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4 shadow-lg">
              K
            </div>
          </Link>
          <h1 className="text-2xl font-bold text-[#1C2B1E]">학부모 포털</h1>
          <p className="text-sm text-gray-500 mt-1">키즈밀 학부모 서비스에 오신 것을 환영합니다</p>
        </div>

        {/* 카카오 버튼 */}
        <button
          type="button"
          onClick={() => setKakaoPopup(true)}
          className="w-full flex items-center justify-center gap-2.5 bg-[#FEE500] hover:bg-[#F5DC00] text-[#1A1A1A] font-bold py-3.5 rounded-2xl text-sm transition-colors mb-4 shadow-sm"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 3C6.477 3 2 6.477 2 10.8c0 2.752 1.655 5.168 4.16 6.627l-.843 3.142a.3.3 0 0 0 .449.328L9.498 18.7A11.06 11.06 0 0 0 12 18.6c5.523 0 10-3.477 10-7.8S17.523 3 12 3z" />
          </svg>
          카카오로 시작하기
        </button>

        {/* 구분선 */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-xs text-gray-400 flex-shrink-0">이메일로 로그인</span>
          <div className="flex-1 h-px bg-gray-200" />
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
              autoComplete="email"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]"
            />
            {/* 아이디 저장 체크박스 */}
            <label className="flex items-center gap-2 mt-2 cursor-pointer w-fit">
              <input
                type="checkbox"
                checked={saveEmail}
                onChange={e => {
                  setSaveEmail(e.target.checked)
                  if (!e.target.checked) localStorage.removeItem(SAVE_EMAIL_KEY)
                }}
                className="w-3.5 h-3.5 rounded accent-[#2D6A4F]"
              />
              <span className="text-xs text-gray-500">아이디 저장</span>
            </label>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="비밀번호"
              required
              autoComplete="current-password"
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

        <div className="mt-5 text-center">
          <Link href="/login" className="text-xs text-gray-400 hover:text-[#2D6A4F] transition-colors">
            ← 로그인 선택으로
          </Link>
        </div>
      </div>
    </div>
  )
}
