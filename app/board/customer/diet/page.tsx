'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

type MenuRow = {
  id: string
  year: number
  month: number
  pptx_url: string | null
  pdf_url: string | null
  jpg_url: string | null
  status: string
  week_num: number | null
}

type FileFormat = 'pdf' | 'jpg' | 'ppt' | 'pdf+jpg'

const STATUS_LABELS: Record<string, string> = {
  generated:        '생성완료',
  review_requested: '검토중',
  approved:         '승인됨',
  deployed:         '배포완료',
}

const STATUS_COLORS: Record<string, string> = {
  generated:        'bg-blue-100 text-blue-700',
  review_requested: 'bg-yellow-100 text-yellow-700',
  approved:         'bg-green-100 text-green-700',
  deployed:         'bg-[#E8F5E9] text-[#2D6A4F]',
}

export default function CustomerDietPage() {
  const [menus, setMenus]           = useState<MenuRow[]>([])
  const [fileFormat, setFileFormat] = useState<FileFormat>('pdf')
  const [branchName, setBranchName] = useState<string | null>(null)
  const [loading, setLoading]       = useState(true)

  useEffect(() => {
    const supabase = createClient()

    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      // branch_id 확인 (master → member 순)
      let branchId: string | null = null
      const { data: branchRow } = await supabase
        .from('branches')
        .select('id, name')
        .eq('auth_id', user.id)
        .maybeSingle()
      if (branchRow) {
        branchId = branchRow.id
        setBranchName(branchRow.name || null)
      } else {
        const { data: memberRow } = await supabase
          .from('branch_members')
          .select('branch_id')
          .eq('auth_id', user.id)
          .maybeSingle()
        if (memberRow) {
          branchId = memberRow.branch_id
          const { data: bData } = await supabase
            .from('branches').select('name').eq('id', branchId).maybeSingle()
          if (bData) setBranchName(bData.name || null)
        }
      }
      if (!branchId) { setLoading(false); return }

      // branch_profiles에서 file_format 조회
      const { data: profileData } = await supabase
        .from('branch_profiles')
        .select('id, file_format, distribution_email')
        .eq('branch_id', branchId)
        .maybeSingle()
      if (profileData?.file_format) setFileFormat(profileData.file_format as FileFormat)
      const profileBranchId: string | null = profileData?.id ?? null

      // weekly_menus 조회 (최신 6개월, 배포된 것만)
      if (!profileBranchId) {
        setMenus([])
        setLoading(false)
        return
      }
      const { data: rows } = await supabase
        .from('weekly_menus')
        .select('id, year, month, pptx_url, pdf_url, jpg_url, status, week_num')
        .eq('branch_id', profileBranchId)
        .in('status', ['generation_complete', 'correction_request', 'resubmitted', 'approved', 'deployed'])
        .order('year', { ascending: false })
        .order('month', { ascending: false })
        .order('week_num', { ascending: true, nullsFirst: true })

      // month 별 대표 row 1개 (week_num IS NULL 우선)
      if (rows) {
        const seen = new Set<string>()
        const monthly: MenuRow[] = []
        for (const r of rows as MenuRow[]) {
          const key = `${r.year}-${r.month}`
          if (!seen.has(key)) {
            seen.add(key)
            monthly.push(r)
            if (monthly.length >= 6) break
          }
        }
        setMenus(monthly)
      }
      setLoading(false)
    }
    load()
  }, [])

  function isFormatActive(fmt: string): boolean {
    if (fileFormat === 'pdf+jpg') return fmt === 'pdf' || fmt === 'jpg'
    if (fileFormat === 'ppt')     return fmt === 'pptx'
    return fileFormat === fmt
  }

  return (
    <div className="min-h-screen bg-[#F6FAF6] font-sans">
      <header className="bg-white border-b border-gray-100 px-4 sm:px-6 h-16 hidden sm:flex items-center sticky top-0 z-10">
        <div>
          <div className="flex items-center gap-1 text-xs text-gray-400 mb-0.5">
            <span>{branchName || '소통채널'}</span>
            <span>›</span>
            <span className="text-[#2D6A4F] font-medium">식단표</span>
          </div>
          <h1 className="font-bold text-[#1C2B1E] text-base">식단표</h1>
          <p className="text-gray-400 text-xs">월별 식단표 다운로드</p>
        </div>
      </header>

      <div className="px-4 sm:px-6 py-6 space-y-4">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl h-28 animate-pulse border border-gray-100" />
          ))
        ) : menus.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 px-6 py-16 text-center">
            <p className="text-5xl mb-4">🍱</p>
            <p className="text-gray-600 font-medium">아직 배포된 식단표가 없습니다.</p>
            <p className="text-gray-400 text-sm mt-1 leading-relaxed">
              식단표가 준비되면 알림을 보내드릴게요 😊
            </p>
            <Link
              href="/board/inquiries/new"
              className="inline-flex items-center gap-1.5 mt-5 text-sm text-[#2D6A4F] border border-[#2D6A4F] rounded-xl px-4 py-2 font-medium hover:bg-[#E8F5E9] transition-colors"
            >
              문의하기
            </Link>
          </div>
        ) : (
          menus.map(menu => {
            const statusLabel = STATUS_LABELS[menu.status] ?? menu.status
            const statusColor = STATUS_COLORS[menu.status] ?? 'bg-gray-100 text-gray-600'

            const downloads = [
              { key: 'pptx', label: 'PPTX', url: menu.pptx_url, active: isFormatActive('pptx') },
              { key: 'pdf',  label: 'PDF',  url: menu.pdf_url,  active: isFormatActive('pdf') },
              { key: 'jpg',  label: 'JPG',  url: menu.jpg_url,  active: isFormatActive('jpg') },
            ]

            return (
              <div key={menu.id} className="bg-white rounded-2xl border border-gray-100 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold text-[#1C2B1E] text-base">
                    {menu.year}년 {menu.month}월 식단표
                  </h2>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusColor}`}>
                    {statusLabel}
                  </span>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {downloads.map(dl =>
                    dl.url ? (
                      <a
                        key={dl.key}
                        href={dl.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                          dl.active
                            ? 'bg-[#2D6A4F] text-white hover:bg-[#1B4332]'
                            : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                        }`}
                      >
                        <span>⬇</span>
                        <span>{dl.label} 다운로드</span>
                      </a>
                    ) : (
                      <button
                        key={dl.key}
                        type="button"
                        disabled
                        className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold bg-gray-50 text-gray-300 cursor-not-allowed"
                      >
                        <span>⬇</span>
                        <span>{dl.label} 다운로드</span>
                      </button>
                    )
                  )}
                </div>
                {fileFormat && (
                  <p className="text-xs text-gray-400 mt-3">
                    우리 원 파일 형식: <span className="font-medium text-[#2D6A4F]">{fileFormat.toUpperCase()}</span>
                  </p>
                )}
              </div>
            )
          })
        )}
      </div>

      <div className="h-14 sm:hidden" />
    </div>
  )
}
