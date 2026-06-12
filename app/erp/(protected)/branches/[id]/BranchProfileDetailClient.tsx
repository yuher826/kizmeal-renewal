'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, CheckCircle2, AlertTriangle, Clock, KeyRound, Loader2,
} from 'lucide-react'
import BranchProfileForm from '@/components/erp/BranchProfileForm'
import ContractStatusButton from '@/components/erp/ContractStatusButton'
import type { BranchProfileDetail, RecentMenu } from '@/types/branch-profile'
import type { BranchAccountInfo } from '@/types/erp'

// ── 토스트 ──────────────────────────────────────────────────────────
function Toast({ msg, type }: { msg: string; type: 'success' | 'error' }) {
  return (
    <div className={`fixed top-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg text-sm font-medium transition-all ${
      type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
    }`}>
      {type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
      {msg}
    </div>
  )
}

// ── 날짜 포맷 ────────────────────────────────────────────────────────
function fmtDate(s: string | null) {
  if (!s) return '-'
  const d = new Date(s)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

// ── 최근 메뉴 테이블 ─────────────────────────────────────────────────
function RecentMenuTable({ menus }: { menus: RecentMenu[] }) {
  if (menus.length === 0) {
    return <p className="text-sm text-slate-400">배포 이력이 없습니다.</p>
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 text-slate-500 text-xs">
            <th className="text-left px-4 py-3 font-medium">년도</th>
            <th className="text-left px-4 py-3 font-medium">월</th>
            <th className="text-left px-4 py-3 font-medium">주차</th>
            <th className="text-left px-4 py-3 font-medium">파일</th>
            <th className="text-left px-4 py-3 font-medium">생성일</th>
          </tr>
        </thead>
        <tbody>
          {menus.map((m, i) => (
            <tr key={i} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
              <td className="px-4 py-3 text-slate-700">{m.year}</td>
              <td className="px-4 py-3 text-slate-700">{m.month}월</td>
              <td className="px-4 py-3 text-slate-500">
                {m.week_num != null ? `${m.week_num}주` : '-'}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  {m.pptx_url && (
                    <a href={m.pptx_url} target="_blank" rel="noopener noreferrer"
                      className="text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded px-2 py-0.5 hover:bg-blue-100 transition-colors">
                      PPTX
                    </a>
                  )}
                  {m.pdf_url && (
                    <a href={m.pdf_url} target="_blank" rel="noopener noreferrer"
                      className="text-xs bg-red-50 text-red-700 border border-red-200 rounded px-2 py-0.5 hover:bg-red-100 transition-colors">
                      PDF
                    </a>
                  )}
                  {!m.pptx_url && !m.pdf_url && (
                    <span className="text-slate-400 text-xs">파일 없음</span>
                  )}
                </div>
              </td>
              <td className="px-4 py-3 text-slate-400 text-xs">{fmtDate(m.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── 담당자 계정 섹션 ─────────────────────────────────────────────────
const STATUS_BADGE: Record<string, { cls: string; label: string }> = {
  pending:  { cls: 'bg-amber-100 text-amber-700',    label: '초대 미수락' },
  active:   { cls: 'bg-emerald-100 text-emerald-700', label: '활성' },
  inactive: { cls: 'bg-slate-100 text-slate-500',    label: '비활성' },
}

function BranchAccountSection({
  profileId,
  showToast,
}: {
  profileId: string
  showToast: (msg: string, type: 'success' | 'error') => void
}) {
  const [info, setInfo] = useState<BranchAccountInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteKosId, setInviteKosId] = useState('')
  const [isInviting, setIsInviting] = useState(false)
  const [emailEditMode, setEmailEditMode] = useState(false)
  const [pendingNewEmail, setPendingNewEmail] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [confirmDeactivate, setConfirmDeactivate] = useState(false)

  function fetchAccount() {
    setLoading(true)
    fetch(`/api/branch-profiles/${profileId}/account`)
      .then(r => r.json())
      .then(data => setInfo(data))
      .catch(() => setInfo(null))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchAccount() }, [profileId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleInvite() {
    if (!inviteEmail.trim()) return
    setIsInviting(true)
    try {
      const res = await fetch(`/api/branch-profiles/${profileId}/account`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim(), kos_id: inviteKosId.trim() || undefined }),
      })
      if (!res.ok) {
        const err = await res.json()
        showToast(err.error ?? '초대 발송에 실패했습니다', 'error')
        return
      }
      showToast('초대 이메일이 발송됐습니다', 'success')
      setInviteEmail('')
      setInviteKosId('')
      fetchAccount()
    } catch {
      showToast('서버 오류가 발생했습니다', 'error')
    } finally {
      setIsInviting(false)
    }
  }

  async function handleResend() {
    setActionLoading('resend')
    try {
      const res = await fetch(`/api/branch-profiles/${profileId}/account/resend`, { method: 'POST' })
      if (!res.ok) {
        const err = await res.json()
        showToast(err.error ?? '재발송에 실패했습니다', 'error')
        return
      }
      showToast('초대 이메일이 재발송됐습니다', 'success')
    } catch {
      showToast('서버 오류가 발생했습니다', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  async function handlePasswordReset() {
    setActionLoading('reset')
    try {
      const res = await fetch(`/api/branch-profiles/${profileId}/account/reset`, { method: 'POST' })
      if (!res.ok) {
        const err = await res.json()
        showToast(err.error ?? '초기화 이메일 발송에 실패했습니다', 'error')
        return
      }
      const data = await res.json()
      showToast(`${data.email}로 초기화 이메일 발송됐습니다`, 'success')
    } catch {
      showToast('서버 오류가 발생했습니다', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleEmailChange() {
    if (!pendingNewEmail.trim()) return
    setActionLoading('email')
    try {
      const res = await fetch(`/api/branch-profiles/${profileId}/account/email`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newEmail: pendingNewEmail.trim() }),
      })
      if (!res.ok) {
        const err = await res.json()
        showToast(err.error ?? '이메일 변경에 실패했습니다', 'error')
        return
      }
      showToast('변경 후 새 이메일로 확인 링크가 발송됩니다', 'success')
      setEmailEditMode(false)
      fetchAccount()
    } catch {
      showToast('서버 오류가 발생했습니다', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleToggleStatus(action: 'activate' | 'deactivate') {
    setActionLoading(action)
    setConfirmDeactivate(false)
    try {
      const res = await fetch(`/api/branch-profiles/${profileId}/account/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) {
        const err = await res.json()
        showToast(err.error ?? '처리에 실패했습니다', 'error')
        return
      }
      showToast(action === 'activate' ? '계정이 재활성화됐습니다' : '계정이 비활성화됐습니다', 'success')
      fetchAccount()
    } catch {
      showToast('서버 오류가 발생했습니다', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  function fmtLastLogin(iso: string | null): { days: number; isOld: boolean } | null {
    if (!iso) return null
    const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
    return { days, isOld: days >= 30 }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 mt-4">
      {/* 헤더 */}
      <div className="flex items-center gap-2 mb-4">
        <KeyRound size={18} className="text-emerald-600" />
        <h2 className="text-base font-semibold text-slate-800">담당자 계정</h2>
      </div>

      {/* 로딩 스켈레톤 */}
      {loading ? (
        <div className="space-y-2">
          <div className="animate-pulse bg-slate-100 rounded h-4 w-1/2" />
          <div className="animate-pulse bg-slate-100 rounded h-4 w-1/3" />
        </div>
      ) : !info?.exists ? (
        /* ── 계정 없음 ── */
        <div className="bg-slate-50 rounded-lg p-4">
          <p className="text-sm text-slate-400 text-center mb-3">등록된 포털 계정이 없습니다</p>
          <input
            type="email"
            value={inviteEmail}
            onChange={e => setInviteEmail(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            placeholder="이메일 (KOS 아이디와 동일 권장)"
          />
          <input
            type="text"
            value={inviteKosId}
            onChange={e => setInviteKosId(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm text-slate-400 mt-2 focus:outline-none focus:border-emerald-500"
            placeholder="KOS ID (선택 — 향후 자동 연동용)"
          />
          <p className="text-xs text-slate-400 mt-1">
            💡 KOS 마스터 아이디와 동일한 이메일 사용을 권장합니다
          </p>
          <button
            onClick={handleInvite}
            disabled={isInviting || !inviteEmail.trim()}
            className="mt-3 w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {isInviting ? <><Loader2 size={15} className="animate-spin" />발송 중...</> : '초대 이메일 발송'}
          </button>
        </div>
      ) : (
        /* ── 계정 있음 ── */
        <>
          {/* 이메일 + 상태 배지 */}
          <div className="flex items-center gap-2 flex-wrap">
            {emailEditMode ? (
              <div className="flex-1 flex items-center gap-2 flex-wrap">
                <input
                  type="email"
                  value={pendingNewEmail}
                  onChange={e => setPendingNewEmail(e.target.value)}
                  className="flex-1 min-w-0 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                  placeholder="새 이메일"
                />
                <button
                  onClick={handleEmailChange}
                  disabled={actionLoading === 'email'}
                  className="bg-emerald-600 text-white text-sm px-3 py-2 rounded-lg hover:bg-emerald-700 disabled:opacity-60 flex items-center gap-1"
                >
                  {actionLoading === 'email' ? <Loader2 size={13} className="animate-spin" /> : null}
                  저장
                </button>
                <button
                  onClick={() => setEmailEditMode(false)}
                  className="text-slate-400 text-sm px-3 py-2 rounded-lg hover:bg-slate-50 border border-slate-200"
                >
                  취소
                </button>
              </div>
            ) : (
              <span className="text-sm font-medium text-slate-800">{info.email}</span>
            )}
            {info.status && (
              <span className={`text-xs font-medium rounded px-2 py-0.5 ${STATUS_BADGE[info.status]?.cls ?? ''}`}>
                {STATUS_BADGE[info.status]?.label}
              </span>
            )}
          </div>

          {/* 마지막 로그인 */}
          {info.status === 'pending' ? (
            <p className="text-xs text-slate-400 mt-1">아직 접속 기록 없음</p>
          ) : (() => {
            const r = fmtLastLogin(info.last_login_at)
            if (!r) return null
            return (
              <p className={`text-xs mt-1 ${r.isOld ? 'text-amber-500' : 'text-slate-400'}`}>
                {r.isOld && '⚠️ '}마지막 접속: {r.days}일 전
              </p>
            )
          })()}

          {/* KOS ID */}
          {info.kos_id && (
            <p className="text-xs text-slate-400 mt-1">KOS ID: {info.kos_id}</p>
          )}

          {/* 버튼 영역 */}
          <div className="flex flex-wrap gap-2 mt-3">
            {info.status === 'pending' && (
              <button
                onClick={handleResend}
                disabled={actionLoading === 'resend'}
                className="border border-amber-200 text-amber-600 hover:bg-amber-50 text-sm rounded-lg px-3 py-2 transition-colors disabled:opacity-60 flex items-center gap-1.5"
              >
                {actionLoading === 'resend' && <Loader2 size={13} className="animate-spin" />}
                초대 재발송
              </button>
            )}

            {info.status === 'active' && (
              <>
                <button
                  onClick={handlePasswordReset}
                  disabled={actionLoading === 'reset'}
                  className="border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm rounded-lg px-3 py-2 transition-colors disabled:opacity-60 flex items-center gap-1.5"
                >
                  {actionLoading === 'reset' && <Loader2 size={13} className="animate-spin" />}
                  비밀번호 초기화
                </button>
                <button
                  onClick={() => { setEmailEditMode(true); setPendingNewEmail(info.email ?? '') }}
                  disabled={emailEditMode}
                  className="border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm rounded-lg px-3 py-2 transition-colors disabled:opacity-60"
                >
                  이메일 변경
                </button>
                <button
                  onClick={() => setConfirmDeactivate(true)}
                  disabled={!!actionLoading}
                  className="border border-red-200 text-red-500 hover:bg-red-50 text-sm rounded-lg px-3 py-2 transition-colors disabled:opacity-60"
                >
                  계정 비활성화
                </button>
              </>
            )}

            {info.status === 'inactive' && (
              <button
                onClick={() => handleToggleStatus('activate')}
                disabled={actionLoading === 'activate'}
                className="border border-emerald-200 text-emerald-600 hover:bg-emerald-50 text-sm rounded-lg px-3 py-2 transition-colors disabled:opacity-60 flex items-center gap-1.5"
              >
                {actionLoading === 'activate' && <Loader2 size={13} className="animate-spin" />}
                계정 재활성화
              </button>
            )}
          </div>

          {/* 비활성화 확인 모달 */}
          {confirmDeactivate && (
            <div
              className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
              onClick={() => setConfirmDeactivate(false)}
            >
              <div
                className="bg-white rounded-xl p-6 max-w-sm w-full shadow-xl"
                onClick={e => e.stopPropagation()}
              >
                <h3 className="text-base font-semibold text-slate-800 mb-2">계정 비활성화</h3>
                <p className="text-sm text-slate-500 mb-4">
                  계정을 비활성화하면 포털 접근이 차단됩니다. 계속하시겠습니까?
                </p>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setConfirmDeactivate(false)}
                    className="border border-slate-200 text-slate-600 text-sm px-4 py-2 rounded-lg hover:bg-slate-50"
                  >
                    취소
                  </button>
                  <button
                    onClick={() => handleToggleStatus('deactivate')}
                    disabled={actionLoading === 'deactivate'}
                    className="bg-red-500 text-white text-sm px-4 py-2 rounded-lg hover:bg-red-600 disabled:opacity-60"
                  >
                    비활성화
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* KOS 연동 예정 */}
      <div className="mt-4 pt-4 border-t border-slate-100">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-400">🔗 KOS 연동</span>
          <span className="bg-slate-100 text-slate-400 text-xs rounded px-2 py-0.5 ml-2">준비중</span>
        </div>
        <p className="text-xs text-slate-300 mt-1">
          KOS API 연동 시 KOS 계정으로 자동 로그인 가능합니다
        </p>
      </div>
    </div>
  )
}

// ── 메인 ────────────────────────────────────────────────────────────
interface Props {
  id: string
  isSuperAdmin: boolean
}

export default function BranchProfileDetailClient({ id, isSuperAdmin }: Props) {
  const [profile, setProfile] = useState<BranchProfileDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  useEffect(() => {
    fetch(`/api/branch-profiles/${id}`)
      .then(async r => {
        if (r.status === 404) { setNotFound(true); return }
        const data = await r.json()
        setProfile(data)
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [id])

  function showToast(msg: string, type: 'success' | 'error') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  async function handleSave(data: Partial<BranchProfileDetail>) {
    setIsSaving(true)
    try {
      const res = await fetch(`/api/branch-profiles/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (res.status === 409) {
        showToast('이미 사용 중인 약칭입니다', 'error')
        return
      }
      if (!res.ok) {
        const err = await res.json()
        showToast(err.error ?? '저장에 실패했습니다', 'error')
        return
      }
      const updated = await res.json()
      setProfile(prev => prev ? { ...prev, ...updated, recent_menus: prev.recent_menus } : prev)
      showToast('저장되었습니다', 'success')
    } catch {
      showToast('서버 오류가 발생했습니다', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#F6FAF6] px-4 sm:px-6 py-6 sm:py-8 flex items-center justify-center">
        <div className="flex items-center gap-2 text-slate-500">
          <Clock size={18} className="animate-pulse" />
          <span className="text-sm">불러오는 중...</span>
        </div>
      </main>
    )
  }

  if (notFound || !profile) {
    return (
      <main className="min-h-screen bg-[#F6FAF6] px-4 sm:px-6 py-6 sm:py-8">
        <div className="text-center py-20">
          <p className="text-slate-500 mb-4">해당 원 프로파일을 찾을 수 없습니다.</p>
          <Link href="/erp/branches" className="text-emerald-600 hover:underline text-sm">
            ← 목록으로 돌아가기
          </Link>
        </div>
      </main>
    )
  }

  const titleName = profile.display_name ?? profile.branch_full_name ?? profile.short_code ?? '-'
  const contractStatus = (profile.contract_status === 'active' || profile.contract_status === 'inactive')
    ? profile.contract_status
    : 'active'

  return (
    <main className="min-h-screen bg-[#F6FAF6] px-4 sm:px-6 py-6 sm:py-8">
      {toast && <Toast msg={toast.msg} type={toast.type} />}

      <div>
        {/* 헤더 */}
        <div className="flex items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3 flex-wrap min-w-0">
            <Link
              href="/erp/branches"
              className="text-slate-400 hover:text-slate-700 transition-colors flex-shrink-0"
              aria-label="목록으로"
            >
              <ArrowLeft size={20} />
            </Link>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-bold text-slate-900">{titleName}</h1>
              {profile.contract_status && (
                <span className={`text-xs font-medium rounded px-2 py-0.5 ${
                  profile.contract_status === 'active'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-slate-100 text-slate-500'
                }`}>
                  {profile.contract_status === 'active' ? '계약중' : '만료'}
                </span>
              )}
              {profile.diet_type && (
                <span className="text-xs font-medium rounded px-2 py-0.5 bg-blue-100 text-blue-700">
                  {profile.diet_type === 'ck' ? 'CK직영' : '위탁'}
                </span>
              )}
              {!profile.is_profile_complete && (
                <span className="text-xs font-medium rounded px-2 py-0.5 bg-amber-100 text-amber-700 flex items-center gap-1">
                  <AlertTriangle size={11} />
                  PPTX 미설정
                </span>
              )}
            </div>
          </div>

          {/* 계약 종료/재활성화 버튼 (super_admin만) */}
          <ContractStatusButton
            branchId={id}
            branchName={profile.branch_full_name ?? profile.display_name ?? titleName}
            currentStatus={contractStatus}
            isSuperAdmin={isSuperAdmin}
          />
        </div>

        {/* 폼 */}
        <BranchProfileForm
          initialData={profile}
          onSave={handleSave}
          isSaving={isSaving}
          isNew={false}
        />

        {/* 식단 배포 현황 */}
        <div className="bg-white border border-slate-200 rounded-xl mt-6 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="text-base font-semibold text-slate-800">식단 배포 현황</h2>
            <p className="text-xs text-slate-400 mt-0.5">최근 12건</p>
          </div>
          <div className="px-0 py-2">
            <RecentMenuTable menus={profile.recent_menus} />
          </div>
        </div>

        {/* 담당자 계정 */}
        <BranchAccountSection profileId={id} showToast={showToast} />
      </div>
    </main>
  )
}
