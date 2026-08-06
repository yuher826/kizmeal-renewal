'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { ROUTES } from '@/lib/routes'
import type { BranchMember } from '@/lib/types'
import AccountMismatchNotice from '@/components/board/AccountMismatchNotice'

export default function CustomerMembersPage() {
  const router = useRouter()
  const [members, setMembers] = useState<BranchMember[]>([])
  const [branchId, setBranchId] = useState<string | null>(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteMsg, setInviteMsg] = useState('')
  const [loading, setLoading] = useState(true)
  const [userEmail, setUserEmail] = useState<string | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.replace(ROUTES.BOARD_LOGIN); return }
    setUserEmail(user.email ?? null)

    try {
      const { data: branchRow } = await supabase
        .from('branches')
        .select('id')
        .eq('auth_id', user.id)
        .maybeSingle()

      // ★branch_members(직원) fallback은 의도적으로 추가하지 않음 —
      // 이 화면(직원 초대/해제)이 마스터 전용인지, 직원도 접근 가능해야 하는지는
      // 비즈니스 판단이 필요해 이번 범위에서 제외(별건으로 결정 필요).
      if (!branchRow) return
      setBranchId(branchRow.id)

      const { data: memberRows } = await supabase
        .from('branch_members')
        .select('*')
        .eq('branch_id', branchRow.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (memberRows) setMembers(memberRows as BranchMember[])
    } finally {
      setLoading(false)
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!inviteEmail.trim() || !branchId) return
    setInviting(true)
    setInviteMsg('')

    const supabase = createClient()
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    const { error } = await supabase.from('branch_invitations').insert({
      branch_id: branchId,
      email: inviteEmail.trim(),
      token: crypto.randomUUID(),
      role: 'staff',
      created_by: branchId,
      expires_at: expiresAt.toISOString(),
    })

    if (error) {
      setInviteMsg(`오류: ${error.message}`)
    } else {
      setInviteMsg('초대 이메일이 발송되었습니다. (7일 후 만료)')
      setInviteEmail('')
    }
    setInviting(false)
  }

  async function deactivateMember(memberId: string) {
    const supabase = createClient()
    await supabase
      .from('branch_members')
      .update({ is_active: false })
      .eq('id', memberId)
    await load()
  }

  return (
    <div className="min-h-screen bg-[#F6FAF6] font-sans">
      <header className="bg-white border-b border-gray-100 px-4 sm:px-6 py-4 hidden sm:flex items-center gap-3 sticky top-0 z-10">
        <Link href="/board/settings" className="text-gray-400 hover:text-gray-600">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5m7-7l-7 7 7 7" />
          </svg>
        </Link>
        <h1 className="font-bold text-[#1C2B1E]">직원 계정 관리</h1>
      </header>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        {!loading && !branchId ? (
          <AccountMismatchNotice
            email={userEmail}
            title="직원 관리 화면을 이용할 수 없습니다"
            message="이 화면은 원 마스터 계정에서만 이용할 수 있습니다. 마스터 계정이 아니거나 계정 연결에 문제가 있을 수 있으니, 다른 계정으로 로그인하셨다면 로그아웃 후 다시 확인해 주세요."
          />
        ) : (
        <>
        {/* 초대 폼 */}
        <form onSubmit={handleInvite} className="bg-white rounded-2xl border border-gray-100 p-6">
          <h2 className="font-bold text-[#1C2B1E] mb-4">직원 초대</h2>
          <div className="flex gap-3">
            <input
              type="email"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              placeholder="초대할 직원 이메일"
              className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]"
            />
            <button
              type="submit"
              disabled={!inviteEmail.trim() || inviting}
              className="bg-[#2D6A4F] hover:bg-[#1B4332] disabled:bg-gray-300 text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition-colors"
            >
              {inviting ? '전송 중...' : '초대'}
            </button>
          </div>
          {inviteMsg && (
            <p className={`text-sm mt-2 ${inviteMsg.startsWith('오류') ? 'text-red-600' : 'text-[#2D6A4F]'}`}>
              {inviteMsg}
            </p>
          )}
          <p className="text-xs text-gray-400 mt-2">초대 링크는 7일간 유효합니다.</p>
        </form>

        {/* 직원 목록 */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-bold text-[#1C2B1E]">소속 직원 ({members.length}명)</h2>
          </div>
          {loading ? (
            <div className="px-6 py-8 text-center text-gray-400 text-sm">로딩 중...</div>
          ) : members.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-400 text-sm">소속 직원이 없습니다.</div>
          ) : (
            <ul className="divide-y divide-gray-50">
              {members.map(member => (
                <li key={member.id} className="flex items-center gap-4 px-6 py-4">
                  <div className="w-9 h-9 rounded-full bg-[#E8F5E9] flex items-center justify-center text-sm font-bold text-[#2D6A4F] flex-shrink-0">
                    {member.name?.[0] || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#1C2B1E] truncate">{member.name}</p>
                    <p className="text-xs text-gray-400 truncate">{member.email}</p>
                  </div>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full flex-shrink-0">
                    {member.role}
                  </span>
                  <button
                    type="button"
                    onClick={() => deactivateMember(member.id)}
                    className="text-xs text-red-400 hover:text-red-600 transition-colors flex-shrink-0"
                  >
                    해제
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        </>
        )}
      </div>
    </div>
  )
}
