'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

interface DietPdf {
  id: string; year_month: string; file_url: string; status: string
  generated_at: string; deployed_at?: string; viewed_at?: string
}

interface SnackInfo {
  오전: boolean; 오후: boolean; 방과후: boolean; 돌봄: boolean; 기타: string[]
}

interface AllergyKid {
  이름: string; 항목: number[]; 기타알레르기: string[]
}

const CIRCLED = (n: number) => String.fromCharCode(0x245f + n)

const ALLERGEN_NAMES: Record<number, string> = {
  1:'난류', 2:'우유', 3:'메밀', 4:'땅콩', 5:'대두', 6:'밀', 7:'고등어',
  8:'게', 9:'새우', 10:'돼지고기', 11:'복숭아', 12:'토마토', 13:'아황산류',
  14:'호두', 15:'닭고기', 16:'쇠고기', 17:'오징어', 18:'조개류', 19:'잣',
}

function getYM(offset = 0): string {
  const d = new Date()
  d.setMonth(d.getMonth() + offset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function CustomerDietPage() {
  const thisMonth = getYM(0)
  const lastMonth = getYM(-1)

  const [tab,       setTab]       = useState<'this' | 'last'>('this')
  const [pdfMap,    setPdfMap]    = useState<Record<string, DietPdf | null>>({})
  const [loading,   setLoading]   = useState(true)
  const [preview,   setPreview]   = useState(false)
  const [marking,   setMarking]   = useState(false)
  const [snack,     setSnack]     = useState<SnackInfo | null>(null)
  const [allergyKids, setAllergyKids] = useState<AllergyKid[]>([])
  const [branchId,  setBranchId]  = useState<string | null>(null)

  const yearMonth = tab === 'this' ? thisMonth : lastMonth
  const pdf = pdfMap[yearMonth]

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      let bId: string | null = null
      const { data: br } = await supabase.from('branches').select('id, meal_config').eq('auth_id', user.id).maybeSingle()
      if (br) {
        bId = br.id
        const mc = br.meal_config as Record<string, unknown> | null
        if (mc && mc.간식 && typeof mc.간식 === 'object') {
          setSnack(mc.간식 as SnackInfo)
          setAllergyKids((mc.알레르기아이 as AllergyKid[]) || [])
        }
      } else {
        const { data: mem } = await supabase.from('branch_members').select('branch_id').eq('auth_id', user.id).maybeSingle()
        if (mem) {
          bId = mem.branch_id
          const { data: bData } = await supabase.from('branches').select('meal_config').eq('id', bId).maybeSingle()
          if (bData) {
            const mc = bData.meal_config as Record<string, unknown> | null
            if (mc && mc.간식 && typeof mc.간식 === 'object') {
              setSnack(mc.간식 as SnackInfo)
              setAllergyKids((mc.알레르기아이 as AllergyKid[]) || [])
            }
          }
        }
      }
      if (!bId) { setLoading(false); return }
      setBranchId(bId)

      const { data: pdfs } = await supabase.from('diet_pdfs')
        .select('*').eq('branch_id', bId).eq('status', 'deployed').in('year_month', [thisMonth, lastMonth])

      const map: Record<string, DietPdf | null> = { [thisMonth]: null, [lastMonth]: null }
      ;(pdfs || []).forEach(p => { map[p.year_month] = p as DietPdf })
      setPdfMap(map)
      setLoading(false)
    }
    load()
  }, [thisMonth, lastMonth])

  async function markViewed() {
    if (!pdf || pdf.viewed_at || marking) return
    setMarking(true)
    const supabase = createClient()
    const now = new Date().toISOString()
    await supabase.from('diet_pdfs').update({ viewed_at: now }).eq('id', pdf.id)
    setPdfMap(prev => ({ ...prev, [yearMonth]: { ...pdf, viewed_at: now } }))

    if (branchId) {
      const { data: bRow } = await supabase.from('branches').select('meal_config').eq('id', branchId).maybeSingle()
      if (bRow) {
        const mc = (bRow.meal_config as Record<string, unknown>) || {}
        const confirm = (mc.식단확인 as Record<string, unknown>) || { 마지막확인: null, 확인횟수: 0 }
        const updated = { ...mc, 식단확인: { 마지막확인: now, 확인횟수: ((confirm.확인횟수 as number) || 0) + 1 } }
        await supabase.from('branches').update({ meal_config: updated }).eq('id', branchId)
      }
    }
    setMarking(false)
  }

  const MONTH_LABEL = (ym: string) => {
    const [y, m] = ym.split('-')
    return `${y}년 ${parseInt(m)}월`
  }

  const snackBadges: string[] = snack
    ? [...(['오전', '오후', '방과후', '돌봄'] as const).filter(k => snack[k]), ...(snack.기타 || [])]
    : []

  return (
    <div className="min-h-screen bg-[#F6FAF6] font-sans">
      <header className="bg-white border-b border-gray-100 px-4 sm:px-6 h-16 hidden sm:flex items-center sticky top-0 z-10">
        <div>
          <h1 className="font-bold text-[#1C2B1E] text-base">식단표</h1>
          <p className="text-gray-400 text-xs">우리 원 월별 식단표</p>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* 탭 */}
        <div className="flex gap-2">
          {([['this', '이번달'], ['last', '지난달']] as const).map(([key, label]) => (
            <button key={key} type="button" onClick={() => { setTab(key); setPreview(false) }}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                tab === key
                  ? 'bg-[#2D6A4F] text-white'
                  : 'bg-white text-gray-500 border border-gray-200 hover:bg-[#E8F5E9] hover:text-[#2D6A4F]'
              }`}>
              {label}
            </button>
          ))}
        </div>

        {/* 식단표 카드 */}
        {loading ? (
          <div className="bg-white rounded-2xl border border-gray-100 aspect-[3/4] flex items-center justify-center">
            <span className="w-8 h-8 border-2 border-[#2D6A4F]/30 border-t-[#2D6A4F] rounded-full animate-spin"/>
          </div>
        ) : !pdf ? (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="aspect-[3/4] flex flex-col items-center justify-center text-center p-8 bg-[#F8FDF8]">
              <div className="text-5xl mb-4">🍱</div>
              <h2 className="font-bold text-[#1C2B1E] text-lg mb-1">{MONTH_LABEL(yearMonth)} 식단표</h2>
              <p className="text-sm text-gray-400 leading-relaxed">
                아직 식단표가 등록되지 않았습니다.<br/>
                등록되면 이곳에서 바로 확인할 수 있습니다.
              </p>
            </div>
          </div>
        ) : !preview ? (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="aspect-[3/4] flex flex-col items-center justify-center text-center p-8 bg-[#F8FDF8]">
              <div className="text-6xl mb-5">📋</div>
              <h2 className="font-bold text-[#1C2B1E] text-xl mb-2">{MONTH_LABEL(yearMonth)} 식단표</h2>
              <p className="text-sm text-gray-400 mb-6">
                {pdf.deployed_at
                  ? `${new Date(pdf.deployed_at).toLocaleDateString('ko-KR', { month:'long', day:'numeric' })} 배포됨`
                  : '배포됨'}
                {pdf.viewed_at && <><br/><span className="text-green-600 text-xs font-medium">✓ 확인완료</span></>}
              </p>
              <button type="button" onClick={() => { setPreview(true); markViewed() }}
                className="bg-[#2D6A4F] hover:bg-[#1B4332] text-white font-bold px-8 py-3 rounded-xl transition-colors">
                식단표 보기
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <p className="text-sm font-semibold text-[#1C2B1E]">{MONTH_LABEL(yearMonth)} 식단표</p>
              <button onClick={() => setPreview(false)} className="text-xs text-gray-400 hover:text-gray-600">닫기</button>
            </div>
            <iframe src={pdf.file_url} className="w-full" style={{ height: '70vh' }} title="식단표" />
          </div>
        )}

        {/* 다운로드 */}
        {pdf ? (
          <a href={pdf.file_url} download target="_blank" rel="noopener noreferrer"
            className="w-full bg-[#2D6A4F] hover:bg-[#1B4332] text-white font-semibold py-3.5 rounded-xl text-sm flex items-center justify-center gap-2 transition-colors">
            ⬇️ 식단표 다운로드
          </a>
        ) : (
          <button type="button" disabled
            className="w-full bg-gray-200 text-gray-400 cursor-not-allowed font-semibold py-3.5 rounded-xl text-sm flex items-center justify-center gap-2">
            ⬇️ 식단표 다운로드
          </button>
        )}
        {!pdf && <p className="text-center text-xs text-gray-400">식단표가 등록되면 다운로드 버튼이 활성화됩니다</p>}

        {/* 간식 구성 & 알레르기 정보 */}
        {(snackBadges.length > 0 || allergyKids.length > 0) && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
            <h3 className="font-bold text-[#1C2B1E] text-sm">우리 원 식단 정보</h3>

            {snackBadges.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">간식 구성</p>
                <div className="flex flex-wrap gap-2">
                  {snackBadges.map(s => (
                    <span key={s} className="text-sm bg-[#E8F5E9] text-[#2D6A4F] font-medium px-3 py-1 rounded-full">{s}간식</span>
                  ))}
                </div>
              </div>
            )}

            {allergyKids.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">알레르기 아이 명단 ({allergyKids.length}명)</p>
                <div className="space-y-2">
                  {allergyKids.map((kid, i) => (
                    <div key={i} className="flex flex-wrap items-baseline gap-2 text-sm">
                      <span className="font-semibold text-[#1C2B1E]">{kid.이름}</span>
                      {kid.항목.length > 0 && (
                        <span className="text-xs text-red-500">
                          {kid.항목.map(n => `${CIRCLED(n)}${ALLERGEN_NAMES[n] || ''}`).join(' ')}
                        </span>
                      )}
                      {(kid.기타알레르기?.length || 0) > 0 && (
                        <span className="text-xs text-orange-500">{kid.기타알레르기.join(', ')}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-1 border-t border-gray-100">
              <p className="text-xs text-gray-400 mb-2">변경이 필요하신가요?</p>
              <Link href="/board/inquiries/new"
                className="inline-flex items-center gap-1.5 text-sm text-[#2D6A4F] border border-[#2D6A4F] rounded-xl px-4 py-2 font-medium hover:bg-[#E8F5E9] transition-colors">
                1:1 문의하기
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
