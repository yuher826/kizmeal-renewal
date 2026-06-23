'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'

interface StyleJson {
  headerColor: string; accentColor: string; sectionBgColor: string
  headerBgColor: string; weekTitleColor: string; weekBorderColor: string
  borderColor: string; fontFamily: string
  rawColors: string[]; rawFonts: string[]
}

interface DietTemplate {
  id: string; version: number; name: string; file_path: string
  style_json: StyleJson; is_active: boolean
  created_at: string; note?: string
}

const DEFAULT_STYLE: StyleJson = {
  headerColor: '#1B4332', accentColor: '#2D6A4F',
  sectionBgColor: '#E8F5E9', headerBgColor: '#F8FDF8',
  weekTitleColor: '#2D6A4F', weekBorderColor: '#2D6A4F',
  borderColor: '#ccc', fontFamily: "'Malgun Gothic', sans-serif",
  rawColors: [], rawFonts: [],
}

function MiniPreview({ style }: { style: StyleJson }) {
  const s = { ...DEFAULT_STYLE, ...style }
  const DAYS = ['월','화','수','목','금']
  const SECTIONS = ['오전간식','오후간식','돌봄간식']
  return (
    <div style={{ fontFamily: s.fontFamily, fontSize: '9px', width: '100%' }}>
      <div style={{ textAlign: 'center', marginBottom: 6 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: s.headerColor }}>키즈밀 튼튼 식단 2026년 7월</div>
        <div style={{ fontSize: 10, color: s.accentColor, marginTop: 1 }}>○○ 어린이집</div>
      </div>
      <div style={{ fontWeight: 700, fontSize: 8, color: s.weekTitleColor, borderLeft: `2px solid ${s.weekBorderColor}`, paddingLeft: 3, marginBottom: 3 }}>1주</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 7 }}>
        <thead>
          <tr>
            <th style={{ background: s.sectionBgColor, color: s.headerColor, border: `1px solid ${s.borderColor}`, padding: '2px 3px', fontWeight: 700, width: 40 }}>구분</th>
            {DAYS.map(d => (
              <th key={d} style={{ background: s.headerBgColor, border: `1px solid ${s.borderColor}`, padding: '2px 3px', fontWeight: 700 }}>{d}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {SECTIONS.map(sec => (
            <tr key={sec}>
              <td style={{ background: s.headerBgColor, color: s.accentColor, border: `1px solid ${s.borderColor}`, padding: '2px 3px', fontWeight: 600, whiteSpace: 'nowrap' }}>{sec}</td>
              {DAYS.map(d => (
                <td key={d} style={{ border: `1px solid ${s.borderColor}`, padding: '2px 3px', textAlign: 'center', color: '#333' }}>
                  {d === '월' ? '샘플 메뉴①②' : '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ marginTop: 4, fontSize: 6, color: '#666', borderTop: `1px solid ${s.borderColor}`, paddingTop: 3 }}>
        ※ 알레르기: ①난류 ②우유 ③메밀 ④땅콩 ...
      </div>
    </div>
  )
}

export default function DietTemplatesPage() {
  const [templates, setTemplates]       = useState<DietTemplate[]>([])
  const [loading,   setLoading]         = useState(true)
  const [uploading, setUploading]       = useState(false)
  const [file,      setFile]            = useState<File | null>(null)
  const [name,      setName]            = useState('')
  const [note,      setNote]            = useState('')
  const [dragging,  setDragging]        = useState(false)
  const [toast,     setToast]           = useState('')
  const [preview,   setPreview]         = useState<{ tmpl: DietTemplate; styles: StyleJson } | null>(null)
  const [pendingStyle, setPendingStyle] = useState<{ id: string; style: StyleJson } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const flash = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 4000) }

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/board/diet/templates')
    if (res.ok) {
      const json = await res.json()
      setTemplates(json.templates || [])
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const active = templates.find(t => t.is_active)
  const inactive = templates.filter(t => !t.is_active)

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f && (f.name.endsWith('.pptx') || f.name.endsWith('.ppt'))) setFile(f)
    else flash('pptx 파일만 지원합니다')
  }, [])

  async function handleUpload() {
    if (!file || !name.trim()) return
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('name', name.trim())
    fd.append('note', note.trim())

    const res = await fetch('/api/board/diet/templates', { method: 'POST', body: fd })
    const json = await res.json()
    setUploading(false)

    if (!res.ok) { flash('업로드 실패: ' + json.error); return }

    setPendingStyle({ id: json.template.id, style: json.style_json })
    setFile(null); setName(''); setNote('')
    await load()
    flash('업로드 완료! 미리보기를 확인하고 적용하세요.')
  }

  async function activate(id: string) {
    const res = await fetch(`/api/board/diet/templates/${id}/activate`, { method: 'PATCH' })
    const json = await res.json()
    if (!res.ok) { flash('활성화 실패: ' + json.error); return }
    setPendingStyle(null)
    await load()
    flash('✅ 템플릿이 활성화되었습니다. 다음 PDF 생성부터 적용됩니다.')
  }

  async function deleteTemplate(id: string) {
    if (!confirm('이 버전을 삭제하시겠습니까?')) return
    const res = await fetch(`/api/board/diet/templates/${id}`, { method: 'DELETE' })
    const json = await res.json()
    if (!res.ok) { flash('삭제 실패: ' + json.error); return }
    await load()
    flash('삭제되었습니다')
  }

  return (
    <main className="min-h-screen bg-[#F6FAF6] px-4 sm:px-6 py-6 sm:py-8">
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-[#2D6A4F] text-white px-6 py-3 rounded-2xl shadow-lg text-sm font-semibold max-w-sm text-center">
          {toast}
        </div>
      )}

      {preview && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-xl shadow-2xl">
            <h2 className="font-bold text-[#1C2B1E] text-lg mb-1">{preview.tmpl.name}</h2>
            <p className="text-xs text-gray-400 mb-4">v{preview.tmpl.version} · {new Date(preview.tmpl.created_at).toLocaleDateString('ko-KR')}</p>
            <div className="border border-gray-200 rounded-xl p-4 bg-white mb-5">
              <MiniPreview style={preview.styles} />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setPreview(null)}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 rounded-xl text-sm">닫기</button>
              <button onClick={() => { activate(preview.tmpl.id); setPreview(null) }}
                className="flex-1 bg-[#2D6A4F] hover:bg-[#1B4332] text-white font-semibold py-3 rounded-xl text-sm">
                이 디자인으로 적용
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <Link href="/erp/diet" className="text-gray-400 hover:text-gray-600 mr-1">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5m7-7l-7 7 7 7"/>
            </svg>
          </Link>
          <span className="text-2xl">🎨</span>
          <h1 className="text-xl sm:text-2xl font-bold text-[#1C2B1E]">식단표 템플릿 관리</h1>
        </div>
        <p className="text-sm text-gray-500 ml-9">코드 수정 없이 디자인을 업데이트하세요</p>
      </div>

      <div className="max-w-3xl mx-auto space-y-5">

        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h2 className="font-bold text-[#1C2B1E] mb-3">현재 사용 중인 템플릿</h2>
          {loading ? (
            <div className="h-16 bg-gray-50 rounded-xl animate-pulse" />
          ) : active ? (
            <div className="flex items-center justify-between bg-[#E8F5E9] border border-[#B7E4C7] rounded-xl px-4 py-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-[#1B4332]">✅ {active.name}</span>
                  <span className="text-xs bg-[#2D6A4F] text-white px-2 py-0.5 rounded-full font-semibold">v{active.version}</span>
                </div>
                {active.note && <p className="text-xs text-[#2D6A4F] mt-0.5">{active.note}</p>}
                <p className="text-xs text-gray-400 mt-0.5">업로드: {new Date(active.created_at).toLocaleDateString('ko-KR')}</p>
              </div>
              <button
                type="button"
                onClick={() => setPreview({ tmpl: active, styles: { ...DEFAULT_STYLE, ...active.style_json } })}
                className="text-xs bg-white border border-[#2D6A4F] text-[#2D6A4F] font-semibold px-3 py-1.5 rounded-lg hover:bg-[#F8FDF8] transition-colors"
              >
                미리보기
              </button>
            </div>
          ) : (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 text-sm text-yellow-700">
              활성화된 템플릿이 없습니다. 기본 키즈밀 스타일로 PDF가 생성됩니다.
            </div>
          )}
        </div>

        {pendingStyle && (() => {
          const tmpl = templates.find(t => t.id === pendingStyle.id)
          return tmpl ? (
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-base">🆕</span>
                <p className="font-bold text-blue-800">{tmpl.name} — 미리보기 확인 후 적용하세요</p>
              </div>
              <div className="border border-blue-200 rounded-xl p-4 bg-white mb-4">
                <MiniPreview style={{ ...DEFAULT_STYLE, ...pendingStyle.style }} />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setPendingStyle(null)}
                  className="flex-1 bg-white border border-blue-300 text-blue-700 font-semibold py-2.5 rounded-xl text-sm">
                  나중에 적용
                </button>
                <button onClick={() => activate(pendingStyle.id)}
                  className="flex-1 bg-[#2D6A4F] hover:bg-[#1B4332] text-white font-bold py-2.5 rounded-xl text-sm">
                  이 디자인으로 적용하기
                </button>
              </div>
            </div>
          ) : null
        })()}

        <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
          <h2 className="font-bold text-[#1C2B1E]">새 템플릿 업로드</h2>
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-colors ${
              dragging ? 'border-[#2D6A4F] bg-[#E8F5E9]' : 'border-gray-200 hover:border-[#52B788] hover:bg-[#F8FDF8]'
            }`}
          >
            <input ref={fileRef} type="file" accept=".pptx,.ppt" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
            <div className="text-4xl mb-2">{file ? '📊' : '📎'}</div>
            {file ? (
              <><p className="font-semibold text-[#1C2B1E] text-sm">{file.name}</p>
              <p className="text-xs text-gray-400">{(file.size / 1024).toFixed(0)} KB</p></>
            ) : (
              <><p className="font-semibold text-gray-600 text-sm">pptx 파일을 드래그하거나 클릭</p>
              <p className="text-xs text-gray-400 mt-1">.pptx 파일만 지원 · 색상/폰트 자동 추출</p></>
            )}
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 mb-1.5 block">버전 이름 <span className="text-red-500">*</span></label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="예: 2026 키즈밀 디자인 v3"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]" />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 mb-1.5 block">변경 메모 (선택)</label>
            <input type="text" value={note} onChange={e => setNote(e.target.value)}
              placeholder="예: 헤더 색상 변경, 폰트 업데이트"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]" />
          </div>
          <button type="button" onClick={handleUpload} disabled={!file || !name.trim() || uploading}
            className="w-full bg-[#2D6A4F] hover:bg-[#1B4332] disabled:bg-gray-300 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2">
            {uploading ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>분석 중...</> : '업로드 및 스타일 분석'}
          </button>
        </div>

        {inactive.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="font-bold text-[#1C2B1E]">이전 버전 목록</h2>
              <p className="text-xs text-gray-400 mt-0.5">롤백하려면 [활성화] 클릭</p>
            </div>
            <div className="divide-y divide-gray-50">
              {inactive.map(t => (
                <div key={t.id} className="px-6 py-3.5 flex items-center justify-between hover:bg-[#F8FDF8]">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-[#1C2B1E]">{t.name}</span>
                      <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded font-mono">v{t.version}</span>
                    </div>
                    {t.note && <p className="text-xs text-gray-400 mt-0.5">{t.note}</p>}
                    <p className="text-xs text-gray-400">{new Date(t.created_at).toLocaleDateString('ko-KR')}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setPreview({ tmpl: t, styles: { ...DEFAULT_STYLE, ...t.style_json } })}
                      className="text-xs text-gray-500 hover:text-[#2D6A4F] font-medium">미리보기</button>
                    <button onClick={() => activate(t.id)}
                      className="text-xs bg-[#E8F5E9] text-[#2D6A4F] font-semibold px-3 py-1.5 rounded-lg hover:bg-[#C8E6C9] transition-colors">
                      활성화
                    </button>
                    <button onClick={() => deleteTemplate(t.id)}
                      className="text-xs text-red-400 hover:text-red-600 font-medium">삭제</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-2xl px-5 py-4 text-xs text-gray-600 space-y-1">
          <p className="font-bold text-yellow-800 mb-1.5">💡 템플릿 관리 안내</p>
          <p>• pptx 파일에서 색상과 폰트를 자동으로 추출합니다</p>
          <p>• [활성화]된 템플릿은 다음 PDF 생성부터 즉시 반영됩니다</p>
          <p>• 활성화된 템플릿은 삭제할 수 없습니다 (다른 버전 활성화 후 삭제)</p>
          <p>• 활성 템플릿이 없으면 기본 키즈밀 스타일로 자동 적용됩니다</p>
        </div>

      </div>
    </main>
  )
}
