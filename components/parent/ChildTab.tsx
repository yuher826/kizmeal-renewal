'use client'

import type { Child } from '@/lib/parent-auth'

interface ChildTabProps {
  items: Child[]
  selectedId: string | null
  onSelect: (id: string) => void
}

export default function ChildTab({ items, selectedId, onSelect }: ChildTabProps) {
  if (items.length === 0) return null

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
      {items.map(child => {
        const active = child.id === selectedId
        return (
          <button
            key={child.id}
            type="button"
            onClick={() => onSelect(child.id)}
            className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              active
                ? 'bg-[#2D6A4F] text-white'
                : 'bg-white text-gray-600 border border-gray-200 hover:border-[#2D6A4F]'
            }`}
          >
            <span className="w-6 h-6 rounded-full bg-[#E8F5E9] flex items-center justify-center text-xs font-bold text-[#2D6A4F] flex-shrink-0">
              {child.name_ko[0]}
            </span>
            <span>
              {child.name_ko}
              {child.branches && (
                <span className="opacity-70 font-normal">
                  {' · '}{[child.branches.brands?.name, child.branches.name].filter(Boolean).join(' ')}
                </span>
              )}
            </span>
          </button>
        )
      })}
    </div>
  )
}
