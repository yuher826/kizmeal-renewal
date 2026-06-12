'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase'

interface Props {
  next?: string
}

export default function ErpLoginForm({ next }: Props) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [error, setError] = useState('')

  // 이미 로그인된 상태 확인
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session) {
        const uid = data.session.user.id
        const { data: adminRow } = await supabase
          .from('admins')
          .select('id')
          .eq('auth_id', uid)
          .maybeSingle()
        if (adminRow) {
          router.push(next || '/erp/diet')
          return
        }
      }
      setChecking(false)
    })
  }, [])

  async function handleLogin() {
    if (!email || !password) return
    setLoading(true)
    setError('')

    const supabase = createClient()

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError) {
      setError('이메일 또는 비밀번호가 올바르지 않습니다')
      setLoading(false)
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError('로그인 중 오류가 발생했습니다')
      setLoading(false)
      return
    }

    const { data: adminData } = await supabase
      .from('admins')
      .select('id')
      .eq('auth_id', user.id)
      .maybeSingle()

    if (!adminData) {
      await supabase.auth.signOut()
      setError('ERP 접근 권한이 없는 계정입니다')
      setLoading(false)
      return
    }

    router.push(next || '/erp/diet')
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleLogin()
  }

  if (checking) {
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <Loader2 size={24} className="animate-spin text-emerald-600" />
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* 왼쪽 패널 (데스크탑) */}
      <div className="hidden md:flex w-1/2 bg-emerald-700 flex-col justify-between p-10">
        <div className="flex items-center gap-2">
          <span className="text-white text-xl font-bold tracking-wide">KIZMEAL</span>
          <span className="bg-white/20 text-white text-xs font-semibold rounded px-2 py-0.5">ERP</span>
        </div>
        <div>
          <h1 className="text-white text-3xl font-bold leading-tight">
            키즈밀 내부<br />운영 시스템
          </h1>
          <p className="text-emerald-200 text-base mt-3">
            식단 자동화 · 원 관리 · 소통 채널
          </p>
        </div>
        <p className="text-emerald-300 text-sm">22년의 노하우를 한 곳에서</p>
      </div>

      {/* 오른쪽 패널 */}
      <div className="flex-1 bg-white flex flex-col">
        {/* 모바일 상단 헤더 */}
        <div className="block md:hidden bg-emerald-600 py-4 px-6">
          <span className="text-white font-bold text-lg">KIZMEAL ERP</span>
        </div>

        <div className="flex-1 flex flex-col justify-center px-8 md:px-16">
          <div className="max-w-sm md:max-w-md mx-auto w-full">
            <h2 className="text-2xl font-semibold text-slate-800">관리자 로그인</h2>
            <p className="text-sm text-slate-500 mt-1 mb-8">
              키즈밀 ERP 접근 권한이 필요합니다
            </p>

            {/* 이메일 */}
            <div>
              <label className="text-sm font-medium text-slate-700">이메일</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="admin@kizmeal.com"
                className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm mt-1 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            {/* 비밀번호 */}
            <div className="mt-4">
              <label className="text-sm font-medium text-slate-700">비밀번호</label>
              <div className="relative mt-1">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="••••••••"
                  className="w-full border border-slate-300 rounded-lg px-4 py-2.5 pr-10 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* 에러 */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3 mt-4">
                {error}
              </div>
            )}

            {/* 로그인 버튼 */}
            <button
              onClick={handleLogin}
              disabled={loading}
              className="w-full mt-6 py-3 rounded-lg font-medium bg-emerald-600 hover:bg-emerald-700 text-white transition-colors duration-150 disabled:opacity-70 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  로그인 중...
                </>
              ) : (
                '로그인'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
