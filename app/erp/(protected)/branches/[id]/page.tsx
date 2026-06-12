'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2, AlertTriangle, Clock } from 'lucide-react'
import BranchProfileForm from '@/components/erp/BranchProfileForm'
import type { BranchProfileDetail, RecentMenu } from '@/types/branch-profile'

// ── 토스트 ──────────────────────────────────────────────────────────
function Toast({ msg, type }: { msg: string; type: 'success' | 'error' }) {
  return (
    <div className={`fixed top-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg text-sm font-medium transition-all ${
      type === 'success'
        ? 'bg-emerald-600 text-white'
        : 'bg-red-600 text-white'
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
                    <a
                      href={m.pptx_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded px-2 py-0.5 hover:bg-blue-100 transition-colors"
                    >
                      PPTX
                    </a>
                  )}
                  {m.pdf_url && (
                    <a
                      href={m.pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs bg-red-50 text-red-700 border border-red-200 rounded px-2 py-0.5 hover:bg-red-100 transition-colors"
                    >
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

// ── 메인 ────────────────────────────────────────────────────────────
export default function BranchProfileDetailPage() {
  const params = useParams<{ id: string }>()

  const [profile, setProfile] = useState<BranchProfileDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  useEffect(() => {
    fetch(`/api/branch-profiles/${params.id}`)
      .then(async r => {
        if (r.status === 404) { setNotFound(true); return }
        const data = await r.json()
        setProfile(data)
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [params.id])

  function showToast(msg: string, type: 'success' | 'error') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  async function handleSave(data: Partial<BranchProfileDetail>) {
    setIsSaving(true)
    try {
      const res = await fetch(`/api/branch-profiles/${params.id}`, {
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
        <div className="max-w-3xl mx-auto text-center py-20">
          <p className="text-slate-500 mb-4">해당 원 프로파일을 찾을 수 없습니다.</p>
          <Link href="/erp/branches" className="text-emerald-600 hover:underline text-sm">
            ← 목록으로 돌아가기
          </Link>
        </div>
      </main>
    )
  }

  const titleName = profile.display_name ?? profile.branch_full_name ?? profile.short_code ?? '-'

  return (
    <main className="min-h-screen bg-[#F6FAF6] px-4 sm:px-6 py-6 sm:py-8">
      {toast && <Toast msg={toast.msg} type={toast.type} />}

      <div className="max-w-3xl mx-auto">
        {/* 헤더 */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/erp/branches"
            className="text-slate-400 hover:text-slate-700 transition-colors"
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
      </div>
    </main>
  )
}
