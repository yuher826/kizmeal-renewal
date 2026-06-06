'use client'

import { useEffect, useState } from 'react'
import { getParentProfile, getContentsForBranch } from '@/lib/parent-auth'
import type { Child, Content } from '@/lib/parent-auth'
import BottomNav from '@/components/parent/BottomNav'
import ChildTab from '@/components/parent/ChildTab'
import ContentCard from '@/components/parent/ContentCard'
import EmptyState from '@/components/parent/EmptyState'
import Lightbox from '@/components/parent/Lightbox'

export default function ParentRecipesPage() {
  const [children, setChildren] = useState<Child[]>([])
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null)
  const [recipes, setRecipes] = useState<Content[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Content | null>(null)
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
    getContentsForBranch(child.branch_id, 'recipe', { limit: 30 }).then(data => {
      setRecipes(data)
      setLoading(false)
    })
  }, [selectedChildId, children])

  function handleSelectChild(id: string) {
    setSelectedChildId(id)
    localStorage.setItem('selectedChildId', id)
  }

  return (
    <div className="min-h-screen bg-[#F6FAF6] pb-20">
      <header className="bg-white border-b border-gray-100 px-4 py-4 sticky top-16 z-10">
        <h1 className="font-bold text-[#1C2B1E]">레시피</h1>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">
        {children.length > 1 && (
          <ChildTab items={children} selectedId={selectedChildId} onSelect={handleSelectChild} />
        )}

        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {[1,2,3,4].map(i => <div key={i} className="bg-white rounded-2xl h-40 animate-pulse" />)}
          </div>
        ) : recipes.length === 0 ? (
          <EmptyState icon="📖" title="등록된 레시피가 없습니다" />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {recipes.map(recipe => (
              <ContentCard key={recipe.id} content={recipe} onClick={() => setSelected(recipe)} />
            ))}
          </div>
        )}
      </div>

      {/* Recipe detail modal */}
      {selected && (
        <div
          className="fixed inset-0 bg-black/60 z-40 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[85vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            {selected.image_urls && selected.image_urls.length > 0 && (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selected.image_urls[0]}
                  alt={selected.title}
                  className="w-full aspect-video object-cover rounded-t-3xl"
                />
                {selected.image_urls.length > 1 && (
                  <button
                    type="button"
                    onClick={() => { setLightboxImages(selected.image_urls!); setLightboxIndex(0) }}
                    className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded-full"
                  >
                    +{selected.image_urls.length - 1} 더보기
                  </button>
                )}
              </div>
            )}
            <div className="p-5">
              <div className="flex items-start justify-between mb-3">
                <h2 className="font-bold text-[#1C2B1E] text-lg leading-snug">{selected.title}</h2>
                <button type="button" onClick={() => setSelected(null)} className="text-gray-400 ml-3 mt-0.5 flex-shrink-0">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
              {selected.tags && selected.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {selected.tags.map(tag => (
                    <span key={tag} className="text-xs bg-[#E8F5E9] text-[#2D6A4F] px-2.5 py-0.5 rounded-full">{tag}</span>
                  ))}
                </div>
              )}
              {selected.body && (
                <p className="text-sm text-gray-600 whitespace-pre-line leading-relaxed">{selected.body}</p>
              )}
            </div>
          </div>
        </div>
      )}

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
