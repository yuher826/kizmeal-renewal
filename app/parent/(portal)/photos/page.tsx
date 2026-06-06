'use client'

import { useEffect, useState } from 'react'
import { getParentProfile, getContentsForBranch } from '@/lib/parent-auth'
import type { Child, Content } from '@/lib/parent-auth'
import BottomNav from '@/components/parent/BottomNav'
import ChildTab from '@/components/parent/ChildTab'
import EmptyState from '@/components/parent/EmptyState'
import Lightbox from '@/components/parent/Lightbox'

export default function ParentPhotosPage() {
  const [children, setChildren] = useState<Child[]>([])
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null)
  const [photos, setPhotos] = useState<Content[]>([])
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
    getContentsForBranch(child.branch_id, 'photo', { limit: 30 }).then(data => {
      setPhotos(data)
      setLoading(false)
    })
  }, [selectedChildId, children])

  function handleSelectChild(id: string) {
    setSelectedChildId(id)
    localStorage.setItem('selectedChildId', id)
  }

  // Flatten all images from all photo contents, keeping track of dates
  const groups = photos.reduce<Record<string, string[]>>((acc, p) => {
    if (p.image_urls && p.image_urls.length > 0) {
      const key = p.date || p.created_at.slice(0, 10)
      acc[key] = [...(acc[key] || []), ...p.image_urls]
    }
    return acc
  }, {})

  const allImages = photos.flatMap(p => p.image_urls || [])

  function openLightbox(groupDate: string, indexInGroup: number) {
    // Build a flat index across groups
    const beforeCount = Object.entries(groups)
      .filter(([d]) => d > groupDate)
      .reduce((sum, [, imgs]) => sum + imgs.length, 0)
    setLightboxImages(allImages)
    setLightboxIndex(beforeCount + indexInGroup)
  }

  return (
    <div className="min-h-screen bg-[#F6FAF6] pb-20">
      <header className="bg-white border-b border-gray-100 px-4 py-4 sticky top-16 z-10">
        <h1 className="font-bold text-[#1C2B1E]">급식 사진</h1>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">
        {children.length > 1 && (
          <ChildTab items={children} selectedId={selectedChildId} onSelect={handleSelectChild} />
        )}

        {loading ? (
          <div className="grid grid-cols-3 gap-1.5">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="aspect-square bg-gray-200 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : photos.length === 0 ? (
          <EmptyState icon="📸" title="등록된 급식 사진이 없습니다" />
        ) : (
          <div className="space-y-5">
            {Object.entries(groups)
              .sort(([a], [b]) => b.localeCompare(a))
              .map(([date, images]) => (
                <div key={date}>
                  <p className="text-xs font-bold text-gray-500 mb-2 px-1">
                    {new Date(date).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })}
                  </p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {images.map((url, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => openLightbox(date, i)}
                        className="aspect-square overflow-hidden rounded-xl"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt="" className="w-full h-full object-cover hover:scale-105 transition-transform" />
                      </button>
                    ))}
                  </div>
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
