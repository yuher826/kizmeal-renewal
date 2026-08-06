'use client'

import type { ReactNode } from 'react'
import { createClient } from '@/lib/supabase'
import { ROUTES } from '@/lib/routes'

interface Props {
  email: string | null
  title?: string
  message?: ReactNode
}

// 로그인은 됐지만 이 화면에 필요한 정보(연결된 원 등)를 계정에서 찾지 못했을 때 보여주는 공용 안내.
// "다른 계정입니다"라고 단정하지 않고, 현재 로그인 계정만 사실대로 알려주고 판단은 사용자에게 맡긴다.
export default function AccountMismatchNotice({
  email,
  title = '연결된 원 정보를 찾을 수 없습니다',
  message,
}: Props) {
  async function handleLogout() {
    const supabase = createClient()
    try {
      await supabase.auth.signOut()
    } finally {
      // signOut 실패해도, 그리고 세션 관련 클라이언트 상태를 확실히 정리하기 위해
      // (로그아웃은) 전체 새로고침으로 이동한다 — router.replace 등 SPA 이동으로는
      // 이전 화면의 구독/상태가 남을 수 있어 이 프로젝트의 다른 로그아웃 버튼들과 동일하게 처리.
      window.location.href = ROUTES.BOARD_LOGIN
    }
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-5 text-sm text-amber-800 space-y-3">
      <p className="font-bold text-amber-900">{title}</p>
      <p className="leading-relaxed">
        {email ? (
          <>현재 <span className="font-semibold">{email}</span> 계정으로 로그인되어 있습니다.</>
        ) : (
          '로그인 계정 정보를 확인할 수 없습니다.'
        )}
        <br />
        {message ?? '이 계정에 연결된 원 정보가 없습니다. 다른 계정으로 로그인하셨다면 로그아웃 후 다시 시도해 주세요.'}
      </p>
      <button
        type="button"
        onClick={handleLogout}
        className="bg-white border border-amber-300 text-amber-800 hover:bg-amber-100 font-semibold text-xs px-4 py-2 rounded-xl transition-colors"
      >
        로그아웃
      </button>
    </div>
  )
}
