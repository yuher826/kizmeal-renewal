'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

interface DietPdf {
  id: string; year_month: string; file_url: string; status: string
  generated_at: string; deployed_at?: string; viewed_at?: string
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
  const [marking,  setMarking]    = useState(false)

  const yearMonth = tab === 'this' ? thisMonth : lastMonth
  const pdf = pdfMap[yearMonth]

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      // Resolve branch_id
      let branchId: string | null = null
      const { data: br } = await supabase.from('branches').select('id').eq('auth_id', user.id).maybeSingle()
      if (br) { branchId = br.id }
      else {
        const { data: mem } = await supabase.from('branch_members').select('branch_id').eq('auth_id', user.id).maybeSingle()
        if (mem) branchId = mem.branch_id
      }
      if (!branchId) { setLoading(false); return }

      // Fetch PDFs for this and last month
      const { data: pdfs } = await supabase.from('diet_pdfs')
        .select('*')
        .eq('branch_id', branchId)
        .eq('status', 'deployed')
        .in('year_month', [thisMonth, lastMonth])

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
    await supabase.from('diet_pdfs').update({ viewed_at: new Date().toISOString() }).eq('id', pdf.id)
    setPdfMap(prev => ({ ...prev, [yearMonth]: { ...pdf, viewed_at: new Date().toISOString() } }))
    setMarking(false)
  }

  const MONTH_LABEL = (ym: string) => {
    const [y, m] = ym.split('-')
    return `${y}년 ${parseInt(m)}월`
  }

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

        {/* 내용 */}
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
          /* PDF 카드 */
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
          /* iframe 미리보기 */
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <p className="text-sm font-semibold text-[#1C2B1E]">{MONTH_LABEL(yearMonth)} 식단표</p>
              <button onClick={() => setPreview(false)} className="text-xs text-gray-400 hover:text-gray-600">닫기</button>
            </div>
            <iframe src={pdf.file_url} className="w-full" style={{ height: '70vh' }} title="식단표" />
          </div>
        )}

        {/* 다운로드 버튼 */}
        {pdf ? (
          <a href={pdf.file_url} download target="_blank" rel="noopener noreferrer"
            className="w-full bg-[#2D6A4F] hover:bg-[#1B4332] text-white font-semibold py-3.5 rounded-xl text-sm flex items-center justify-center gap-2 transition-colors">
            <span>⬇️</span> 식단표 다운로드
          </a>
        ) : (
          <button type="button" disabled
            className="w-full bg-gray-200 text-gray-400 cursor-not-allowed font-semibold py-3.5 rounded-xl text-sm flex items-center justify-center gap-2">
            <span>⬇️</span> 식단표 다운로드
          </button>
        )}
        {!pdf && <p className="text-center text-xs text-gray-400">식단표가 등록되면 다운로드 버튼이 활성화됩니다</p>}
      </div>
    </div>
  )
}
