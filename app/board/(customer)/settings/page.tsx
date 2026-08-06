'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { ROUTES } from '@/lib/routes'
import type { Branch } from '@/lib/types'
import AccountMismatchNotice from '@/components/board/AccountMismatchNotice'

export default function CustomerSettingsPage() {
  const router = useRouter()
  const [branch, setBranch] = useState<Branch | null>(null)
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [userEmail, setUserEmail] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace(ROUTES.BOARD_LOGIN); return }
      setUserEmail(user.email ?? null)

      try {
        const { data: branchRow } = await supabase
          .from('branches')
          .select('*, brands(*)')
          .eq('auth_id', user.id)
          .maybeSingle()

        // ★branch_members(직원) fallback은 settings/members와 동일 사유로 이번엔 제외
        if (branchRow) {
          setBranch(branchRow as Branch)
          setPhone(branchRow.phone || '')
          setAddress(branchRow.address || '')
        }
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [router])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!branch) return
    setSaving(true)
    const supabase = createClient()
    await supabase
      .from('branches')
      .update({ phone, address })
      .eq('id', branch.id)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = ROUTES.BOARD_LOGIN
  }

  return (
    <div className="min-h-screen bg-[#F6FAF6] font-sans">
      <header className="bg-white border-b border-gray-100 px-4 sm:px-6 py-4 hidden sm:flex items-center gap-3 sticky top-0 z-10">
        <Link href="/board/dashboard" className="text-gray-400 hover:text-gray-600">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5m7-7l-7 7 7 7" />
          </svg>
        </Link>
        <h1 className="font-bold text-[#1C2B1E]">계정 설정</h1>
      </header>

      <div className="px-4 sm:px-6 py-6 space-y-4">
        {!loading && !branch ? (
          <AccountMismatchNotice
            email={userEmail}
            title="원 정보 수정 화면을 이용할 수 없습니다"
            message="이 화면은 원 마스터 계정에서만 이용할 수 있습니다. 마스터 계정이 아니거나 계정 연결에 문제가 있을 수 있으니, 다른 계정으로 로그인하셨다면 로그아웃 후 다시 확인해 주세요."
          />
        ) : (
        <>
        {/* 지점 정보 */}
        <form onSubmit={handleSave} className="bg-white rounded-2xl border border-gray-100 p-6">
          <h2 className="font-bold text-[#1C2B1E] mb-4">지점 정보</h2>
          <div className="space-y-4">
            {[
              { label: '지점명', value: branch?.name || '', disabled: true },
              { label: 'KOS ID', value: branch?.kos_id || '', disabled: true },
              { label: '대표자명', value: branch?.owner_name || '', disabled: true },
              { label: '이메일', value: branch?.email || '', disabled: true },
            ].map(field => (
              <div key={field.label}>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{field.label}</label>
                <input
                  type="text"
                  value={field.value}
                  disabled={field.disabled}
                  readOnly
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm disabled:bg-gray-50 disabled:text-gray-400 focus:outline-none"
                />
              </div>
            ))}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">연락처</label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="010-0000-0000"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">주소</label>
              <input
                type="text"
                value={address}
                onChange={e => setAddress(e.target.value)}
                placeholder="주소를 입력하세요"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="mt-5 bg-[#2D6A4F] hover:bg-[#1B4332] disabled:bg-gray-300 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors text-sm"
          >
            {saving ? '저장 중...' : saved ? '✓ 저장 완료' : '저장'}
          </button>
        </form>

        {/* 직원 계정 관리 */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-bold text-[#1C2B1E]">직원 계정 관리</h2>
              <p className="text-xs text-gray-400 mt-0.5">직원을 초대하거나 권한을 관리합니다</p>
            </div>
            <Link href="/board/settings/members" className="text-sm text-[#2D6A4F] font-medium hover:underline">
              관리하기
            </Link>
          </div>
        </div>

        {/* 로그아웃 */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h2 className="font-bold text-[#1C2B1E] mb-3">계정</h2>
          <button
            onClick={handleLogout}
            className="text-sm text-red-500 hover:text-red-700 font-medium transition-colors"
          >
            로그아웃
          </button>
        </div>
        </>
        )}
      </div>
    </div>
  )
}
