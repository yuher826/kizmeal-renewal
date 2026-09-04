'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Users, UserCheck, UserX, Plus, Copy, Check, Pencil, ShieldAlert, Loader2, X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { ROLES, ROLE_LABEL, isNutritionist, ADMIN_CREATE_ROLES, MANAGER_CREATABLE_ROLES, MANAGER_FORCED_SCOPE } from '@/lib/roles'
import { useErpUser } from '@/components/erp/ErpUserProvider'
import type { Admin } from '@/lib/types'

// access_scope · 권한 플래그 포함 확장 타입 (lib/types의 Admin에는 아직 없는 컬럼)
interface AdminRow extends Admin {
  access_scope?: string | null
  can_manage_templates?: boolean | null
  can_handle_cs?: boolean | null
  can_write_notices?: boolean | null
}

// ── 상수 ─────────────────────────────────────────────────────────────

// 접근범위 배지 메타
const SCOPE_META: Record<string, { label: string; badgeClass: string }> = {
  both:       { label: '전체',          badgeClass: 'bg-emerald-100 text-emerald-700' },
  erp_only:   { label: 'ERP 전용',      badgeClass: 'bg-blue-100 text-blue-700' },
  board_only: { label: '홈페이지 전용', badgeClass: 'bg-orange-100 text-orange-700' },
}

// 역할 선택 시 접근범위 자동 제안 (수동 변경 가능)
const SCOPE_SUGGESTION: Record<string, string> = {
  super_admin:              'both',
  manager:                  'both',
  director:                 'erp_only',
  nutritionist_ck:          'erp_only',
  nutritionist_consignment: 'erp_only',
}

// 역할 셀렉트 옵션 (lib/roles.ts 상수에서 파생 — 하드코딩 금지)
const ROLE_OPTIONS = Object.values(ROLES).map(r => ({ value: r, label: ROLE_LABEL[r] ?? r }))

// 접근범위 셀렉트 옵션
const SCOPE_OPTIONS = [
  { value: 'both',       label: '전체 (ERP + 홈페이지관리)' },
  { value: 'erp_only',   label: 'ERP 전용' },
  { value: 'board_only', label: '홈페이지 전용' },
]

// 추가 권한 플래그 메타 (수정 모달 체크박스 + 목록 배지가 함께 참조)
const PERMISSION_FLAGS = [
  { field: 'can_manage_templates', label: '템플릿 관리', badge: '템플릿', desc: '디자이너 양식 업로드·활성화' },
  { field: 'can_handle_cs',        label: 'CS 관리 대응', badge: 'CS',   desc: '고객사 1:1 문의 답변' },
  { field: 'can_write_notices',    label: '고객사 공지 작성', badge: '공지', desc: '계약 원 담당자에게 공지 발송' },
] as const

// 역할 배지 색상
function roleBadgeClass(role: string): string {
  if (role === 'super_admin') return 'bg-purple-100 text-purple-700'
  if (role === 'director') return 'bg-orange-100 text-orange-700'
  if (isNutritionist(role)) return 'bg-teal-100 text-teal-700'
  return 'bg-blue-100 text-blue-700'
}

// ── 소형 컴포넌트 ────────────────────────────────────────────────────

function SummaryCard({ icon, label, value, color, isActive, onClick }: {
  icon: React.ReactNode; label: string; value: number; color: string
  isActive: boolean; onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`bg-white border rounded-xl p-5 flex items-center gap-4 w-full text-left transition-all ${
        isActive
          ? 'border-emerald-400 ring-2 ring-emerald-300 brightness-95'
          : 'border-slate-200 hover:brightness-95'
      }`}
    >
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-800">{value}</p>
        <p className="text-xs text-slate-500 mt-0.5">{label}</p>
      </div>
    </button>
  )
}

function RoleBadge({ role }: { role: string }) {
  return (
    <span className={`inline-flex items-center text-xs font-medium rounded px-2 py-0.5 ${roleBadgeClass(role)}`}>
      {ROLE_LABEL[role] ?? role}
    </span>
  )
}

function ScopeBadge({ scope }: { scope?: string | null }) {
  const meta = SCOPE_META[scope ?? 'both'] ?? SCOPE_META.both
  return (
    <span className={`inline-flex items-center text-xs font-medium rounded px-2 py-0.5 ${meta.badgeClass}`}>
      {meta.label}
    </span>
  )
}

function ActiveBadge({ active }: { active: boolean }) {
  return (
    <span className={`inline-flex items-center text-xs font-medium rounded px-2 py-0.5 ${
      active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'
    }`}>
      {active ? '활성' : '비활성'}
    </span>
  )
}

// ★역할 배지(색으로 구분)·범위/상태 배지(채움 스타일)와 겹치지 않도록
//   전부 같은 중립색 아웃라인으로 통일 — 권한은 색이 아니라 글자로만 구분한다.
//   super_admin은 role만으로 canManageTemplates 등이 항상 true를 반환하지만
//   DB 값은 false이므로, 여기서도 '전체' 배지로 그 사실을 명시한다
//   (목록·수정 모달 두 곳에서 규칙이 갈리지 않도록 이 컴포넌트 하나만 쓴다).
function PermissionBadges({ admin }: { admin: AdminRow }) {
  if (admin.role === 'super_admin') {
    return (
      <span className="inline-flex items-center text-xs font-medium rounded border border-slate-300 text-slate-500 px-2 py-0.5">
        전체
      </span>
    )
  }
  const active = PERMISSION_FLAGS.filter(f => !!admin[f.field])
  if (active.length === 0) return <span className="text-xs text-slate-300">—</span>
  return (
    <div className="flex flex-wrap gap-1">
      {active.map(f => (
        <span key={f.field} className="inline-flex items-center text-xs font-medium rounded border border-slate-300 text-slate-500 px-2 py-0.5">
          {f.badge}
        </span>
      ))}
    </div>
  )
}

// ── 메인 페이지 ──────────────────────────────────────────────────────

export default function AdminsPage() {
  const currentAdmin = useErpUser()
  const [admins, setAdmins] = useState<AdminRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [statFilter, setStatFilter] = useState<null | 'active' | 'inactive'>(null)

  // 신규 모달
  const [showNew, setShowNew] = useState(false)
  const [newForm, setNewForm] = useState({ name: '', email: '', department: '', phone: '', role: '', access_scope: 'both' })
  const [creating, setCreating] = useState(false)
  const [createMsg, setCreateMsg] = useState('')

  // 생성 성공 모달 (임시 비밀번호 1회 표시)
  const [createdInfo, setCreatedInfo] = useState<{ email: string; tempPassword: string; emailSent: boolean } | null>(null)
  const [copied, setCopied] = useState(false)

  // 수정 모달
  const [editTarget, setEditTarget] = useState<AdminRow | null>(null)
  const [editForm, setEditForm] = useState({
    name: '', role: '', access_scope: 'both', department: '', phone: '', is_active: true,
    can_manage_templates: false, can_handle_cs: false, can_write_notices: false,
  })
  const [saving, setSaving] = useState(false)
  const [editMsg, setEditMsg] = useState('')

  // ── 권한 파생값 (super_admin: 전체 / manager: 하위 role·erp_only 생성만) ──
  const isSuperAdmin = currentAdmin?.role === ROLES.SUPER_ADMIN
  const availableRoleOptions = isSuperAdmin
    ? ROLE_OPTIONS
    : ROLE_OPTIONS.filter(o => MANAGER_CREATABLE_ROLES.includes(o.value))
  const availableScopeOptions = isSuperAdmin
    ? SCOPE_OPTIONS
    : SCOPE_OPTIONS.filter(o => o.value === MANAGER_FORCED_SCOPE)

  // ── 데이터 로드 (centers 탭의 검증된 직접 쿼리 방식, 비활성 포함) ──
  const load = useCallback(async () => {
    const supabase = createClient()
    const { data, error } = await supabase.from('admins').select('*').order('name')

    if (error) setLoadError('목록을 불러오지 못했습니다. 새로고침 해주세요.')
    else setAdmins((data ?? []) as AdminRow[])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // ── 집계 (전체 기준 고정) ──
  const total = admins.length
  const activeCount = admins.filter(a => a.is_active).length
  const inactiveCount = total - activeCount
  const activeSuperAdminCount = admins.filter(a => a.role === 'super_admin' && a.is_active).length

  const filtered = statFilter === 'active'
    ? admins.filter(a => a.is_active)
    : statFilter === 'inactive'
      ? admins.filter(a => !a.is_active)
      : admins

  // ── 신규 생성 ──
  function openNewModal() {
    setNewForm({ name: '', email: '', department: '', phone: '', role: '', access_scope: isSuperAdmin ? 'both' : MANAGER_FORCED_SCOPE })
    setCreateMsg('')
    setShowNew(true)
  }

  // 역할 변경 시 접근범위 자동 제안 (super_admin만 수동 변경 가능 / manager는 erp_only 고정)
  function handleRoleChange(role: string) {
    setNewForm(f => ({ ...f, role, access_scope: isSuperAdmin ? (SCOPE_SUGGESTION[role] ?? 'both') : MANAGER_FORCED_SCOPE }))
  }

  async function handleCreate() {
    setCreating(true)
    setCreateMsg('')
    try {
      const res = await fetch('/api/admin/branch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create-admin', ...newForm }),
      })
      const data = await res.json()
      if (!res.ok) {
        setCreateMsg(`오류: ${data.error}`)
      } else {
        setShowNew(false)
        // 임시 비밀번호는 이 응답에서만 받을 수 있음 — 1회 표시 모달로 전달
        setCopied(false)
        setCreatedInfo({ email: newForm.email.trim(), tempPassword: data.tempPassword, emailSent: data.emailSent })
        await load()
      }
    } catch {
      setCreateMsg('오류: 네트워크 문제')
    }
    setCreating(false)
  }

  async function handleCopyPassword() {
    if (!createdInfo) return
    try {
      await navigator.clipboard.writeText(createdInfo.tempPassword)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* 클립보드 미지원 환경 무시 */ }
  }

  // ── 행별 수정 ──
  function openEditModal(a: AdminRow) {
    setEditTarget(a)
    setEditForm({
      name: a.name,
      role: a.role,
      access_scope: a.access_scope ?? 'both',
      department: a.department ?? '',
      phone: a.phone ?? '',
      is_active: a.is_active,
      can_manage_templates: a.can_manage_templates ?? false,
      can_handle_cs: a.can_handle_cs ?? false,
      can_write_notices: a.can_write_notices ?? false,
    })
    setEditMsg('')
  }

  // 보호 조건 (UI 측 — 서버에서도 동일하게 강제됨)
  const isSelf = !!(editTarget && currentAdmin && editTarget.id === currentAdmin.id)
  const isLastSuperAdmin = !!(editTarget && editTarget.role === 'super_admin' && editTarget.is_active && activeSuperAdminCount <= 1)
  // super_admin은 canManageTemplates 등이 role만으로 항상 true를 반환하므로
  // (lib/roles.ts) DB 값(false)을 그대로 그리면 "권한 없음"으로 오해된다.
  // 체크박스를 checked+disabled로 고정해 실제 동작과 화면을 일치시킨다.
  const isTargetSuperAdmin = editTarget?.role === 'super_admin'

  async function handleEditSave() {
    if (!editTarget) return
    // 변경된 필드만 전송 (email은 수정 불가 — 서버에서도 화이트리스트 차단)
    const updates: Record<string, unknown> = {}
    if (editForm.name.trim() !== editTarget.name) updates.name = editForm.name.trim()
    if (editForm.role !== editTarget.role) updates.role = editForm.role
    if (editForm.access_scope !== (editTarget.access_scope ?? 'both')) updates.access_scope = editForm.access_scope
    if (editForm.department.trim() !== (editTarget.department ?? '')) updates.department = editForm.department.trim() || null
    if (editForm.phone.trim() !== (editTarget.phone ?? '')) updates.phone = editForm.phone.trim() || null
    if (editForm.is_active !== editTarget.is_active) updates.is_active = editForm.is_active
    // 플래그 3개 — boolean을 그대로 보낸다(서버가 typeof==='boolean'을 검증).
    // super_admin 행은 체크박스가 disabled라 editForm 값이 안 바뀌므로
    // 여기서 별도 분기 없이도 updates에 담기지 않는다.
    for (const { field } of PERMISSION_FLAGS) {
      if (editForm[field] !== (editTarget[field] ?? false)) updates[field] = editForm[field]
    }

    if (Object.keys(updates).length === 0) {
      setEditMsg('변경된 내용이 없습니다')
      return
    }

    setSaving(true)
    setEditMsg('')
    try {
      const res = await fetch('/api/admin/branch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update-admin', adminId: editTarget.id, updates }),
      })
      const data = await res.json()
      if (!res.ok) {
        setEditMsg(`오류: ${data.error}`)
      } else {
        setEditTarget(null)
        await load()
      }
    } catch {
      setEditMsg('오류: 네트워크 문제')
    }
    setSaving(false)
  }

  // ── 로딩 ──
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={24} className="animate-spin text-emerald-600" />
      </div>
    )
  }

  // ── 접근 차단 (super_admin·manager만 — manager는 하위 계정 생성만 가능) ──
  if (!currentAdmin || !ADMIN_CREATE_ROLES.includes(currentAdmin.role)) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <ShieldAlert size={40} className="text-slate-300 mb-4" />
        <p className="text-slate-600 font-semibold">이 페이지에 접근할 권한이 없습니다</p>
        <p className="text-sm text-slate-400 mt-1">권한이 필요하면 슈퍼관리자에게 문의해주세요.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* ── 요약 카드 (클릭 필터) ── */}
      <div className="grid grid-cols-3 gap-4">
        <SummaryCard
          icon={<Users size={20} className="text-emerald-600" />}
          label="전체" value={total} color="bg-emerald-50"
          isActive={statFilter === null}
          onClick={() => setStatFilter(null)}
        />
        <SummaryCard
          icon={<UserCheck size={20} className="text-green-600" />}
          label="활성" value={activeCount} color="bg-green-50"
          isActive={statFilter === 'active'}
          onClick={() => setStatFilter(prev => prev === 'active' ? null : 'active')}
        />
        <SummaryCard
          icon={<UserX size={20} className="text-slate-500" />}
          label="비활성" value={inactiveCount} color="bg-slate-100"
          isActive={statFilter === 'inactive'}
          onClick={() => setStatFilter(prev => prev === 'inactive' ? null : 'inactive')}
        />
      </div>

      {/* ── 헤더 + 신규 버튼 ── */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-600">
          관리자 계정 {filtered.length}명{statFilter ? ' (필터 적용됨)' : ''}
        </h2>
        <button
          onClick={openNewModal}
          className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={16} /> 새 관리자
        </button>
      </div>

      {/* ── 테이블 (데스크탑) ── */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50">
                {['이름', '이메일', '역할', '접근범위', '추가 권한', '상태', ...(isSuperAdmin ? ['관리'] : [])].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-bold text-slate-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(a => (
                <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3.5 text-sm font-semibold text-slate-800">
                    {a.name}
                    {currentAdmin.id === a.id && <span className="ml-1.5 text-xs text-emerald-600 font-medium">(나)</span>}
                  </td>
                  <td className="px-4 py-3.5 text-sm text-slate-500">{a.email}</td>
                  <td className="px-4 py-3.5"><RoleBadge role={a.role} /></td>
                  <td className="px-4 py-3.5"><ScopeBadge scope={a.access_scope} /></td>
                  <td className="px-4 py-3.5"><PermissionBadges admin={a} /></td>
                  <td className="px-4 py-3.5"><ActiveBadge active={a.is_active} /></td>
                  {isSuperAdmin && (
                    <td className="px-4 py-3.5">
                      <button
                        onClick={() => openEditModal(a)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-emerald-700 border border-slate-200 hover:border-emerald-300 rounded-lg px-2.5 py-1.5 transition-colors"
                      >
                        <Pencil size={12} /> 수정
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={isSuperAdmin ? 7 : 6} className="px-4 py-10 text-center text-sm text-slate-400">표시할 관리자가 없습니다</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ── 모바일 카드 ── */}
        <div className="sm:hidden divide-y divide-slate-100">
          {filtered.map(a => (
            <div key={a.id} className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-800 text-sm">
                    {a.name}
                    {currentAdmin.id === a.id && <span className="ml-1.5 text-xs text-emerald-600 font-medium">(나)</span>}
                  </p>
                  <p className="text-xs text-slate-400">{a.email}</p>
                </div>
                {isSuperAdmin && (
                  <button
                    onClick={() => openEditModal(a)}
                    className="text-xs font-semibold text-slate-500 border border-slate-200 rounded-lg px-2.5 py-1.5"
                  >
                    수정
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                <RoleBadge role={a.role} />
                <ScopeBadge scope={a.access_scope} />
                <PermissionBadges admin={a} />
                <ActiveBadge active={a.is_active} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {loadError && (
        <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-600">{loadError}</div>
      )}

      {/* ── 신규 관리자 모달 ── */}
      {showNew && (
        <div className="fixed inset-0 bg-black/40 z-30 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-slate-800">새 관리자 계정</h2>
              <button onClick={() => setShowNew(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>

            {([['name', '이름 *', 'text'], ['email', '이메일 *', 'email'], ['department', '부서', 'text'], ['phone', '전화', 'tel']] as const).map(([field, label, type]) => (
              <div key={field}>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">{label}</label>
                <input
                  type={type}
                  value={newForm[field]}
                  onChange={e => setNewForm(f => ({ ...f, [field]: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder={label.replace(' *', '')}
                />
              </div>
            ))}

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">역할 *</label>
              <select
                value={newForm.role}
                onChange={e => handleRoleChange(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="" disabled>역할을 선택하세요</option>
                {availableRoleOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">
                {isSuperAdmin ? '접근범위 (역할 선택 시 자동 제안)' : '접근범위 (ERP 전용 고정)'}
              </label>
              <select
                value={newForm.access_scope}
                onChange={e => setNewForm(f => ({ ...f, access_scope: e.target.value }))}
                disabled={!isSuperAdmin}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-50 disabled:text-slate-400"
              >
                {availableScopeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            <p className="text-xs text-slate-400">
              임시 비밀번호는 서버에서 자동 생성되어 생성 완료 후 1회만 표시됩니다.
            </p>

            {createMsg && (
              <div className="bg-red-50 rounded-xl px-4 py-3 text-sm text-red-600">{createMsg}</div>
            )}

            <button
              onClick={handleCreate}
              disabled={creating || !newForm.name.trim() || !newForm.email.trim() || !newForm.role}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-sm font-semibold transition-colors"
            >
              {creating ? '생성 중...' : '관리자 계정 생성'}
            </button>
          </div>
        </div>
      )}

      {/* ── 생성 성공 모달 (임시 비밀번호 1회 표시) ── */}
      {createdInfo && (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl p-6 space-y-4">
            <h2 className="font-bold text-slate-800">관리자 계정이 생성되었습니다</h2>
            <div className="bg-slate-50 rounded-xl p-4 space-y-2">
              <p className="text-sm text-slate-600"><span className="font-semibold">이메일:</span> {createdInfo.email}</p>
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-600 font-semibold flex-shrink-0">임시 비밀번호:</span>
                <code className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-mono text-slate-800 break-all">
                  {createdInfo.tempPassword}
                </code>
                <button
                  onClick={handleCopyPassword}
                  className="flex-shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-emerald-700 border border-slate-200 rounded-lg px-2.5 py-1.5 transition-colors"
                >
                  {copied ? <><Check size={12} className="text-emerald-600" /> 복사됨</> : <><Copy size={12} /> 복사</>}
                </button>
              </div>
            </div>
            <p className="text-sm text-slate-500">
              {createdInfo.emailSent
                ? '✅ 계정 안내 메일이 발송되었습니다 (비밀번호 미포함).'
                : '⚠️ 안내 메일 발송에 실패했습니다 — 계정 정보를 직접 전달해주세요.'}
            </p>
            <div className="bg-red-50 rounded-xl px-4 py-3 text-sm text-red-600 font-semibold">
              이 창을 닫으면 임시 비밀번호를 다시 볼 수 없습니다. 지금 복사해서 안전하게 전달하세요.
            </div>
            <button
              onClick={() => setCreatedInfo(null)}
              className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-sm font-semibold transition-colors"
            >
              확인했습니다. 닫기
            </button>
          </div>
        </div>
      )}

      {/* ── 수정 모달 ── */}
      {editTarget && (
        <div className="fixed inset-0 bg-black/40 z-30 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-slate-800">관리자 정보 수정</h2>
              <button onClick={() => setEditTarget(null)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>

            {/* 이메일은 수정 불가 (Auth 계정과 어긋남 방지) */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">이메일 (수정 불가)</label>
              <input
                type="email" value={editTarget.email} readOnly
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-400"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">이름</label>
              <input
                type="text" value={editForm.name}
                onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">역할</label>
              <select
                value={editForm.role}
                onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))}
                disabled={isLastSuperAdmin}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-50 disabled:text-slate-400"
              >
                {ROLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">접근범위</label>
              <select
                value={editForm.access_scope}
                onChange={e => setEditForm(f => ({ ...f, access_scope: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="both">전체 (ERP + 홈페이지관리)</option>
                <option value="erp_only">ERP 전용</option>
                <option value="board_only">홈페이지 전용</option>
              </select>
            </div>

            {([['department', '부서'], ['phone', '전화']] as const).map(([field, label]) => (
              <div key={field}>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">{label}</label>
                <input
                  type="text" value={editForm[field]}
                  onChange={e => setEditForm(f => ({ ...f, [field]: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            ))}

            {/* 추가 권한 — "직무가 아니라 배정"인 3단계 플래그 (canManageTemplates와 같은 설계) */}
            <div className="bg-slate-50 rounded-xl px-4 py-3 space-y-3">
              <p className="text-sm font-semibold text-slate-600">추가 권한</p>
              {PERMISSION_FLAGS.map(({ field, label, desc }) => (
                <label key={field} className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isTargetSuperAdmin || editForm[field]}
                    disabled={isTargetSuperAdmin}
                    onChange={e => setEditForm(f => ({ ...f, [field]: e.target.checked }))}
                    className="mt-0.5 w-4 h-4 rounded accent-emerald-600 disabled:cursor-not-allowed"
                  />
                  <span>
                    <span className="block text-sm font-medium text-slate-700">{label}</span>
                    <span className="block text-xs text-slate-400">{desc}</span>
                  </span>
                </label>
              ))}
              {isTargetSuperAdmin && (
                <p className="text-xs text-slate-400 pt-1 border-t border-slate-200">
                  슈퍼관리자는 플래그와 무관하게 항상 전체 권한을 가집니다.
                </p>
              )}
            </div>

            {/* 활성 토글 — 자기 자신·마지막 super_admin은 비활성화 불가 */}
            <div className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3">
              <span className="text-sm font-semibold text-slate-600">계정 활성 상태</span>
              <button
                onClick={() => setEditForm(f => ({ ...f, is_active: !f.is_active }))}
                disabled={isSelf || isLastSuperAdmin}
                className={`relative w-11 h-6 rounded-full transition-colors disabled:opacity-40 ${
                  editForm.is_active ? 'bg-emerald-500' : 'bg-slate-300'
                }`}
              >
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${
                  editForm.is_active ? 'left-[22px]' : 'left-0.5'
                }`} />
              </button>
            </div>

            {isSelf && (
              <p className="text-xs text-slate-400">자기 자신은 비활성화할 수 없습니다.</p>
            )}
            {isLastSuperAdmin && (
              <p className="text-xs text-red-500 font-semibold">마지막 슈퍼관리자는 역할 변경·비활성화할 수 없습니다.</p>
            )}

            {editMsg && (
              <div className="bg-red-50 rounded-xl px-4 py-3 text-sm text-red-600">{editMsg}</div>
            )}

            <button
              onClick={handleEditSave}
              disabled={saving || !editForm.name.trim()}
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
