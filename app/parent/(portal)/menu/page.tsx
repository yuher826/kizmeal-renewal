'use client'

import { useEffect, useState } from 'react'
import { getParentProfile, getContentsForBranch, getYearMonth } from '@/lib/parent-auth'
import type { Child, Content } from '@/lib/parent-auth'
import BottomNav from '@/components/parent/BottomNav'
import ChildTab from '@/components/parent/ChildTab'
import EmptyState from '@/components/parent/EmptyState'
import Lightbox from '@/components/parent/Lightbox'

export default function ParentMenuPage() {
  const [children, setChildren] = useState<Child[]>([])
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null)
  const [month, setMonth] = useState(getYearMonth())
  const [menus, setMenus] = useState<Content[]>([])
  const [loading, setLoading] = useState(true)
  const [lightboxImages, setLightboxImages] = useState<string[]>([])
  const [lightboxIndex, setLightboxIndex] = useState(0)

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
    setLoading(true)
    getContentsForBranch(child.branch_id, 'menu', { month }).then(data => {
      setMenus(data)
      setLoading(false)
    })
  }, [selectedChildId, month, children])

  function handleSelectChild(id: string) {
    setSelectedChildId(id)
    localStorage.setItem('selectedChildId', id)
  }

  function openLightbox(images: string[], index: number) {
    setLightboxImages(images)
    setLightboxIndex(index)
  }

  const [y, m] = month.split('-').map(Number)

  return (
    <div className="min-h-screen bg-[#F6FAF6] pb-20">
      <header className="bg-white border-b border-gray-100 px-4 py-4 sticky top-16 z-10">
        <h1 className="font-bold text-[#1C2B1E]">식단표</h1>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">
        {children.length > 1 && (
          <ChildTab items={children} selectedId={selectedChildId} onSelect={handleSelectChild} />
        )}

        {/* Month selector */}
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
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="bg-white rounded-2xl h-32 animate-pulse" />)}
          </div>
        ) : menus.length === 0 ? (
          <EmptyState icon="🥗" title="등록된 식단표가 없습니다" description={`${y}년 ${m}월 식단표가 아직 등록되지 않았습니다.`} />
        ) : (
          <div className="space-y-3">
            {menus.map(menu => (
              <div key={menu.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <div className="px-5 py-4">
                  <p className="font-bold text-[#1C2B1E]">{menu.title}</p>
                  {menu.date && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(menu.date).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })}
                    </p>
                  )}
                  {menu.body && <p className="text-sm text-gray-600 mt-2 whitespace-pre-line">{menu.body}</p>}
                </div>
                {menu.image_urls && menu.image_urls.length > 0 && (
                  <div className="grid grid-cols-2 gap-1 px-4 pb-4">
                    {menu.image_urls.map((url, i) => (
                      <button key={i} type="button" onClick={() => openLightbox(menu.image_urls!, i)}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt="" className="w-full aspect-video object-cover rounded-xl" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {lightboxImages.length > 0 && (
        <Lightbox
          images={lightboxImages}
          index={lightboxIndex}
          onClose={() => setLightboxImages([])}
          onPrev={() => setLightboxIndex(i => (i - 1 + lightboxImages.length) % lightboxImages.length)}
          onNext={() => setLightboxIndex(i => (i + 1) % lightboxImages.length)}
        />
      )}

      <BottomNav />
    </div>
  )
}
