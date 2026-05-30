'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import type { Content } from '@/lib/parent-auth'

export default function NutritionistDashboardPage() {
  const [branchName, setBranchName] = useState('')
  const [contents, setContents] = useState<Content[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: member } = await supabase
        .from('branch_members')
        .select('branch_id, branches(name)')
        .eq('auth_id', user.id)
        .maybeSingle()

      if (!member) return
      setBranchName((member.branches as unknown as { name: string } | null)?.name || '')

      const { data } = await supabase
        .from('contents')
        .select('*')
        .eq('branch_id', member.branch_id)
        .order('created_at', { ascending: false })
        .limit(20)

      if (data) setContents(data as Content[])
      setLoading(false)
    }
    load()
  }, [])

  const counts = {
    menu: contents.filter(c => c.type === 'menu').length,
    photo: contents.filter(c => c.type === 'photo').length,
    recipe: contents.filter(c => c.type === 'recipe').length,
    notice: contents.filter(c => c.type === 'notice').length,
  }

  const TYPE_LABELS: Record<string, string> = { menu: '식단표', photo: '급식사진', recipe: '레시피', notice: '공지' }
  const TYPE_ICONS: Record<string, string> = { menu: '🥗', photo: '📸', recipe: '📖', notice: '📢' }

  async function handleDelete(id: string) {
    if (!confirm('삭제하시겠습니까?')) return
    const supabase = createClient()
    await supabase.from('contents').delete().eq('id', id)
    setContents(prev => prev.filter(c => c.id !== id))
  }

  return (
    <div className="min-h-screen bg-[#F6FAF6]">
      <header className="bg-white border-b border-gray-100 px-4 sm:px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div>
          <h1 className="font-bold text-[#1C2B1E]">영양사 대시보드</h1>
          <p className="text-xs text-gray-400">{branchName}</p>
        </div>
        <Link
          href="/nutritionist/upload"
          className="bg-[#2D6A4F] hover:bg-[#1B4332] text-white font-semibold px-4 py-2 rounded-xl text-sm transition-colors"
        >
          + 컨텐츠 등록
        </Link>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-3">
          {(['menu', 'photo', 'recipe', 'notice'] as const).map(type => (
            <div key={type} className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
              <div className="text-2xl mb-1">{TYPE_ICONS[type]}</div>
              <div className="text-xl font-bold text-[#1C2B1E]">{counts[type]}</div>
              <div className="text-xs text-gray-400">{TYPE_LABELS[type]}</div>
            </div>
          ))}
        </div>

        {/* Content List */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-bold text-[#1C2B1E]">등록된 컨텐츠</h2>
            <span className="text-xs text-gray-400">{contents.length}건</span>
          </div>
          {loading ? (
            <div className="p-6 text-center text-gray-400 text-sm">로딩 중...</div>
          ) : contents.length === 0 ? (
            <div className="p-6 text-center text-gray-400 text-sm">
              <p>등록된 컨텐츠가 없습니다.</p>
              <Link href="/nutritionist/upload" className="text-[#2D6A4F] font-medium hover:underline mt-2 inline-block">
                첫 컨텐츠 등록하기 →
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-gray-50">
              {contents.map(content => (
                <li key={content.id} className="flex items-center gap-4 px-5 py-4">
                  <span className="text-xl flex-shrink-0">{TYPE_ICONS[content.type]}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#1C2B1E] truncate">{content.title}</p>
                    <p className="text-xs text-gray-400">
                      {TYPE_LABELS[content.type]}
                      {content.date && ` · ${new Date(content.date).toLocaleDateString('ko-KR')}`}
                    </p>
                  </div>
                  {content.image_urls && content.image_urls.length > 0 && (
                    <span className="text-xs text-gray-400">사진 {content.image_urls.length}장</span>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDelete(content.id)}
                    className="text-xs text-red-400 hover:text-red-600 transition-colors flex-shrink-0"
                  >
                    삭제
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
