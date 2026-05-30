'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

export default function ParentRejectedPage() {
  const [reason, setReason] = useState('')

  useEffect(() => {
    createClient()
      .from('parents')
      .select('rejected_reason')
      .maybeSingle()
      .then(({ data }) => {
        if (data?.rejected_reason) setReason(data.rejected_reason)
      })
  }, [])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/parent/login'
  }

  return (
    <div className="min-h-screen bg-[#F6FAF6] flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm text-center">
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center text-4xl mx-auto mb-6">
          ❌
        </div>
        <h1 className="text-xl font-bold text-[#1C2B1E] mb-2">가입 신청이 거절되었습니다</h1>
        <p className="text-sm text-gray-500 leading-relaxed mb-6">
          가입 신청이 승인되지 않았습니다.<br />
          문의사항은 해당 원에 직접 연락해주세요.
        </p>

        {reason && (
          <div className="bg-red-50 rounded-2xl p-4 mb-6 text-left">
            <p className="text-xs font-bold text-red-500 mb-1">거절 사유</p>
            <p className="text-sm text-red-700">{reason}</p>
          </div>
        )}

        <div className="space-y-3">
          <a
            href="/parent/register"
            className="block w-full bg-[#2D6A4F] hover:bg-[#1B4332] text-white font-bold py-3.5 rounded-2xl text-sm transition-colors"
          >
            다시 신청하기
          </a>
          <button
            onClick={handleLogout}
            className="w-full text-sm text-gray-400 hover:text-gray-600 transition-colors py-2"
          >
            로그아웃
          </button>
        </div>
      </div>
    </div>
  )
}
