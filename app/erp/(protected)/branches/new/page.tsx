'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import BranchProfileForm from '@/components/erp/BranchProfileForm'
import type { BranchProfileDetail } from '@/types/branch-profile'

export default function BranchProfileNewPage() {
  const router = useRouter()
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave(data: Partial<BranchProfileDetail>) {
    setIsSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/branch-profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (res.status === 409) {
        setError('이미 사용 중인 약칭입니다. 다른 약칭을 입력해주세요.')
        return
      }
      if (!res.ok) {
        const err = await res.json()
        setError(err.error ?? '등록에 실패했습니다')
        return
      }
      const created = await res.json()
      router.push(`/erp/branches/${created.id}`)
    } catch {
      setError('서버 오류가 발생했습니다')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#F6FAF6] px-4 sm:px-6 py-6 sm:py-8">
      <div className="max-w-3xl mx-auto">
        {/* 헤더 */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/erp/branches"
            className="text-slate-400 hover:text-slate-700 transition-colors"
            aria-label="목록으로"
          >
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-lg font-bold text-slate-900">원 프로파일 신규 등록</h1>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 mb-4">
            {error}
          </div>
        )}

        <BranchProfileForm
          onSave={handleSave}
          isSaving={isSaving}
          isNew
        />
      </div>
    </main>
  )
}
