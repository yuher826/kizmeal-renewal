'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import type { Branch } from '@/lib/types'

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

interface SnackConfig {
  오전: boolean; 오후: boolean; 방과후: boolean; 돌봄: boolean; 기타: string[]
}

interface AllergyChild {
  id: string
  이름: string
  항목: number[]
  기타알레르기: string[]
}

interface StoredAllergyChild {
  이름: string; 항목: number[]; 기타알레르기: string[]
}

interface MealConfigState {
  간식: SnackConfig
  특이사항: string
  pptx슬라이드: 1 | 3
  알레르기아이: AllergyChild[]
  식단확인: { 마지막확인: string | null; 확인횟수: number }
}

function calcSlide(snack: SnackConfig): 1 | 3 {
  return (snack.오전 || snack.오후 || snack.방과후 || snack.돌봄 || snack.기타.length > 0) ? 1 : 3
}

const DEFAULT_CONFIG = (): MealConfigState => ({
  간식: { 오전: false, 오후: true, 방과후: false, 돌봄: false, 기타: [] },
  특이사항: '',
  pptx슬라이드: 1,
  알레르기아이: [],
  식단확인: { 마지막확인: null, 확인횟수: 0 },
})

export default function DietProfilePage({ params }: { params: { branchId: string } }) {
  const { branchId } = params
  const router = useRouter()

  const [branch,  setBranch]  = useState<Branch | null>(null)
  const [dietType, setDietType] = useState<'ck' | 'catering'>('ck')
  const [config,  setConfig]  = useState<MealConfigState>(DEFAULT_CONFIG())
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [toast,   setToast]   = useState('')
  const [toastOk, setToastOk] = useState(true)
  const [newSlot, setNewSlot] = useState('')
  const [newChildName, setNewChildName] = useState('')
  const [customInputs, setCustomInputs] = useState<Record<string, string>>({})

  const flash = (msg: string, ok = true) => {
    setToast(msg); setToastOk(ok)
    setTimeout(() => setToast(''), 3000)
  }

  useEffect(() => {
    const supabase = createClient()
    supabase.from('branches').select('*, brands(*)').eq('id', branchId).single().then(({ data }) => {
      if (data) {
        setBranch(data as Branch)
        setDietType((data.diet_type as 'ck' | 'catering') || 'ck')
        const raw = (data as Record<string, unknown>).meal_config as Record<string, unknown> | null
        if (raw && raw.간식 && typeof raw.간식 === 'object') {
          const snackRaw = raw.간식 as Record<string, unknown>
          const kidsRaw  = (raw.알레르기아이 as StoredAllergyChild[]) || []
          const confirmRaw = raw.식단확인 as Record<string, unknown> | undefined
          setConfig({
            간식: {
              오전:    Boolean(snackRaw.오전),
              오후:    Boolean(snackRaw.오후),
              방과후:  Boolean(snackRaw.방과후),
              돌봄:    Boolean(snackRaw.돌봄),
              기타:    (snackRaw.기타 as string[]) || [],
            },
            특이사항:    (raw.특이사항 as string) || '',
            pptx슬라이드: (raw.pptx슬라이드 as 1 | 3) || 1,
            알레르기아이: kidsRaw.map((c, i) => ({
              id: `${i}_${c.이름}_loaded`,
              이름: c.이름,
              항목: c.항목 || [],
              기타알레르기: c.기타알레르기 || [],
            })),
            식단확인: {
              마지막확인: (confirmRaw?.마지막확인 as string | null) ?? null,
              확인횟수:   (confirmRaw?.확인횟수 as number) || 0,
            },
          })
        }
      }
      setLoading(false)
    })
  }, [branchId])

  const toggleSnack = useCallback((key: '오전' | '오후' | '방과후' | '돌봄') => {
    setConfig(c => {
      const s = { ...c.간식, [key]: !c.간식[key] }
      return { ...c, 간식: s, pptx슬라이드: calcSlide(s) }
    })
  }, [])

  const addSlot = useCallback(() => {
    const label = newSlot.trim()
    if (!label) return
    setConfig(c => {
      const s = { ...c.간식, 기타: [...c.간식.기타, label] }
      return { ...c, 간식: s, pptx슬라이드: calcSlide(s) }
    })
    setNewSlot('')
  }, [newSlot])

  const removeSlot = useCallback((label: string) => {
    setConfig(c => {
      const s = { ...c.간식, 기타: c.간식.기타.filter(x => x !== label) }
      return { ...c, 간식: s, pptx슬라이드: calcSlide(s) }
    })
  }, [])

  const addChild = useCallback(() => {
    const name = newChildName.trim()
    if (!name) return
    setConfig(c => ({
      ...c,
      알레르기아이: [...c.알레르기아이, { id: String(Date.now()), 이름: name, 항목: [], 기타알레르기: [] }],
    }))
    setNewChildName('')
  }, [newChildName])

  const removeChild = useCallback((id: string) => {
    setConfig(c => ({ ...c, 알레르기아이: c.알레르기아이.filter(ch => ch.id !== id) }))
  }, [])

  const toggleAllergen = useCallback((childId: string, no: number) => {
    setConfig(c => ({
      ...c,
      알레르기아이: c.알레르기아이.map(ch =>
        ch.id !== childId ? ch : {
          ...ch,
          항목: ch.항목.includes(no) ? ch.항목.filter(n => n !== no) : [...ch.항목, no].sort((a, b) => a - b),
        }
      ),
    }))
  }, [])

  const addCustomAllergy = useCallback((childId: string) => {
    const val = (customInputs[childId] || '').trim()
    if (!val) return
    setConfig(c => ({
      ...c,
      알레르기아이: c.알레르기아이.map(ch =>
        ch.id !== childId ? ch : { ...ch, 기타알레르기: [...(ch.기타알레르기 || []), val] }
      ),
    }))
    setCustomInputs(p => ({ ...p, [childId]: '' }))
  }, [customInputs])

  const removeCustomAllergy = useCallback((childId: string, allergy: string) => {
    setConfig(c => ({
      ...c,
      알레르기아이: c.알레르기아이.map(ch =>
        ch.id !== childId ? ch : { ...ch, 기타알레르기: (ch.기타알레르기 || []).filter(a => a !== allergy) }
      ),
    }))
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

    const { data: prevRow } = await supabase.from('branches').select('meal_config').eq('id', branchId).single()
    const prevConfig = prevRow?.meal_config || null

    const slide = calcSlide(config.간식)
    const toSave = {
      간식: config.간식,
      특이사항: config.특이사항,
      pptx슬라이드: slide,
      알레르기아이: config.알레르기아이.map((c): StoredAllergyChild => ({
        이름: c.이름, 항목: c.항목, 기타알레르기: c.기타알레르기,
      })),
      식단확인: config.식단확인,
    }

    const { error } = await supabase.from('branches').update({ diet_type: dietType, meal_config: toSave }).eq('id', branchId)

    if (error) { flash('저장 실패: ' + error.message, false); setSaving(false); return }

    if (adminId) {
      supabase.from('audit_logs').insert({
        actor_id: adminId, actor_type: 'admin', actor_name: adminName,
        action: 'meal_config_updated', target_type: 'branch', target_id: branchId,
        detail: { before: prevConfig, after: toSave },
      }).then(() => {})
    }

    const prevKids = (prevConfig as Record<string, unknown>)?.['알레르기아이']
    const currKids = toSave.알레르기아이
    if (JSON.stringify(prevKids || []) !== JSON.stringify(currKids) && branch?.auth_id) {
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

  const slide = calcSlide(config.간식)

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
            {(['ck', 'catering'] as const).map(t => (
              <button key={t} type="button" onClick={() => setDietType(t)}
                className={`flex-1 py-3 rounded-xl border font-semibold text-sm transition-all ${
                  dietType === t
                    ? 'bg-[#2D6A4F] border-[#2D6A4F] text-white shadow-sm'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-[#52B788]'
                }`}>{t === 'ck' ? 'CK' : '위탁'}</button>
            ))}
          </div>
          {dietType === 'catering' && (
            <div className="mt-3 px-4 py-2.5 bg-purple-50 rounded-xl text-xs text-purple-700 font-medium">
              위탁: 영양사 직접 수정 가능
            </div>
          )}
        </section>

        {/* ② 간식 구성 */}
        <section className="bg-white rounded-2xl border border-gray-100 p-5">
          <h2 className="font-bold text-[#1C2B1E] text-sm mb-4">② 간식 구성</h2>
          <div className="grid grid-cols-2 gap-2.5 mb-4">
            {([['오전', '오전간식'], ['오후', '오후간식'], ['방과후', '방과후간식'], ['돌봄', '돌봄간식']] as const).map(([key, label]) => (
              <label key={key} className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                config.간식[key] ? 'bg-[#E8F5E9] border-[#52B788]' : 'bg-white border-gray-200 hover:border-gray-300'
              }`}>
                <input type="checkbox" checked={config.간식[key]} onChange={() => toggleSnack(key)}
                  className="w-4 h-4 rounded accent-[#2D6A4F]" />
                <span className={`text-sm font-medium ${config.간식[key] ? 'text-[#2D6A4F]' : 'text-gray-600'}`}>{label}</span>
              </label>
            ))}
          </div>

          {config.간식.기타.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {config.간식.기타.map(slot => (
                <span key={slot} className="inline-flex items-center gap-1.5 text-xs bg-[#E8F5E9] text-[#2D6A4F] font-medium px-3 py-1.5 rounded-full">
                  {slot}
                  <button type="button" onClick={() => removeSlot(slot)} className="hover:text-red-500 leading-none">×</button>
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

        {/* ③ 특이사항 */}
        <section className="bg-white rounded-2xl border border-gray-100 p-5">
          <h2 className="font-bold text-[#1C2B1E] text-sm mb-1">③ 특이사항</h2>
          <p className="text-xs text-gray-400 mb-3">식단표 생성 시 자동 반영됩니다</p>
          <textarea value={config.특이사항} onChange={e => setConfig(c => ({ ...c, 특이사항: e.target.value }))}
            rows={3} placeholder="예) 주스 오전1/오후1"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F] resize-none" />
        </section>

        {/* ④ 알레르기 아이 명단 */}
        <section className="bg-white rounded-2xl border border-gray-100 p-5">
          <h2 className="font-bold text-[#1C2B1E] text-sm mb-1">④ 알레르기 아이 명단</h2>
          <p className="text-xs text-gray-400 mb-4">식단표 생성 시 알레르기 경고 자동 표시</p>

          {config.알레르기아이.map(child => (
            <div key={child.id} className="border border-gray-100 rounded-xl p-4 mb-3 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex flex-wrap items-baseline gap-1.5">
                  <span className="font-semibold text-sm text-[#1C2B1E]">{child.이름}</span>
                  {child.항목.length > 0 && (
                    <span className="text-xs text-red-500">{child.항목.map(n => CIRCLED(n)).join(' ')}</span>
                  )}
                  {(child.기타알레르기?.length || 0) > 0 && (
                    <span className="text-xs text-orange-500">+기타{child.기타알레르기.length}</span>
                  )}
                </div>
                <button type="button" onClick={() => removeChild(child.id)}
                  className="text-xs text-red-400 hover:text-red-600 font-medium shrink-0 ml-2">삭제</button>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {ALLERGENS.map(a => {
                  const on = child.항목.includes(a.no)
                  return (
                    <button key={a.no} type="button" onClick={() => toggleAllergen(child.id, a.no)}
                      className={`text-xs px-2 py-1 rounded-lg border transition-colors ${
                        on ? 'bg-red-500 border-red-500 text-white font-bold' : 'bg-white border-gray-200 text-gray-600 hover:border-red-300'
                      }`}>
                      {CIRCLED(a.no)} {a.name}
                    </button>
                  )
                })}
              </div>

              {(child.기타알레르기?.length || 0) > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {child.기타알레르기.map(a => (
                    <span key={a} className="inline-flex items-center gap-1 text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-lg font-medium">
                      {a}
                      <button type="button" onClick={() => removeCustomAllergy(child.id, a)} className="hover:text-red-600">×</button>
                    </span>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <input type="text"
                  value={customInputs[child.id] || ''}
                  onChange={e => setCustomInputs(p => ({ ...p, [child.id]: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && addCustomAllergy(child.id)}
                  placeholder="+ 기타 알레르기 추가 (예: 키위)"
                  className="flex-1 px-3 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-1 focus:ring-[#2D6A4F]" />
                <button type="button" onClick={() => addCustomAllergy(child.id)}
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
