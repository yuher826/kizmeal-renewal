'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil, Trash2, X, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import type { Brand } from '@/lib/types'

// ── 상수/헬퍼 ────────────────────────────────────────────────────────

// 브랜드명으로 코드 자동생성 (centers 탭 로직 그대로 이식)
function generateBrandCode(name: string): string {
  const c = name.replace(/\s+/g, '').toUpperCase().substring(0, 4)
  return c + Math.floor(Math.random() * 90 + 10)
}

// 브랜드명이 영문(숫자/공백/일부 기호 포함)으로만 이뤄졌는지 — 아니면 코드 자동생성을 건너뜀
// (한글 브랜드명에서 뽑은 초기값이 그대로 저장되는 것을 방지)
function isEnglishName(name: string): boolean {
  return /^[A-Za-z0-9\s\-&.]+$/.test(name.trim())
}

// 브랜드 코드는 영문·숫자만 허용
const BRAND_CODE_PATTERN = /^[A-Za-z0-9]+$/
function isValidBrandCode(code: string): boolean {
  return BRAND_CODE_PATTERN.test(code.trim())
}

// Postgres unique violation → 사용자 친화 메시지로 변환
function friendlyError(error: { code?: string; message: string } | null): string {
  if (!error) return ''
  if (error.code === '23505') return '이미 사용 중인 브랜드 코드입니다.'
  return `오류: ${error.message}`
}

// ── 소형 컴포넌트 ────────────────────────────────────────────────────

function ActiveBadge({ active }: { active: boolean }) {
  return (
    <span className={`inline-flex items-center text-xs font-medium rounded px-2 py-0.5 ${
      active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'
    }`}>
      {active ? '활성' : '비활성'}
    </span>
  )
}

// ── 메인 페이지 ──────────────────────────────────────────────────────

export default function BrandsPage() {
  const [brands, setBrands] = useState<Brand[]>([])
  const [branchCounts, setBranchCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  // 신규 모달
  const [showNew, setShowNew] = useState(false)
  const [brandName, setBrandName] = useState('')
  const [brandCode, setBrandCode] = useState('')
  const [creating, setCreating] = useState(false)
  const [createMsg, setCreateMsg] = useState('')

  // 수정 모달
  const [editTarget, setEditTarget] = useState<Brand | null>(null)
  const [editForm, setEditForm] = useState({ name: '', code: '', is_active: true })
  const [saving, setSaving] = useState(false)
  const [editMsg, setEditMsg] = useState('')

  // 삭제
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteMsg, setDeleteMsg] = useState('')

  // ── 데이터 로드 (브랜드 + 소속 원 수 집계용 branches 목록) ──
  const load = useCallback(async () => {
    const supabase = createClient()
    const [brandsRes, branchesRes] = await Promise.all([
      supabase.from('brands').select('*').order('name'),
      supabase.from('branches').select('id, brand_id'),
    ])

    if (brandsRes.error) setLoadError('브랜드 목록을 불러오지 못했습니다. 새로고침 해주세요.')
    else setBrands((brandsRes.data ?? []) as Brand[])

    const counts: Record<string, number> = {}
    for (const b of (branchesRes.data ?? []) as { id: string; brand_id: string | null }[]) {
      if (b.brand_id) counts[b.brand_id] = (counts[b.brand_id] ?? 0) + 1
    }
    setBranchCounts(counts)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // ── 신규 생성 ──
  function openNewModal() {
    setBrandName('')
    setBrandCode('')
    setCreateMsg('')
    setShowNew(true)
  }

  async function handleCreate() {
    const name = brandName.trim()
    if (!name) return

    const code = (brandCode.trim() || generateBrandCode(name)).toUpperCase()
    if (!isValidBrandCode(code)) {
      setCreateMsg('브랜드 코드는 영문·숫자만 입력할 수 있습니다')
      return
    }

    setCreating(true)
    setCreateMsg('')
    const supabase = createClient()

    // 브랜드 코드 중복 사전 체크 — 기존 centers 코드엔 없어 DB UNIQUE 에러로만 걸러지고
    // 사용자에게 노출도 안 됐던 부분이라, 이번에 UI 단에서 먼저 막도록 보강했다.
    const { data: dup } = await supabase.from('brands').select('id').eq('code', code).maybeSingle()
    if (dup) {
      setCreateMsg('이미 사용 중인 브랜드 코드입니다. 다른 코드를 입력해주세요.')
      setCreating(false)
      return
    }

    const { error } = await supabase.from('brands').insert({ name, code, is_active: true })
    if (error) setCreateMsg(friendlyError(error))
    else {
      setShowNew(false)
      await load()
    }
    setCreating(false)
  }

  // ── 수정 ──
  function openEditModal(b: Brand) {
    setEditTarget(b)
    setEditForm({ name: b.name, code: b.code, is_active: b.is_active })
    setEditMsg('')
  }

  async function handleEditSave() {
    if (!editTarget) return
    const name = editForm.name.trim()
    const code = editForm.code.trim().toUpperCase()
    if (!name || !code) {
      setEditMsg('브랜드명과 코드를 입력해주세요')
      return
    }
    if (!isValidBrandCode(code)) {
      setEditMsg('브랜드 코드는 영문·숫자만 입력할 수 있습니다')
      return
    }

    // 변경된 필드만 전송
    const updates: Record<string, unknown> = {}
    if (name !== editTarget.name) updates.name = name
    if (code !== editTarget.code) updates.code = code
    if (editForm.is_active !== editTarget.is_active) updates.is_active = editForm.is_active

    if (Object.keys(updates).length === 0) {
      setEditMsg('변경된 내용이 없습니다')
      return
    }

    setSaving(true)
    setEditMsg('')
    const supabase = createClient()

    // 코드가 바뀌는 경우에만 중복 사전 체크
    if (typeof updates.code === 'string') {
      const { data: dup } = await supabase
        .from('brands').select('id').eq('code', updates.code).neq('id', editTarget.id).maybeSingle()
      if (dup) {
        setEditMsg('이미 사용 중인 브랜드 코드입니다.')
        setSaving(false)
        return
      }
    }

    const { error } = await supabase.from('brands').update(updates).eq('id', editTarget.id)
    if (error) setEditMsg(friendlyError(error))
    else {
      setEditTarget(null)
      await load()
    }
    setSaving(false)
  }

  // ── 삭제 ──
  async function handleDelete(b: Brand) {
    const count = branchCounts[b.id] ?? 0
    if (count > 0) return // 버튼이 비활성화되어 있어 정상 흐름에선 도달하지 않음(방어적 재확인)

    if (!window.confirm(`"${b.name}" 브랜드를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) return

    setDeletingId(b.id)
    setDeleteMsg('')
    const supabase = createClient()
    const { error } = await supabase.from('brands').delete().eq('id', b.id)
    if (error) setDeleteMsg(`삭제 실패: ${error.message}`)
    else await load()
    setDeletingId(null)
  }

  // ── 로딩 ──
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={24} className="animate-spin text-emerald-600" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* ── 헤더 + 신규 버튼 ── */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-600">브랜드 {brands.length}개</h2>
        <button
          onClick={openNewModal}
          className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={16} /> 새 브랜드
        </button>
      </div>

      {/* ── 테이블 (데스크탑) ── */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50">
                {['브랜드명', '코드', '소속 원 수', '상태', '관리'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-bold text-slate-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {brands.map(b => {
                const count = branchCounts[b.id] ?? 0
                return (
                  <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3.5 text-sm font-semibold text-slate-800">{b.name}</td>
                    <td className="px-4 py-3.5 text-sm text-slate-500 font-mono">{b.code}</td>
                    <td className="px-4 py-3.5 text-sm text-slate-600">
                      {count}개
                      {count === 0 && <span className="ml-1.5 text-xs text-orange-500">소속 원 없음</span>}
                    </td>
                    <td className="px-4 py-3.5"><ActiveBadge active={b.is_active} /></td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => openEditModal(b)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-emerald-700 border border-slate-200 hover:border-emerald-300 rounded-lg px-2.5 py-1.5 transition-colors"
                        >
                          <Pencil size={12} /> 수정
                        </button>
                        <button
                          onClick={() => handleDelete(b)}
                          disabled={count > 0 || deletingId === b.id}
                          title={count > 0 ? `소속 원 ${count}개가 있어 삭제할 수 없습니다` : undefined}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-red-500 hover:text-red-700 border border-red-200 hover:border-red-300 rounded-lg px-2.5 py-1.5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:text-red-500"
                        >
                          <Trash2 size={12} /> {deletingId === b.id ? '삭제 중...' : '삭제'}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {brands.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-400">등록된 브랜드가 없습니다</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ── 모바일 카드 ── */}
        <div className="sm:hidden divide-y divide-slate-100">
          {brands.map(b => {
            const count = branchCounts[b.id] ?? 0
            return (
              <div key={b.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-slate-800 text-sm">{b.name}</p>
                    <p className="text-xs text-slate-400 font-mono">{b.code}</p>
                  </div>
                  <ActiveBadge active={b.is_active} />
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  소속 원 {count}개
                  {count === 0 && <span className="ml-1.5 text-orange-500">소속 원 없음</span>}
                </p>
                <div className="flex items-center gap-1.5 mt-2">
                  <button
                    onClick={() => openEditModal(b)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 border border-slate-200 rounded-lg px-2.5 py-1.5"
                  >
                    <Pencil size={12} /> 수정
                  </button>
                  <button
                    onClick={() => handleDelete(b)}
                    disabled={count > 0 || deletingId === b.id}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-red-500 border border-red-200 rounded-lg px-2.5 py-1.5 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <Trash2 size={12} /> {deletingId === b.id ? '삭제 중...' : '삭제'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {loadError && (
        <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-600">{loadError}</div>
      )}
      {deleteMsg && (
        <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-600">{deleteMsg}</div>
      )}

      {/* ── 신규 브랜드 모달 ── */}
      {showNew && (
        <div className="fixed inset-0 bg-black/40 z-30 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-sm sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-slate-800">새 브랜드</h2>
              <button onClick={() => setShowNew(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">브랜드명 *</label>
              <input
                type="text"
                value={brandName}
                onChange={e => {
                  const v = e.target.value
                  setBrandName(v)
                  // 브랜드명이 영문일 때만 코드 자동생성 — 아니면 비워둠(사용자가 직접 입력)
                  if (!brandCode && isEnglishName(v)) setBrandCode(generateBrandCode(v))
                }}
                placeholder="예: 폴리영어"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">브랜드 코드 (자동생성)</label>
              <input
                type="text"
                value={brandCode}
                onChange={e => setBrandCode(e.target.value.toUpperCase())}
                placeholder="예: POLY12 (영문 대문자로 입력)"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              {brandCode.trim() && !isValidBrandCode(brandCode) && (
                <p className="text-xs text-red-500 mt-1">브랜드 코드는 영문·숫자만 입력할 수 있습니다</p>
              )}
            </div>

            {createMsg && (
              <div className="bg-red-50 rounded-xl px-4 py-3 text-sm text-red-600">{createMsg}</div>
            )}

            <button
              onClick={handleCreate}
              disabled={creating || !brandName.trim() || !brandCode.trim() || !isValidBrandCode(brandCode)}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-sm font-semibold transition-colors"
            >
              {creating ? '생성 중...' : '브랜드 생성'}
            </button>
          </div>
        </div>
      )}

      {/* ── 수정 모달 ── */}
      {editTarget && (
        <div className="fixed inset-0 bg-black/40 z-30 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-sm sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-slate-800">브랜드 정보 수정</h2>
              <button onClick={() => setEditTarget(null)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">브랜드명</label>
              <input
                type="text" value={editForm.name}
                onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">브랜드 코드</label>
              <input
                type="text" value={editForm.code}
                onChange={e => setEditForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                placeholder="영문 대문자로 입력"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              {editForm.code.trim() && !isValidBrandCode(editForm.code) && (
                <p className="text-xs text-red-500 mt-1">브랜드 코드는 영문·숫자만 입력할 수 있습니다</p>
              )}
            </div>

            <div className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3">
              <span className="text-sm font-semibold text-slate-600">활성 상태</span>
              <button
                onClick={() => setEditForm(f => ({ ...f, is_active: !f.is_active }))}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  editForm.is_active ? 'bg-emerald-500' : 'bg-slate-300'
                }`}
              >
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${
                  editForm.is_active ? 'left-[22px]' : 'left-0.5'
                }`} />
              </button>
            </div>

            {editMsg && (
              <div className="bg-red-50 rounded-xl px-4 py-3 text-sm text-red-600">{editMsg}</div>
            )}

            <button
              onClick={handleEditSave}
              disabled={saving || !editForm.name.trim() || !editForm.code.trim() || !isValidBrandCode(editForm.code)}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-sm font-semibold transition-colors"
            >
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
