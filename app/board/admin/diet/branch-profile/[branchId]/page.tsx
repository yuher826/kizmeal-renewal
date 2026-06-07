'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import type { BranchProfile } from '@/lib/types'

const ALLERGENS = [
  '난류', '우유', '메밀', '땅콩', '대두', '밀', '고등어',
  '게', '새우', '돼지고기', '복숭아', '토마토', '아황산류',
  '호두', '닭고기', '쇠고기', '오징어', '조개류',
]

interface AllergyChild {
  id: string
  name: string
  allergens: number[]
}

interface FormState {
  branch_full_name: string
  display_name: string
  short_code: string
  group_tag: 'E' | 'P' | 'R' | 'SLP' | 'MB' | '기타' | ''
  contract_status: 'active' | 'inactive'
  contract_start_date: string
  contract_renew_date: string
  inactive_reason: string
  diet_plan_type: 'CK' | 'CONSIGNMENT'
  nutritionist_name: string
  nutritionist_email: string
  file_format: 'pdf' | 'jpg' | 'ppt' | 'pdf+jpg'
  slide_count: 1 | 2 | 3 | 4
  needs_english: boolean
  english_name: string
  snack_morning: boolean
  snack_afternoon: boolean
  snack_afterschool: boolean
  snack_childcare: boolean
  snack_teacher_extra: boolean
  snack_label: string
  childcare_label: string
  morning_snack_fixed: boolean
  morning_snack_fixed_menu: string
  is_elan: boolean
  is_ingpa: boolean
  has_dessert_fruit: boolean
  has_birthday_snack: boolean
  has_health_booklet: boolean
  has_yonder: boolean
  yonder_name: string
  is_table_15row: boolean
  direct_delivery: boolean
  special_note: string
  distribution_emails: string[]
  allergy_children: AllergyChild[]
}

const defaultForm = (): FormState => ({
  branch_full_name: '',
  display_name: '',
  short_code: '',
  group_tag: '',
  contract_status: 'active',
  contract_start_date: '',
  contract_renew_date: '',
  inactive_reason: '',
  diet_plan_type: 'CK',
  nutritionist_name: '',
  nutritionist_email: '',
  file_format: 'pdf',
  slide_count: 1,
  needs_english: false,
  english_name: '',
  snack_morning: false,
  snack_afternoon: true,
  snack_afterschool: false,
  snack_childcare: false,
  snack_teacher_extra: false,
  snack_label: '오전간식/오후간식',
  childcare_label: '돌봄',
  morning_snack_fixed: false,
  morning_snack_fixed_menu: '',
  is_elan: false,
  is_ingpa: false,
  has_dessert_fruit: false,
  has_birthday_snack: false,
  has_health_booklet: false,
  has_yonder: false,
  yonder_name: 'Yonder International',
  is_table_15row: false,
  direct_delivery: false,
  special_note: '',
  distribution_emails: [],
  allergy_children: [],
})

function profileToForm(p: BranchProfile): FormState {
  return {
    branch_full_name: p.branch_full_name || '',
    display_name: p.display_name || '',
    short_code: p.short_code || '',
    group_tag: (p.group_tag as FormState['group_tag']) || '',
    contract_status: p.contract_status || 'active',
    contract_start_date: p.contract_start_date || '',
    contract_renew_date: p.contract_renew_date || '',
    inactive_reason: p.inactive_reason || '',
    diet_plan_type: p.diet_plan_type,
    nutritionist_name: p.nutritionist_name || '',
    nutritionist_email: p.nutritionist_email || '',
    file_format: p.file_format || 'pdf',
    slide_count: (p.slide_count as 1 | 2 | 3 | 4) || 1,
    needs_english: p.needs_english || false,
    english_name: p.english_name || '',
    snack_morning: p.snack_morning,
    snack_afternoon: p.snack_afternoon,
    snack_afterschool: p.snack_afterschool,
    snack_childcare: p.snack_childcare,
    snack_teacher_extra: p.snack_teacher_extra,
    snack_label: p.snack_label || '오전간식/오후간식',
    childcare_label: p.childcare_label || '돌봄',
    morning_snack_fixed: p.morning_snack_fixed || false,
    morning_snack_fixed_menu: p.morning_snack_fixed_menu || '',
    is_elan: p.is_elan || false,
    is_ingpa: p.is_ingpa || false,
    has_dessert_fruit: p.has_dessert_fruit || false,
    has_birthday_snack: p.has_birthday_snack || false,
    has_health_booklet: p.has_health_booklet || false,
    has_yonder: p.has_yonder || false,
    yonder_name: p.yonder_name || 'Yonder International',
    is_table_15row: p.is_table_15row || false,
    direct_delivery: p.direct_delivery || false,
    special_note: p.special_note || '',
    distribution_emails: p.distribution_emails || [],
    allergy_children: (p.allergy_children || []).map(c => ({
      id: c.id,
      name: c.name,
      allergens: c.allergens,
    })),
  }
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6">
      <h2 className="font-bold text-[#1C2B1E] text-sm pb-3 mb-4 border-b border-gray-100">{title}</h2>
      <div className="space-y-4">{children}</div>
    </div>
  )
}

function ToggleBtn({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
        active
          ? 'bg-[#2D6A4F] text-white border-[#2D6A4F]'
          : 'bg-white text-gray-600 border-gray-200 hover:border-[#2D6A4F]'
      }`}
    >
      {children}
    </button>
  )
}

export default function BranchProfilePage() {
  const params = useParams()
  const branchId = params.branchId as string

  const [branchName, setBranchName] = useState('')
  const [form, setForm] = useState<FormState>(defaultForm())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [toastOk, setToastOk] = useState(true)
  const [emailInput, setEmailInput] = useState('')

  const flash = (msg: string, ok = true) => {
    setToast(msg)
    setToastOk(ok)
    setTimeout(() => setToast(''), 3000)
  }

  const load = useCallback(async () => {
    const supabase = createClient()
    const [branchRes, profileRes] = await Promise.all([
      supabase.from('branches').select('name').eq('id', branchId).maybeSingle(),
      supabase.from('branch_profiles').select('*').eq('branch_id', branchId).maybeSingle(),
    ])
    if (branchRes.data) setBranchName(branchRes.data.name)
    if (profileRes.data) setForm(profileToForm(profileRes.data as BranchProfile))
    setLoading(false)
  }, [branchId])

  useEffect(() => { load() }, [load])

  const set = <K extends keyof FormState>(key: K, val: FormState[K]) =>
    setForm(f => ({ ...f, [key]: val }))

  function addEmail() {
    const email = emailInput.trim()
    if (!email.includes('@')) return
    if (form.distribution_emails.includes(email)) { setEmailInput(''); return }
    setForm(f => ({ ...f, distribution_emails: [...f.distribution_emails, email] }))
    setEmailInput('')
  }

  function removeEmail(email: string) {
    setForm(f => ({ ...f, distribution_emails: f.distribution_emails.filter(e => e !== email) }))
  }

  function addChild() {
    const newChild: AllergyChild = { id: crypto.randomUUID(), name: '', allergens: [] }
    setForm(f => ({ ...f, allergy_children: [...f.allergy_children, newChild] }))
  }

  function removeChild(id: string) {
    setForm(f => ({ ...f, allergy_children: f.allergy_children.filter(c => c.id !== id) }))
  }

  function updateChildName(id: string, name: string) {
    setForm(f => ({
      ...f,
      allergy_children: f.allergy_children.map(c => c.id === id ? { ...c, name } : c),
    }))
  }

  function toggleAllergen(childId: string, idx: number) {
    setForm(f => ({
      ...f,
      allergy_children: f.allergy_children.map(c => {
        if (c.id !== childId) return c
        const allergens = c.allergens.includes(idx)
          ? c.allergens.filter(a => a !== idx)
          : [...c.allergens, idx].sort((a, b) => a - b)
        return { ...c, allergens }
      }),
    }))
  }

  async function handleSave() {
    setSaving(true)
    const supabase = createClient()
    const payload = {
      branch_id: branchId,
      // 기본정보
      branch_full_name: form.branch_full_name || null,
      display_name: form.display_name || null,
      short_code: form.short_code || null,
      group_tag: form.group_tag || null,
      contract_status: form.contract_status,
      contract_start_date: form.contract_start_date || null,
      contract_renew_date: form.contract_renew_date || null,
      inactive_reason: form.inactive_reason || null,
      // 식단 타입
      diet_plan_type: form.diet_plan_type,
      nutritionist_name: form.nutritionist_name || null,
      nutritionist_email: form.nutritionist_email || null,
      // 파일설정
      file_format: form.file_format,
      slide_count: form.slide_count,
      needs_english: form.needs_english,
      english_name: form.english_name || null,
      // 간식구성
      snack_morning: form.snack_morning,
      snack_afternoon: form.snack_afternoon,
      snack_afterschool: form.snack_afterschool,
      snack_childcare: form.snack_childcare,
      snack_teacher_extra: form.snack_teacher_extra,
      snack_label: form.snack_label,
      childcare_label: form.childcare_label,
      morning_snack_fixed: form.morning_snack_fixed,
      morning_snack_fixed_menu: form.morning_snack_fixed_menu || null,
      // 특수처리
      is_elan: form.is_elan,
      is_ingpa: form.is_ingpa,
      has_dessert_fruit: form.has_dessert_fruit,
      has_birthday_snack: form.has_birthday_snack,
      has_health_booklet: form.has_health_booklet,
      has_yonder: form.has_yonder,
      yonder_name: form.yonder_name || null,
      is_table_15row: form.is_table_15row,
      direct_delivery: form.direct_delivery,
      special_note: form.special_note || null,
      // 배포설정
      distribution_emails: form.distribution_emails,
      // 알레르기
      allergy_children: form.allergy_children,
    }
    const { error } = await supabase
      .from('branch_profiles')
      .upsert(payload, { onConflict: 'branch_id' })
    if (error) {
      flash('저장 실패: ' + error.message, false)
    } else {
      flash('저장되었습니다!')
    }
    setSaving(false)
  }

  const FILE_FORMATS = [
    { value: 'pdf', label: 'PDF', icon: '📄', desc: '일반 PDF' },
    { value: 'jpg', label: 'JPG', icon: '🖼', desc: '이미지 파일' },
    { value: 'ppt', label: 'PPT', icon: '📊', desc: '파워포인트' },
    { value: 'pdf+jpg', label: 'PDF+JPG', icon: '📦', desc: '엘란 전용 — 4종류 자동생성' },
  ] as const

  const SLIDE_COUNTS = [
    { value: 1 as const, label: '1P', desc: '표준 (1페이지)' },
    { value: 2 as const, label: '2P', desc: '2페이지 구성' },
    { value: 3 as const, label: '3P', desc: '3페이지 구성' },
    { value: 4 as const, label: '4P', desc: '4페이지 구성' },
  ]

  const SPECIAL_CHECKS = [
    { key: 'is_elan' as const, label: '엘란', desc: '알레르기 표기/미표기 4종류 자동생성' },
    { key: 'is_ingpa' as const, label: '잉파', desc: '[잉파X] 규칙 적용 대상' },
    { key: 'has_dessert_fruit' as const, label: '후식과일 행 포함', desc: '잉글리쉬파크 등' },
    { key: 'has_birthday_snack' as const, label: '생일간식 표기', desc: '정발POLY, 목동POLY' },
    { key: 'has_health_booklet' as const, label: '건강정보지 합본', desc: '목동POLY 전용' },
    { key: 'has_yonder' as const, label: 'Yonder International 합본', desc: '송파알티오라 전용' },
    { key: 'is_table_15row' as const, label: '15행 테이블 구조', desc: '동탄POLY, 잉글리쉬파크 등 중식+오전+오후 분리' },
    { key: 'direct_delivery' as const, label: '직접 전달', desc: '이메일 없이 담당자 직접 전달' },
  ]

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F6FAF6] flex items-center justify-center">
        <span className="w-8 h-8 border-2 border-[#2D6A4F]/30 border-t-[#2D6A4F] rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F6FAF6] font-sans pb-28">
      {/* 토스트 */}
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-2xl shadow-lg text-sm font-semibold pointer-events-none ${toastOk ? 'bg-[#2D6A4F] text-white' : 'bg-red-600 text-white'}`}>
          {toast}
        </div>
      )}

      {/* 헤더 */}
      <header className="bg-white border-b border-gray-100 px-4 sm:px-6 h-16 flex items-center sticky top-0 z-10">
        <div className="max-w-2xl mx-auto w-full">
          <div className="flex items-center gap-1 text-xs text-gray-400 mb-0.5">
            <Link href="/board/admin" className="hover:text-[#2D6A4F] transition-colors">관리자</Link>
            <span>›</span>
            <Link href="/board/admin/branches" className="hover:text-[#2D6A4F] transition-colors">원 관리</Link>
            <span>›</span>
            <span className="text-gray-500">{branchName}</span>
            <span>›</span>
            <span className="text-[#2D6A4F] font-medium">프로파일 설정</span>
          </div>
          <div className="flex items-center gap-2">
            <h1 className="font-bold text-[#1C2B1E] text-sm">{branchName || '원 프로파일 설정'}</h1>
            {form.contract_status === 'active' ? (
              <span className="text-xs bg-green-100 text-green-700 font-semibold px-2 py-0.5 rounded-full">활성</span>
            ) : (
              <span className="text-xs bg-gray-100 text-gray-500 font-semibold px-2 py-0.5 rounded-full">비활성</span>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-5">

        {/* ── 섹션 1: 기본정보 ── */}
        <SectionCard title="섹션 1 — 기본정보">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">원 풀네임</label>
            <input
              type="text"
              value={form.branch_full_name}
              onChange={e => set('branch_full_name', e.target.value)}
              placeholder="예: 키즈밀 목동POLY영어학원"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              식단표 표기 원명
              <span className="ml-1 text-gray-400 font-normal">(PPTX 슬라이드 타이틀에 표기되는 이름)</span>
            </label>
            <input
              type="text"
              value={form.display_name}
              onChange={e => set('display_name', e.target.value)}
              placeholder="예: 목동POLY영어학원"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              대괄호 약자
              <span className="ml-1 text-gray-400 font-normal">(원별 요청사항 매칭에 사용 — 예: 목동E, 일산P)</span>
            </label>
            <input
              type="text"
              value={form.short_code}
              onChange={e => set('short_code', e.target.value)}
              placeholder="예: 목동E"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">그룹 태그</label>
            <select
              value={form.group_tag}
              onChange={e => set('group_tag', e.target.value as FormState['group_tag'])}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]"
            >
              <option value="">선택 안함</option>
              {(['E', 'P', 'R', 'SLP', 'MB', '기타'] as const).map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">식단 타입</label>
            <div className="flex gap-2">
              <ToggleBtn active={form.diet_plan_type === 'CK'} onClick={() => set('diet_plan_type', 'CK')}>CK식단</ToggleBtn>
              <ToggleBtn active={form.diet_plan_type === 'CONSIGNMENT'} onClick={() => set('diet_plan_type', 'CONSIGNMENT')}>위탁</ToggleBtn>
            </div>
            {form.diet_plan_type === 'CONSIGNMENT' && (
              <div className="mt-3 space-y-3 p-4 bg-purple-50 rounded-xl">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">영양사 이름</label>
                  <input
                    type="text"
                    value={form.nutritionist_name}
                    onChange={e => set('nutritionist_name', e.target.value)}
                    placeholder="영양사 이름"
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">영양사 이메일</label>
                  <input
                    type="email"
                    value={form.nutritionist_email}
                    onChange={e => set('nutritionist_email', e.target.value)}
                    placeholder="nutritionist@example.com"
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]"
                  />
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">계약 상태</label>
            <div className="flex gap-2">
              <ToggleBtn active={form.contract_status === 'active'} onClick={() => set('contract_status', 'active')}>활성</ToggleBtn>
              <ToggleBtn active={form.contract_status === 'inactive'} onClick={() => set('contract_status', 'inactive')}>비활성</ToggleBtn>
            </div>
            {form.contract_status === 'inactive' && (
              <div className="mt-3">
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">비활성 사유</label>
                <input
                  type="text"
                  value={form.inactive_reason}
                  onChange={e => set('inactive_reason', e.target.value)}
                  placeholder="예: 폐원, 계약해지"
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">계약 시작일</label>
              <input
                type="date"
                value={form.contract_start_date}
                onChange={e => set('contract_start_date', e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">계약 갱신일</label>
              <input
                type="date"
                value={form.contract_renew_date}
                onChange={e => set('contract_renew_date', e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]"
              />
            </div>
          </div>
        </SectionCard>

        {/* ── 섹션 2: 파일 및 슬라이드 설정 ── */}
        <SectionCard title="섹션 2 — 파일 및 슬라이드 설정">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">파일 형식</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {FILE_FORMATS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => set('file_format', opt.value)}
                  className={`p-3 rounded-xl border text-left transition-colors ${
                    form.file_format === opt.value
                      ? 'border-[#2D6A4F] bg-[#F0F7F4]'
                      : 'border-gray-200 hover:border-[#2D6A4F]'
                  }`}
                >
                  <div className="text-xl mb-1">{opt.icon}</div>
                  <div className="text-xs font-bold text-[#1C2B1E]">{opt.label}</div>
                  <div className="text-xs text-gray-400 leading-tight mt-0.5">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">슬라이드 구성</label>
            <div className="grid grid-cols-4 gap-2.5">
              {SLIDE_COUNTS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => set('slide_count', opt.value)}
                  className={`p-3 rounded-xl border text-center transition-colors ${
                    form.slide_count === opt.value
                      ? 'border-[#2D6A4F] bg-[#F0F7F4]'
                      : 'border-gray-200 hover:border-[#2D6A4F]'
                  }`}
                >
                  <div className="text-sm font-bold text-[#1C2B1E]">{opt.label}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={form.needs_english}
                onChange={e => set('needs_english', e.target.checked)}
                className="w-4 h-4 accent-[#2D6A4F]"
              />
              <span className="text-sm font-medium text-[#1C2B1E]">영문 식단표 필요</span>
            </label>
            {form.needs_english && (
              <div className="mt-3">
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">영문 원명</label>
                <input
                  type="text"
                  value={form.english_name}
                  onChange={e => set('english_name', e.target.value)}
                  placeholder="예: Mokdong POLY English Academy"
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]"
                />
              </div>
            )}
          </div>
        </SectionCard>

        {/* ── 섹션 3: 간식 구성 ── */}
        <SectionCard title="섹션 3 — 간식 구성">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">간식 항목</label>
            <div className="grid grid-cols-2 gap-2.5">
              {([
                ['snack_morning', '오전간식'],
                ['snack_afternoon', '오후간식'],
                ['snack_afterschool', '방과후간식'],
                ['snack_childcare', '돌봄간식'],
              ] as const).map(([key, label]) => (
                <label
                  key={key}
                  className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-colors ${
                    form[key] ? 'bg-[#E8F5E9] border-[#52B788]' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={form[key]}
                    onChange={e => set(key, e.target.checked)}
                    className="w-4 h-4 accent-[#2D6A4F]"
                  />
                  <span className={`text-sm font-medium ${form[key] ? 'text-[#2D6A4F]' : 'text-gray-600'}`}>{label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">간식 표기명</label>
            <div className="space-y-2">
              {(['오전간식/오후간식', '간식'] as const).map(val => (
                <label key={val} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={form.snack_label === val}
                    onChange={() => set('snack_label', val)}
                    className="accent-[#2D6A4F]"
                  />
                  <span className="text-sm">
                    {val === '오전간식/오후간식'
                      ? '오전간식/오후간식 (기본)'
                      : '간식 (수지P, 광교P, 대치P 등)'}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {form.snack_childcare && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-2">돌봄 표기명</label>
              <div className="space-y-2">
                {(['돌봄', '저녁'] as const).map(val => (
                  <label key={val} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={form.childcare_label === val}
                      onChange={() => set('childcare_label', val)}
                      className="accent-[#2D6A4F]"
                    />
                    <span className="text-sm">
                      {val === '돌봄' ? '돌봄 (기본)' : '저녁 (송파ECC)'}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={form.morning_snack_fixed}
                onChange={e => set('morning_snack_fixed', e.target.checked)}
                className="w-4 h-4 accent-[#2D6A4F]"
              />
              <span className="text-sm font-medium text-[#1C2B1E]">오전간식 고정 (동탄POLY 전용)</span>
            </label>
            {form.morning_snack_fixed && (
              <div className="mt-3">
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">고정 메뉴명</label>
                <input
                  type="text"
                  value={form.morning_snack_fixed_menu}
                  onChange={e => set('morning_snack_fixed_menu', e.target.value)}
                  placeholder="예: 유기농우유"
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]"
                />
              </div>
            )}
          </div>
        </SectionCard>

        {/* ── 섹션 4: 특수 처리 ── */}
        <SectionCard title="섹션 4 — 특수 처리">
          <div className="space-y-3">
            {SPECIAL_CHECKS.map(({ key, label, desc }) => (
              <div key={key}>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form[key] as boolean}
                    onChange={e => set(key, e.target.checked)}
                    className="w-4 h-4 accent-[#2D6A4F] mt-0.5 shrink-0"
                  />
                  <div>
                    <span className="text-sm font-medium text-[#1C2B1E]">{label}</span>
                    <span className="text-xs text-gray-400 ml-2">— {desc}</span>
                  </div>
                </label>
                {key === 'has_yonder' && form.has_yonder && (
                  <div className="mt-2 ml-7">
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Yonder 영문명</label>
                    <input
                      type="text"
                      value={form.yonder_name}
                      onChange={e => set('yonder_name', e.target.value)}
                      placeholder="Yonder International"
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">기타 특이사항</label>
            <textarea
              value={form.special_note}
              onChange={e => set('special_note', e.target.value)}
              rows={3}
              placeholder="예) 주스 오전1/오후1, 기타 주의사항"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F] resize-none"
            />
          </div>
        </SectionCard>

        {/* ── 섹션 5: 배포 이메일 ── */}
        {!form.direct_delivery && (
          <SectionCard title="섹션 5 — 배포 이메일">
            <p className="text-xs text-gray-400 -mt-2">매주 식단표 PDF 자동 발송 이메일 목록</p>
            <div className="flex gap-2">
              <input
                type="email"
                value={emailInput}
                onChange={e => setEmailInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addEmail()}
                placeholder="이메일 주소 입력"
                className="flex-1 px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]"
              />
              <button
                type="button"
                onClick={addEmail}
                className="px-4 py-2.5 rounded-xl bg-[#2D6A4F] hover:bg-[#1B4332] text-white text-sm font-semibold transition-colors whitespace-nowrap"
              >
                추가
              </button>
            </div>
            {form.distribution_emails.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {form.distribution_emails.map(email => (
                  <span
                    key={email}
                    className="inline-flex items-center gap-1.5 text-xs bg-[#E8F5E9] text-[#2D6A4F] font-medium px-3 py-1.5 rounded-full"
                  >
                    {email}
                    <button
                      type="button"
                      onClick={() => removeEmail(email)}
                      className="hover:text-red-500 leading-none text-base"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            {form.distribution_emails.length === 0 && (
              <p className="text-xs text-gray-400">추가된 이메일 없음</p>
            )}
          </SectionCard>
        )}

        {/* ── 섹션 6: 알레르기 아동 관리 ── */}
        <SectionCard title="섹션 6 — 알레르기 아동 관리">
          {form.allergy_children.map((child, idx) => (
            <div key={child.id} className="border border-gray-100 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <input
                  type="text"
                  value={child.name}
                  onChange={e => updateChildName(child.id, e.target.value)}
                  placeholder={`아동 ${idx + 1} 이름`}
                  className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]"
                />
                <button
                  type="button"
                  onClick={() => removeChild(child.id)}
                  className="text-xs text-red-400 hover:text-red-600 font-medium whitespace-nowrap"
                >
                  삭제
                </button>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                {ALLERGENS.map((name, i) => {
                  const no = i + 1
                  const on = child.allergens.includes(no)
                  return (
                    <button
                      key={no}
                      type="button"
                      onClick={() => toggleAllergen(child.id, no)}
                      className={`text-xs px-2 py-1.5 rounded-lg border transition-colors text-left ${
                        on
                          ? 'bg-red-500 border-red-500 text-white font-bold'
                          : 'bg-white border-gray-200 text-gray-600 hover:border-red-300'
                      }`}
                    >
                      <span className="font-mono">{no}.</span> {name}
                    </button>
                  )
                })}
              </div>
              {child.allergens.length > 0 && (
                <p className="text-xs text-red-600 font-medium">
                  선택된 항목: {child.allergens.map(n => `${n}.${ALLERGENS[n - 1]}`).join(', ')}
                </p>
              )}
            </div>
          ))}

          <button
            type="button"
            onClick={addChild}
            className="w-full py-3 rounded-xl border-2 border-dashed border-[#2D6A4F] text-[#2D6A4F] text-sm font-semibold hover:bg-[#F0F7F4] transition-colors"
          >
            + 아동 추가
          </button>
        </SectionCard>

      </div>

      {/* 고정 저장바 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-4 z-10">
        <div className="max-w-2xl mx-auto">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-[#2D6A4F] hover:bg-[#1B4332] disabled:opacity-50 text-white text-sm font-bold py-3.5 rounded-xl transition-colors"
          >
            {saving ? '저장 중...' : '저장하기'}
          </button>
        </div>
      </div>
    </div>
  )
}
