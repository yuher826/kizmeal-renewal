'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

// ─────────────────────────────────────────────────────────────
// 알림 공통 유틸 (CS 관리 / 고객 문의 공용)
//   - playNotify: 알림음 재생 (public/sounds/notify.mp3 재생)
//   - requestNotificationPermission: 브라우저 팝업 권한 요청 (안전, 예외 삼킴)
//   - showBrowserNotification: 권한 있을 때만 팝업 (없으면 조용히 스킵 → 소리만)
//   - useNotifier: ON/OFF 토글 + 중복 방지 상태를 담은 훅
// ─────────────────────────────────────────────────────────────

const NOTIFY_SOUND_SRC = '/sounds/notify.mp3'
const NOTIFY_VOLUME = 0.55

let notifyAudio: HTMLAudioElement | null = null
let audioUnlockBound = false
let audioUnlocked = false

/** 알림음 오디오 엘리먼트 (지연 생성, 단일 인스턴스 재사용) */
function getNotifyAudio(): HTMLAudioElement | null {
  if (typeof window === 'undefined') return null
  if (!notifyAudio) {
    notifyAudio = new Audio(NOTIFY_SOUND_SRC)
    notifyAudio.volume = NOTIFY_VOLUME
  }
  return notifyAudio
}

/**
 * 오디오 자동재생 unlock (도우미 — 없어도 mp3는 재생됨).
 * 첫 사용자 상호작용(클릭/키/터치) 시 오디오를 muted 로 살짝 재생했다 멈춰서
 * 브라우저의 자동재생 잠금을 해제한다. volume 은 건드리지 않고 muted 만 사용하며,
 * 끝나면 muted=false 로 반드시 원복한다. (한 번만 바인딩)
 */
export function setupAudioUnlock(): void {
  if (typeof window === 'undefined' || audioUnlockBound) return
  audioUnlockBound = true
  const unlock = () => {
    window.removeEventListener('pointerdown', unlock)
    window.removeEventListener('keydown', unlock)
    window.removeEventListener('touchstart', unlock)
    if (audioUnlocked) return
    const audio = getNotifyAudio()
    if (!audio) return
    audio.muted = true // volume 이 아니라 muted 로 무음 처리
    audio.play().then(() => {
      // 그 사이 실제 알림(playNotify)이 muted 를 풀었으면 건드리지 않는다 (재생 클로버 방지)
      if (audio.muted) {
        audio.pause()
        audio.currentTime = 0
        audio.muted = false // 무음 원복 보장
      }
      audioUnlocked = true
    }).catch(() => {
      audio.muted = false   // 실패해도 무음 원복 보장
    })
  }
  window.addEventListener('pointerdown', unlock)
  window.addEventListener('keydown', unlock)
  window.addEventListener('touchstart', unlock)
}

/**
 * 알림음 재생.
 * public/sounds/notify.mp3 (happy bells 종소리)를 재생한다.
 * unlock 여부와 무관하게 항상 muted=false, volume=0.55 로 세팅한 뒤 play() 를 시도한다.
 * (unlock 은 도우미일 뿐 — 없거나 실패해도 여기서 그냥 재생을 시도한다. 실패해도 페이지엔 영향 없음)
 */
export function playNotify(): void {
  const audio = getNotifyAudio()
  if (!audio) return
  try {
    audio.muted = false          // unlock 등으로 바뀌었을 수 있어 매번 확실히 해제
    audio.volume = NOTIFY_VOLUME  // 볼륨도 매번 보정
    audio.currentTime = 0         // 연속 알림 대비 처음부터 재생
    void audio.play().catch(() => {
      /* 자동재생 차단 등은 조용히 무시 */
    })
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
    // silent: true → 팝업은 뜨되 OS 기본 알림음은 안 남 (우리 mp3만 재생)
    new Notification(title, { body, silent: true })
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
    // 첫 사용자 상호작용에 오디오 unlock 바인딩 (한 번만)
    setupAudioUnlock()
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
