'use client'

import type { Content } from '@/lib/parent-auth'

interface ContentCardProps {
  content: Content
  onClick?: () => void
}

export default function ContentCard({ content, onClick }: ContentCardProps) {
  const thumb = content.image_urls?.[0]

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-md transition-shadow"
    >
      {thumb && (
        <div className="w-full aspect-video bg-gray-100 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={thumb} alt={content.title} className="w-full h-full object-cover" />
        </div>
      )}
      <div className="p-4">
        <p className="font-semibold text-[#1C2B1E] text-sm leading-snug line-clamp-2">{content.title}</p>
        {content.date && (
          <p className="text-xs text-gray-400 mt-1">
            {new Date(content.date).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}
          </p>
        )}
        {content.tags && content.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {content.tags.slice(0, 3).map(tag => (
              <span key={tag} className="text-[10px] bg-[#E8F5E9] text-[#2D6A4F] px-2 py-0.5 rounded-full">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </button>
  )
}
