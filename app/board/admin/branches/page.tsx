'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import type { Branch, Brand, Admin, BranchStatus } from '@/lib/types'
import * as XLSX from 'xlsx'

// ── 확장 타입 ──────────────────────────────────────────────────
interface ExtendedBranch extends Branch {
  inquiry_count?: number
  pending_count?: number
  last_inquiry_at?: string
}

interface NewBranchForm {
  branch_type: 'franchise' | 'independent'
  brand_id: string
  name: string
  kos_id: string
  address: string
  phone: string
  assigned_admin_id: string
  contract_start: string
  contract_end: string
  meal_count: string
  diet_type: 'ck' | 'catering'
  meal_config: { 오전: boolean; 오후: boolean; 방과후: boolean; 돌봄: boolean }
  manager_name: string
  email: string
  manager_phone: string
  temp_password: string
}

interface ImportRow {
  원이름: string
  브랜드코드: string
  'KOS ID': string
  이메일: string
  담당자명: string
  연락처: string
  주소: string
  식단타입: string
  계약시작: string
  계약만료: string
  식수인원: string
  _duplicate?: boolean
}

type Tab = 'branches' | 'brands' | 'admins'
type SlideTab = 'info' | 'contract' | 'diet' | 'account'

// ── 헬퍼 ──────────────────────────────────────────────────────
function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000)
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const d = Math.floor(diff / 86400000)
  const h = Math.floor(diff / 3600000)
  if (d > 0) return `${d}일 전`
  if (h > 0) return `${h}시간 전`
  return '방금 전'
}

function generateTempPassword(): string {
  const lower = 'abcdefghijklmnopqrstuvwxyz'
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const digits = '0123456789'
  const special = '!@#$%'
  const all = lower + upper + digits + special
  let pw = lower[Math.floor(Math.random() * lower.length)]
  pw += upper[Math.floor(Math.random() * upper.length)]
  pw += digits[Math.floor(Math.random() * digits.length)]
  pw += special[Math.floor(Math.random() * special.length)]
  for (let i = 0; i < 4; i++) pw += all[Math.floor(Math.random() * all.length)]
  return pw.split('').sort(() => Math.random() - 0.5).join('')
}

function generateBrandCode(name: string): string {
  const c = name.replace(/\s+/g, '').toUpperCase().substring(0, 4)
  return c + Math.floor(Math.random() * 90 + 10)
}

async function generateKzmCode(): Promise<string> {
  const supabase = createClient()
  const { data } = await supabase
    .from('branches')
    .select('kos_id')
    .like('kos_id', 'KZM-%')
    .order('kos_id', { ascending: false })
    .limit(1)
  let nextNum = 1
  if (data && data.length > 0) {
    const match = (data[0].kos_id || '').match(/KZM-(\d+)/)
    if (match) nextNum = parseInt(match[1]) + 1
  }
  return `KZM-${String(nextNum).padStart(3, '0')}`
}

const STATUS_CFG: Record<BranchStatus, { label: string; cls: string }> = {
  new: { label: '신규', cls: 'bg-blue-100 text-blue-700' },
  active: { label: '활성', cls: 'bg-green-100 text-green-700' },
  vacation: { label: '방학', cls: 'bg-yellow-100 text-yellow-800' },
  expired: { label: '만료', cls: 'bg-orange-100 text-orange-700' },
  inactive: { label: '비활성', cls: 'bg-gray-100 text-gray-600' },
}

function StatusBadge({ status }: { status?: BranchStatus | string }) {
  const cfg = STATUS_CFG[(status as BranchStatus) || 'active'] || STATUS_CFG.active
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.cls}`}>{cfg.label}</span>
}

// ── 기본값 ────────────────────────────────────────────────────
const defaultForm = (): NewBranchForm => ({
  branch_type: 'franchise',
  brand_id: '',
  name: '',
  kos_id: '',
  address: '',
  phone: '',
  assigned_admin_id: '',
  contract_start: '',
  contract_end: '',
  meal_count: '',
  diet_type: 'ck',
  meal_config: { 오전: false, 오후: true, 방과후: false, 돌봄: false },
  manager_name: '',
  email: '',
  manager_phone: '',
  temp_password: generateTempPassword(),
})

// ─────────────────────────────────────────────────────────────
export default function AdminBranchesPage() {
  const [activeTab, setActiveTab] = useState<Tab>('branches')
  const [branches, setBranches] = useState<ExtendedBranch[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [admins, setAdmins] = useState<Admin[]>([])
  const [loading, setLoading] = useState(true)
  const [currentAdmin, setCurrentAdmin] = useState<Admin | null>(null)

  // 지점 탭 필터
  const [search, setSearch] = useState('')
  const [filterBrand, setFilterBrand] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterType, setFilterType] = useState('')

  // 슬라이드 패널
  const [selectedBranch, setSelectedBranch] = useState<ExtendedBranch | null>(null)
  const [slideTab, setSlideTab] = useState<SlideTab>('info')
  const [panelLoading] = useState(false)

  // 새 지점 모달
  const [showNewBranch, setShowNewBranch] = useState(false)
  const [step, setStep] = useState(1)
  const [form, setForm] = useState<NewBranchForm>(defaultForm())
  const [creating, setCreating] = useState(false)
  const [createMsg, setCreateMsg] = useState('')

  // 새 브랜드 모달
  const [showNewBrand, setShowNewBrand] = useState(false)
  const [brandName, setBrandName] = useState('')
  const [brandCode, setBrandCode] = useState('')
  const [creatingBrand, setCreatingBrand] = useState(false)

  // 새 관리자 모달
  const [showNewAdmin, setShowNewAdmin] = useState(false)
  const [adminForm, setAdminForm] = useState({ name: '', email: '', role: 'general', temp_password: generateTempPassword() })
  const [creatingAdmin, setCreatingAdmin] = useState(false)
  const [adminMsg, setAdminMsg] = useState('')

  // 엑셀 Import
  const [showImport, setShowImport] = useState(false)
  const [importRows, setImportRows] = useState<ImportRow[]>([])
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  // 패널 액션 상태
  const [resetingPw, setResetingPw] = useState(false)
  const [deactivating, setDeactivating] = useState(false)
  const [actionMsg, setActionMsg] = useState('')
  const [confirmDeactivate, setConfirmDeactivate] = useState(false)

  // ── 데이터 로드 ──────────────────────────────────────────────
  const load = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const [branchRes, brandRes, adminRes, selfRes, inqRes] = await Promise.all([
      supabase.from('branches').select('*, brands(*), branch_profiles!branch_profiles_branch_id_fkey(*)').order('name', { ascending: true }),
      supabase.from('brands').select('*').order('name'),
      supabase.from('admins').select('*').eq('is_active', true).order('name'),
      user
        ? supabase.from('admins').select('*').eq('auth_id', user.id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from('inquiries').select('branch_id, status, created_at'),
    ])

    if (selfRes.data) setCurrentAdmin(selfRes.data as Admin)
    if (brandRes.data) setBrands(brandRes.data as Brand[])
    if (adminRes.data) setAdmins(adminRes.data as Admin[])

    if (branchRes.data && inqRes.data) {
      const inqs = inqRes.data
      const enriched: ExtendedBranch[] = branchRes.data.map(b => {
        const bi = inqs.filter(i => i.branch_id === b.id)
        const pending = bi.filter(i => ['pending', 'in_progress'].includes(i.status)).length
        const last = [...bi].sort((a, c) => new Date(c.created_at).getTime() - new Date(a.created_at).getTime())[0]
        return { ...b, inquiry_count: bi.length, pending_count: pending, last_inquiry_at: last?.created_at } as ExtendedBranch
      })
      setBranches(enriched)
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // ── 필터링 ───────────────────────────────────────────────────
  const filtered = branches.filter(b => {
    if (filterBrand && b.brand_id !== filterBrand) return false
    if (filterStatus && b.status !== filterStatus) return false
    if (filterType && b.branch_type !== filterType) return false
    if (search) {
      const q = search.toLowerCase()
      if (
        !b.name.toLowerCase().includes(q) &&
        !(b.kos_id || '').toLowerCase().includes(q) &&
        !(b.owner_name || '').toLowerCase().includes(q)
      ) return false
    }
    return true
  })

  const urgentBranches = branches.filter(b => {
    const d = daysUntil(b.contract_end)
    return d !== null && d >= 0 && d <= 30
  })

  // ── 새 지점 생성 ─────────────────────────────────────────────
  async function handleCreateBranch() {
    setCreating(true)
    setCreateMsg('')
    try {
      const res = await fetch('/api/admin/branch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          branchData: {
            name: form.name,
            kos_id: form.kos_id,
            brand_id: form.brand_id || null,
            branch_type: form.branch_type,
            address: form.address,
            phone: form.phone,
            owner_name: form.manager_name,
            contract_start: form.contract_start || null,
            contract_end: form.contract_end || null,
            meal_count: form.meal_count ? parseInt(form.meal_count) : 0,
            diet_type: form.diet_type,
            meal_config: form.meal_config,
            assigned_admin_id: form.assigned_admin_id || null,
          },
          email: form.email,
          tempPassword: form.temp_password,
          managerName: form.manager_name,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setCreateMsg(`오류: ${data.error}`)
      } else {
        setCreateMsg(data.emailSent ? '생성 완료! 이메일이 발송되었습니다.' : '생성 완료! (이메일 발송 실패 — 수동 전달 필요)')
        if (data.branch?.id) {
          const supabase = createClient()
          await supabase.from('branch_profiles').upsert({
            branch_id: data.branch.id,
            diet_plan_type: form.diet_type === 'catering' ? 'CONSIGNMENT' : 'CK',
            snack_morning: form.meal_config['오전'] || false,
            snack_afternoon: form.meal_config['오후'] || false,
            snack_afterschool: form.meal_config['방과후'] || false,
            snack_childcare: form.meal_config['돌봄'] || false,
            snack_teacher_extra: false,
            custom_snack_slots: [],
            nutritionist_name: '',
            nutritionist_email: '',
            distribution_email: '',
            special_notes: '',
            allergy_children: [],
          }, { onConflict: 'branch_id' })
        }
        await load()
        setTimeout(() => {
          setShowNewBranch(false)
          setStep(1)
          setForm(defaultForm())
          setCreateMsg('')
        }, 2000)
      }
    } catch {
      setCreateMsg('오류: 네트워크 문제')
    }
    setCreating(false)
  }

  // ── 새 지점 모달 열기 (원코드 자동생성) ──────────────────────
  async function openNewBranchModal() {
    const nextCode = await generateKzmCode()
    setShowNewBranch(true)
    setStep(1)
    setForm({ ...defaultForm(), kos_id: nextCode })
    setCreateMsg('')
  }

  // ── 새 브랜드 생성 ───────────────────────────────────────────
  async function handleCreateBrand() {
    if (!brandName.trim()) return
    setCreatingBrand(true)
    const supabase = createClient()
    const { error } = await supabase.from('brands').insert({ name: brandName.trim(), code: brandCode || generateBrandCode(brandName), is_active: true })
    if (!error) {
      await load()
      setShowNewBrand(false)
      setBrandName('')
      setBrandCode('')
    }
    setCreatingBrand(false)
  }

  // ── 관리자 계정 생성 ─────────────────────────────────────────
  async function handleCreateAdmin() {
    setCreatingAdmin(true)
    setAdminMsg('')
    try {
      const res = await fetch('/api/admin/branch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create-admin', ...adminForm }),
      })
      const data = await res.json()
      if (!res.ok) {
        setAdminMsg(`오류: ${data.error}`)
      } else {
        setAdminMsg('관리자 계정이 생성되었습니다.')
        await load()
        setTimeout(() => { setShowNewAdmin(false); setAdminMsg('') }, 1500)
      }
    } catch {
      setAdminMsg('오류: 네트워크 문제')
    }
    setCreatingAdmin(false)
  }

  // ── 비밀번호 초기화 ──────────────────────────────────────────
  async function handleResetPassword() {
    if (!selectedBranch) return
    setResetingPw(true)
    setActionMsg('')
    const newPw = generateTempPassword()
    try {
      const res = await fetch('/api/admin/branch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reset-password',
          branchId: selectedBranch.id,
          authId: selectedBranch.auth_id,
          email: selectedBranch.email,
          branchName: selectedBranch.name,
          newPassword: newPw,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setActionMsg(`오류: ${data.error}`)
      } else {
        setActionMsg(data.emailSent ? `임시 비번 발송 완료: ${newPw}` : `임시 비번: ${newPw} (이메일 발송 실패 — 수동 전달)`)
      }
    } catch {
      setActionMsg('오류: 네트워크 문제')
    }
    setResetingPw(false)
  }

  // ── 지점 비활성화 ─────────────────────────────────────────────
  async function handleDeactivate() {
    if (!selectedBranch) return
    setDeactivating(true)
    setActionMsg('')
    try {
      const res = await fetch('/api/admin/branch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'deactivate',
          branchId: selectedBranch.id,
          authId: selectedBranch.auth_id,
          actorId: currentAdmin?.id,
          actorName: currentAdmin?.name,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setActionMsg(`오류: ${data.error}`)
      } else {
        setActionMsg('비활성화 완료')
        await load()
        setSelectedBranch(prev => prev ? { ...prev, status: 'inactive', is_active: false } : null)
        setConfirmDeactivate(false)
      }
    } catch {
      setActionMsg('오류: 네트워크 문제')
    }
    setDeactivating(false)
  }

  // ── 엑셀 처리 ────────────────────────────────────────────────
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const wb = XLSX.read(ev.target?.result as ArrayBuffer, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<ImportRow>(ws)
      const existingEmails = new Set(branches.map(b => b.email?.toLowerCase()))
      const existingKos = new Set(branches.map(b => b.kos_id?.toLowerCase()))
      const marked = rows.map(r => ({
        ...r,
        _duplicate: existingEmails.has((r['이메일'] || '').toLowerCase()) ||
                    existingKos.has((r['KOS ID'] || '').toLowerCase()),
      }))
      setImportRows(marked)
    }
    reader.readAsArrayBuffer(file)
  }

  function downloadTemplate() {
    const ws = XLSX.utils.aoa_to_sheet([[
      '원이름', '브랜드코드', 'KOS ID', '이메일', '담당자명', '연락처', '주소', '식단타입', '계약시작', '계약만료', '식수인원',
    ]])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '지점목록')
    XLSX.writeFile(wb, '지점_일괄등록_템플릿.xlsx')
  }

  async function handleBulkImport() {
    const rows = importRows.filter(r => !r._duplicate)
    if (rows.length === 0) { setImportMsg('등록할 항목 없음'); return }
    setImporting(true)
    setImportMsg('')
    let ok = 0
    let fail = 0
    for (const row of rows) {
      try {
        const pw = generateTempPassword()
        const res = await fetch('/api/admin/branch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create',
            branchData: {
              name: row['원이름'],
              kos_id: row['KOS ID'],
              address: row['주소'],
              phone: row['연락처'],
              owner_name: row['담당자명'],
              diet_type: row['식단타입'] === 'catering' ? 'catering' : 'ck',
              contract_start: row['계약시작'] || null,
              contract_end: row['계약만료'] || null,
              meal_count: parseInt(row['식수인원']) || 0,
            },
            email: row['이메일'],
            tempPassword: pw,
            managerName: row['담당자명'],
          }),
        })
        if (res.ok) ok++; else fail++
      } catch { fail++ }
    }
    setImportMsg(`완료: 성공 ${ok}건, 실패 ${fail}건`)
    await load()
    setImporting(false)
  }

  async function handleStatusChange(branchId: string, status: string) {
    const res = await fetch('/api/admin/branch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update-status', branchId, status }),
    })
    if (res.ok) {
      setBranches(prev => prev.map(b => b.id === branchId ? { ...b, status: status as BranchStatus } : b))
      setSelectedBranch(prev => prev && prev.id === branchId ? { ...prev, status: status as BranchStatus } : prev)
    }
  }

  function handleLogout() {
    const s = createClient()
    s.auth.signOut().then(() => { window.location.href = '/board/login' })
  }

  // ── 렌더 ─────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#F6FAF6] font-sans">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-100 px-4 sm:px-6 py-4 hidden sm:flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-[#2D6A4F] to-[#52B788] rounded-xl flex items-center justify-center text-white font-bold text-sm">K</div>
          <div>
            <div className="flex items-center gap-1 text-xs text-gray-400 mb-0.5">
              <Link href="/board/admin" className="hover:text-[#2D6A4F] transition-colors">소통채널</Link>
              <span>›</span>
              <span>운영관리</span>
              <span>›</span>
              <span className="text-[#2D6A4F] font-medium">원 관리</span>
            </div>
            <h1 className="font-bold text-[#1C2B1E] text-sm">원 관리</h1>
            <p className="text-gray-400 text-xs">계약 원의 정보와 계정을 관리합니다</p>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-3">
          <button onClick={handleLogout} className="text-xs text-gray-400 hover:text-gray-600">로그아웃</button>
        </div>
      </header>

      {/* 탭 */}
      <div className="bg-white border-b border-gray-100 px-4 sm:px-6">
        <div className="flex gap-1 max-w-7xl mx-auto">
          {([['branches', '지점'], ['brands', '브랜드'], ['admins', '관리자계정']] as const).map(([t, label]) => (
            currentAdmin?.role === 'super' || t !== 'admins' ? (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${
                  activeTab === t
                    ? 'border-[#2D6A4F] text-[#2D6A4F]'
                    : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
              >
                {label}
              </button>
            ) : null
          ))}
        </div>
      </div>

      <div className={`max-w-7xl mx-auto px-4 sm:px-6 py-6 ${selectedBranch ? 'pr-0 sm:pr-6' : ''}`}>
        {/* ── 지점 탭 ───────────────────────────────────────── */}
        {activeTab === 'branches' && (
          <div className="flex gap-4">
            <div className="flex-1 min-w-0 space-y-4">
              {/* 계약만료 배너 */}
              {urgentBranches.length > 0 && (
                <div className="bg-orange-50 border border-orange-200 rounded-2xl px-4 py-3 flex items-start gap-3">
                  <span className="text-lg">⚠️</span>
                  <div>
                    <p className="text-sm font-semibold text-orange-800">계약 만료 임박</p>
                    <p className="text-xs text-orange-600 mt-0.5">
                      {urgentBranches.map(b => `${b.name} D-${daysUntil(b.contract_end)}`).join(', ')}
                    </p>
                  </div>
                </div>
              )}

              {/* 상단 액션바 */}
              <div className="flex flex-wrap gap-3 items-center justify-between">
                <div className="flex flex-wrap gap-2 flex-1">
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="지점명, 원코드, 대표자..."
                    className="flex-1 min-w-[160px] px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]"
                  />
                  <select
                    value={filterBrand}
                    onChange={e => setFilterBrand(e.target.value)}
                    className="px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]"
                  >
                    <option value="">전체 브랜드</option>
                    {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                  <select
                    value={filterStatus}
                    onChange={e => setFilterStatus(e.target.value)}
                    className="px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]"
                  >
                    <option value="">전체 상태</option>
                    {Object.entries(STATUS_CFG).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                  <select
                    value={filterType}
                    onChange={e => setFilterType(e.target.value)}
                    className="px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]"
                  >
                    <option value="">전체 타입</option>
                    <option value="franchise">프랜차이즈</option>
                    <option value="independent">독립원</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowImport(true)}
                    className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    엑셀 Import
                  </button>
                  <button
                    onClick={openNewBranchModal}
                    className="px-4 py-2 rounded-xl bg-[#2D6A4F] hover:bg-[#1B4332] text-white text-sm font-semibold transition-colors"
                  >
                    + 새 지점
                  </button>
                </div>
              </div>

              {/* 지점 목록 */}
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                {/* 모바일 카드 */}
                <div className="sm:hidden divide-y divide-gray-50">
                  {loading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="p-4"><div className="h-20 bg-gray-50 rounded-xl animate-pulse" /></div>
                    ))
                  ) : filtered.length === 0 ? (
                    <div className="py-12 text-center text-gray-400 text-sm">지점 없음</div>
                  ) : filtered.map(b => {
                    const days = daysUntil(b.contract_end)
                    return (
                      <button
                        key={b.id}
                        onClick={() => { setSelectedBranch(b); setSlideTab('info'); setActionMsg(''); setConfirmDeactivate(false) }}
                        className={`w-full text-left p-4 space-y-2 hover:bg-[#F8FDF8] transition-colors ${selectedBranch?.id === b.id ? 'bg-[#F0F7F4]' : ''}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-semibold text-[#1C2B1E] text-sm truncate">{b.name}</p>
                            <p className="text-xs text-gray-400 whitespace-nowrap">{b.kos_id}</p>
                          </div>
                          <div className="flex gap-1 flex-shrink-0">
                            <StatusBadge status={b.status} />
                            {b.brands && (
                              <span className="text-xs bg-[#E8F5E9] text-[#2D6A4F] font-medium px-2 py-0.5 rounded-full">{b.brands.name}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {days !== null && (
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${days < 0 ? 'bg-gray-100 text-gray-500' : days <= 14 ? 'bg-red-100 text-red-700' : days <= 30 ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-50 text-blue-700'}`}>
                              {days < 0 ? '만료' : `D-${days}`}
                            </span>
                          )}
                          {(b.pending_count || 0) > 0 && (
                            <span className="text-xs bg-red-100 text-red-700 font-semibold px-2 py-0.5 rounded-full">미처리 {b.pending_count}건</span>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>

                {/* 데스크탑 테이블 */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-[#F8FDF8]">
                        {['지점명', '브랜드', '타입', '상태', '계약만료', '미처리', '마지막문의', ''].map(h => (
                          <th key={h} className="text-left px-4 py-3 text-xs font-bold text-gray-400 whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        Array.from({ length: 4 }).map((_, i) => (
                          <tr key={i}><td colSpan={8} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td></tr>
                        ))
                      ) : filtered.length === 0 ? (
                        <tr><td colSpan={8} className="py-12 text-center text-gray-400 text-sm">지점 없음</td></tr>
                      ) : filtered.map(b => {
                        const days = daysUntil(b.contract_end)
                        return (
                          <tr
                            key={b.id}
                            onClick={() => { setSelectedBranch(b); setSlideTab('info'); setActionMsg(''); setConfirmDeactivate(false) }}
                            className={`hover:bg-[#F8FDF8] cursor-pointer border-t border-gray-50 transition-colors ${selectedBranch?.id === b.id ? 'bg-[#F0F7F4]' : ''}`}
                          >
                            <td className="px-4 py-3 whitespace-nowrap">
                              <p className="text-sm font-semibold text-[#1C2B1E]">{b.name}</p>
                              <p className="text-xs text-gray-400">{b.kos_id}</p>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-xs bg-[#E8F5E9] text-[#2D6A4F] font-medium px-2 py-0.5 rounded-full">
                                {b.brands?.name || '—'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-500">
                              {b.branch_type === 'independent' ? '독립원' : '프랜차이즈'}
                            </td>
                            <td className="px-4 py-3"><StatusBadge status={b.status} /></td>
                            <td className="px-4 py-3">
                              {b.contract_end ? (
                                <div className="flex items-center gap-1">
                                  <span className="text-xs text-gray-500">{b.contract_end}</span>
                                  {days !== null && (
                                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${days < 0 ? 'bg-gray-100 text-gray-500' : days <= 14 ? 'bg-red-100 text-red-700' : days <= 30 ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-50 text-blue-700'}`}>
                                      {days < 0 ? '만료' : `D-${days}`}
                                    </span>
                                  )}
                                </div>
                              ) : <span className="text-xs text-gray-300">—</span>}
                            </td>
                            <td className="px-4 py-3">
                              {(b.pending_count || 0) > 0 ? (
                                <span className="inline-flex items-center justify-center w-6 h-6 bg-red-500 text-white text-xs font-bold rounded-full">{b.pending_count}</span>
                              ) : <span className="text-xs text-gray-300">—</span>}
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-400">
                              {b.last_inquiry_at ? timeAgo(b.last_inquiry_at) : '없음'}
                            </td>
                            <td className="px-4 py-3">
                              <Link
                                href={`/board/admin/inquiries?branch=${b.id}`}
                                onClick={e => e.stopPropagation()}
                                className="text-xs bg-[#2D6A4F] hover:bg-[#1B4332] text-white font-medium px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                              >
                                문의 보기
                              </Link>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="px-5 py-3 border-t border-gray-100">
                  <p className="text-xs text-gray-400">총 {filtered.length}개 지점</p>
                </div>
              </div>
            </div>

            {/* ── 슬라이드 패널 ───────────────────────────── */}
            {selectedBranch && (
              <div className="hidden sm:flex flex-col w-96 flex-shrink-0 bg-white rounded-2xl border border-gray-100 h-fit sticky top-24 max-h-[calc(100vh-7rem)] overflow-hidden">
                {/* 패널 헤더 */}
                <div className="flex items-start justify-between p-5 border-b border-gray-100">
                  <div>
                    <p className="font-bold text-[#1C2B1E]">{selectedBranch.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <StatusBadge status={selectedBranch.status} />
                      {selectedBranch.brands && (
                        <span className="text-xs text-[#2D6A4F] bg-[#E8F5E9] px-2 py-0.5 rounded-full">{selectedBranch.brands.name}</span>
                      )}
                    </div>
                  </div>
                  <button onClick={() => setSelectedBranch(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
                </div>

                {/* 패널 탭 */}
                <div className="flex border-b border-gray-100 overflow-x-auto">
                  {([['info', '기본정보'], ['contract', '계약'], ['diet', '식단설정'], ['account', '계정관리']] as const).map(([t, label]) => (
                    <button
                      key={t}
                      onClick={() => setSlideTab(t)}
                      className={`flex-1 px-3 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors ${slideTab === t ? 'border-[#2D6A4F] text-[#2D6A4F]' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {/* 패널 콘텐츠 */}
                <div className="flex-1 overflow-y-auto p-5 space-y-3">
                  {slideTab === 'info' && (
                    <>
                      {[
                        ['원 이름', selectedBranch.name],
                        ['브랜드', selectedBranch.brands?.name || '—'],
                        ['타입', selectedBranch.branch_type === 'independent' ? '독립원' : '프랜차이즈'],
                        ['원코드', selectedBranch.kos_id || '—'],
                        ['주소', selectedBranch.address || '—'],
                        ['연락처', selectedBranch.phone || '—'],
                        ['대표자', selectedBranch.owner_name || '—'],
                      ].map(([label, value]) => (
                        <div key={label} className="flex justify-between text-sm">
                          <span className="text-gray-400">{label}</span>
                          <span className="text-[#1C2B1E] font-medium text-right max-w-[60%]">{value}</span>
                        </div>
                      ))}
                      <div className="pt-3">
                        <Link
                          href={`/board/admin/branches/${selectedBranch.id}/profile`}
                          className="block w-full text-center text-sm text-[#2D6A4F] border border-[#2D6A4F] rounded-xl py-2 font-medium hover:bg-[#F0F7F4] transition-colors"
                        >
                          프로파일 상세 →
                        </Link>
                      </div>
                    </>
                  )}

                  {slideTab === 'contract' && (
                    <>
                      {[
                        ['계약 시작', selectedBranch.contract_start || '—'],
                        ['계약 만료', selectedBranch.contract_end || '—'],
                        ['식수 인원', selectedBranch.meal_count ? `${selectedBranch.meal_count}명` : '—'],
                        ['식단 타입', selectedBranch.branch_profiles?.diet_plan_type === 'CONSIGNMENT' ? '위탁' : 'CK'],
                      ].map(([label, value]) => (
                        <div key={label} className="flex justify-between text-sm">
                          <span className="text-gray-400">{label}</span>
                          <span className="text-[#1C2B1E] font-medium">{value}</span>
                        </div>
                      ))}
                      {selectedBranch.contract_end && (
                        <div className="mt-3 p-3 rounded-xl bg-[#F8FDF8]">
                          {(() => {
                            const d = daysUntil(selectedBranch.contract_end)
                            if (d === null) return null
                            return (
                              <p className={`text-sm font-bold text-center ${d < 0 ? 'text-gray-500' : d <= 14 ? 'text-red-600' : d <= 30 ? 'text-orange-600' : 'text-[#2D6A4F]'}`}>
                                {d < 0 ? '계약 만료됨' : `D-${d} (${d}일 남음)`}
                              </p>
                            )
                          })()}
                        </div>
                      )}
                      <div className="pt-2">
                        <label className="block text-xs font-medium text-gray-500 mb-1.5">상태 변경</label>
                        <select
                          value={selectedBranch.status || 'active'}
                          onChange={e => handleStatusChange(selectedBranch.id, e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]"
                        >
                          {Object.entries(STATUS_CFG).map(([k, v]) => (
                            <option key={k} value={k}>{v.label}</option>
                          ))}
                        </select>
                      </div>
                    </>
                  )}

                  {slideTab === 'diet' && (() => {
                    const bp = selectedBranch.branch_profiles
                    const snackBadges = [
                      bp?.snack_morning && '오전간식',
                      bp?.snack_afternoon && '오후간식',
                      bp?.snack_afterschool && '방과후간식',
                      bp?.snack_childcare && '돌봄간식',
                      bp?.snack_teacher_extra && '교.추',
                      ...(bp?.custom_snack_slots?.map((s: {label:string}) => s.label) || []),
                    ].filter(Boolean) as string[]
                    const allergyKids = bp?.allergy_children?.length || 0
                    const notes = bp?.special_notes || ''
                    return (
                      <>
                        <div className="flex gap-2 flex-wrap">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${bp?.diet_plan_type === 'CONSIGNMENT' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                            {bp?.diet_plan_type === 'CONSIGNMENT' ? '위탁' : 'CK'}
                          </span>
                          {allergyKids > 0 && (
                            <span className="text-xs bg-red-100 text-red-700 font-semibold px-2 py-0.5 rounded-full">⚠️ {allergyKids}명</span>
                          )}
                        </div>
                        {snackBadges.length > 0 ? (
                          <div>
                            <p className="text-xs text-gray-400 mb-1.5">간식 구성</p>
                            <div className="flex flex-wrap gap-1.5">
                              {snackBadges.map(s => (
                                <span key={s} className="text-xs bg-[#E8F5E9] text-[#2D6A4F] font-medium px-2 py-0.5 rounded-full">{s}</span>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-gray-400">간식 구성 미설정</p>
                        )}
                        {notes && (
                          <div>
                            <p className="text-xs text-gray-400 mb-1">특이사항</p>
                            <p className="text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2">{notes}</p>
                          </div>
                        )}
                        <div className="pt-1">
                          <Link
                            href={`/board/admin/diet/${selectedBranch.id}`}
                            className="block w-full text-center text-sm text-[#2D6A4F] border border-[#2D6A4F] rounded-xl py-2 font-medium hover:bg-[#F0F7F4] transition-colors"
                          >
                            프로파일 설정하기 →
                          </Link>
                        </div>
                      </>
                    )
                  })()}

                  {slideTab === 'account' && (
                    <div className="space-y-4">
                      {[
                        ['이메일', selectedBranch.email || '—'],
                        ['비번 변경 필요', selectedBranch.must_change_password ? '예' : '아니오'],
                        ['상태', selectedBranch.is_active ? '활성' : '비활성'],
                      ].map(([label, value]) => (
                        <div key={label} className="flex justify-between text-sm">
                          <span className="text-gray-400">{label}</span>
                          <span className={`font-medium ${label === '비번 변경 필요' && value === '예' ? 'text-orange-600' : 'text-[#1C2B1E]'}`}>{value}</span>
                        </div>
                      ))}

                      {actionMsg && (
                        <div className={`text-xs px-3 py-2 rounded-xl ${actionMsg.startsWith('오류') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>
                          {actionMsg}
                        </div>
                      )}

                      <button
                        onClick={handleResetPassword}
                        disabled={resetingPw || panelLoading}
                        className="w-full bg-[#2D6A4F] hover:bg-[#1B4332] disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
                      >
                        {resetingPw ? '처리 중...' : '비밀번호 초기화'}
                      </button>

                      {!confirmDeactivate ? (
                        <button
                          onClick={() => setConfirmDeactivate(true)}
                          disabled={!selectedBranch.is_active}
                          className="w-full bg-red-50 hover:bg-red-100 disabled:opacity-40 text-red-600 text-sm font-semibold py-2.5 rounded-xl transition-colors border border-red-200"
                        >
                          {selectedBranch.is_active ? '지점 비활성화' : '이미 비활성'}
                        </button>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-xs text-red-600 text-center font-medium">정말 비활성화할까요? Auth 접근이 차단됩니다.</p>
                          <div className="flex gap-2">
                            <button onClick={() => setConfirmDeactivate(false)} className="flex-1 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">취소</button>
                            <button onClick={handleDeactivate} disabled={deactivating} className="flex-1 py-2 rounded-xl bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-semibold">
                              {deactivating ? '처리 중...' : '확인'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── 브랜드 탭 ──────────────────────────────────────── */}
        {activeTab === 'brands' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="font-bold text-[#1C2B1E]">브랜드 목록</h2>
              <button
                onClick={() => { setShowNewBrand(true); setBrandName(''); setBrandCode('') }}
                className="px-4 py-2 bg-[#2D6A4F] hover:bg-[#1B4332] text-white text-sm font-semibold rounded-xl transition-colors"
              >
                + 새 브랜드
              </button>
            </div>

            {/* 독립원 그룹 */}
            {branches.filter(b => !b.brand_id).length > 0 && (
              <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-4">
                <p className="text-sm font-semibold text-gray-500 mb-3">독립원 (브랜드 미지정)</p>
                <div className="flex flex-wrap gap-2">
                  {branches.filter(b => !b.brand_id).map(b => (
                    <span key={b.id} className="text-xs bg-gray-100 text-gray-600 px-3 py-1 rounded-full">{b.name}</span>
                  ))}
                </div>
              </div>
            )}

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="bg-white rounded-2xl border border-gray-100 h-32 animate-pulse" />
                ))
              ) : brands.map(brand => {
                const branchCount = branches.filter(b => b.brand_id === brand.id).length
                return (
                  <div key={brand.id} className="bg-white rounded-2xl border border-gray-100 p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-bold text-[#1C2B1E]">{brand.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">코드: {brand.code}</p>
                      </div>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${brand.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {brand.is_active ? '활성' : '비활성'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">소속 지점 <span className="font-bold text-[#1C2B1E]">{branchCount}</span>개</p>
                    {branchCount === 0 && (
                      <p className="text-xs text-orange-500 mt-1">소속 지점 없음</p>
                    )}
                  </div>
                )
              })}
              {!loading && brands.length === 0 && (
                <div className="col-span-3 py-12 text-center text-gray-400 text-sm">브랜드 없음</div>
              )}
            </div>
          </div>
        )}

        {/* ── 관리자계정 탭 ──────────────────────────────────── */}
        {activeTab === 'admins' && currentAdmin?.role === 'super' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="font-bold text-[#1C2B1E]">관리자 계정</h2>
              <button
                onClick={() => { setShowNewAdmin(true); setAdminMsg(''); setAdminForm({ name: '', email: '', role: 'general', temp_password: generateTempPassword() }) }}
                className="px-4 py-2 bg-[#2D6A4F] hover:bg-[#1B4332] text-white text-sm font-semibold rounded-xl transition-colors"
              >
                + 새 관리자
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-[#F8FDF8]">
                      {['이름', '이메일', '역할', '상태'].map(h => (
                        <th key={h} className="text-left px-5 py-3 text-xs font-bold text-gray-400">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {loading ? (
                      Array.from({ length: 3 }).map((_, i) => (
                        <tr key={i}><td colSpan={4} className="px-5 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td></tr>
                      ))
                    ) : admins.map(a => (
                      <tr key={a.id} className="hover:bg-[#F8FDF8] transition-colors">
                        <td className="px-5 py-4 text-sm font-semibold text-[#1C2B1E]">{a.name}</td>
                        <td className="px-5 py-4 text-sm text-gray-500">{a.email}</td>
                        <td className="px-5 py-4">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${a.role === 'super' ? 'bg-purple-100 text-purple-700' : a.role === 'nutritionist' ? 'bg-teal-100 text-teal-700' : 'bg-blue-100 text-blue-700'}`}>
                            {a.role === 'super' ? 'Super' : a.role === 'nutritionist' ? '영양사' : '일반'}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${a.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            {a.is_active ? '활성' : '비활성'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* 모바일 */}
              <div className="sm:hidden divide-y divide-gray-50">
                {admins.map(a => (
                  <div key={a.id} className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-[#1C2B1E] text-sm">{a.name}</p>
                      <p className="text-xs text-gray-400">{a.email}</p>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${a.role === 'super' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                      {a.role === 'super' ? 'Super' : '일반'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── 새 지점 모달 ─────────────────────────────────────── */}
      {showNewBranch && (
        <div className="fixed inset-0 bg-black/40 z-30 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-lg sm:rounded-3xl rounded-t-3xl max-h-[90vh] flex flex-col">
            {/* 모달 헤더 */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <div>
                <h2 className="font-bold text-[#1C2B1E]">새 지점 추가</h2>
                <p className="text-xs text-gray-400 mt-0.5">Step {step}/4</p>
              </div>
              <button onClick={() => setShowNewBranch(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>

            {/* 스텝 인디케이터 */}
            <div className="flex px-6 pt-4 gap-2">
              {[1, 2, 3, 4].map(s => (
                <div key={s} className={`flex-1 h-1.5 rounded-full transition-colors ${s <= step ? 'bg-[#2D6A4F]' : 'bg-gray-100'}`} />
              ))}
            </div>

            {/* 모달 콘텐츠 */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {step === 1 && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-2">원 타입</label>
                    <div className="flex gap-3">
                      {[['franchise', '프랜차이즈'], ['independent', '독립원']].map(([v, label]) => (
                        <label key={v} className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="branch_type" value={v} checked={form.branch_type === v}
                            onChange={() => setForm(f => ({ ...f, branch_type: v as 'franchise' | 'independent' }))}
                            className="accent-[#2D6A4F]" />
                          <span className="text-sm">{label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  {form.branch_type === 'franchise' && (
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">브랜드 선택</label>
                      <select value={form.brand_id} onChange={e => setForm(f => ({ ...f, brand_id: e.target.value }))}
                        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]">
                        <option value="">브랜드 선택...</option>
                        {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                    </div>
                  )}
                  {/* 원코드 — 읽기전용 자동생성 */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">원코드 (자동생성)</label>
                    <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50">
                      <span className="text-sm font-mono font-semibold text-[#2D6A4F]">{form.kos_id}</span>
                      <span className="text-xs text-gray-400 ml-auto">자동생성</span>
                    </div>
                  </div>
                  {(['name', 'address', 'phone'] as const).map(field => (
                    <div key={field}>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                        {field === 'name' ? '원 이름 *' : field === 'address' ? '주소' : '연락처'}
                      </label>
                      <input
                        type="text"
                        value={form[field]}
                        onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]"
                        placeholder={field === 'name' ? '원 이름' : field === 'address' ? '주소' : '연락처'}
                      />
                    </div>
                  ))}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">담당 관리자</label>
                    <select value={form.assigned_admin_id} onChange={e => setForm(f => ({ ...f, assigned_admin_id: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]">
                      <option value="">선택 안함</option>
                      {admins.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">계약 시작일</label>
                    <input type="date" value={form.contract_start} onChange={e => setForm(f => ({ ...f, contract_start: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">계약 만료일</label>
                    <input type="date" value={form.contract_end} onChange={e => setForm(f => ({ ...f, contract_end: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">식수 인원</label>
                    <input type="number" value={form.meal_count} onChange={e => setForm(f => ({ ...f, meal_count: e.target.value }))}
                      placeholder="0"
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-2">식단 타입</label>
                    <div className="flex gap-3">
                      {[['ck', 'CK'], ['catering', '위탁']].map(([v, label]) => (
                        <label key={v} className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="diet_type" value={v} checked={form.diet_type === v}
                            onChange={() => setForm(f => ({ ...f, diet_type: v as 'ck' | 'catering' }))}
                            className="accent-[#2D6A4F]" />
                          <span className="text-sm">{label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {step === 3 && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-2">간식 구성</label>
                    <div className="grid grid-cols-2 gap-3">
                      {(['오전', '오후', '방과후', '돌봄'] as const).map(key => (
                        <label key={key} className="flex items-center gap-2 cursor-pointer p-3 rounded-xl border border-gray-200 hover:border-[#2D6A4F] transition-colors">
                          <input
                            type="checkbox"
                            checked={form.meal_config[key]}
                            onChange={e => setForm(f => ({ ...f, meal_config: { ...f.meal_config, [key]: e.target.checked } }))}
                            className="accent-[#2D6A4F] w-4 h-4"
                          />
                          <span className="text-sm font-medium">{key}간식</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="bg-[#F8FDF8] rounded-xl p-4 text-sm text-gray-500">
                    알레르기 아이 정보는 지점 프로파일에서 추가할 수 있습니다.
                  </div>
                </>
              )}

              {step === 4 && (
                <>
                  <div className="bg-blue-50 rounded-xl px-4 py-3 text-xs text-blue-700">
                    계정 생성 후 임시 비밀번호가 이메일로 발송됩니다.
                    첫 로그인 시 비밀번호 변경이 강제됩니다.
                  </div>
                  {(['manager_name', 'email', 'manager_phone'] as const).map(field => (
                    <div key={field}>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                        {field === 'manager_name' ? '담당자 이름 *' : field === 'email' ? '담당자 이메일 *' : '담당자 연락처'}
                      </label>
                      <input
                        type={field === 'email' ? 'email' : 'text'}
                        value={form[field]}
                        onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]"
                        placeholder={field === 'manager_name' ? '담당자 이름' : field === 'email' ? '이메일 주소' : '연락처'}
                      />
                    </div>
                  ))}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">임시 비밀번호 (자동생성)</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={form.temp_password}
                        readOnly
                        className="flex-1 px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setForm(f => ({ ...f, temp_password: generateTempPassword() }))}
                        className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50"
                      >
                        재생성
                      </button>
                    </div>
                  </div>

                  {createMsg && (
                    <div className={`px-4 py-3 rounded-xl text-sm ${createMsg.startsWith('오류') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>
                      {createMsg}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* 모달 푸터 */}
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              {step > 1 && (
                <button onClick={() => setStep(s => s - 1)} className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">이전</button>
              )}
              {step < 4 ? (
                <button
                  onClick={() => setStep(s => s + 1)}
                  disabled={step === 1 && !form.name.trim()}
                  className="flex-1 py-3 rounded-xl bg-[#2D6A4F] hover:bg-[#1B4332] disabled:opacity-40 text-white text-sm font-semibold transition-colors"
                >
                  다음
                </button>
              ) : (
                <button
                  onClick={handleCreateBranch}
                  disabled={creating || !form.email.trim() || !form.manager_name.trim()}
                  className="flex-1 py-3 rounded-xl bg-[#2D6A4F] hover:bg-[#1B4332] disabled:opacity-40 text-white text-sm font-semibold transition-colors"
                >
                  {creating ? '생성 중...' : '계정 생성 및 이메일 발송'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── 새 브랜드 모달 ────────────────────────────────────── */}
      {showNewBrand && (
        <div className="fixed inset-0 bg-black/40 z-30 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-[#1C2B1E]">새 브랜드</h2>
              <button onClick={() => setShowNewBrand(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">브랜드명 *</label>
              <input
                type="text"
                value={brandName}
                onChange={e => { setBrandName(e.target.value); if (!brandCode) setBrandCode(generateBrandCode(e.target.value)) }}
                placeholder="예: 폴리영어"
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">브랜드 코드 (자동생성)</label>
              <input
                type="text"
                value={brandCode}
                onChange={e => setBrandCode(e.target.value.toUpperCase())}
                placeholder="POLY12"
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F] font-mono"
              />
            </div>
            <button
              onClick={handleCreateBrand}
              disabled={creatingBrand || !brandName.trim()}
              className="w-full py-3 rounded-xl bg-[#2D6A4F] hover:bg-[#1B4332] disabled:opacity-40 text-white text-sm font-semibold transition-colors"
            >
              {creatingBrand ? '생성 중...' : '브랜드 생성'}
            </button>
          </div>
        </div>
      )}

      {/* ── 새 관리자 모달 ────────────────────────────────────── */}
      {showNewAdmin && (
        <div className="fixed inset-0 bg-black/40 z-30 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-[#1C2B1E]">새 관리자 계정</h2>
              <button onClick={() => setShowNewAdmin(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>
            {[['name', '이름 *', 'text'], ['email', '이메일 *', 'email']].map(([field, label, type]) => (
              <div key={field}>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">{label}</label>
                <input
                  type={type}
                  value={(adminForm as Record<string, string>)[field]}
                  onChange={e => setAdminForm(f => ({ ...f, [field]: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]"
                  placeholder={label.replace(' *', '')}
                />
              </div>
            ))}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">역할</label>
              <select value={adminForm.role} onChange={e => setAdminForm(f => ({ ...f, role: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]">
                <option value="general">일반 관리자</option>
                <option value="super">Super 관리자</option>
                <option value="nutritionist">영양사</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">임시 비밀번호</label>
              <div className="flex gap-2">
                <input type="text" value={adminForm.temp_password} readOnly className="flex-1 px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 font-mono" />
                <button type="button" onClick={() => setAdminForm(f => ({ ...f, temp_password: generateTempPassword() }))} className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50">재생성</button>
              </div>
            </div>
            {adminMsg && (
              <div className={`px-4 py-3 rounded-xl text-sm ${adminMsg.startsWith('오류') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>{adminMsg}</div>
            )}
            <button
              onClick={handleCreateAdmin}
              disabled={creatingAdmin || !adminForm.name.trim() || !adminForm.email.trim()}
              className="w-full py-3 rounded-xl bg-[#2D6A4F] hover:bg-[#1B4332] disabled:opacity-40 text-white text-sm font-semibold transition-colors"
            >
              {creatingAdmin ? '생성 중...' : '관리자 계정 생성'}
            </button>
          </div>
        </div>
      )}

      {/* ── 엑셀 Import 모달 ──────────────────────────────────── */}
      {showImport && (
        <div className="fixed inset-0 bg-black/40 z-30 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-2xl sm:rounded-3xl rounded-t-3xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <h2 className="font-bold text-[#1C2B1E]">지점 일괄 등록 (엑셀)</h2>
              <button onClick={() => { setShowImport(false); setImportRows([]); setImportMsg('') }} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              <div className="flex flex-wrap gap-3">
                <button onClick={downloadTemplate} className="px-4 py-2 rounded-xl border border-[#2D6A4F] text-[#2D6A4F] text-sm font-medium hover:bg-[#F0F7F4] transition-colors">
                  템플릿 다운로드
                </button>
                <button onClick={() => fileRef.current?.click()} className="px-4 py-2 rounded-xl bg-[#2D6A4F] text-white text-sm font-medium hover:bg-[#1B4332] transition-colors">
                  파일 업로드
                </button>
                <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFileChange} className="hidden" />
              </div>

              {importRows.length > 0 && (
                <div>
                  <p className="text-sm text-gray-500 mb-2">
                    총 {importRows.length}행 ({importRows.filter(r => r._duplicate).length}건 중복 — 빨간색)
                  </p>
                  <div className="overflow-x-auto rounded-xl border border-gray-100">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50">
                        <tr>
                          {['원이름', '이메일', 'KOS ID', '식단타입', '계약만료'].map(h => (
                            <th key={h} className="px-3 py-2 text-left font-semibold text-gray-400">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {importRows.map((row, i) => (
                          <tr key={i} className={row._duplicate ? 'bg-red-50' : ''}>
                            <td className="px-3 py-2 font-medium">{row['원이름']}{row._duplicate && <span className="ml-1 text-red-500">중복</span>}</td>
                            <td className="px-3 py-2 text-gray-500">{row['이메일']}</td>
                            <td className="px-3 py-2 text-gray-500">{row['KOS ID']}</td>
                            <td className="px-3 py-2 text-gray-500">{row['식단타입'] || 'ck'}</td>
                            <td className="px-3 py-2 text-gray-500">{row['계약만료']}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {importMsg && (
                <div className={`px-4 py-3 rounded-xl text-sm ${importMsg.startsWith('오류') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>{importMsg}</div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100">
              <button
                onClick={handleBulkImport}
                disabled={importing || importRows.filter(r => !r._duplicate).length === 0}
                className="w-full py-3 rounded-xl bg-[#2D6A4F] hover:bg-[#1B4332] disabled:opacity-40 text-white text-sm font-semibold transition-colors"
              >
                {importing ? '등록 중...' : `일괄 생성 (${importRows.filter(r => !r._duplicate).length}건)`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 모바일 슬라이드 패널 ──────────────────────────────── */}
      {selectedBranch && (
        <div className="sm:hidden fixed inset-0 bg-black/40 z-30 flex items-end">
          <div className="bg-white w-full rounded-t-3xl max-h-[85vh] flex flex-col">
            <div className="flex items-start justify-between p-5 border-b border-gray-100">
              <div>
                <p className="font-bold text-[#1C2B1E]">{selectedBranch.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <StatusBadge status={selectedBranch.status} />
                  {selectedBranch.brands && (
                    <span className="text-xs text-[#2D6A4F] bg-[#E8F5E9] px-2 py-0.5 rounded-full">{selectedBranch.brands.name}</span>
                  )}
                </div>
              </div>
              <button onClick={() => setSelectedBranch(null)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>

            <div className="flex border-b border-gray-100 overflow-x-auto">
              {([['info', '기본정보'], ['contract', '계약'], ['diet', '식단'], ['account', '계정']] as const).map(([t, label]) => (
                <button key={t} onClick={() => setSlideTab(t)} className={`flex-1 px-3 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors ${slideTab === t ? 'border-[#2D6A4F] text-[#2D6A4F]' : 'border-transparent text-gray-400'}`}>{label}</button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {slideTab === 'info' && (
                <div className="space-y-3">
                  {[['원 이름', selectedBranch.name], ['원코드', selectedBranch.kos_id || '—'], ['연락처', selectedBranch.phone || '—'], ['주소', selectedBranch.address || '—']].map(([l, v]) => (
                    <div key={l} className="flex justify-between text-sm"><span className="text-gray-400">{l}</span><span className="font-medium text-right max-w-[60%]">{v}</span></div>
                  ))}
                  <Link href={`/board/admin/inquiries?branch=${selectedBranch.id}`} className="mt-4 block w-full text-center bg-[#2D6A4F] text-white text-sm font-semibold py-2.5 rounded-xl">문의 보기</Link>
                </div>
              )}
              {slideTab === 'contract' && (
                <div className="space-y-3">
                  {[['계약만료', selectedBranch.contract_end || '—'], ['식수', selectedBranch.meal_count ? `${selectedBranch.meal_count}명` : '—'], ['식단타입', selectedBranch.branch_profiles?.diet_plan_type === 'CONSIGNMENT' ? '위탁' : 'CK']].map(([l, v]) => (
                    <div key={l} className="flex justify-between text-sm"><span className="text-gray-400">{l}</span><span className="font-medium">{v}</span></div>
                  ))}
                  <select value={selectedBranch.status || 'active'} onChange={e => handleStatusChange(selectedBranch.id, e.target.value)}
                    className="w-full mt-3 px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]">
                    {Object.entries(STATUS_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
              )}
              {slideTab === 'diet' && (() => {
                const bp = selectedBranch.branch_profiles
                const snackBadges = [
                  bp?.snack_morning && '오전간식',
                  bp?.snack_afternoon && '오후간식',
                  bp?.snack_afterschool && '방과후간식',
                  bp?.snack_childcare && '돌봄간식',
                  bp?.snack_teacher_extra && '교.추',
                  ...(bp?.custom_snack_slots?.map((s: {label:string}) => s.label) || []),
                ].filter(Boolean) as string[]
                const allergyKids = bp?.allergy_children?.length || 0
                return (
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${bp?.diet_plan_type === 'CONSIGNMENT' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                        {bp?.diet_plan_type === 'CONSIGNMENT' ? '위탁' : 'CK'}
                      </span>
                      {allergyKids > 0 && <span className="text-xs bg-red-100 text-red-700 font-semibold px-2 py-0.5 rounded-full">⚠️ {allergyKids}명</span>}
                    </div>
                    {snackBadges.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {snackBadges.map(s => (
                          <span key={s} className="text-xs bg-[#E8F5E9] text-[#2D6A4F] font-medium px-2 py-0.5 rounded-full">{s}</span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400">간식 구성 미설정</p>
                    )}
                    <Link href={`/board/admin/diet/${selectedBranch.id}`}
                      className="block w-full text-center text-sm bg-[#2D6A4F] text-white font-semibold py-2.5 rounded-xl hover:bg-[#1B4332] transition-colors">
                      프로파일 설정하기
                    </Link>
                  </div>
                )
              })()}
              {slideTab === 'account' && (
                <div className="space-y-3">
                  <div className="flex justify-between text-sm"><span className="text-gray-400">이메일</span><span className="font-medium text-right text-xs">{selectedBranch.email || '—'}</span></div>
                  {actionMsg && <div className={`text-xs px-3 py-2 rounded-xl ${actionMsg.startsWith('오류') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>{actionMsg}</div>}
                  <button onClick={handleResetPassword} disabled={resetingPw} className="w-full bg-[#2D6A4F] disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-xl">{resetingPw ? '처리 중...' : '비밀번호 초기화'}</button>
                  {!confirmDeactivate ? (
                    <button onClick={() => setConfirmDeactivate(true)} disabled={!selectedBranch.is_active} className="w-full bg-red-50 disabled:opacity-40 text-red-600 text-sm font-semibold py-2.5 rounded-xl border border-red-200">{selectedBranch.is_active ? '비활성화' : '이미 비활성'}</button>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs text-red-600 text-center">정말 비활성화할까요?</p>
                      <div className="flex gap-2">
                        <button onClick={() => setConfirmDeactivate(false)} className="flex-1 py-2 rounded-xl border border-gray-200 text-sm text-gray-600">취소</button>
                        <button onClick={handleDeactivate} disabled={deactivating} className="flex-1 py-2 rounded-xl bg-red-500 disabled:opacity-50 text-white text-sm font-semibold">{deactivating ? '처리 중...' : '확인'}</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
