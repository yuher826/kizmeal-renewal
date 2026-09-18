// realtime 구독 상태 로그(2026-09-18, B-1 진단용으로 도입 → 수리 확인 후 D에서 정리).
// 정상 상태(SUBSCRIBED, 우리가 닫은 CLOSED)는 남기지 않고 이상 신호만 console.warn으로 남긴다:
//   CHANNEL_ERROR / TIMED_OUT / 우리가 닫지 않았는데 온 CLOSED
// 재발 진단은 HANDOFF의 realtime.subscription 조회 SQL(claims_role)과 함께 본다.

// subscribeAfterAuth의 cleanup이 removeChannel 하기 직전에 표시한다 — 이 토픽의 CLOSED는 정상.
const intentionallyClosing = new Set<string>()

export function markChannelClosing(topic: string) {
  intentionallyClosing.add(topic)
}

export function logChannelStatus(name: string) {
  const topic = `realtime:${name}`
  return (status: string, err?: Error) => {
    if (status === 'CLOSED') {
      if (intentionallyClosing.delete(topic)) return
      console.warn('[realtime]', name, status, '— 의도하지 않은 종료')
      return
    }
    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      console.warn('[realtime]', name, status, err?.message)
    }
  }
}
