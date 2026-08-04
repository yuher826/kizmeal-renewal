'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { KIZMEAL_LOGO_PATH } from '@/lib/brand'

const SAVE_EMAIL_KEY = 'board_saved_email'

export default function BoardLoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [saveEmail, setSaveEmail] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [failCount, setFailCount] = useState(0)
  const router = useRouter()

  useEffect(() => {
    const saved = localStorage.getItem(SAVE_EMAIL_KEY)
    if (saved) { setEmail(saved); setSaveEmail(true) }

    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) return
      const uid = data.session.user.id
      const { data: adminRow } = await supabase.from('admins').select('id, access_scope').eq('auth_id', uid).maybeSingle()
      // ERP 전용 계정은 ERP로, 그 외는 홈페이지관리로
      if (adminRow) { router.replace(adminRow.access_scope === 'erp_only' ? '/erp/diet' : '/board/admin'); return }
      const { data: branchRow } = await supabase.from('branches').select('id').eq('auth_id', uid).maybeSingle()
      if (branchRow) { router.replace('/board/dashboard'); return }
      const { data: memberRow } = await supabase.from('branch_members').select('id, role').eq('auth_id', uid).maybeSingle()
      if (memberRow) {
        router.replace(memberRow.role === 'nutritionist' ? '/nutritionist/dashboard' : '/board/dashboard')
        return
      }
      await supabase.auth.signOut()
    })
  }, [router])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (failCount >= 5) {
      setError('로그인 시도가 5회 초과되었습니다. 잠시 후 다시 시도해주세요.')
      return
    }

    if (saveEmail) {
      localStorage.setItem(SAVE_EMAIL_KEY, email)
    } else {
      localStorage.removeItem(SAVE_EMAIL_KEY)
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

      const { data: adminData } = await supabase.from('admins').select('id, access_scope').eq('auth_id', data.user.id).maybeSingle()
      // ERP 전용 계정은 ERP로, 그 외는 홈페이지관리로
      if (adminData) { router.push(adminData.access_scope === 'erp_only' ? '/erp/diet' : '/board/admin'); router.refresh(); return }

      const { data: branchData } = await supabase.from('branches').select('id').eq('auth_id', data.user.id).maybeSingle()
      if (branchData) {
        await supabase.from('branches').update({ last_login_at: new Date().toISOString() }).eq('id', branchData.id)
        router.push('/board/dashboard'); router.refresh(); return
      }

      const { data: memberData } = await supabase.from('branch_members').select('id, role').eq('auth_id', data.user.id).maybeSingle()
      if (memberData) {
        router.push(memberData.role === 'nutritionist' ? '/nutritionist/dashboard' : '/board/dashboard')
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
    <div className="min-h-screen flex">
      {/* ── 왼쪽: 브랜드 패널 (데스크탑만) ── */}
      <div
        className="hidden lg:flex lg:w-1/2 flex-col justify-between p-14"
        style={{ background: 'linear-gradient(135deg, #1B4332 0%, #2D6A4F 100%)' }}
      >
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={KIZMEAL_LOGO_PATH} alt="키즈밀 로고" className="h-10 w-auto object-contain mb-10" />
          <h1 className="text-[28px] font-bold text-white leading-tight mb-2">
            키즈밀 포털
          </h1>
          <p className="text-white/70 text-base mt-2">식단표 확인 및 공지 서비스</p>

          <div className="mt-12 pt-10 border-t border-white/20 space-y-4">
            <p className="text-white text-2xl font-bold leading-snug">&ldquo;새벽 3시의 약속&rdquo;</p>
            <p className="text-white text-2xl font-bold leading-snug">&ldquo;22년의 신뢰&rdquo;</p>
          </div>
        </div>

        <div className="pt-8 border-t border-white/20">
          <div className="flex gap-10">
            {[
              { label: '경력', value: '22년' },
              { label: '냉장차량', value: '18대' },
              { label: '출발 시간', value: '새벽 3시' },
            ].map(item => (
              <div key={item.label}>
                <p className="text-white font-bold text-xl">{item.value}</p>
                <p className="text-white/50 text-xs mt-0.5">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── 오른쪽: 로그인 폼 ── */}
      <div className="w-full lg:w-1/2 flex items-center justify-center bg-white px-6 py-12 min-h-screen">
        <div className="w-full max-w-sm">
          {/* 모바일 전용 로고 */}
          <div className="lg:hidden flex justify-center mb-10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={KIZMEAL_LOGO_PATH} alt="키즈밀 로고" className="h-12 w-auto object-contain" />
          </div>

          <h2 className="text-2xl font-bold text-[#1C2B1E] mb-1">안녕하세요 👋</h2>
          <p className="text-gray-400 text-sm mb-8">로그인</p>

          <form onSubmit={handleLogin} className="space-y-4">
            {/* 이메일 */}
            <div>
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                이메일
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="example@email.com"
                required
                autoComplete="email"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F] focus:border-transparent focus:bg-white transition-all"
              />
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
                <span className="text-xs text-gray-400">아이디 저장</span>
              </label>
            </div>

            {/* 비밀번호 */}
            <div>
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                비밀번호
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="비밀번호를 입력하세요"
                  required
                  autoComplete="current-password"
                  className="w-full px-4 py-3 pr-12 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F] focus:border-transparent focus:bg-white transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'}
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full bg-[#2D6A4F] hover:bg-[#1B4332] disabled:bg-gray-200 disabled:cursor-not-allowed text-white font-semibold py-3.5 rounded-xl transition-colors text-sm flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  로그인 중...
                </>
              ) : '로그인'}
            </button>
          </form>

          <div className="mt-8 space-y-2 text-center">
            <button
              type="button"
              className="text-xs text-gray-400 hover:text-[#2D6A4F] transition-colors block w-full"
              onClick={() => alert('비밀번호 재설정은 관리자에게 문의해주세요.')}
            >
              비밀번호를 잊으셨나요?
            </button>
            <p className="text-xs text-gray-300">계정 문의: 031-388-3501</p>
            <p className="text-xs text-gray-400">초대받은 계정으로만 이용 가능합니다</p>
          </div>
        </div>
      </div>
    </div>
  )
}
