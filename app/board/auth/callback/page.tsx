'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { KIZMEAL_LOGO_PATH } from '@/lib/brand'

export default function AuthCallbackPage() {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()

    // STEP 0. hash에 access_token 있을 때 (초대 이메일 implicit 방식)
    if (window.location.hash.includes('access_token')) {
      const hashParams = new URLSearchParams(window.location.hash.substring(1))
      const access_token = hashParams.get('access_token')
      const refresh_token = hashParams.get('refresh_token') || ''
      if (access_token) {
        supabase.auth.setSession({ access_token, refresh_token }).then(({ error }) => {
          if (!error) router.push('/board/change-password')
          else router.push('/board/login?error=invite_failed')
        })
        return
      }
    }

    // STEP 1. PKCE code 파라미터 처리
    const code = new URLSearchParams(window.location.search).get('code')
    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (!error) router.push('/board/change-password')
        else router.push('/board/login?error=invite_failed')
      })
      return
    }

    // STEP 2. 기존 세션 체크
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
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={KIZMEAL_LOGO_PATH} alt="키즈밀 로고" className="h-12 w-auto object-contain mx-auto" />
        <p className="text-[#1C2B1E] font-medium">계정을 확인하는 중입니다...</p>
        <p className="text-gray-400 text-sm">잠시만 기다려주세요.</p>
      </div>
    </div>
  )
}
