'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { getParentProfile, getYearMonth } from '@/lib/parent-auth'
import type { Child } from '@/lib/parent-auth'
import BottomNav from '@/components/parent/BottomNav'
import ChildTab from '@/components/parent/ChildTab'
import EmptyState from '@/components/parent/EmptyState'

type WeeklyMenu = {
  id: string
  year: number
  month: number
  pptx_url: string | null
  pdf_url: string | null
  jpg_url: string | null
  status: string
}

export default function ParentMenuPage() {
  const [children, setChildren] = useState<Child[]>([])
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null)
  const [month, setMonth] = useState(getYearMonth())
  const [menu, setMenu] = useState<WeeklyMenu | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getParentProfile().then(({ children }) => {
      setChildren(children)
      if (children.length > 0) {
        const saved = localStorage.getItem('selectedChildId')
        const validId = children.find(c => c.id === saved)?.id || children[0].id
        setSelectedChildId(validId)
      }
    })
  }, [])

  useEffect(() => {
    if (!selectedChildId) return
    const child = children.find(c => c.id === selectedChildId)
    if (!child?.branch_id) return

    const [y, m] = month.split('-').map(Number)
    setLoading(true)

    const supabase = createClient()
    ;(async () => {
      // children.branch_id(=branches.id) → branch_profiles.id 변환
      const { data: bpRow } = await supabase
        .from('branch_profiles')
        .select('id')
        .eq('branch_id', child.branch_id)
        .maybeSingle()

      if (!bpRow) {
        setMenu(null)
        setLoading(false)
        return
      }

      const { data } = await supabase
        .from('weekly_menus')
        .select('id, year, month, pptx_url, pdf_url, jpg_url, status')
        .eq('branch_id', bpRow.id)
        .eq('year', y)
        .eq('month', m)
        .neq('status', 'error')
        // pptx/pdf/jpg 중 하나라도 있으면 노출 (직접 업로드된 PDF-only 식단표 포함)
        .or('pptx_url.not.is.null,pdf_url.not.is.null,jpg_url.not.is.null')
        .maybeSingle()

      setMenu(data as WeeklyMenu | null)
      setLoading(false)
    })()
  }, [selectedChildId, month, children])

  function handleSelectChild(id: string) {
    setSelectedChildId(id)
    localStorage.setItem('selectedChildId', id)
  }

  const [y, m] = month.split('-').map(Number)

  const downloads: { key: string; label: string; icon: string; url: string | null }[] = menu
    ? [
        { key: 'pptx', label: 'PPTX', icon: '📊', url: menu.pptx_url },
        { key: 'pdf',  label: 'PDF',  icon: '📄', url: menu.pdf_url  },
        { key: 'jpg',  label: 'JPG',  icon: '🖼️', url: menu.jpg_url  },
      ]
    : []

  return (
    <div className="min-h-screen bg-[#F6FAF6] pb-20">
      <header className="bg-white border-b border-gray-100 px-4 py-4 sticky top-0 z-10">
        <h1 className="font-bold text-[#1C2B1E]">
          {children.find(c => c.id === selectedChildId)?.branches?.name
            ? `${children.find(c => c.id === selectedChildId)!.branches!.name} 식단표`
            : '식단표'}
        </h1>
      </header>

      <div className="px-4 py-5 space-y-4">
        {children.length > 1 && (
          <ChildTab items={children} selectedId={selectedChildId} onSelect={handleSelectChild} />
        )}

        <div className="flex items-center justify-between bg-white rounded-2xl border border-gray-100 px-5 py-3">
          <button
            type="button"
            onClick={() => {
              const d = new Date(y, m - 2)
              setMonth(getYearMonth(d))
            }}
            className="text-gray-400 hover:text-[#2D6A4F] p-1"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <span className="font-bold text-[#1C2B1E]">{y}년 {m}월</span>
          <button
            type="button"
            onClick={() => {
              const d = new Date(y, m)
              setMonth(getYearMonth(d))
            }}
            className="text-gray-400 hover:text-[#2D6A4F] p-1"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>

        {loading ? (
          <div className="bg-white rounded-2xl h-40 animate-pulse" />
        ) : !menu ? (
          <EmptyState
            icon="🥗"
            title="이번 달 식단표가 아직 등록되지 않았습니다"
            description={`${y}년 ${m}월 식단표가 준비 중입니다.`}
          />
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
            {children.find(c => c.id === selectedChildId)?.branches?.name && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-[#E8F5E9] text-[#2D6A4F]">
                🏫 {children.find(c => c.id === selectedChildId)!.branches!.name}
              </span>
            )}
            <p className="font-bold text-[#1C2B1E]">{y}년 {m}월 식단표</p>
            <div className="flex flex-col gap-2">
              {downloads.filter(dl => dl.url).map(dl => (
                <a
                  key={dl.key}
                  href={dl.url!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-3 rounded-xl bg-[#2D6A4F] text-white font-semibold text-sm hover:bg-[#1B4332] transition-colors"
                >
                  <span>{dl.icon}</span>
                  <span>식단표 {dl.label} 다운로드</span>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  )
}
