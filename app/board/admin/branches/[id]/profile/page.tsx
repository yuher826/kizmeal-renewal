'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import type { Branch } from '@/lib/types'

const ALLERGENS = [
  { no: 1,  name: '난류(달걀)' }, { no: 2,  name: '우유' },
  { no: 3,  name: '메밀' },       { no: 4,  name: '땅콩' },
  { no: 5,  name: '대두(콩)' },   { no: 6,  name: '밀' },
  { no: 7,  name: '고등어' },     { no: 8,  name: '게' },
  { no: 9,  name: '새우' },       { no: 10, name: '돼지고기' },
  { no: 11, name: '복숭아' },     { no: 12, name: '토마토' },
  { no: 13, name: '아황산류' },   { no: 14, name: '호두' },
  { no: 15, name: '닭고기' },     { no: 16, name: '쇠고기' },
  { no: 17, name: '오징어' },     { no: 18, name: '조개류' },
  { no: 19, name: '잣' },
]

const CIRCLED = (n: number) => String.fromCharCode(0x245f + n)

const DEFAULT_SLOTS = [
  { key: 'morning',       label: '오전간식' },
  { key: 'afternoon',     label: '오후간식' },
  { key: 'afterschool',   label: '방과후간식' },
  { key: 'care',          label: '돌봄간식' },
  { key: 'teacher_extra', label: '교사/추가 (교.추)' },
]

interface AllergyChild { id: string; name: string; allergens: number[] }
interface CustomSlot   { key: string; label: string }

interface ProfileData {
  branch_type:      'CK' | '위탁' | ''
  snack_slots:      string[]
  custom_slots:     CustomSlot[]
  special_notes:    string
  allergy_children: AllergyChild[]
}

const EMPTY: ProfileData = {
  branch_type: '', snack_slots: ['morning', 'afternoon'],
  custom_slots: [], special_notes: '', allergy_children: [],
}

export default function BranchProfilePage({ params }: { params: { id: string } }) {
  const { id } = params
  const [branch,  setBranch]  = useState<Branch | null>(null)
  const [profile, setProfile] = useState<ProfileData>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [toast,   setToast]   = useState('')
  const [newSlot, setNewSlot] = useState('')
  const [newChild,setNewChild]= useState('')

  const flash = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  useEffect(() => {
    const supabase = createClient()
    supabase.from('branches').select('*, brands(*)').eq('id', id).single()
      .then(({ data }) => {
        if (data) {
          setBranch(data as Branch)
          const pd = (data as Record<string, unknown>).profile_data as ProfileData | null
          if (pd && pd.branch_type !== undefined) setProfile({ ...EMPTY, ...pd })
        }
        setLoading(false)
      })
  }, [id])

  const toggleSlot = useCallback((key: string) => {
    setProfile(p => ({
      ...p,
      snack_slots: p.snack_slots.includes(key)
        ? p.snack_slots.filter(k => k !== key)
        : [...p.snack_slots, key],
    }))
  }, [])

  const addSlot = useCallback(() => {
    const label = newSlot.trim()
    if (!label) return
    const key = `custom_${Date.now()}`
    setProfile(p => ({
      ...p,
      custom_slots: [...p.custom_slots, { key, label }],
      snack_slots:  [...p.snack_slots, key],
    }))
    setNewSlot('')
  }, [newSlot])

  const removeSlot = useCallback((key: string) => {
    setProfile(p => ({
      ...p,
      custom_slots: p.custom_slots.filter(s => s.key !== key),
      snack_slots:  p.snack_slots.filter(k => k !== key),
    }))
  }, [])

  const addChild = useCallback(() => {
    const name = newChild.trim()
    if (!name) return
    setProfile(p => ({
      ...p,
      allergy_children: [...p.allergy_children, { id: String(Date.now()), name, allergens: [] }],
    }))
    setNewChild('')
  }, [newChild])

  const removeChild = useCallback((cid: string) => {
    setProfile(p => ({ ...p, allergy_children: p.allergy_children.filter(c => c.id !== cid) }))
  }, [])

  const toggleAllergen = useCallback((cid: string, no: number) => {
    setProfile(p => ({
      ...p,
      allergy_children: p.allergy_children.map(c =>
        c.id !== cid ? c : {
          ...c,
          allergens: c.allergens.includes(no)
            ? c.allergens.filter(n => n !== no)
            : [...c.allergens, no].sort((a, b) => a - b),
        }
      ),
    }))
  }, [])

  async function save() {
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('branches').update({ profile_data: profile }).eq('id', id)
    setSaving(false)
    if (error) flash('저장 실패: ' + error.message)
    else flash('저장되었습니다 ✓')
  }

  const allSlots = [
    ...DEFAULT_SLOTS,
    ...profile.custom_slots,
  ]

  if (loading) return (
    <div className="min-h-screen bg-[#F6FAF6] flex items-center justify-center">
      <span className="w-8 h-8 border-2 border-[#2D6A4F]/30 border-t-[#2D6A4F] rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen bg-[#F6FAF6] font-sans">
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-[#2D6A4F] text-white px-6 py-3 rounded-2xl shadow-lg text-sm font-semibold">
          {toast}
        </div>
      )}

      <header className="bg-white border-b border-gray-100 px-4 sm:px-6 py-4 flex items-center gap-3 sticky top-0 z-10">
        <Link href="/board/admin/diet" className="text-gray-400 hover:text-gray-600">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5m7-7l-7 7 7 7"/>
          </svg>
        </Link>
        <div>
          <h1 className="font-bold text-[#1C2B1E]">{branch?.name || '원 프로파일'}</h1>
          <p className="text-xs text-gray-400">식단표 설정</p>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-5">

        {/* ① 원 타입 */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h2 className="font-bold text-[#1C2B1E] mb-4">원 타입</h2>
          <div className="flex gap-3">
            {(['CK', '위탁'] as const).map(t => (
              <button key={t} type="button"
                onClick={() => setProfile(p => ({ ...p, branch_type: t }))}
                className={`flex-1 py-3 rounded-xl border font-semibold text-sm transition-all ${
                  profile.branch_type === t
                    ? 'bg-[#2D6A4F] border-[#2D6A4F] text-white shadow-md'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-[#52B788]'
                }`}
              >{t}</button>
            ))}
          </div>
        </div>

        {/* ② 간식 구성 */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h2 className="font-bold text-[#1C2B1E] mb-4">간식 구성</h2>
          <div className="space-y-2.5 mb-4">
            {allSlots.map(slot => {
              const isCustom = profile.custom_slots.some(s => s.key === slot.key)
              return (
                <div key={slot.key} className="flex items-center justify-between">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={profile.snack_slots.includes(slot.key)}
                      onChange={() => toggleSlot(slot.key)}
                      className="w-4 h-4 rounded accent-[#2D6A4F]" />
                    <span className="text-sm text-gray-700">{slot.label}</span>
                  </label>
                  {isCustom && (
                    <button type="button" onClick={() => removeSlot(slot.key)}
                      className="text-xs text-red-400 hover:text-red-600">삭제</button>
                  )}
                </div>
              )
            })}
          </div>
          <div className="flex gap-2">
            <input type="text" value={newSlot} onChange={e => setNewSlot(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addSlot()}
              placeholder="+ 새 구분 추가 (예: 석식)"
              className="flex-1 px-4 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]" />
            <button type="button" onClick={addSlot}
              className="px-4 py-2 rounded-xl bg-[#E8F5E9] text-[#2D6A4F] font-semibold text-sm hover:bg-[#C8E6C9] transition-colors">
              추가
            </button>
          </div>
        </div>

        {/* ③ 특이사항 */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h2 className="font-bold text-[#1C2B1E] mb-4">특이사항</h2>
          <textarea value={profile.special_notes}
            onChange={e => setProfile(p => ({ ...p, special_notes: e.target.value }))}
            rows={3} placeholder="원별 특이사항 (식단표에 자동 반영)"
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F] resize-none" />
        </div>

        {/* ④ 알레르기 아이 명단 */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h2 className="font-bold text-[#1C2B1E] mb-1">알레르기 아이 명단</h2>
          <p className="text-xs text-gray-400 mb-4">식단표 생성 시 알레르기 경고 자동 표시</p>

          {profile.allergy_children.map(child => (
            <div key={child.id} className="border border-gray-100 rounded-xl p-4 mb-3">
              <div className="flex items-center justify-between mb-3">
                <span className="font-semibold text-sm text-[#1C2B1E]">
                  {child.name}
                  {child.allergens.length > 0 && (
                    <span className="ml-2 text-xs text-red-500 font-normal">
                      {child.allergens.map(n => CIRCLED(n)).join('')}
                    </span>
                  )}
                </span>
                <button type="button" onClick={() => removeChild(child.id)}
                  className="text-xs text-red-400 hover:text-red-600">삭제</button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {ALLERGENS.map(a => {
                  const checked = child.allergens.includes(a.no)
                  return (
                    <button key={a.no} type="button"
                      onClick={() => toggleAllergen(child.id, a.no)}
                      className={`text-xs px-2 py-1 rounded-lg border transition-colors ${
                        checked
                          ? 'bg-red-500 border-red-500 text-white font-bold'
                          : 'bg-white border-gray-200 text-gray-600 hover:border-red-300'
                      }`}
                    >
                      {CIRCLED(a.no)} {a.name}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}

          <div className="flex gap-2 mt-2">
            <input type="text" value={newChild} onChange={e => setNewChild(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addChild()}
              placeholder="아이 이름 입력"
              className="flex-1 px-4 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]" />
            <button type="button" onClick={addChild}
              className="px-4 py-2 rounded-xl bg-[#E8F5E9] text-[#2D6A4F] font-semibold text-sm hover:bg-[#C8E6C9] transition-colors">
              + 추가
            </button>
          </div>
        </div>

        {/* 저장 */}
        <button type="button" onClick={save} disabled={saving}
          className="w-full bg-[#2D6A4F] hover:bg-[#1B4332] disabled:bg-gray-300 text-white font-bold py-3.5 rounded-xl transition-colors">
          {saving ? '저장 중...' : '저장'}
        </button>
      </div>
    </div>
  )
}
