'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import type { BranchProfileRow } from '@/types/branch-profile'

export default function BranchProfileAlert() {
  const [incomplete, setIncomplete] = useState<BranchProfileRow[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    fetch('/api/branch-profiles')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setIncomplete(data.filter((r: BranchProfileRow) => !r.is_profile_complete && r.contract_status === 'active'))
        }
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
  }, [])

  if (!loaded || incomplete.length === 0) return null

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-start gap-3">
      <AlertTriangle size={20} className="text-amber-500 mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-semibold text-amber-800">PPTX 생성 전 확인 필요</p>
          <Link
            href="/erp/branches"
            className="text-xs text-amber-700 underline whitespace-nowrap flex-shrink-0"
          >
            프로파일 설정하기 →
          </Link>
        </div>
        <p className="text-xs text-amber-700 mt-1">
          아래 고객사는 필수 프로파일이 미설정되어 PPTX가 자동 생성되지 않습니다.
        </p>
        <div className="flex flex-wrap gap-1 mt-2">
          {incomplete.map(r => (
            <span
              key={r.id}
              className="bg-amber-100 text-amber-800 text-xs rounded px-2 py-0.5"
            >
              {r.branch_full_name ?? r.display_name ?? r.short_code ?? r.id}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
