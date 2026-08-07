'use client'

import { useRef, useState } from 'react'
import { Upload, FileText, Loader2, X } from 'lucide-react'

interface Props {
  profileId: string
  showToast: (msg: string, type: 'success' | 'error') => void
  onUploaded?: () => void
}

// 크레오(임시원) 식단표 직접 업로드 카드
//   - 완성된 PDF 식단표를 연/월 지정해 업로드 → 고객/학부모 포털에 바로 노출
//   - 임시원 상세 페이지에서만 렌더링됨
export default function BranchDietUploadCard({ profileId, showToast, onUploaded }: Props) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // 최근 3년 범위
  const years = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1]

  function pickFile(f: File | null) {
    if (!f) return
    const isPdf = f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
    if (!isPdf) {
      showToast('PDF 파일만 업로드할 수 있습니다', 'error')
      return
    }
    setFile(f)
  }

  async function handleUpload() {
    if (!file) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('year', String(year))
      formData.append('month', String(month))

      const res = await fetch(`/api/branch-profiles/${profileId}/diet-upload`, {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        showToast(err.error ?? '업로드에 실패했습니다', 'error')
        return
      }
      showToast(`${year}년 ${month}월 식단표가 업로드되었습니다`, 'success')
      setFile(null)
      if (inputRef.current) inputRef.current.value = ''
      onUploaded?.()
    } catch {
      showToast('서버 오류가 발생했습니다', 'error')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 mt-4">
      {/* 헤더 */}
      <div className="flex items-center gap-2 mb-1">
        <Upload size={18} className="text-emerald-600" />
        <h2 className="text-base font-semibold text-slate-800">식단표 직접 업로드</h2>
      </div>
      <p className="text-xs text-slate-400 mb-4">
        완성된 PDF 식단표를 연/월 지정해 업로드하면 고객·학부모 포털에 바로 노출됩니다. (임시원 전용)
      </p>

      {/* 연/월 선택 */}
      <div className="flex items-center gap-2 mb-3">
        <select
          value={year}
          onChange={e => setYear(Number(e.target.value))}
          disabled={uploading}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 disabled:opacity-60"
        >
          {years.map(y => <option key={y} value={y}>{y}년</option>)}
        </select>
        <select
          value={month}
          onChange={e => setMonth(Number(e.target.value))}
          disabled={uploading}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 disabled:opacity-60"
        >
          {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
            <option key={m} value={m}>{m}월</option>
          ))}
        </select>
      </div>

      {/* 드롭존 */}
      {!file ? (
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => {
            e.preventDefault()
            setDragOver(false)
            pickFile(e.dataTransfer.files?.[0] ?? null)
          }}
          onClick={() => inputRef.current?.click()}
          className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-lg px-4 py-8 cursor-pointer transition-colors ${
            dragOver ? 'border-emerald-500 bg-emerald-50' : 'border-slate-300 hover:border-emerald-400 hover:bg-slate-50'
          }`}
        >
          <FileText size={28} className="text-slate-400" />
          <p className="text-sm text-slate-500">PDF 파일을 끌어다 놓거나 클릭해 선택하세요</p>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={e => pickFile(e.target.files?.[0] ?? null)}
          />
        </div>
      ) : (
        /* 선택된 파일 */
        <div className="flex items-center justify-between gap-2 border border-slate-200 rounded-lg px-4 py-3 bg-slate-50">
          <div className="flex items-center gap-2 min-w-0">
            <FileText size={18} className="text-red-500 flex-shrink-0" />
            <span className="text-sm text-slate-700 truncate">{file.name}</span>
          </div>
          <button
            onClick={() => { setFile(null); if (inputRef.current) inputRef.current.value = '' }}
            disabled={uploading}
            className="text-slate-400 hover:text-slate-600 flex-shrink-0 disabled:opacity-60"
            aria-label="파일 제거"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* 업로드 버튼 */}
      <button
        onClick={handleUpload}
        disabled={!file || uploading}
        className="mt-4 w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
      >
        {uploading ? <><Loader2 size={15} className="animate-spin" />업로드 중...</> : '식단표 업로드'}
      </button>
    </div>
  )
}
