'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import type { Branch } from '@/lib/types'

interface AllergyChild { name: string; allergens: number[] }
interface ProfileData {
  branch_type: string; snack_slots: string[]; allergy_children: AllergyChild[]
}
interface MenuItem { name: string; allergens: number[] }
interface SectionRow { section: string; items: (MenuItem | null)[] }
interface WeekData { weekNumber: number; sections: SectionRow[] }
interface ParsedDiet { dietType: string; weeks: WeekData[] }

interface BranchWithProfile extends Branch {
  profile_data?: ProfileData
}

type GenStatus = 'pending' | 'running' | 'done' | 'error'

interface BranchResult {
  branch: BranchWithProfile
  status: GenStatus
  pdfUrl?: string
  error?: string
  allergyWarnings: string[]
}

const CIRCLED = (n: number) => String.fromCharCode(0x245f + n)
const ALLERGEN_NAMES = [
  '', '난류(달걀)', '우유', '메밀', '땅콩', '대두(콩)', '밀', '고등어', '게', '새우', '돼지고기',
  '복숭아', '토마토', '아황산류', '호두', '닭고기', '쇠고기', '오징어', '조개류', '잣',
]

function detectAllergyWarnings(parsed: ParsedDiet, profile: ProfileData): string[] {
  const children = profile.allergy_children || []
  if (!children.length) return []

  const warnings: string[] = []
  const allergenMenuMap: Record<number, string[]> = {}

  parsed.weeks.forEach(w => {
    w.sections.forEach(sec => {
      sec.items.forEach((item, dayIdx) => {
        if (!item) return
        item.allergens.forEach(no => {
          if (!allergenMenuMap[no]) allergenMenuMap[no] = []
          allergenMenuMap[no].push(`${w.weekNumber}주 ${['월','화','수','목','금'][dayIdx]}요일 ${sec.section} - ${item.name}`)
        })
      })
    })
  })

  children.forEach(child => {
    child.allergens.forEach(no => {
      const menus = allergenMenuMap[no] || []
      if (menus.length) {
        warnings.push(`${child.name}: ${ALLERGEN_NAMES[no]}(${CIRCLED(no)}) → ${menus.slice(0, 3).join(', ')}${menus.length > 3 ? ` 외 ${menus.length - 3}건` : ''}`)
      }
    })
  })
  return warnings
}

export default function DietGeneratePage() {
  const params = useSearchParams()
  const uploadId  = params.get('upload_id')  || ''
  const yearMonth = params.get('year_month') || ''

  const [branches, setBranches]       = useState<BranchResult[]>([])
  const [loading,  setLoading]        = useState(true)
  const [generating,setGenerating]    = useState(false)
  const [allergyPopup,setAllergyPopup]= useState(false)
  const [confirmed,setConfirmed]      = useState(false)

  useEffect(() => {
    if (!uploadId) return
    const supabase = createClient()
    async function load() {
      const [uploadRes, branchRes] = await Promise.all([
        supabase.from('diet_uploads').select('parsed_data, diet_type').eq('id', uploadId).single(),
        supabase.from('branches').select('*, brands(*), profile_data').eq('is_active', true).order('name'),
      ])

      const pd = uploadRes.data?.parsed_data as ParsedDiet | null

      const filtered = (branchRes.data || []).filter(b => {
        const prof = (b as BranchWithProfile).profile_data as ProfileData | undefined
        return !uploadRes.data?.diet_type || !prof?.branch_type || prof.branch_type === uploadRes.data.diet_type
      })

      const results: BranchResult[] = filtered.map(b => {
        const prof = ((b as BranchWithProfile).profile_data || {}) as ProfileData
        const warnings = pd ? detectAllergyWarnings(pd, prof) : []
        return { branch: b as BranchWithProfile, status: 'pending', allergyWarnings: warnings }
      })
      setBranches(results)
      setLoading(false)
    }
    load()
  }, [uploadId])

  const allWarnings = branches.flatMap(r => r.allergyWarnings.map(w => `[${r.branch.name}] ${w}`))
  const hasPending  = branches.some(r => r.status === 'pending')
  const allDone     = branches.length > 0 && branches.every(r => r.status === 'done' || r.status === 'error')

  const runGeneration = useCallback(async () => {
    setGenerating(true)
    for (const item of branches) {
      if (item.status === 'done') continue
      setBranches(prev => prev.map(r => r.branch.id === item.branch.id ? { ...r, status: 'running' } : r))
      try {
        const res = await fetch('/api/board/diet/generate-pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ branch_id: item.branch.id, upload_id: uploadId }),
        })
        const json = await res.json()
        if (res.ok && json.success) {
          setBranches(prev => prev.map(r => r.branch.id === item.branch.id ? { ...r, status: 'done', pdfUrl: json.file_url } : r))
        } else {
          setBranches(prev => prev.map(r => r.branch.id === item.branch.id ? { ...r, status: 'error', error: json.error || '생성 실패' } : r))
        }
      } catch {
        setBranches(prev => prev.map(r => r.branch.id === item.branch.id ? { ...r, status: 'error', error: '네트워크 오류' } : r))
      }
    }
    setGenerating(false)
  }, [branches, uploadId])

  function handleGenerateClick() {
    if (allWarnings.length > 0 && !confirmed) { setAllergyPopup(true); return }
    runGeneration()
  }

  if (loading) return (
    <div className="min-h-screen bg-[#F6FAF6] flex items-center justify-center">
      <span className="w-8 h-8 border-2 border-[#2D6A4F]/30 border-t-[#2D6A4F] rounded-full animate-spin" />
    </div>
  )

  const done  = branches.filter(r => r.status === 'done').length
  const err   = branches.filter(r => r.status === 'error').length
  const total = branches.length

  return (
    <div className="min-h-screen bg-[#F6FAF6] font-sans">
      {/* 알레르기 경고 팝업 */}
      {allergyPopup && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl">
            <div className="text-2xl mb-2">⚠️</div>
            <h2 className="font-bold text-[#1C2B1E] text-lg mb-1">알레르기 주의 필요!</h2>
            <p className="text-sm text-gray-500 mb-4">아래 원·아동의 알레르기를 확인하세요.</p>
            <div className="bg-red-50 rounded-xl p-4 max-h-52 overflow-y-auto space-y-1.5 mb-5">
              {allWarnings.map((w, i) => (
                <p key={i} className="text-xs text-red-700">{w}</p>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setAllergyPopup(false)}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 rounded-xl text-sm">
                취소
              </button>
              <button onClick={() => { setConfirmed(true); setAllergyPopup(false); runGeneration() }}
                className="flex-1 bg-[#2D6A4F] hover:bg-[#1B4332] text-white font-semibold py-3 rounded-xl text-sm">
                확인 후 배포하기
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="bg-white border-b border-gray-100 px-4 sm:px-6 py-4 flex items-center gap-3 sticky top-0 z-10">
        <Link href="/board/admin/diet" className="text-gray-400 hover:text-gray-600">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5m7-7l-7 7 7 7"/>
          </svg>
        </Link>
        <div>
          <h1 className="font-bold text-[#1C2B1E]">원별 식단표 생성</h1>
          <p className="text-xs text-gray-400">{yearMonth} · {total}개 원</p>
        </div>
        {allDone && (
          <Link href={`/board/admin/diet/deploy?upload_id=${uploadId}&year_month=${yearMonth}`}
            className="ml-auto bg-[#F97316] hover:bg-[#EA6C0A] text-white font-bold px-5 py-2 rounded-xl text-sm">
            배포하기 →
          </Link>
        )}
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* 진행 현황 */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="font-bold text-[#1C2B1E]">생성 현황</p>
            <span className="text-sm text-gray-500">{done}/{total} 완료 {err > 0 ? `· 오류 ${err}건` : ''}</span>
          </div>
          <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-[#2D6A4F] rounded-full transition-all duration-500"
              style={{ width: `${total > 0 ? (done / total) * 100 : 0}%` }} />
          </div>
          {allWarnings.length > 0 && (
            <div className="mt-3 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
              <p className="text-xs font-bold text-red-700 mb-1">⚠️ 알레르기 주의 {allWarnings.length}건</p>
              {allWarnings.slice(0, 2).map((w, i) => <p key={i} className="text-xs text-red-600">{w}</p>)}
              {allWarnings.length > 2 && <p className="text-xs text-red-400 mt-0.5">외 {allWarnings.length - 2}건...</p>}
            </div>
          )}
        </div>

        {/* 생성 버튼 */}
        {hasPending && !generating && (
          <button type="button" onClick={handleGenerateClick}
            className="w-full bg-[#2D6A4F] hover:bg-[#1B4332] text-white font-bold py-3.5 rounded-xl transition-colors">
            🚀 전체 생성 시작 ({branches.filter(r => r.status === 'pending').length}개 원)
          </button>
        )}

        {/* 원 목록 */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[#F8FDF8]">
                  {['원 이름', '간식 구성', '알레르기', '상태', ''].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-bold text-gray-400 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {branches.map(r => {
                  const prof = r.branch.profile_data
                  const slots = prof?.snack_slots?.length || 0
                  return (
                    <tr key={r.branch.id} className="hover:bg-[#F8FDF8]">
                      <td className="px-5 py-3">
                        <p className="text-sm font-semibold text-[#1C2B1E]">{r.branch.name}</p>
                        <p className="text-xs text-gray-400">{prof?.branch_type || '—'}</p>
                      </td>
                      <td className="px-5 py-3 text-xs text-gray-500">{slots}개</td>
                      <td className="px-5 py-3">
                        {r.allergyWarnings.length > 0 ? (
                          <span className="text-xs bg-red-100 text-red-700 font-semibold px-2 py-0.5 rounded-full">
                            ⚠️ {r.allergyWarnings.length}건
                          </span>
                        ) : <span className="text-xs text-gray-300">없음</span>}
                      </td>
                      <td className="px-5 py-3">
                        {r.status === 'pending'  && <span className="text-xs text-gray-400">대기중</span>}
                        {r.status === 'running'  && <span className="text-xs text-blue-600 flex items-center gap-1"><span className="w-3 h-3 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin"/>생성 중</span>}
                        {r.status === 'done'     && <span className="text-xs text-green-600 font-semibold">✅ 완료</span>}
                        {r.status === 'error'    && <span className="text-xs text-red-600" title={r.error}>❌ 오류</span>}
                      </td>
                      <td className="px-5 py-3">
                        {r.pdfUrl && (
                          <a href={r.pdfUrl} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-[#2D6A4F] hover:underline font-medium">미리보기</a>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
