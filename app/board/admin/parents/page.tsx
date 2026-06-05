'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import type { Parent, Child } from '@/lib/parent-auth'

interface ParentWithChildren extends Parent {
  children: Child[]
}

export default function AdminParentsPage() {
  const [parents, setParents] = useState<ParentWithChildren[]>([])
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending')
  const [loading, setLoading] = useState(true)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectTarget, setRejectTarget] = useState<string | null>(null)
  const [toast, setToast] = useState('')

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3500)
  }

  async function getToken(): Promise<string | null> {
    const supabase = createClient()
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token ?? null
  }

  useEffect(() => { load() }, [])

  async function load() {
    const supabase = createClient()
    const { data: parentRows } = await supabase
      .from('parents')
      .select('*')
      .order('created_at', { ascending: false })

    if (!parentRows) { setLoading(false); return }

    const { data: childRows } = await supabase
      .from('children')
      .select('*, branches(id, name)')

    const result = parentRows.map(p => ({
      ...p,
      children: (childRows || []).filter(c => c.parent_id === p.id) as unknown as Child[],
    })) as ParentWithChildren[]

    setParents(result)
    setLoading(false)
  }

  async function approve(parentId: string) {
    const supabase = createClient()
    await supabase.from('parents').update({
      status: 'approved',
      approved_at: new Date().toISOString(),
    }).eq('id', parentId)

    setParents(prev => prev.map(p =>
      p.id === parentId ? { ...p, status: 'approved' as const } : p
    ))

    const parent = parents.find(p => p.id === parentId)
    if (parent) {
      const token = await getToken()
      const firstChild = parent.children[0]
      const res = await fetch('/api/send-approval-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          type: 'approved',
          parentEmail: parent.email,
          parentName: parent.name,
          childName: firstChild?.name_ko ?? '',
        }),
      })
      if (res.ok) {
        showToast('승인 완료! 이메일 발송됐습니다 ✉️')
      } else {
        showToast('승인 완료, 이메일 발송 실패')
      }
    }
  }

  async function reject(parentId: string) {
    const supabase = createClient()
    await supabase.from('parents').update({
      status: 'rejected',
      rejected_reason: rejectReason.trim() || null,
    }).eq('id', parentId)

    const parent = parents.find(p => p.id === parentId)
    setParents(prev => prev.map(p =>
      p.id === parentId ? { ...p, status: 'rejected' as const, rejected_reason: rejectReason } : p
    ))
    setRejectTarget(null)
    setRejectReason('')

    if (parent) {
      const token = await getToken()
      const res = await fetch('/api/send-approval-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          type: 'rejected',
          parentEmail: parent.email,
          parentName: parent.name,
          childName: parent.children[0]?.name_ko ?? '',
          reason: rejectReason.trim() || undefined,
        }),
      })
      if (res.ok) {
        showToast('거절 처리 완료, 이메일 발송됐습니다 ✉️')
      } else {
        showToast('거절 완료, 이메일 발송 실패')
      }
    }
  }

  const filtered = filter === 'all' ? parents : parents.filter(p => p.status === filter)

  const counts = {
    pending: parents.filter(p => p.status === 'pending').length,
    approved: parents.filter(p => p.status === 'approved').length,
    rejected: parents.filter(p => p.status === 'rejected').length,
  }

  const STATUS_COLORS: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-700',
  }
  const STATUS_LABELS: Record<string, string> = {
    pending: '대기중',
    approved: '승인됨',
    rejected: '거절됨',
  }

  return (
    <div className="min-h-screen bg-[#F6FAF6]">
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#1C2B1E] text-white text-sm font-medium px-5 py-3 rounded-2xl shadow-xl animate-fade-in whitespace-nowrap">
          {toast}
        </div>
      )}
      <header className="bg-white border-b border-gray-100 px-4 sm:px-6 py-4 hidden sm:flex items-center gap-3 sticky top-0 z-10">
        <div>
          <div className="flex items-center gap-1 text-xs text-gray-400 mb-0.5">
            <Link href="/board/admin" className="hover:text-[#2D6A4F] transition-colors">소통채널</Link>
            <span>›</span>
            <span>홈페이지&포털</span>
            <span>›</span>
            <span className="text-[#2D6A4F] font-medium">학부모 승인</span>
          </div>
          <div className="flex items-center gap-2">
            <h1 className="font-bold text-[#1C2B1E]">학부모 승인</h1>
            {counts.pending > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {counts.pending}
              </span>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* Filter tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {([
            { key: 'pending', label: `대기중 (${counts.pending})` },
            { key: 'approved', label: `승인됨 (${counts.approved})` },
            { key: 'rejected', label: `거절됨 (${counts.rejected})` },
            { key: 'all', label: '전체' },
          ] as const).map(tab => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFilter(tab.key)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                filter === tab.key
                  ? 'bg-[#2D6A4F] text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-[#2D6A4F]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="py-8 text-center text-sm text-gray-400">로딩 중...</div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400">해당 항목이 없습니다.</div>
          ) : (
            <ul className="divide-y divide-gray-50">
              {filtered.map(parent => (
                <li key={parent.id} className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-[#1C2B1E]">{parent.name}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[parent.status]}`}>
                          {STATUS_LABELS[parent.status]}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400">{parent.email}</p>
                      {parent.phone && <p className="text-xs text-gray-400">{parent.phone}</p>}
                      {parent.children.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {parent.children.map(child => (
                            <span key={child.id} className="text-xs bg-[#E8F5E9] text-[#2D6A4F] px-2 py-0.5 rounded-full">
                              {child.name_ko}
                              {child.branches && ` · ${(child.branches as unknown as { name: string }).name}`}
                            </span>
                          ))}
                        </div>
                      )}
                      {parent.rejected_reason && (
                        <p className="text-xs text-red-500 mt-1">거절 사유: {parent.rejected_reason}</p>
                      )}
                      <p className="text-xs text-gray-300 mt-1">
                        신청일: {new Date(parent.created_at).toLocaleDateString('ko-KR')}
                      </p>
                    </div>

                    {parent.status === 'pending' && (
                      <div className="flex flex-col gap-2 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => approve(parent.id)}
                          className="bg-[#2D6A4F] hover:bg-[#1B4332] text-white font-semibold px-4 py-1.5 rounded-lg text-xs transition-colors"
                        >
                          승인
                        </button>
                        <button
                          type="button"
                          onClick={() => setRejectTarget(parent.id)}
                          className="bg-red-50 hover:bg-red-100 text-red-600 font-semibold px-4 py-1.5 rounded-lg text-xs transition-colors"
                        >
                          거절
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Reject modal */}
      {rejectTarget && (
        <div className="fixed inset-0 bg-black/60 z-40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <h2 className="font-bold text-[#1C2B1E] mb-3">가입 거절</h2>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="거절 사유 (선택사항)"
              rows={3}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none mb-4"
            />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setRejectTarget(null); setRejectReason('') }}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 font-semibold py-3 rounded-xl text-sm transition-colors"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => reject(rejectTarget)}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white font-semibold py-3 rounded-xl text-sm transition-colors"
              >
                거절 확인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
