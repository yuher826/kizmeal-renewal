// realtime 미동작 원인 확정 전까지 유지하는 진단 로그(2026-09-18, B-1).
// F12 콘솔에서 '[realtime]'으로 필터해 SUBSCRIBED / CHANNEL_ERROR / TIMED_OUT / CLOSED를 본다.
export function logChannelStatus(name: string) {
  return (status: string, err?: Error) => console.info('[realtime]', name, status, err?.message)
}
