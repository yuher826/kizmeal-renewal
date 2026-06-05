'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import type { Branch } from '@/lib/types'

export default function CustomerProfilePage() {
  const [branch, setBranch] = useState<Branch | null>(null)
  const [contactName, setContactName] = useState('')
  const [loading, setLoading] = useState(true)

  const [showPwForm, setShowPwForm] = useState(false)
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwMsg, setPwMsg] = useState('')
  const [pwSaving, setPwSaving] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: branchRow } = await supabase
        .from('branches')
        .select('*, brands(*)')
        .eq('auth_id', user.id)
        .maybeSingle()

      if (branchRow) {
        setBranch(branchRow as Branch)
        setContactName(branchRow.owner_name || '')
      } else {
        const { data: memberRow } = await supabase
          .from('branch_members')
          .select('name, branches(*, brands(*))')
          .eq('auth_id', user.id)
          .maybeSingle()
        if (memberRow) {
          setBranch(memberRow.branches as unknown as Branch)
          setContactName(memberRow.name || '')
        }
      }
      setLoading(false)
    }
    load()
  }, [])

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    setPwMsg('')
    if (newPw.length < 6) { setPwMsg('비밀번호는 6자 이상이어야 합니다.'); return }
    if (newPw !== confirmPw) { setPwMsg('비밀번호가 일치하지 않습니다.'); return }

    setPwSaving(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: newPw })
    setPwSaving(false)

    if (error) { setPwMsg('변경에 실패했습니다. 다시 시도해주세요.'); return }
    setPwMsg('✅ 비밀번호가 변경되었습니다.')
    setNewPw(''); setConfirmPw('')
    setTimeout(() => { setShowPwForm(false); setPwMsg('') }, 1500)
  }

  return (
    <div className="min-h-screen bg-[#F6FAF6] font-sans">
      <header className="bg-white border-b border-gray-100 px-4 sm:px-6 h-16 hidden sm:flex items-center sticky top-0 z-10">
        <div>
          <div className="flex items-center gap-1 text-xs text-gray-400 mb-0.5">
            <span>{loading ? '소통채널' : (branch?.name || '소통채널')}</span>
            <span>›</span>
            <span className="text-[#2D6A4F] font-medium">마이페이지</span>
          </div>
          <h1 className="font-bold text-[#1C2B1E] text-base">마이페이지</h1>
          <p className="text-gray-400 text-xs">원 정보 및 계정 관리</p>
        </div>
      </header>

      <div className="max-w-xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* 원 정보 */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex items-center gap-4 mb-5">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#2D6A4F] to-[#52B788] flex items-center justify-center text-white font-bold text-2xl font-serif">
              {branch?.name?.[0] || 'K'}
            </div>
            <div>
              <p className="font-bold text-[#1C2B1E] text-lg">{loading ? '—' : branch?.name || '원 정보 없음'}</p>
              {branch?.brands?.name && <p className="text-xs text-gray-400">{branch.brands.name}</p>}
            </div>
          </div>

          <div className="divide-y divide-gray-50">
            {[
              { label: '원 이름', value: branch?.name },
              { label: '담당자명', value: contactName },
              { label: '연락처', value: branch?.phone },
              { label: '이메일', value: branch?.email },
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between py-3">
                <span className="text-sm text-gray-400">{row.label}</span>
                <span className="text-sm font-medium text-[#1C2B1E]">{loading ? '—' : row.value || '—'}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 비밀번호 변경 */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          {!showPwForm ? (
            <button
              type="button"
              onClick={() => setShowPwForm(true)}
              className="w-full bg-white border border-[#2D6A4F] text-[#2D6A4F] hover:bg-[#E8F5E9] font-semibold py-3 rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
            >
              <span>🔒</span> 비밀번호 변경
            </button>
          ) : (
            <form onSubmit={handleChangePassword} className="space-y-3">
              <h3 className="font-bold text-[#1C2B1E] text-sm">비밀번호 변경</h3>
              <input
                type="password"
                value={newPw}
                onChange={e => setNewPw(e.target.value)}
                placeholder="새 비밀번호 (6자 이상)"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]"
              />
              <input
                type="password"
                value={confirmPw}
                onChange={e => setConfirmPw(e.target.value)}
                placeholder="새 비밀번호 확인"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]"
              />
              {pwMsg && <p className="text-xs text-center text-gray-500">{pwMsg}</p>}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setShowPwForm(false); setPwMsg(''); setNewPw(''); setConfirmPw('') }}
                  className="flex-1 bg-gray-100 text-gray-500 font-medium py-3 rounded-xl text-sm hover:bg-gray-200 transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={pwSaving}
                  className="flex-1 bg-[#2D6A4F] hover:bg-[#1B4332] disabled:bg-gray-300 text-white font-semibold py-3 rounded-xl text-sm transition-colors"
                >
                  {pwSaving ? '변경 중...' : '변경하기'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
