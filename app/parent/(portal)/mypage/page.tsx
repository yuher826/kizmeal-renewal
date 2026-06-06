'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { getParentProfile } from '@/lib/parent-auth'
import type { Parent, Child } from '@/lib/parent-auth'
import BottomNav from '@/components/parent/BottomNav'

export default function ParentMypagePage() {
  const [parent, setParent] = useState<Parent | null>(null)
  const [children, setChildren] = useState<Child[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getParentProfile().then(({ parent, children }) => {
      setParent(parent)
      setChildren(children)
      setLoading(false)
    })
  }, [])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/parent/login'
  }

  return (
    <div className="min-h-screen bg-[#F6FAF6] pb-20">
      <header className="bg-white border-b border-gray-100 px-4 py-4 sticky top-16 z-10">
        <h1 className="font-bold text-[#1C2B1E]">마이페이지</h1>
      </header>

      <div className="max-w-md mx-auto px-4 py-5 space-y-4">
        {loading ? (
          <div className="bg-white rounded-2xl h-32 animate-pulse" />
        ) : (
          <>
            {/* Profile Card */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-[#E8F5E9] flex items-center justify-center text-2xl font-bold text-[#2D6A4F]">
                  {parent?.name?.[0] || '?'}
                </div>
                <div>
                  <p className="font-bold text-[#1C2B1E]">{parent?.name}</p>
                  <p className="text-sm text-gray-400">{parent?.email}</p>
                  {parent?.phone && <p className="text-xs text-gray-400">{parent.phone}</p>}
                </div>
              </div>
            </div>

            {/* Children */}
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="font-bold text-[#1C2B1E] text-sm">원아 정보 ({children.length}명)</h2>
              </div>
              {children.length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-6">등록된 원아가 없습니다.</p>
              ) : (
                <ul className="divide-y divide-gray-50">
                  {children.map(child => (
                    <li key={child.id} className="flex items-center gap-4 px-5 py-4">
                      <div className="w-10 h-10 rounded-full bg-[#E8F5E9] flex items-center justify-center text-sm font-bold text-[#2D6A4F] flex-shrink-0">
                        {child.name_ko[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[#1C2B1E]">{child.name_ko}</p>
                        {child.name_en && <p className="text-xs text-gray-400">{child.name_en}</p>}
                        {child.branches && (
                          <p className="text-xs text-gray-400">
                            {[child.branches.brands?.name, child.branches.name].filter(Boolean).join(' ')}
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Menu Items */}
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <ul className="divide-y divide-gray-50">
                <li>
                  <a href="/parent/forgot-password" className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors">
                    <span className="text-sm text-[#1C2B1E]">비밀번호 변경</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </a>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
                  >
                    <span className="text-sm text-red-500">로그아웃</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </button>
                </li>
              </ul>
            </div>

            <p className="text-center text-xs text-gray-300 pt-2">키즈밀 학부모 포털 v1.0</p>
          </>
        )}
      </div>

      <BottomNav />
    </div>
  )
}
