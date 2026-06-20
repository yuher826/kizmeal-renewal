'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase'

interface Props {
  email: string
}

export default function PasswordChangeCard({ email }: Props) {
  const router = useRouter()
  const [currentPassword, setCurrentPassword]   = useState('')
  const [newPassword, setNewPassword]           = useState('')
  const [confirmPassword, setConfirmPassword]   = useState('')
  const [showCurrent, setShowCurrent]           = useState(false)
  const [showNew, setShowNew]                   = useState(false)
  const [showConfirm, setShowConfirm]           = useState(false)
  const [loading, setLoading]                   = useState(false)
  const [errors, setErrors] = useState<{
    current?: string
    new?: string
    confirm?: string
  }>({})

  function validate() {
    const errs: typeof errors = {}
    if (!currentPassword) errs.current = '현재 비밀번호를 입력해주세요'
    if (newPassword.length < 8) errs.new = '새 비밀번호는 8자 이상이어야 합니다'
    if (newPassword !== confirmPassword) errs.confirm = '새 비밀번호가 일치하지 않습니다'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit() {
    if (!validate()) return
    setLoading(true)
    setErrors({})

    const supabase = createClient()

    // 1. 현재 비밀번호 검증
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password: currentPassword,
    })
    if (signInError) {
      setErrors({ current: '현재 비밀번호가 올바르지 않습니다' })
      setLoading(false)
      return
    }

    // 2. 비밀번호 변경
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
    if (updateError) {
      setErrors({ new: '비밀번호 변경에 실패했습니다. 다시 시도해주세요' })
      setLoading(false)
      return
    }

    // 3. 로그아웃 → 로그인 페이지 배너로 성공 안내
    await supabase.auth.signOut()
    router.push('/erp/login?message=password_changed')
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <h2 className="text-base font-semibold text-slate-800 mb-4">비밀번호 변경</h2>

      <div className="space-y-4">
        {/* 현재 비밀번호 */}
        <div>
          <label className="text-xs font-medium text-slate-600">현재 비밀번호</label>
          <div className="relative mt-1">
            <input
              type={showCurrent ? 'text' : 'password'}
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              placeholder="현재 비밀번호"
              className={`w-full border rounded-lg px-4 py-2.5 pr-10 text-sm focus:outline-none focus:ring-1 ${
                errors.current
                  ? 'border-red-400 focus:border-red-400 focus:ring-red-400'
                  : 'border-slate-300 focus:border-emerald-500 focus:ring-emerald-500'
              }`}
            />
            <button
              type="button"
              onClick={() => setShowCurrent(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
            >
              {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.current && (
            <p className="text-xs text-red-500 mt-1">{errors.current}</p>
          )}
        </div>

        {/* 새 비밀번호 */}
        <div>
          <label className="text-xs font-medium text-slate-600">새 비밀번호</label>
          <div className="relative mt-1">
            <input
              type={showNew ? 'text' : 'password'}
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="8자 이상"
              className={`w-full border rounded-lg px-4 py-2.5 pr-10 text-sm focus:outline-none focus:ring-1 ${
                errors.new
                  ? 'border-red-400 focus:border-red-400 focus:ring-red-400'
                  : 'border-slate-300 focus:border-emerald-500 focus:ring-emerald-500'
              }`}
            />
            <button
              type="button"
              onClick={() => setShowNew(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
            >
              {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.new && (
            <p className="text-xs text-red-500 mt-1">{errors.new}</p>
          )}
        </div>

        {/* 새 비밀번호 확인 */}
        <div>
          <label className="text-xs font-medium text-slate-600">새 비밀번호 확인</label>
          <div className="relative mt-1">
            <input
              type={showConfirm ? 'text' : 'password'}
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="새 비밀번호 재입력"
              className={`w-full border rounded-lg px-4 py-2.5 pr-10 text-sm focus:outline-none focus:ring-1 ${
                errors.confirm
                  ? 'border-red-400 focus:border-red-400 focus:ring-red-400'
                  : 'border-slate-300 focus:border-emerald-500 focus:ring-emerald-500'
              }`}
            />
            <button
              type="button"
              onClick={() => setShowConfirm(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
            >
              {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.confirm && (
            <p className="text-xs text-red-500 mt-1">{errors.confirm}</p>
          )}
        </div>
      </div>

      <p className="text-xs text-slate-400 mt-5">
        ※ 변경 후 자동으로 로그아웃되며 새 비밀번호로 다시 로그인해야 합니다.
      </p>

      <button
        onClick={handleSubmit}
        disabled={loading}
        className="mt-4 w-full py-2.5 rounded-lg font-medium text-sm bg-emerald-600 hover:bg-emerald-700 text-white transition-colors duration-150 disabled:opacity-70 flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            변경 중...
          </>
        ) : (
          '변경하기'
        )}
      </button>
    </div>
  )
}
