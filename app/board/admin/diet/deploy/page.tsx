'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

interface DietPdf {
  id: string; branch_id: string; branch_name: string
  year_month: string; file_url: string; status: string
  generated_at: string; deployed_at?: string
}

export default function DietDeployPage() {
  const params    = useSearchParams()
  const uploadId  = params.get('upload_id')  || ''
  const yearMonth = params.get('year_month') || ''

  const [pdfs,      setPdfs]      = useState<DietPdf[]>([])
  const [loading,   setLoading]   = useState(true)
  const [deploying, setDeploying] = useState(false)
  const [toast,     setToast]     = useState('')
  const [preview,   setPreview]   = useState<DietPdf | null>(null)

  const flash = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 4000) }

  useEffect(() => {
    if (!uploadId) return
    const supabase = createClient()
    supabase.from('diet_pdfs').select('*').eq('upload_id', uploadId).order('branch_name')
      .then(({ data }) => { if (data) setPdfs(data as DietPdf[]); setLoading(false) })
  }, [uploadId])

  async function deployAll() {
    if (!pdfs.length) return
    setDeploying(true)
    const supabase = createClient()
    const ids = pdfs.filter(p => p.status !== 'deployed').map(p => p.id)

    const { error: updateErr } = await supabase.from('diet_pdfs')
      .update({ status: 'deployed', deployed_at: new Date().toISOString() })
      .in('id', ids)

    if (updateErr) { flash('배포 실패: ' + updateErr.message); setDeploying(false); return }

    // Record deployment
    await supabase.from('diet_deployments').insert({
      upload_id: uploadId,
      year_month: yearMonth,
      branch_count: ids.length,
    })

    // Update local state
    setPdfs(prev => prev.map(p => ids.includes(p.id)
      ? { ...p, status: 'deployed', deployed_at: new Date().toISOString() }
      : p
    ))
    setDeploying(false)
    flash(`✅ ${ids.length}개 원에 배포 완료! 고객사에서 식단표를 확인할 수 있습니다.`)
  }

  const deployed = pdfs.filter(p => p.status === 'deployed').length
  const total    = pdfs.length

  return (
    <div className="min-h-screen bg-[#F6FAF6] font-sans">
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-[#2D6A4F] text-white px-6 py-3 rounded-2xl shadow-lg text-sm font-semibold max-w-sm text-center">
          {toast}
        </div>
      )}

      {/* PDF 미리보기 모달 */}
      {preview && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setPreview(null)}>
          <div className="bg-white rounded-2xl overflow-hidden w-full max-w-3xl h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <p className="font-bold text-[#1C2B1E]">{preview.branch_name} 식단표</p>
              <button onClick={() => setPreview(null)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>
            <iframe src={preview.file_url} className="flex-1 w-full" title={`${preview.branch_name} 식단표`} />
            <div className="px-5 py-3 border-t border-gray-100 flex gap-3">
              <a href={preview.file_url} download target="_blank" rel="noopener noreferrer"
                className="flex-1 bg-[#2D6A4F] text-white font-semibold py-2.5 rounded-xl text-sm text-center">
                ⬇️ 다운로드
              </a>
              <button onClick={() => setPreview(null)}
                className="flex-1 bg-gray-100 text-gray-600 font-semibold py-2.5 rounded-xl text-sm">
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="bg-white border-b border-gray-100 px-4 sm:px-6 py-4 hidden sm:flex items-center gap-3 sticky top-0 z-10">
        <Link href="/board/admin/diet" className="text-gray-400 hover:text-gray-600">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5m7-7l-7 7 7 7"/>
          </svg>
        </Link>
        <div>
          <h1 className="font-bold text-[#1C2B1E]">식단표 배포</h1>
          <p className="text-xs text-gray-400">{yearMonth} · {deployed}/{total} 배포 완료</p>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* 현황 카드 */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: '전체 PDF', value: total, icon: '📄' },
            { label: '배포 완료', value: deployed, icon: '✅' },
            { label: '미배포', value: total - deployed, icon: '⏳' },
          ].map(c => (
            <div key={c.label} className="bg-white rounded-2xl border border-gray-100 p-4">
              <div className="text-xl mb-1">{c.icon}</div>
              <div className="text-2xl font-bold text-[#1C2B1E]">{c.value}</div>
              <div className="text-xs text-gray-400">{c.label}</div>
            </div>
          ))}
        </div>

        {/* 배포 버튼 */}
        {total - deployed > 0 && (
          <button type="button" onClick={deployAll} disabled={deploying || loading}
            className="w-full bg-[#F97316] hover:bg-[#EA6C0A] disabled:bg-gray-300 text-white font-bold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2">
            {deploying
              ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>배포 중...</>
              : `🚀 전체 배포하기 (${total - deployed}개 원)`}
          </button>
        )}

        {/* PDF 목록 */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-bold text-[#1C2B1E]">생성된 식단표 목록</h2>
          </div>
          {loading ? (
            <div className="p-8 flex justify-center">
              <span className="w-6 h-6 border-2 border-[#2D6A4F]/30 border-t-[#2D6A4F] rounded-full animate-spin"/>
            </div>
          ) : pdfs.length === 0 ? (
            <div className="p-10 text-center text-gray-400 text-sm">
              생성된 식단표가 없습니다.<br/>
              <Link href={`/board/admin/diet/generate?upload_id=${uploadId}&year_month=${yearMonth}`}
                className="text-[#2D6A4F] hover:underline font-medium mt-2 inline-block">← 생성 페이지로 돌아가기</Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {pdfs.map(pdf => (
                <div key={pdf.id} className="px-5 py-3.5 flex items-center justify-between hover:bg-[#F8FDF8]">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-[#E8F5E9] flex items-center justify-center text-sm flex-shrink-0">📄</div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#1C2B1E] whitespace-nowrap truncate">{pdf.branch_name}</p>
                      <p className="text-xs text-gray-400">
                        {pdf.deployed_at
                          ? `배포: ${new Date(pdf.deployed_at).toLocaleString('ko-KR', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })}`
                          : `생성: ${new Date(pdf.generated_at).toLocaleString('ko-KR', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {pdf.status === 'deployed'
                      ? <span className="text-xs bg-green-100 text-green-700 font-semibold px-2.5 py-1 rounded-full">배포완료</span>
                      : <span className="text-xs bg-yellow-100 text-yellow-700 font-semibold px-2.5 py-1 rounded-full">미배포</span>}
                    {pdf.file_url && (
                      <button type="button" onClick={() => setPreview(pdf)}
                        className="text-xs text-[#2D6A4F] hover:underline font-medium">
                        미리보기
                      </button>
                    )}
                    {pdf.file_url && (
                      <a href={pdf.file_url} download target="_blank" rel="noopener noreferrer"
                        className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 font-medium px-2.5 py-1 rounded-lg transition-colors">
                        ⬇️
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
