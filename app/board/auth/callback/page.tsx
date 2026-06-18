'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function AuthCallbackPage() {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()

    // STEP 1. PKCE code 파라미터 체크
    const code = new URLSearchParams(window.location.search).get('code')
    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (!error) router.push('/board/change-password')
        else router.push('/board/login?error=invite_failed')
      })
      return
    }

    // STEP 2. 이미 세션 있는지 체크
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.push('/board/change-password')
    })

    // STEP 3. hash 방식 이벤트 감지
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if ((event === 'SIGNED_IN' || event === 'PASSWORD_RECOVERY') && session) {
          router.push('/board/change-password')
        }
      }
    )

    // STEP 4. 10초 타임아웃 fallback
    const timeout = setTimeout(() => {
      router.push('/board/login?error=invite_timeout')
    }, 10000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [router])

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
