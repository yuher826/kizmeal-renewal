'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2, CheckCircle2, AlertTriangle, Search } from 'lucide-react'
import type { BranchProfileRow } from '@/types/branch-profile'

// ── 토스트 ──────────────────────────────────────────────────────────
function Toast({ msg, type }: { msg: string; type: 'success' | 'error' }) {
  return (
    <div className={`fixed top-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg text-sm font-medium ${
      type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
    }`}>
      {type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
      {msg}
    </div>
  )
}

type TargetType = 'all' | 'specific'

export default function NoticesNewPage() {
  const router = useRouter()

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [targetType, setTargetType] = useState<TargetType>('all')
  const [branches, setBranches] = useState<BranchProfileRow[]>([])
  // ★selectedIds는 branches.id(=branch_profiles.branch_id)를 담는다.
  // branch_profiles.id를 담으면 parent_notices.branch_id(branches(id) 참조)와
  // 어긋나 FK 위반 또는 아무 계정에도 안 보이는 유령 공지가 된다.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [branchSearch, setBranchSearch] = useState('')
  const [isPopup, setIsPopup] = useState(false)
  const [popupUntil, setPopupUntil] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [errors, setErrors] = useState<{ title?: string; content?: string; branches?: string }>({})

  useEffect(() => {
    fetch('/api/branch-profiles')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setBranches(data.filter((b: BranchProfileRow) => b.contract_status === 'active'))
        }
      })
      .catch(() => {})
  }, [])

  function showToast(msg: string, type: 'success' | 'error') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  function toggleBranch(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else { next.add(id) }
      return next
    })
    setErrors(e => ({ ...e, branches: undefined }))
  }

  const filteredBranches = branches.filter(b => {
    const q = branchSearch.trim().toLowerCase()
    if (!q) return true
    return (
      (b.short_code ?? '').toLowerCase().includes(q) ||
      (b.branch_full_name ?? '').toLowerCase().includes(q)
    )
  })

  function validate(): boolean {
    const errs: typeof errors = {}
    if (!title.trim())   errs.title = '제목을 입력해주세요'
    if (!content.trim()) errs.content = '내용을 입력해주세요'
    if (targetType === 'specific' && selectedIds.size === 0) errs.branches = '원을 1개 이상 선택해주세요'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSave() {
    if (!validate()) return
    setIsSaving(true)
    try {
      const res = await fetch('/api/notices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          content,
          target_type: targetType,
          branch_ids: targetType === 'specific' ? Array.from(selectedIds) : [],
          is_popup: isPopup,
          popup_until: isPopup && popupUntil ? new Date(popupUntil).toISOString() : null,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        showToast(err.error ?? '저장 실패. 다시 시도해주세요.', 'error')
        return
      }
      showToast('공지가 등록됐습니다', 'success')
      setTimeout(() => router.push('/erp/notices'), 1200)
    } catch {
      showToast('저장 실패. 다시 시도해주세요.', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const inputCls = (hasErr?: boolean) =>
    `w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 ${
      hasErr ? 'border-red-400' : 'border-slate-300'
    }`

  return (
    <main className="min-h-screen bg-[#F6FAF6] px-4 sm:px-6 py-6 sm:py-8 pb-24">
      {toast && <Toast msg={toast.msg} type={toast.type} />}

      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/erp/notices"
          className="text-slate-400 hover:text-slate-700 transition-colors flex-shrink-0"
          aria-label="목록으로"
        >
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-xl font-semibold text-slate-900">공지 작성</h1>
      </div>

      {/* 폼 */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">

        {/* 제목 */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            제목 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={e => { setTitle(e.target.value); setErrors(er => ({ ...er, title: undefined })) }}
            className={inputCls(!!errors.title)}
            placeholder="공지 제목을 입력하세요"
          />
          {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title}</p>}
        </div>

        {/* 발송 대상 */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-3">발송 대상</label>
          <div className="flex flex-col gap-3">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="radio"
                name="target"
                value="all"
                checked={targetType === 'all'}
                onChange={() => setTargetType('all')}
                className="w-4 h-4 accent-emerald-600"
              />
              <span className="text-sm text-slate-700">전체 원</span>
            </label>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="radio"
                name="target"
                value="specific"
                checked={targetType === 'specific'}
                onChange={() => setTargetType('specific')}
                className="w-4 h-4 accent-emerald-600"
              />
              <span className="text-sm text-slate-700">특정 원 선택</span>
            </label>
          </div>

          {/* 특정 원 선택 UI */}
          {targetType === 'specific' && (
            <div className="mt-4 border border-slate-200 rounded-lg overflow-hidden">
              {/* 검색 */}
              <div className="p-3 border-b border-slate-100 relative">
                <Search size={14} className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={branchSearch}
                  onChange={e => setBranchSearch(e.target.value)}
                  placeholder="원명 검색..."
                  className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-500"
                />
              </div>
              {/* 체크박스 목록 */}
              <div className="max-h-56 overflow-y-auto divide-y divide-slate-50">
                {filteredBranches.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-6">검색 결과가 없습니다</p>
                ) : filteredBranches.map(b => (
                  <label
                    key={b.branch_id}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(b.branch_id)}
                      onChange={() => toggleBranch(b.branch_id)}
                      className="w-4 h-4 accent-emerald-600 flex-shrink-0"
                    />
                    <div className="text-sm min-w-0">
                      <span className="font-medium text-slate-800">
                        {b.branch_full_name ?? b.display_name ?? b.short_code ?? '-'}
                      </span>
                      {b.short_code && (
                        <span className="text-slate-400 ml-1.5 text-xs">{b.short_code}</span>
                      )}
                    </div>
                  </label>
                ))}
              </div>
              {selectedIds.size > 0 && (
                <div className="px-4 py-2 bg-emerald-50 border-t border-slate-100 text-xs text-emerald-700">
                  {selectedIds.size}개 원 선택됨
                </div>
              )}
            </div>
          )}
          {errors.branches && <p className="text-red-500 text-xs mt-2">{errors.branches}</p>}
        </div>

        {/* 내용 */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            내용 <span className="text-red-500">*</span>
          </label>
          <textarea
            rows={8}
            value={content}
            onChange={e => { setContent(e.target.value); setErrors(er => ({ ...er, content: undefined })) }}
            className={`${inputCls(!!errors.content)} resize-none`}
            placeholder="공지 내용을 입력하세요"
          />
          {errors.content && <p className="text-red-500 text-xs mt-1">{errors.content}</p>}
        </div>

        {/* 팝업 노출 */}
        <div className="border-t border-slate-100 pt-5">
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={isPopup}
              onChange={e => { setIsPopup(e.target.checked); if (!e.target.checked) setPopupUntil('') }}
              className="w-4 h-4 accent-emerald-600"
            />
            <span className="text-sm font-medium text-slate-700">고객사 포털 로그인 시 팝업으로 노출</span>
          </label>
          <p className="text-xs text-slate-400 mt-1 ml-6">폭설로 인한 배송 지연처럼 즉시 알려야 하는 긴급 공지에 사용하세요.</p>

          {isPopup && (
            <div className="mt-3 ml-6">
              <label className="block text-xs font-medium text-slate-500 mb-1">팝업 종료 시각 (선택)</label>
              <input
                type="datetime-local"
                value={popupUntil}
                onChange={e => setPopupUntil(e.target.value)}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
              <p className="text-xs text-slate-400 mt-1">비워두면 이 팝업을 직접 끌 때까지 계속 노출됩니다.</p>
            </div>
          )}
        </div>
      </div>

      {/* 하단 버튼 */}
      <div className="flex justify-end gap-3 mt-6">
        <Link
          href="/erp/notices"
          className="border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 px-6 py-2.5 rounded-lg text-sm transition-colors"
        >
          취소
        </Link>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-70 flex items-center gap-2"
        >
          {isSaving ? (
            <>
              <Loader2 size={15} className="animate-spin" />
              저장 중...
            </>
          ) : (
            '저장'
          )}
        </button>
      </div>
    </main>
  )
}
