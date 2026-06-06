'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import type { Branch, BranchProfile, BranchProfileAllergyChild } from '@/lib/types'

const ALLERGENS = [
  { no: 1,  name: '난류' },     { no: 2,  name: '우유' },
  { no: 3,  name: '메밀' },     { no: 4,  name: '땅콩' },
  { no: 5,  name: '대두' },     { no: 6,  name: '밀' },
  { no: 7,  name: '고등어' },   { no: 8,  name: '게' },
  { no: 9,  name: '새우' },     { no: 10, name: '돼지고기' },
  { no: 11, name: '복숭아' },   { no: 12, name: '토마토' },
  { no: 13, name: '아황산류' }, { no: 14, name: '호두' },
  { no: 15, name: '닭고기' },   { no: 16, name: '쇠고기' },
  { no: 17, name: '오징어' },   { no: 18, name: '조개류' },
  { no: 19, name: '잣' },
]

const CIRCLED = (n: number) => String.fromCharCode(0x245f + n)

interface AllergyChildLocal extends BranchProfileAllergyChild {
  _localId: string
}

function calcSlide(p: BranchProfile): 1 | 3 {
  return (p.snack_morning || p.snack_afternoon || p.snack_afterschool ||
          p.snack_childcare || p.snack_teacher_extra ||
          p.custom_snack_slots.length > 0) ? 1 : 3
}

const EMPTY_PROFILE = (branchId: string): BranchProfile => ({
  branch_id: branchId,
  diet_plan_type: 'CK',
  snack_morning: false,
  snack_afternoon: true,
  snack_afterschool: false,
  snack_childcare: false,
  snack_teacher_extra: false,
  custom_snack_slots: [],
  nutritionist_name: '',
  nutritionist_email: '',
  distribution_email: '',
  special_notes: '',
  allergy_children: [],
})

export default function DietProfilePage({ params }: { params: { branchId: string } }) {
  const { branchId } = params
  const router = useRouter()

  const [branch,   setBranch]   = useState<Branch | null>(null)
  const [profile,  setProfile]  = useState<BranchProfile>(EMPTY_PROFILE(branchId))
  const [children, setChildren] = useState<AllergyChildLocal[]>([])
  const [newSlot,  setNewSlot]  = useState('')
  const [newChildName, setNewChildName] = useState('')
  const [customInputs, setCustomInputs] = useState<Record<string, string>>({})
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [toast,    setToast]    = useState('')
  const [toastOk,  setToastOk]  = useState(true)

  const flash = (msg: string, ok = true) => {
    setToast(msg); setToastOk(ok)
    setTimeout(() => setToast(''), 3000)
  }

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const [branchRes, profileRes] = await Promise.all([
        supabase.from('branches').select('*, brands(*)').eq('id', branchId).single(),
        supabase.from('branch_profiles').select('*').eq('branch_id', branchId).maybeSingle(),
      ])
      if (branchRes.data) setBranch(branchRes.data as Branch)
      if (profileRes.data) {
        const p = profileRes.data as BranchProfile
        setProfile(p)
        setChildren((p.allergy_children || []).map((c, i) => ({
          ...c,
          _localId: `loaded_${i}_${c.name}`,
        })))
      }
      setLoading(false)
    }
    load()
  }, [branchId])

  const setProfileField = useCallback(<K extends keyof BranchProfile>(key: K, val: BranchProfile[K]) => {
    setProfile(p => ({ ...p, [key]: val }))
  }, [])

  const addSlot = useCallback(() => {
    const label = newSlot.trim()
    if (!label) return
    const key = `custom_${Date.now()}`
    setProfile(p => ({ ...p, custom_snack_slots: [...p.custom_snack_slots, { key, label }] }))
    setNewSlot('')
  }, [newSlot])

  const removeSlot = useCallback((key: string) => {
    setProfile(p => ({ ...p, custom_snack_slots: p.custom_snack_slots.filter(s => s.key !== key) }))
  }, [])

  const addChild = useCallback(() => {
    const name = newChildName.trim()
    if (!name) return
    const localId = String(Date.now())
    setChildren(prev => [...prev, { _localId: localId, id: localId, name, allergens: [], extra_allergies: [] }])
    setNewChildName('')
  }, [newChildName])

  const removeChild = useCallback((localId: string) => {
    setChildren(prev => prev.filter(c => c._localId !== localId))
  }, [])

  const toggleAllergen = useCallback((localId: string, no: number) => {
    setChildren(prev => prev.map(c =>
      c._localId !== localId ? c : {
        ...c,
        allergens: c.allergens.includes(no)
          ? c.allergens.filter(n => n !== no)
          : [...c.allergens, no].sort((a, b) => a - b),
      }
    ))
  }, [])

  const addCustomAllergy = useCallback((localId: string) => {
    const val = (customInputs[localId] || '').trim()
    if (!val) return
    setChildren(prev => prev.map(c =>
      c._localId !== localId ? c : { ...c, extra_allergies: [...(c.extra_allergies || []), val] }
    ))
    setCustomInputs(p => ({ ...p, [localId]: '' }))
  }, [customInputs])

  const removeCustomAllergy = useCallback((localId: string, allergy: string) => {
    setChildren(prev => prev.map(c =>
      c._localId !== localId ? c : { ...c, extra_allergies: (c.extra_allergies || []).filter(a => a !== allergy) }
    ))
  }, [])

  async function save() {
    setSaving(true)
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    let adminName = '관리자'
    let adminId: string | null = null
    if (user) {
      const { data: ad } = await supabase.from('admins').select('id, name').eq('auth_id', user.id).maybeSingle()
      if (ad) { adminName = ad.name; adminId = ad.id }
    }

    const { data: prevRow } = await supabase
      .from('branch_profiles').select('*').eq('branch_id', branchId).maybeSingle()

    const allergyToSave: BranchProfileAllergyChild[] = children.map(c => ({
      id: c.id,
      name: c.name,
      allergens: c.allergens,
      extra_allergies: c.extra_allergies || [],
    }))

    const profileToSave: BranchProfile = {
      ...profile,
      branch_id: branchId,
      allergy_children: allergyToSave,
    }

    const { error } = await supabase
      .from('branch_profiles')
      .upsert({ ...profileToSave, branch_id: branchId }, { onConflict: 'branch_id' })

    if (error) { flash('저장 실패: ' + error.message, false); setSaving(false); return }

    if (adminId) {
      supabase.from('audit_logs').insert({
        actor_id: adminId, actor_type: 'admin', actor_name: adminName,
        action: 'branch_profile_updated', target_type: 'branch', target_id: branchId,
        detail: { before: prevRow, after: profileToSave },
      }).then(() => {})
    }

    if (JSON.stringify(prevRow?.allergy_children || []) !== JSON.stringify(allergyToSave) && branch?.auth_id) {
      supabase.from('notifications').insert({
        recipient_auth_id: branch.auth_id,
        recipient_type: 'branch',
        recipient_id: branchId,
        type: 'allergy_updated',
        title: '알레르기 아이 명단이 업데이트되었습니다',
        body: '담당 관리자가 알레르기 아이 명단을 변경했습니다. 확인해주세요.',
        is_read: false,
      }).then(() => {})
    }

    flash('저장되었습니다 ✅')
    setSaving(false)
    setTimeout(() => router.push('/board/admin/diet'), 1200)
  }

  const slide = calcSlide(profile)

  if (loading) return (
    <div className="min-h-screen bg-[#F6FAF6] flex items-center justify-center">
      <span className="w-8 h-8 border-2 border-[#2D6A4F]/30 border-t-[#2D6A4F] rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen bg-[#F6FAF6] font-sans pb-24">
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-2xl shadow-lg text-sm font-semibold pointer-events-none ${toastOk ? 'bg-[#2D6A4F] text-white' : 'bg-red-600 text-white'}`}>
          {toast}
        </div>
      )}

      <header className="bg-white border-b border-gray-100 px-4 sm:px-6 py-4 flex items-center gap-3 sticky top-0 z-10">
        <Link href="/board/admin/diet" className="text-gray-400 hover:text-gray-600 p-1 -ml-1">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5m7-7l-7 7 7 7"/>
          </svg>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-[#1C2B1E] text-sm sm:text-base truncate">{branch?.name || '원 식단 프로파일'}</h1>
          <p className="text-xs text-gray-400">식단표 프로파일 설정</p>
        </div>
        <button onClick={save} disabled={saving}
          className="bg-[#2D6A4F] hover:bg-[#1B4332] disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors whitespace-nowrap">
          {saving ? '저장 중...' : '저장'}
        </button>
      </header>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-4">

        {/* ① 원 타입 */}
        <section className="bg-white rounded-2xl border border-gray-100 p-5">
          <h2 className="font-bold text-[#1C2B1E] text-sm mb-4">① 원 타입</h2>
          <div className="flex gap-3">
            {(['CK', 'CONSIGNMENT'] as const).map(t => (
              <button key={t} type="button" onClick={() => setProfileField('diet_plan_type', t)}
                className={`flex-1 py-3 rounded-xl border font-semibold text-sm transition-all ${
                  profile.diet_plan_type === t
                    ? 'bg-[#2D6A4F] border-[#2D6A4F] text-white shadow-sm'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-[#52B788]'
                }`}>{t === 'CK' ? 'CK' : '위탁'}</button>
            ))}
          </div>
          {profile.diet_plan_type === 'CONSIGNMENT' && (
            <div className="mt-4 space-y-3">
              <div className="px-4 py-2.5 bg-purple-50 rounded-xl text-xs text-purple-700 font-medium">
                위탁: 영양사 직접 수정 가능
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">영양사 이름</label>
                <input type="text" value={profile.nutritionist_name}
                  onChange={e => setProfileField('nutritionist_name', e.target.value)}
                  placeholder="영양사 이름"
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">영양사 이메일</label>
                <input type="email" value={profile.nutritionist_email}
                  onChange={e => setProfileField('nutritionist_email', e.target.value)}
                  placeholder="nutritionist@example.com"
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]" />
              </div>
            </div>
          )}
        </section>

        {/* ② 간식 구성 */}
        <section className="bg-white rounded-2xl border border-gray-100 p-5">
          <h2 className="font-bold text-[#1C2B1E] text-sm mb-4">② 간식 구성</h2>
          <div className="grid grid-cols-2 gap-2.5 mb-4">
            {([
              ['snack_morning',    '오전간식'],
              ['snack_afternoon',  '오후간식'],
              ['snack_afterschool','방과후간식'],
              ['snack_childcare',  '돌봄간식'],
              ['snack_teacher_extra', '교.추'],
            ] as const).map(([key, label]) => (
              <label key={key} className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                profile[key] ? 'bg-[#E8F5E9] border-[#52B788]' : 'bg-white border-gray-200 hover:border-gray-300'
              }`}>
                <input type="checkbox" checked={profile[key]}
                  onChange={() => setProfileField(key, !profile[key])}
                  className="w-4 h-4 rounded accent-[#2D6A4F]" />
                <span className={`text-sm font-medium ${profile[key] ? 'text-[#2D6A4F]' : 'text-gray-600'}`}>{label}</span>
              </label>
            ))}
          </div>

          {profile.custom_snack_slots.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {profile.custom_snack_slots.map(slot => (
                <span key={slot.key} className="inline-flex items-center gap-1.5 text-xs bg-[#E8F5E9] text-[#2D6A4F] font-medium px-3 py-1.5 rounded-full">
                  {slot.label}
                  <button type="button" onClick={() => removeSlot(slot.key)} className="hover:text-red-500 leading-none">×</button>
                </span>
              ))}
            </div>
          )}

          <div className="flex gap-2 mb-4">
            <input type="text" value={newSlot} onChange={e => setNewSlot(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addSlot()}
              placeholder="+ 구분 추가 (예: 석식)"
              className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]" />
            <button type="button" onClick={addSlot}
              className="px-4 py-2 rounded-xl bg-[#E8F5E9] text-[#2D6A4F] font-semibold text-sm hover:bg-[#C8E6C9] transition-colors">
              추가
            </button>
          </div>

          <div className={`px-4 py-3 rounded-xl text-sm font-medium ${slide === 1 ? 'bg-blue-50 text-blue-700' : 'bg-gray-50 text-gray-500'}`}>
            식단표 슬라이드: {slide === 1 ? '간식있음 (Slide 1)' : '간식없음 — 점심만 (Slide 3)'}
          </div>
        </section>

        {/* ③ 배포 이메일 */}
        <section className="bg-white rounded-2xl border border-gray-100 p-5">
          <h2 className="font-bold text-[#1C2B1E] text-sm mb-1">③ 배포 이메일</h2>
          <p className="text-xs text-gray-400 mb-3">매주 식단표 PDF 자동 발송 이메일</p>
          <input type="email" value={profile.distribution_email}
            onChange={e => setProfileField('distribution_email', e.target.value)}
            placeholder="distribution@example.com"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]" />
        </section>

        {/* ④ 특이사항 */}
        <section className="bg-white rounded-2xl border border-gray-100 p-5">
          <h2 className="font-bold text-[#1C2B1E] text-sm mb-1">④ 특이사항</h2>
          <p className="text-xs text-gray-400 mb-3">식단표 생성 시 자동 반영됩니다</p>
          <textarea value={profile.special_notes}
            onChange={e => setProfileField('special_notes', e.target.value)}
            rows={3} placeholder="예) 주스 오전1/오후1"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F] resize-none" />
        </section>

        {/* ⑤ 알레르기 아이 명단 */}
        <section className="bg-white rounded-2xl border border-gray-100 p-5">
          <h2 className="font-bold text-[#1C2B1E] text-sm mb-1">⑤ 알레르기 아이 명단</h2>
          <p className="text-xs text-gray-400 mb-4">식단표 생성 시 알레르기 경고 자동 표시</p>

          {children.map(child => (
            <div key={child._localId} className="border border-gray-100 rounded-xl p-4 mb-3 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex flex-wrap items-baseline gap-1.5">
                  <span className="font-semibold text-sm text-[#1C2B1E]">{child.name}</span>
                  {child.allergens.length > 0 && (
                    <span className="text-xs text-red-500">{child.allergens.map(n => CIRCLED(n)).join(' ')}</span>
                  )}
                  {(child.extra_allergies?.length || 0) > 0 && (
                    <span className="text-xs text-orange-500">+기타{child.extra_allergies.length}</span>
                  )}
                </div>
                <button type="button" onClick={() => removeChild(child._localId)}
                  className="text-xs text-red-400 hover:text-red-600 font-medium shrink-0 ml-2">삭제</button>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {ALLERGENS.map(a => {
                  const on = child.allergens.includes(a.no)
                  return (
                    <button key={a.no} type="button" onClick={() => toggleAllergen(child._localId, a.no)}
                      className={`text-xs px-2 py-1 rounded-lg border transition-colors ${
                        on ? 'bg-red-500 border-red-500 text-white font-bold' : 'bg-white border-gray-200 text-gray-600 hover:border-red-300'
                      }`}>
                      {CIRCLED(a.no)} {a.name}
                    </button>
                  )
                })}
              </div>

              {(child.extra_allergies?.length || 0) > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {child.extra_allergies.map(a => (
                    <span key={a} className="inline-flex items-center gap-1 text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-lg font-medium">
                      {a}
                      <button type="button" onClick={() => removeCustomAllergy(child._localId, a)} className="hover:text-red-600">×</button>
                    </span>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <input type="text"
                  value={customInputs[child._localId] || ''}
                  onChange={e => setCustomInputs(p => ({ ...p, [child._localId]: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && addCustomAllergy(child._localId)}
                  placeholder="+ 기타 알레르기 추가 (예: 키위)"
                  className="flex-1 px-3 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-1 focus:ring-[#2D6A4F]" />
                <button type="button" onClick={() => addCustomAllergy(child._localId)}
                  className="px-3 py-1.5 rounded-lg bg-orange-50 text-orange-600 font-semibold text-xs hover:bg-orange-100 transition-colors shrink-0">
                  추가
                </button>
              </div>
            </div>
          ))}

          <div className="flex gap-2 mb-5">
            <input type="text" value={newChildName} onChange={e => setNewChildName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addChild()}
              placeholder="아이 이름 입력"
              className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]" />
            <button type="button" onClick={addChild}
              className="px-4 py-2.5 rounded-xl bg-[#E8F5E9] text-[#2D6A4F] font-semibold text-sm hover:bg-[#C8E6C9] transition-colors whitespace-nowrap">
              + 추가
            </button>
          </div>

          <div className="bg-gray-50 rounded-xl p-4 text-xs text-gray-500 leading-relaxed">
            ※ 기본 19가지는 식품위생법 의무표시 알레르기 기준입니다. 법령 개정 시 항목이 추가될 수 있으며,
            그 외 개인별 특이 알레르기는 기타 항목에 직접 입력해주세요.
          </div>
        </section>

        <button type="button" onClick={save} disabled={saving}
          className="w-full bg-[#2D6A4F] hover:bg-[#1B4332] disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl transition-colors text-sm">
          {saving ? '저장 중...' : '저장하기'}
        </button>
      </div>
    </div>
  )
}
