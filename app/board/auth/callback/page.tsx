'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase'

export default function AuthCallbackPage() {
  useEffect(() => {
    const supabase = createClient()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'PASSWORD_RECOVERY') {
        window.location.href = '/board/change-password'
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  return (
    <div className="min-h-screen bg-[#F6FAF6] flex items-center justify-center px-4">
      <div className="text-center space-y-4">
        <div className="w-14 h-14 bg-gradient-to-br from-[#2D6A4F] to-[#52B788] rounded-2xl flex items-center justify-center text-white font-bold text-xl mx-auto">K</div>
        <p className="text-[#1C2B1E] font-medium">계정을 확인하는 중입니다...</p>
        <p className="text-gray-400 text-sm">잠시만 기다려주세요.</p>
      </div>
    </div>
  )
}
