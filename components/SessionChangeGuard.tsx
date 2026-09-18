'use client'

import { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase'

// 화면을 그린 계정과 현재 세션 계정이 달라졌는지 감지해 전 화면을 덮는다(2026-09-18, B-5).
// ★왜 필요한가 — ERP·고객사·홈페이지관리가 같은 쿠키(storageKey)를 쓴다. 같은 브라우저의
//   다른 탭에서 다른 계정으로 로그인하면 쿠키가 덮어써져, 이미 열린 화면은 헤더에 원래
//   사람 이름을 띄운 채 새 계정 권한으로 조회·저장한다(실측: ERP 헤더는 유성모인데
//   고객사 권한으로 조회됨).
// ★화면 단계 방어다. 근본 해결은 ㄹ(storageKey 분리) — 그 전까지 한 브라우저에서
//   ERP와 고객사를 동시에 쓸 수는 없다(한쪽은 이 덮개를 본다).
// 감지 경로(폴링 없음):
//   ① onAuthStateChange — 다른 탭의 로그인·로그아웃이 auth-js BroadcastChannel로 즉시 전달된다
//   ② focus / visibilitychange / pageshow — 탭 복귀·뒤로가기(bfcache) 때 쿠키의 세션을 다시 읽는다
//   ③ 마운트 — INITIAL_SESSION 이벤트로 판정(라우터 캐시로 화면이 되살아난 경우)

type GuardState =
  | { kind: 'ok' }
  | { kind: 'otherUser'; email: string | null }
  | { kind: 'signedOut' }

const SessionChangedContext = createContext(false)

// 덮개가 떠 있는지 — 폴링·소리 같은 백그라운드 동작을 멈출 때 쓴다
export function useSessionChanged(): boolean {
  return useContext(SessionChangedContext)
}

const BUTTON_CLASS = {
  erp: {
    primary: 'bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors',
    secondary: 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm font-semibold px-4 py-2 rounded-lg transition-colors',
  },
  board: {
    primary: 'bg-[#2D6A4F] hover:bg-[#1B4332] text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors',
    secondary: 'bg-white border border-amber-300 text-amber-800 hover:bg-amber-100 text-sm font-semibold px-4 py-2 rounded-xl transition-colors',
  },
} as const

interface Props {
  expectedAuthId: string
  loginPath: string
  tone: 'erp' | 'board'
  children: React.ReactNode
}

export default function SessionChangeGuard({ expectedAuthId, loginPath, tone, children }: Props) {
  const [state, setState] = useState<GuardState>({ kind: 'ok' })
  const bodyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const supabase = createClient()
    let disposed = false

    // 동기 판정만 한다 — onAuthStateChange 콜백 안에서 supabase 호출을 await하면 auth 잠금이 꼬인다
    function evaluate(session: Session | null) {
      if (disposed) return
      if (!session) setState({ kind: 'signedOut' })
      else if (session.user.id !== expectedAuthId) setState({ kind: 'otherUser', email: session.user.email ?? null })
      else setState({ kind: 'ok' }) // 원래 계정으로 되돌아온 경우
    }

    // ① + ③(INITIAL_SESSION)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      evaluate(session)
    })

    // ②
    async function recheck() {
      const { data: { session } } = await supabase.auth.getSession()
      evaluate(session)
    }
    function onVisibility() {
      if (document.visibilityState === 'visible') void recheck()
    }
    function onFocus() { void recheck() }
    function onPageShow() { void recheck() }
    window.addEventListener('focus', onFocus)
    window.addEventListener('pageshow', onPageShow)
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      disposed = true
      subscription.unsubscribe()
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('pageshow', onPageShow)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [expectedAuthId])

  const changed = state.kind !== 'ok'

  // ★클릭만 막으면 입력창에 남은 포커스로 Enter 전송이 된다 — 본문을 inert로 만들고
  //   포커스를 뺀다. ERP엔 쓰기 직전 세션 검증(B-3)이 없어 다른 관리자 세션이면 그 사람
  //   이름으로 답변이 저장된다. (React 18은 inert prop을 모르므로 속성을 직접 다룬다)
  useEffect(() => {
    const el = bodyRef.current
    if (!el) return
    if (changed) {
      el.setAttribute('inert', '')
      const active = document.activeElement
      if (active instanceof HTMLElement) active.blur()
    } else {
      el.removeAttribute('inert')
    }
  }, [changed])

  async function handleRelogin() {
    const supabase = createClient()
    try {
      // scope 'local' — 기본값(global)은 지금 쿠키에 있는 계정(다른 탭 사람)의 서버 세션까지 폐기한다
      await supabase.auth.signOut({ scope: 'local' })
    } finally {
      window.location.href = loginPath
    }
  }

  const btn = BUTTON_CLASS[tone]

  return (
    <SessionChangedContext.Provider value={changed}>
      <div ref={bodyRef} className="contents">
        {children}
      </div>
      {changed && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="session-guard-title"
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 px-4"
        >
          <div className="w-full max-w-md bg-amber-50 border border-amber-200 rounded-2xl px-5 py-5 text-sm text-amber-800 space-y-3 shadow-lg">
            {state.kind === 'otherUser' ? (
              <>
                <p id="session-guard-title" className="font-bold text-amber-900">로그인 계정이 바뀌었습니다</p>
                <p className="leading-relaxed">
                  {state.email ? (
                    <>현재 <span className="font-semibold break-all">{state.email}</span> 계정으로 로그인되어 있습니다.</>
                  ) : (
                    '현재 다른 계정으로 로그인되어 있습니다.'
                  )}
                  <br />
                  새로고침하거나 다시 로그인해 주세요.
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <button type="button" onClick={() => window.location.reload()} className={btn.primary}>
                    새로고침
                  </button>
                  <button type="button" onClick={handleRelogin} className={btn.secondary}>
                    다시 로그인
                  </button>
                </div>
              </>
            ) : (
              <>
                <p id="session-guard-title" className="font-bold text-amber-900">로그아웃되었습니다</p>
                <p className="leading-relaxed">다시 로그인해 주세요.</p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <button type="button" onClick={handleRelogin} className={btn.primary}>
                    다시 로그인
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </SessionChangedContext.Provider>
  )
}
