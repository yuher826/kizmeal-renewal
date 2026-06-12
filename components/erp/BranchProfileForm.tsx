'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Building2, FileText, Coffee, Mail, Settings2, FileEdit, Loader2,
} from 'lucide-react'
import type { BranchProfileDetail } from '@/types/branch-profile'

// ── 공유 타입 ────────────────────────────────────────────────────────
interface FormState {
  branch_full_name: string
  display_name: string
  short_code: string
  group_tag: string
  diet_type: string
  contract_status: string
  contract_start_date: string
  renew_date: string
  diet_plan_type: string
  file_format: string
  slide_count: string
  slide_type: string
  needs_english: boolean
  english_name: string
  english_code: string
  pptx_template_id: string
  snack_morning: boolean
  snack_afternoon: boolean
  snack_afterschool: boolean
  snack_childcare: boolean
  snack_teacher_extra: boolean
  has_dessert_fruit: boolean
  has_birthday_snack: boolean
  has_health_booklet: boolean
  has_yonder: boolean
  yonder_name: string
  distribution_emails: string[]
  review_required: boolean
  is_elan: boolean
  is_ingpa: boolean
  is_table_15row: boolean
  direct_delivery: boolean
  special_notes: string
  memo: string
  nutritionist_name: string
  nutritionist_email: string
}

interface Props {
  initialData?: BranchProfileDetail
  onSave: (data: Partial<BranchProfileDetail>) => Promise<void>
  isSaving?: boolean
  isNew?: boolean
  onCancel?: () => void
}

// PPTX 변경 감지 대상 필드
const PPTX_WATCH_FIELDS: (keyof FormState)[] = [
  'file_format', 'slide_count', 'distribution_emails',
  'pptx_template_id', 'needs_english',
]

// ── 토글 스위치 ──────────────────────────────────────────────────────
function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
        checked ? 'bg-emerald-500' : 'bg-slate-200'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  )
}

// ── 토글 행 ─────────────────────────────────────────────────────────
function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-slate-700">{label}</span>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  )
}

// ── 섹션 헤더 ────────────────────────────────────────────────────────
function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-5">
      <span className="text-emerald-600">{icon}</span>
      <h3 className="text-base font-semibold text-slate-800">{title}</h3>
    </div>
  )
}

// ── 필드 레이블 ──────────────────────────────────────────────────────
function FieldLabel({
  children,
  required,
  pptx,
  htmlFor,
}: {
  children: React.ReactNode
  required?: boolean
  pptx?: boolean
  htmlFor?: string
}) {
  return (
    <label htmlFor={htmlFor} className="flex items-center gap-1.5 text-sm font-medium text-slate-700 mb-1">
      {children}
      {required && <span className="text-red-500 text-xs"> *</span>}
      {pptx && (
        <span className="bg-emerald-100 text-emerald-700 text-xs rounded px-1.5 py-0.5">
          PPTX 필수
        </span>
      )}
    </label>
  )
}

// ── 변경 감지 경고 ───────────────────────────────────────────────────
function PptxChangeWarning() {
  return (
    <div className="bg-amber-50 border border-amber-200 text-amber-700 text-xs rounded-lg px-3 py-2 mt-3">
      ⚠️ 변경사항은 다음 PPTX 생성 시부터 적용됩니다
    </div>
  )
}

// ── 초기 폼 상태 ─────────────────────────────────────────────────────
function buildInitial(d?: BranchProfileDetail): FormState {
  return {
    branch_full_name:    d?.branch_full_name    ?? '',
    display_name:        d?.display_name        ?? '',
    short_code:          d?.short_code          ?? '',
    group_tag:           d?.group_tag           ?? '',
    diet_type:           d?.diet_type           ?? '',
    contract_status:     d?.contract_status     ?? 'active',
    contract_start_date: d?.contract_start_date ?? '',
    renew_date:          d?.renew_date          ?? '',
    diet_plan_type:      d?.diet_plan_type      ?? 'CK',
    file_format:         d?.file_format         ?? '',
    slide_count:         d?.slide_count         != null ? String(d.slide_count) : '',
    slide_type:          d?.slide_type          ?? '',
    needs_english:       d?.needs_english       ?? false,
    english_name:        d?.english_name        ?? '',
    english_code:        d?.english_code        ?? '',
    pptx_template_id:    d?.pptx_template_id    ?? '',
    snack_morning:       d?.snack_morning       ?? false,
    snack_afternoon:     d?.snack_afternoon     ?? false,
    snack_afterschool:   d?.snack_afterschool   ?? false,
    snack_childcare:     d?.snack_childcare     ?? false,
    snack_teacher_extra: d?.snack_teacher_extra ?? false,
    has_dessert_fruit:   d?.has_dessert_fruit   ?? false,
    has_birthday_snack:  d?.has_birthday_snack  ?? false,
    has_health_booklet:  d?.has_health_booklet  ?? false,
    has_yonder:          d?.has_yonder          ?? false,
    yonder_name:         d?.yonder_name         ?? '',
    distribution_emails: d?.distribution_emails ?? [],
    review_required:     d?.review_required     ?? false,
    is_elan:             d?.is_elan             ?? false,
    is_ingpa:            d?.is_ingpa            ?? false,
    is_table_15row:      d?.is_table_15row      ?? false,
    direct_delivery:     d?.direct_delivery     ?? false,
    special_notes:       d?.special_notes       ?? '',
    memo:                d?.memo                ?? '',
    nutritionist_name:   d?.nutritionist_name   ?? '',
    nutritionist_email:  d?.nutritionist_email  ?? '',
  }
}

// ── 메인 컴포넌트 ────────────────────────────────────────────────────
export default function BranchProfileForm({
  initialData,
  onSave,
  isSaving,
  isNew,
  onCancel,
}: Props) {
  const [form, setForm] = useState<FormState>(() => buildInitial(initialData))
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})
  const [emailInput, setEmailInput] = useState('')
  const [emailError, setEmailError] = useState('')

  useEffect(() => {
    setForm(buildInitial(initialData))
  }, [initialData?.id])

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm(prev => ({ ...prev, [k]: v }))
    if (errors[k]) setErrors(prev => ({ ...prev, [k]: undefined }))
  }

  // PPTX 변경 감지
  function pptxChanged(field: keyof FormState): boolean {
    if (isNew || !initialData) return false
    const orig = initialData[field as keyof BranchProfileDetail]
    const curr = form[field]
    if (Array.isArray(orig) && Array.isArray(curr)) {
      return JSON.stringify([...(orig as string[])].sort()) !==
             JSON.stringify([...curr].sort())
    }
    return String(orig ?? '') !== String(curr ?? '')
  }

  function anyPptxChanged(): boolean {
    return PPTX_WATCH_FIELDS.some(f => pptxChanged(f))
  }

  // 이메일 태그 추가
  function addEmail(raw: string) {
    const trimmed = raw.trim().replace(/,$/, '')
    if (!trimmed) return
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailError('올바른 이메일 형식이 아닙니다')
      return
    }
    if (form.distribution_emails.includes(trimmed)) {
      setEmailError('이미 추가된 이메일입니다')
      return
    }
    set('distribution_emails', [...form.distribution_emails, trimmed])
    setEmailInput('')
    setEmailError('')
    if (errors.distribution_emails) setErrors(p => ({ ...p, distribution_emails: undefined }))
  }

  function removeEmail(email: string) {
    set('distribution_emails', form.distribution_emails.filter(e => e !== email))
  }

  function handleEmailKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addEmail(emailInput)
    }
  }

  // 유효성 검증
  function validate(): boolean {
    const newErrors: Partial<Record<keyof FormState, string>> = {}
    if (!form.branch_full_name.trim())
      newErrors.branch_full_name = '원 전체명은 필수입니다'
    if (!form.short_code.trim())
      newErrors.short_code = '약칭은 필수입니다 (PPTX 파일명에 사용)'
    if (!form.file_format)
      newErrors.file_format = '파일형식을 선택해주세요 (PPTX 생성 필수)'
    if (form.distribution_emails.length === 0)
      newErrors.distribution_emails = '배포 이메일을 1개 이상 입력해주세요 (PPTX 생성 필수)'
    setErrors(newErrors)
    if (Object.keys(newErrors).length > 0) {
      const firstKey = Object.keys(newErrors)[0]
      document.getElementById(`field-${firstKey}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return false
    }
    return true
  }

  async function handleSave() {
    if (!validate()) return
    const data: Partial<BranchProfileDetail> = {
      ...form,
      slide_count: form.slide_count ? Number(form.slide_count) : null,
    }
    await onSave(data)
  }

  const inputCls = (hasErr?: boolean) =>
    `w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 ${
      hasErr ? 'border-red-400' : 'border-slate-300'
    }`
  const selectCls = (hasErr?: boolean) =>
    `w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-white ${
      hasErr ? 'border-red-400' : 'border-slate-300'
    }`

  return (
    <div className="pb-24">
      {/* ── 섹션 1: 기본 정보 ─────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 mb-4">
        <SectionHeader icon={<Building2 size={18} />} title="기본 정보" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 원 전체명 */}
          <div id="field-branch_full_name">
            <FieldLabel required htmlFor="branch_full_name">원 전체명</FieldLabel>
            <input
              id="branch_full_name"
              type="text"
              value={form.branch_full_name}
              onChange={e => set('branch_full_name', e.target.value)}
              className={inputCls(!!errors.branch_full_name)}
              placeholder="예: 강남어린이집"
            />
            {errors.branch_full_name && (
              <p className="text-red-500 text-xs mt-1">{errors.branch_full_name}</p>
            )}
          </div>
          {/* 화면 표시명 */}
          <div>
            <FieldLabel htmlFor="display_name">화면 표시명</FieldLabel>
            <input
              id="display_name"
              type="text"
              value={form.display_name}
              onChange={e => set('display_name', e.target.value)}
              className={inputCls()}
              placeholder="예: 강남원"
            />
          </div>
          {/* 약칭 */}
          <div id="field-short_code">
            <FieldLabel required pptx htmlFor="short_code">약칭</FieldLabel>
            <input
              id="short_code"
              type="text"
              value={form.short_code}
              onChange={e => set('short_code', e.target.value)}
              className={inputCls(!!errors.short_code)}
              placeholder="예: 강남E (PPTX 파일명에 사용)"
            />
            {errors.short_code && (
              <p className="text-red-500 text-xs mt-1">{errors.short_code}</p>
            )}
          </div>
          {/* 그룹 */}
          <div>
            <FieldLabel htmlFor="group_tag">그룹</FieldLabel>
            <select
              id="group_tag"
              value={form.group_tag}
              onChange={e => set('group_tag', e.target.value)}
              className={selectCls()}
            >
              <option value="">선택 안함</option>
              {['E', 'P', 'R', 'SLP', 'MB', '기타'].map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>
          {/* 식단 타입 */}
          <div>
            <FieldLabel htmlFor="diet_type">식단 타입</FieldLabel>
            <select
              id="diet_type"
              value={form.diet_type}
              onChange={e => set('diet_type', e.target.value)}
              className={selectCls()}
            >
              <option value="">선택 안함</option>
              <option value="ck">CK직영</option>
              <option value="consignment">위탁</option>
            </select>
          </div>
          {/* 계약 상태 */}
          <div>
            <FieldLabel htmlFor="contract_status">계약 상태</FieldLabel>
            <select
              id="contract_status"
              value={form.contract_status}
              onChange={e => set('contract_status', e.target.value)}
              className={selectCls()}
            >
              <option value="active">계약중</option>
              <option value="inactive">만료</option>
            </select>
          </div>
          {/* 계약 시작일 */}
          <div>
            <FieldLabel htmlFor="contract_start_date">계약 시작일</FieldLabel>
            <input
              id="contract_start_date"
              type="date"
              value={form.contract_start_date}
              onChange={e => set('contract_start_date', e.target.value)}
              className={inputCls()}
            />
          </div>
          {/* 계약 갱신일 */}
          <div>
            <FieldLabel htmlFor="renew_date">계약 갱신일</FieldLabel>
            <input
              id="renew_date"
              type="date"
              value={form.renew_date}
              onChange={e => set('renew_date', e.target.value)}
              className={inputCls()}
            />
          </div>
        </div>
      </div>

      {/* ── 섹션 2: 식단 파일 설정 ───────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 mb-4">
        <SectionHeader icon={<FileText size={18} />} title="식단 파일 설정" />
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 mb-5 text-xs text-blue-700">
          🖨️ 이 섹션의 PPTX 필수 항목이 미입력 시 해당 고객사 식단표가 생성되지 않습니다
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 파일형식 */}
          <div id="field-file_format">
            <FieldLabel required pptx htmlFor="file_format">파일형식</FieldLabel>
            <select
              id="file_format"
              value={form.file_format}
              onChange={e => set('file_format', e.target.value)}
              className={selectCls(!!errors.file_format)}
            >
              <option value="">선택해주세요</option>
              <option value="pdf">PDF — 기본 배포 형식</option>
              <option value="jpg">JPG — 이미지 형식</option>
              <option value="ppt">PPT — 파워포인트 원본</option>
              <option value="pdf+jpg">PDF+JPG — 두 형식 모두 배포</option>
            </select>
            {errors.file_format && (
              <p className="text-red-500 text-xs mt-1">{errors.file_format}</p>
            )}
            {!isNew && pptxChanged('file_format') && <PptxChangeWarning />}
          </div>
          {/* 슬라이드 수 */}
          <div>
            <FieldLabel required pptx htmlFor="slide_count">슬라이드 수</FieldLabel>
            <select
              id="slide_count"
              value={form.slide_count}
              onChange={e => set('slide_count', e.target.value)}
              className={selectCls()}
            >
              <option value="">선택해주세요</option>
              {[1, 2, 3, 4].map(n => (
                <option key={n} value={String(n)}>{n}p</option>
              ))}
            </select>
            {!isNew && pptxChanged('slide_count') && <PptxChangeWarning />}
          </div>
          {/* 슬라이드 타입 */}
          <div>
            <FieldLabel htmlFor="slide_type">슬라이드 타입</FieldLabel>
            <input
              id="slide_type"
              type="text"
              value={form.slide_type}
              onChange={e => set('slide_type', e.target.value)}
              className={inputCls()}
              placeholder="예: A타입, B타입"
            />
          </div>
          {/* 템플릿 ID */}
          <div>
            <FieldLabel htmlFor="pptx_template_id">템플릿 ID</FieldLabel>
            <input
              id="pptx_template_id"
              type="text"
              value={form.pptx_template_id}
              onChange={e => set('pptx_template_id', e.target.value)}
              className={inputCls()}
              placeholder="(비워두면 기본 템플릿 사용)"
            />
            {!isNew && pptxChanged('pptx_template_id') && <PptxChangeWarning />}
          </div>
          {/* 식단 계획 타입 */}
          <div>
            <FieldLabel htmlFor="diet_plan_type">식단 계획 타입</FieldLabel>
            <select
              id="diet_plan_type"
              value={form.diet_plan_type}
              onChange={e => set('diet_plan_type', e.target.value)}
              className={selectCls()}
            >
              <option value="CK">CK 직영</option>
              <option value="CONSIGNMENT">위탁</option>
            </select>
          </div>
          {/* 영문 식단표 */}
          <div className="flex items-center justify-between">
            <FieldLabel>영문 식단표 필요</FieldLabel>
            <Toggle
              checked={form.needs_english}
              onChange={v => set('needs_english', v)}
            />
          </div>
          {form.needs_english && (
            <>
              <div>
                <FieldLabel htmlFor="english_name">영문 원명</FieldLabel>
                <input
                  id="english_name"
                  type="text"
                  value={form.english_name}
                  onChange={e => set('english_name', e.target.value)}
                  className={inputCls()}
                />
              </div>
              <div>
                <FieldLabel htmlFor="english_code">영문 코드</FieldLabel>
                <input
                  id="english_code"
                  type="text"
                  value={form.english_code}
                  onChange={e => set('english_code', e.target.value)}
                  className={inputCls()}
                />
              </div>
            </>
          )}
          {!isNew && pptxChanged('needs_english') && (
            <div className="md:col-span-2"><PptxChangeWarning /></div>
          )}
        </div>
        {!isNew && anyPptxChanged() && (
          <div className="mt-3 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            ⚠️ PPTX 관련 설정이 변경되었습니다. 저장 후 다음 PPTX 생성부터 적용됩니다.
          </div>
        )}
      </div>

      {/* ── 섹션 3: 간식/특식 설정 ──────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 mb-4">
        <SectionHeader icon={<Coffee size={18} />} title="간식/특식 설정" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
          <ToggleRow label="오전 간식"     checked={form.snack_morning}       onChange={v => set('snack_morning', v)} />
          <ToggleRow label="오후 간식"     checked={form.snack_afternoon}     onChange={v => set('snack_afternoon', v)} />
          <ToggleRow label="방과후 간식"   checked={form.snack_afterschool}   onChange={v => set('snack_afterschool', v)} />
          <ToggleRow label="종일반 간식"   checked={form.snack_childcare}     onChange={v => set('snack_childcare', v)} />
          <ToggleRow label="교직원 추가"   checked={form.snack_teacher_extra} onChange={v => set('snack_teacher_extra', v)} />
          <ToggleRow label="후식 과일"     checked={form.has_dessert_fruit}   onChange={v => set('has_dessert_fruit', v)} />
          <ToggleRow label="생일 간식"     checked={form.has_birthday_snack}  onChange={v => set('has_birthday_snack', v)} />
          <ToggleRow label="건강 소식지"   checked={form.has_health_booklet}  onChange={v => set('has_health_booklet', v)} />
          <ToggleRow label="연계 시설"     checked={form.has_yonder}          onChange={v => set('has_yonder', v)} />
        </div>
        {form.has_yonder && (
          <div className="mt-4">
            <FieldLabel htmlFor="yonder_name">연계 시설명</FieldLabel>
            <input
              id="yonder_name"
              type="text"
              value={form.yonder_name}
              onChange={e => set('yonder_name', e.target.value)}
              className={inputCls()}
              placeholder="연계 시설 이름을 입력하세요"
            />
          </div>
        )}
      </div>

      {/* ── 섹션 4: 배포 설정 ─────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 mb-4">
        <SectionHeader icon={<Mail size={18} />} title="배포 설정" />

        {/* 배포 이메일 태그 입력 */}
        <div id="field-distribution_emails" className="mb-5">
          <FieldLabel required pptx>배포 이메일</FieldLabel>
          <div className={`min-h-[52px] border rounded-lg px-3 py-2 flex flex-wrap gap-1.5 items-center ${
            errors.distribution_emails ? 'border-red-400' : 'border-slate-300'
          } focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500`}>
            {form.distribution_emails.map(email => (
              <span
                key={email}
                className="bg-slate-100 text-slate-700 text-sm rounded-lg px-3 py-1 flex items-center gap-1.5"
              >
                {email}
                <button
                  type="button"
                  onClick={() => removeEmail(email)}
                  className="text-slate-400 hover:text-red-500 transition-colors leading-none"
                  aria-label={`${email} 제거`}
                >
                  ×
                </button>
              </span>
            ))}
            <input
              type="email"
              value={emailInput}
              onChange={e => { setEmailInput(e.target.value); setEmailError('') }}
              onKeyDown={handleEmailKeyDown}
              onBlur={() => { if (emailInput.trim()) addEmail(emailInput) }}
              placeholder={form.distribution_emails.length === 0 ? '이메일 입력 후 Enter' : ''}
              className="flex-1 min-w-[180px] outline-none text-sm py-0.5 bg-transparent"
            />
          </div>
          {emailError && <p className="text-red-500 text-xs mt-1">{emailError}</p>}
          {errors.distribution_emails && !emailError && (
            <p className="text-red-500 text-xs mt-1">{errors.distribution_emails}</p>
          )}
          {!isNew && pptxChanged('distribution_emails') && <PptxChangeWarning />}
        </div>

        {/* 검토 필요 여부 */}
        <label className="flex items-center gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={form.review_required}
            onChange={e => set('review_required', e.target.checked)}
            className="w-4 h-4 rounded border-slate-300 accent-emerald-600"
          />
          <span className="text-sm text-slate-700">식단 배포 전 관리자 검토 필요</span>
        </label>
      </div>

      {/* ── 섹션 5: 원 특성 ──────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 mb-4">
        <SectionHeader icon={<Settings2 size={18} />} title="원 특성" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
          <ToggleRow label="이란 계열"     checked={form.is_elan}         onChange={v => set('is_elan', v)} />
          <ToggleRow label="잉파 계열"     checked={form.is_ingpa}        onChange={v => set('is_ingpa', v)} />
          <ToggleRow label="15행 표 형식"  checked={form.is_table_15row}  onChange={v => set('is_table_15row', v)} />
          <ToggleRow label="직납"          checked={form.direct_delivery} onChange={v => set('direct_delivery', v)} />
        </div>
      </div>

      {/* ── 섹션 6: 특이사항/메모 ────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 mb-4">
        <SectionHeader icon={<FileEdit size={18} />} title="특이사항/메모" />
        <div className="grid grid-cols-1 gap-4">
          <div>
            <FieldLabel htmlFor="special_notes">특이사항</FieldLabel>
            <textarea
              id="special_notes"
              rows={4}
              value={form.special_notes}
              onChange={e => set('special_notes', e.target.value)}
              className={`${inputCls()} resize-none`}
              placeholder="식단 제작 시 특이사항 입력"
            />
          </div>
          <div>
            <FieldLabel htmlFor="memo">메모</FieldLabel>
            <textarea
              id="memo"
              rows={4}
              value={form.memo}
              onChange={e => set('memo', e.target.value)}
              className={`${inputCls()} resize-none`}
              placeholder="내부 관리용 메모"
            />
          </div>
        </div>
      </div>

      {/* ── 저장 버튼 (sticky) ─────────────────────────────────── */}
      <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-4 flex justify-end gap-3 z-10 -mx-6 mt-4">
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 px-6 py-2.5 rounded-lg text-sm transition-colors"
          >
            취소
          </button>
        ) : (
          <Link
            href="/erp/branches"
            className="border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 px-6 py-2.5 rounded-lg text-sm transition-colors inline-flex items-center"
          >
            취소
          </Link>
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-70 flex items-center gap-2"
        >
          {isSaving ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              저장 중...
            </>
          ) : (
            isNew ? '등록' : '저장'
          )}
        </button>
      </div>
    </div>
  )
}
