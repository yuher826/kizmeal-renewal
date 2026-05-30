'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function BoardLoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [failCount, setFailCount] = useState(0)
  const router = useRouter()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (failCount >= 5) {
      setError('로그인 시도가 5회 초과되었습니다. 잠시 후 다시 시도해주세요.')
      return
    }
    setLoading(true)
    setError('')

    const supabase = createClient()

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })

      if (authError) {
        setFailCount(prev => prev + 1)
        if (authError.message.toLowerCase().includes('invalid login credentials') ||
            authError.message.toLowerCase().includes('invalid email or password')) {
          setError(`이메일 또는 비밀번호가 올바르지 않습니다. (${failCount + 1}/5회)`)
        } else {
          setError(authError.message)
        }
        return
      }

      if (!data.user) {
        setError('로그인에 실패했습니다.')
        return
      }

      // Check if admin
      const { data: adminData } = await supabase
        .from('admins')
        .select('id')
        .eq('auth_id', data.user.id)
        .maybeSingle()

      if (adminData) {
        router.push('/board/admin')
        router.refresh()
        return
      }

      // Check branch master account
      const { data: branchData } = await supabase
        .from('branches')
        .select('id')
        .eq('auth_id', data.user.id)
        .maybeSingle()

      if (branchData) {
        router.push('/board/dashboard')
        router.refresh()
        return
      }

      // Check branch member (nutritionist gets their own dashboard)
      const { data: memberData } = await supabase
        .from('branch_members')
        .select('id, role')
        .eq('auth_id', data.user.id)
        .maybeSingle()

      if (memberData) {
        if (memberData.role === 'nutritionist') {
          router.push('/nutritionist/dashboard')
        } else {
          router.push('/board/dashboard')
        }
        router.refresh()
        return
      }

      setError('계정 정보를 찾을 수 없습니다. 관리자에게 문의해주세요.')
    } catch {
      setError('오류가 발생했습니다. 다시 시도해주세요.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F6FAF6] to-[#E8F5E9] flex items-center justify-center px-4 font-sans">
      <div className="w-full max-w-sm">
        {/* 로고 */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-[#2D6A4F] to-[#52B788] rounded-2xl flex items-center justify-center text-white font-bold text-2xl mx-auto mb-4 shadow-lg">
            K
          </div>
          <h1 className="text-2xl font-bold text-[#1C2B1E]">키즈밀 소통채널</h1>
          <p className="text-sm text-gray-500 mt-1.5">가맹점 1:1 문의 게시판</p>
        </div>

        {/* 로그인 폼 */}
        <form onSubmit={handleLogin} className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">이메일</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="example@email.com"
              required
              autoComplete="email"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F] focus:border-transparent transition-shadow"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="비밀번호를 입력하세요"
              required
              autoComplete="current-password"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F] focus:border-transparent transition-shadow"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !email || !password}
            className="w-full bg-[#2D6A4F] hover:bg-[#1B4332] disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-xl transition-colors text-sm flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                로그인 중...
              </>
            ) : '로그인'}
          </button>

          <div className="text-center">
            <button
              type="button"
              className="text-xs text-gray-400 hover:text-[#2D6A4F] transition-colors"
              onClick={() => alert('비밀번호 재설정은 관리자에게 문의해주세요.')}
            >
              비밀번호를 잊으셨나요?
            </button>
          </div>
        </form>

        <p className="text-center text-xs text-gray-400 mt-6">
          초대 링크로만 가입이 가능합니다.
        </p>
      </div>
    </div>
  )
}
