'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

export default function AuthCallbackPage() {
  const [urlInfo, setUrlInfo] = useState({ href: '', search: '', hash: '' })
  const [logs, setLogs] = useState<string[]>([])

  function addLog(msg: string) {
    setLogs(prev => [...prev, msg])
  }

  useEffect(() => {
    setUrlInfo({
      href:   window.location.href,
      search: window.location.search,
      hash:   window.location.hash,
    })

    const supabase = createClient()

    // STEP 1
    addLog('STEP1: code 파라미터 확인 중...')
    const code = new URLSearchParams(window.location.search).get('code')
    if (code) {
      addLog('STEP1: code 있음 → exchangeCodeForSession 실행')
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (error) addLog(`에러: ${error.message}`)
        else addLog('STEP1: exchangeCodeForSession 성공')
      })
      return
    }
    addLog('STEP1: code 없음')

    // STEP 2
    addLog('STEP2: 기존 세션 확인 중...')
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        addLog('STEP2: 세션 있음 → 이동')
      } else {
        addLog('STEP2: 세션 없음')
      }
    })

    // STEP 3
    addLog('STEP3: onAuthStateChange 대기 중...')
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        addLog(`STEP3: 이벤트=${event}, session=${session ? '있음' : '없음'}`)
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  return (
    <div className="min-h-screen bg-[#F6FAF6] p-6">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="bg-yellow-50 border border-yellow-300 rounded-xl p-4">
          <p className="font-bold text-yellow-800 text-sm mb-2">🛠 디버그 모드</p>
          <p className="text-xs text-yellow-700 font-mono break-all"><b>href:</b> {urlInfo.href}</p>
          <p className="text-xs text-yellow-700 font-mono break-all"><b>search:</b> {urlInfo.search || '(없음)'}</p>
          <p className="text-xs text-yellow-700 font-mono break-all"><b>hash:</b> {urlInfo.hash || '(없음)'}</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="font-bold text-gray-700 text-sm mb-2">진행 로그</p>
          <div className="space-y-1">
            {logs.map((log, i) => (
              <p key={i} className="text-xs font-mono text-gray-600">{log}</p>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
