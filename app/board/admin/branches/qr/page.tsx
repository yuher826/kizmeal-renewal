'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { QRCodeCanvas } from 'qrcode.react'
import { createClient } from '@/lib/supabase'
import type { Branch } from '@/lib/types'

export default function BranchQrPage() {
  const [branches, setBranches] = useState<Branch[]>([])
  const [selected, setSelected] = useState('')
  const [origin, setOrigin] = useState('')
  const qrRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setOrigin(window.location.origin)
    const supabase = createClient()
    supabase
      .from('branches')
      .select('*, brands(*)')
      .eq('is_active', true)
      .order('name', { ascending: true })
      .then(({ data }) => {
        if (data) {
          setBranches(data as Branch[])
          if (data.length > 0) setSelected((data[0] as Branch).id)
        }
      })
  }, [])

  const branch = branches.find(b => b.id === selected)
  const qrValue = selected ? `${origin}/parent/login?school=${selected}` : ''

  const getCanvas = useCallback(() => qrRef.current?.querySelector('canvas') as HTMLCanvasElement | null, [])

  function handleSaveImage() {
    const canvas = getCanvas()
    if (!canvas) return
    const url = canvas.toDataURL('image/png')
    const a = document.createElement('a')
    a.href = url
    a.download = `kizmeal-qr-${branch?.name || selected}.png`
    a.click()
  }

  function handleDownloadPdf() {
    const canvas = getCanvas()
    if (!canvas) return
    const img = canvas.toDataURL('image/png')
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`
      <html>
        <head><title>키즈밀 학부모 초대 QR · ${branch?.name || ''}</title></head>
        <body style="font-family:sans-serif;text-align:center;padding:48px;color:#1C2B1E;">
          <h1 style="color:#2D6A4F;font-size:24px;margin-bottom:8px;">키즈밀 학부모 포털 초대</h1>
          <p style="font-size:16px;margin:0 0 4px;font-weight:bold;">${branch?.name || ''}</p>
          <p style="color:#888;font-size:13px;margin:0 0 24px;">아래 QR코드를 스캔하여 학부모 포털에 가입하세요</p>
          <img src="${img}" style="width:280px;height:280px;" />
          <p style="color:#888;font-size:12px;margin-top:24px;">가정통신문에 첨부하여 배부하세요</p>
        </body>
      </html>
    `)
    win.document.close()
    win.focus()
    setTimeout(() => win.print(), 300)
  }

  return (
    <div className="min-h-screen bg-[#F6FAF6] font-sans">
      <header className="bg-white border-b border-gray-100 px-4 sm:px-6 h-16 hidden sm:flex items-center justify-between sticky top-0 z-10">
        <div>
          <h1 className="font-bold text-[#1C2B1E] text-base">학부모 초대 QR코드</h1>
          <p className="text-gray-400 text-xs">원별 학부모 가입 QR코드를 생성하세요</p>
        </div>
        <Link href="/board/admin/branches" className="text-sm text-[#2D6A4F] font-medium hover:underline">← 원 관리</Link>
      </header>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* 원 선택 */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">원 선택</label>
          <select
            value={selected}
            onChange={e => setSelected(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]"
          >
            {branches.length === 0 && <option value="">등록된 원이 없습니다</option>}
            {branches.map(b => (
              <option key={b.id} value={b.id}>{b.name}{b.brands?.name ? ` (${b.brands.name})` : ''}</option>
            ))}
          </select>
        </div>

        {/* QR 미리보기 */}
        <div className="bg-white rounded-2xl border border-gray-100 p-8 flex flex-col items-center">
          <div ref={qrRef} className="p-4 bg-white rounded-2xl border border-gray-100">
            {qrValue ? (
              <QRCodeCanvas value={qrValue} size={220} fgColor="#1B4332" level="M" marginSize={4} />
            ) : (
              <div className="w-[220px] h-[220px] flex items-center justify-center text-gray-300 text-sm">원을 선택하세요</div>
            )}
          </div>
          {branch && (
            <p className="mt-4 font-bold text-[#1C2B1E]">{branch.name}</p>
          )}
          {qrValue && (
            <p className="mt-1 text-xs text-gray-400 break-all text-center max-w-xs">{qrValue}</p>
          )}
        </div>

        {/* 버튼 */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={!qrValue}
            className="bg-[#2D6A4F] hover:bg-[#1B4332] disabled:bg-gray-200 disabled:cursor-not-allowed text-white font-semibold py-3.5 rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
          >
            <span>📄</span> PDF 다운로드
          </button>
          <button
            type="button"
            onClick={handleSaveImage}
            disabled={!qrValue}
            className="bg-white border border-[#2D6A4F] text-[#2D6A4F] hover:bg-[#E8F5E9] disabled:opacity-40 disabled:cursor-not-allowed font-semibold py-3.5 rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
          >
            <span>🖼️</span> 이미지 저장
          </button>
        </div>

        <div className="bg-[#E8F5E9] rounded-2xl p-4 text-center">
          <p className="text-sm text-[#2D6A4F] font-medium">📌 가정통신문에 첨부하여 배부하세요</p>
        </div>
      </div>
    </div>
  )
}
