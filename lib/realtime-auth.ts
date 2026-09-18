import type { RealtimeChannel, Session } from '@supabase/supabase-js'
import type { createClient } from '@/lib/supabase'
import { markChannelClosing } from '@/lib/realtime-debug'

type BrowserClient = ReturnType<typeof createClient>

// realtime 구독 전에 로그인 토큰을 realtime에 먼저 실어 둔다(2026-09-18, B-1).
// ★원인 — 마운트 즉시 subscribe하면 supabase-js가 getSession()으로 토큰을 받아오기 전에
//   채널이 anon으로 join하는 경우가 있다. 그 뒤 토큰을 보내도 서버에 이미 등록된
//   postgres_changes 구독의 claims_role은 anon으로 남아 RLS에 걸려 이벤트가 0건이 된다
//   (realtime.subscription 실측: 목록 채널 anon 1건 확인).
// 세션이 없으면 null — anon 구독은 RLS로 어차피 0건이라 구독하지 않는다.
export async function ensureRealtimeAuth(supabase: BrowserClient): Promise<Session | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return null
    await supabase.realtime.setAuth(session.access_token)
    return session
  } catch (e) {
    console.error('[realtime] 토큰 설정 실패:', e)
    return null
  }
}

// ensureRealtimeAuth를 통과한 뒤에만 채널을 만든다. 반환값은 useEffect cleanup으로 쓴다.
// · 언마운트가 먼저 오면(cancelled) 채널을 만들지 않는다
// · removeChannel은 채널이 실제로 만들어졌을 때만 한다
export function subscribeAfterAuth(
  supabase: BrowserClient,
  build: (session: Session) => RealtimeChannel,
): () => void {
  let cancelled = false
  let channel: RealtimeChannel | null = null
  void ensureRealtimeAuth(supabase).then(session => {
    if (!session || cancelled) return
    channel = build(session)
  })
  return () => {
    cancelled = true
    if (channel) {
      // 우리가 닫는 CLOSED는 정상 — 진단 로그가 경고로 남기지 않게 표시해 둔다
      markChannelClosing(channel.topic)
      void supabase.removeChannel(channel)
    }
  }
}
