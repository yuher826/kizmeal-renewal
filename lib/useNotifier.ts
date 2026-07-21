'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

// ─────────────────────────────────────────────────────────────
// 알림 공통 유틸 (CS 관리 / 고객 문의 공용)
//   - playNotify: 딩동 알림음 재생 (Web Audio로 즉석 생성 — mp3 파일 불필요)
//   - requestNotificationPermission: 브라우저 팝업 권한 요청 (안전, 예외 삼킴)
//   - showBrowserNotification: 권한 있을 때만 팝업 (없으면 조용히 스킵 → 소리만)
//   - useNotifier: ON/OFF 토글 + 중복 방지 상태를 담은 훅
// ─────────────────────────────────────────────────────────────

let audioCtx: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  try {
    const Ctor: typeof AudioContext | undefined =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    if (!audioCtx) audioCtx = new Ctor()
    return audioCtx
  } catch {
    return null
  }
}

/**
 * 알림음 재생.
 * Web Audio API로 마림바(나무 실로폰) 느낌의 통통 튀는 멜로디(솔-도-미-솔-미-도-솔)를 즉석 생성한다.
 * 각 음 = triangle 기음 + 낮은 서브옥타브(따뜻함) + 짧은 고배음 어택 트랜지언트("톡"),
 * 빠른 어택 + 짧은 지수 감쇠로 마림바 특유의 통통한 타격감을 낸다.
 * 별도 음원 파일이 필요 없고, 어느 환경에서도 소리가 난다.
 * (자동재생 정책상 최초 사용자 상호작용 전에는 무음일 수 있으나,
 *  버튼 클릭 등 제스처 이후 resume 되어 정상 재생된다 — 실패해도 페이지엔 영향 없음)
 */
export function playNotify(): void {
  const ctx = getAudioContext()
  if (!ctx) return
  try {
    if (ctx.state === 'suspended') void ctx.resume()
    const now = ctx.currentTime

    // 리미터(컴프레서)로 볼륨을 키우되 찢어짐(클리핑) 방지 (겹치는 음의 피크만 부드럽게 억제)
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -10
    comp.knee.value = 20
    comp.ratio.value = 6
    comp.attack.value = 0.003
    comp.release.value = 0.25
    const master = ctx.createGain()
    master.gain.value = 0.85 // 전체 볼륨 (기존 0.75 → 0.85 로 더 크게)
    master.connect(comp).connect(ctx.destination)

    const PEAK = 0.75 // 음당 크기
    // 통통 튀는 마림바 멜로디: 솔(G4)-도(C5)-미(E5)-솔(G5)-미(E5)-도(C5)-솔(G5)
    const notes = [
      { freq: 392.00, start: 0.00, dur: 0.30 }, // 솔 G4
      { freq: 523.25, start: 0.28, dur: 0.30 }, // 도 C5
      { freq: 659.25, start: 0.56, dur: 0.30 }, // 미 E5
      { freq: 783.99, start: 0.84, dur: 0.30 }, // 솔 G5
      { freq: 659.25, start: 1.12, dur: 0.30 }, // 미 E5
      { freq: 523.25, start: 1.40, dur: 0.30 }, // 도 C5
      { freq: 783.99, start: 1.68, dur: 0.68 }, // 솔 G5 (여운 길게)
    ]
    for (const n of notes) {
      const t0 = now + n.start
      const t1 = t0 + n.dur
      // 음마다 envelope gain — 빠른 어택 + 짧고 통통한 지수 감쇠 (마림바 톡톡)
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0.0001, t0)
      gain.gain.exponentialRampToValueAtTime(PEAK, t0 + 0.006) // 빠른 타격 어택
      gain.gain.exponentialRampToValueAtTime(0.0001, t1)       // 짧은 감쇠
      gain.connect(master)

      // 기음 (triangle — 따뜻하고 부드러운 나무 소리)
      const osc = ctx.createOscillator()
      osc.type = 'triangle'
      osc.frequency.value = n.freq
      osc.connect(gain)
      osc.start(t0)
      osc.stop(t1 + 0.05)

      // 낮은 서브옥타브 (따뜻함/두께 추가)
      const sub = ctx.createOscillator()
      const subGain = ctx.createGain()
      sub.type = 'sine'
      sub.frequency.value = n.freq / 2
      subGain.gain.value = 0.30
      sub.connect(subGain).connect(gain)
      sub.start(t0)
      sub.stop(t1 + 0.05)

      // 고배음 어택 트랜지언트 ("톡" — 아주 짧게만 울려 타격감만 준다)
      const click = ctx.createOscillator()
      const clickGain = ctx.createGain()
      click.type = 'sine'
      click.frequency.value = n.freq * 4
      clickGain.gain.setValueAtTime(0.0001, t0)
      clickGain.gain.exponentialRampToValueAtTime(0.22 * PEAK, t0 + 0.004)
      clickGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.09)
      click.connect(clickGain).connect(master)
      click.start(t0)
      click.stop(t0 + 0.12)
    }
  } catch {
    /* 오디오 미지원/차단 시 조용히 무시 */
  }
}

/** 브라우저 팝업 권한 요청 — 미지원/거부여도 throw 없이 boolean 반환 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) return false
  try {
    if (Notification.permission === 'granted') return true
    if (Notification.permission === 'denied') return false
    const result = await Notification.requestPermission()
    return result === 'granted'
  } catch {
    return false
  }
}

/** 팝업 표시 — 권한 없거나 미지원이면 조용히 스킵 (소리는 별도 처리) */
export function showBrowserNotification(title: string, body?: string): void {
  if (typeof window === 'undefined' || !('Notification' in window)) return
  try {
    if (Notification.permission !== 'granted') return
    new Notification(title, { body })
  } catch {
    /* 팝업 실패는 무시 */
  }
}

/**
 * 알림 훅.
 * - enabled: 현재 ON/OFF (기본 ON, 새로고침 시 초기화 = 세션 내 컴포넌트 state)
 * - toggle: ON/OFF 전환 (ON 전환 시 팝업 권한 요청)
 * - notify(id, title, body): id 기준 중복 방지 후 소리+팝업
 *
 * ⚠️ 알려진 한계(이번 범위 밖): 같은 사용자가 탭을 여러 개 열면
 *    각 탭이 독립적으로 소리를 내 중복 재생될 수 있음. 여기서는 다루지 않음.
 */
export function useNotifier(defaultEnabled = true) {
  const [enabled, setEnabled] = useState(defaultEnabled)
  // realtime 콜백은 구독 시점 클로저에 갇히므로, 최신 enabled 값을 ref로 읽는다
  const enabledRef = useRef(defaultEnabled)
  // 마지막으로 알린 id를 기억 → 동일 이벤트 중복 수신 시 재알림 방지
  const lastNotifiedIdRef = useRef<string | null>(null)

  useEffect(() => {
    // 기본 ON이므로 마운트 시 한 번 권한 요청
    if (enabledRef.current) void requestNotificationPermission()
  }, [])

  const toggle = useCallback(() => {
    setEnabled(prev => {
      const next = !prev
      enabledRef.current = next
      if (next) void requestNotificationPermission()
      return next
    })
  }, [])

  // 안정적인 identity(deps []) — realtime 콜백에 넘겨도 재구독을 유발하지 않는다
  const notify = useCallback((id: string, title: string, body?: string) => {
    if (!enabledRef.current) return
    if (id && lastNotifiedIdRef.current === id) return // 중복 방지
    lastNotifiedIdRef.current = id
    playNotify()
    showBrowserNotification(title, body)
  }, [])

  return { enabled, toggle, notify }
}
