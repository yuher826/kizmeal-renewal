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
// 팝업·소리 ON/OFF 저장 키 — 헤더 배지 ON/OFF(cs_notify_badge_enabled)와는 완전히
// 독립된 별개 설정이라 키를 따로 쓴다(하나를 꺼도 다른 하나는 그대로 살아 있어야 함).
// ErpHeader가 같은 키로 상태를 맞춰야 해서 export한다.
export const NOTIFY_SOUND_ENABLED_KEY = 'cs_notify_sound_enabled'
// 같은 탭 안에서 이 설정을 바꾼 컴포넌트가 다른 컴포넌트(헤더 ↔ CS 화면)에게
// 알리는 커스텀 이벤트. 다른 탭은 브라우저 기본 'storage' 이벤트로 맞춘다.
export const NOTIFY_SOUND_EVENT = 'cs-notify-sound-changed'

// src별로 따로 캐시한다(기본 알림음 + 이어받기 전용음 등, 여러 소리를 동시에 쓸 수 있게).
const notifyAudioCache = new Map<string, HTMLAudioElement>()
let audioUnlockBound = false
let audioUnlocked = false

/** 알림음 오디오 엘리먼트 (지연 생성, src별 단일 인스턴스 재사용) */
function getNotifyAudio(src: string = NOTIFY_SOUND_SRC): HTMLAudioElement | null {
  if (typeof window === 'undefined') return null
  let audio = notifyAudioCache.get(src)
  if (!audio) {
    audio = new Audio(src)
    audio.volume = NOTIFY_VOLUME
    notifyAudioCache.set(src, audio)
  }
  return audio
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
 * src를 생략하면 기본 public/sounds/notify.mp3 (happy bells 종소리)를 재생한다.
 * 다른 소리를 쓰려면 경로를 넘긴다(예: 이어받기 전용음 '/sounds/takeover.mp3').
 * unlock 여부와 무관하게 항상 muted=false, volume=0.55 로 세팅한 뒤 play() 를 시도한다.
 * (unlock 은 도우미일 뿐 — 없거나 실패해도 여기서 그냥 재생을 시도한다. 실패해도 페이지엔 영향 없음)
 */
export function playNotify(src?: string): void {
  const audio = getNotifyAudio(src)
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

/**
 * 팝업·소리 ON/OFF를 호출 시점에 직접 읽는다(localStorage, 저장 안 돼 있으면
 * 기본 ON). ★useNotifier 훅의 enabled state는 마운트 시 한 번만 읽으므로,
 * 다른 컴포넌트(예: ErpHeader)에서 그 훅을 새로 쓰면 CS 화면에서 바꾼 설정을
 * 모른다 — 그래서 상태 없이 값만 매번 직접 읽는 함수가 따로 필요하다.
 */
export function isNotifySoundEnabled(): boolean {
  try {
    const saved = localStorage.getItem(NOTIFY_SOUND_ENABLED_KEY)
    return saved === null ? true : saved === 'true'
  } catch {
    return true
  }
}

/**
 * 팝업·소리 ON/OFF 저장 + 같은 탭의 다른 컴포넌트에 즉시 알림(NOTIFY_SOUND_EVENT).
 * ErpHeader와 useNotifier 양쪽이 이 함수 하나로만 값을 쓰게 해서 저장과 알림이
 * 어긋나는(하나만 하고 다른 하나를 빼먹는) 실수를 막는다.
 */
export function setNotifySoundEnabled(next: boolean): void {
  try {
    localStorage.setItem(NOTIFY_SOUND_ENABLED_KEY, String(next))
  } catch {
    /* 저장 실패해도 이번 세션 동작엔 영향 없음 */
  }
  try {
    window.dispatchEvent(new CustomEvent(NOTIFY_SOUND_EVENT, { detail: { enabled: next } }))
  } catch {
    /* CustomEvent 미지원 환경 — 같은 탭 동기화만 안 될 뿐, 저장은 이미 끝났다 */
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

/** 팝업 표시 — 권한 없거나 미지원이면 조용히 스킵 (소리는 별도 처리).
 *  onClick을 주면 팝업 클릭 시 포커스를 가져오고 그 콜백을 실행한다(생략 시
 *  기존과 동일하게 동작). */
export function showBrowserNotification(title: string, body?: string, onClick?: () => void): void {
  if (typeof window === 'undefined' || !('Notification' in window)) return
  try {
    if (Notification.permission !== 'granted') return
    // silent: true → 팝업은 뜨되 OS 기본 알림음은 안 남 (우리 mp3만 재생)
    const notification = new Notification(title, { body, silent: true })
    if (onClick) {
      notification.onclick = () => {
        window.focus()
        onClick()
        notification.close()
      }
    }
  } catch {
    /* 팝업 실패는 무시 */
  }
}

/**
 * 알림 훅.
 * - enabled: 현재 ON/OFF (기본 ON. localStorage에 저장돼 새로고침해도 유지된다)
 * - toggle: ON/OFF 전환 (ON 전환 시 팝업 권한 요청)
 * - notify(id, title, body): id 기준 중복 방지 후 소리+팝업
 *
 * ⚠️ 알려진 한계(이번 범위 밖): 같은 사용자가 탭을 여러 개 열면
 *    각 탭이 독립적으로 소리를 내 중복 재생될 수 있음. 여기서는 다루지 않음.
 */
export function useNotifier(defaultEnabled = true) {
  // ★SSR엔 localStorage가 없다 — 초기 state는 서버·클라이언트가 항상 같은 값
  //   (defaultEnabled)으로 시작해 hydration mismatch를 피하고, 저장된 값은
  //   마운트 후 아래 effect에서 반영한다.
  const [enabled, setEnabled] = useState(defaultEnabled)
  // realtime 콜백은 구독 시점 클로저에 갇히므로, 최신 enabled 값을 ref로 읽는다
  const enabledRef = useRef(defaultEnabled)
  // 마지막으로 알린 id를 기억 → 동일 이벤트 중복 수신 시 재알림 방지
  const lastNotifiedIdRef = useRef<string | null>(null)

  useEffect(() => {
    // 저장된 ON/OFF 값으로 마운트 후 보정 (없으면 기본값 그대로 ON 유지)
    try {
      const saved = localStorage.getItem(NOTIFY_SOUND_ENABLED_KEY)
      if (saved !== null) {
        const next = saved === 'true'
        enabledRef.current = next
        setEnabled(next)
      }
    } catch {
      /* localStorage 접근 불가 환경(프라이빗 모드 등)은 기본값 유지 */
    }
    // 첫 사용자 상호작용에 오디오 unlock 바인딩 (한 번만)
    setupAudioUnlock()
    // ON 상태로 시작하면 마운트 시 한 번 권한 요청
    if (enabledRef.current) void requestNotificationPermission()
  }, [])

  // 다른 컴포넌트(ErpHeader 등)가 같은 키를 바꾸면 이 훅도 즉시 맞춘다 —
  // enabled state뿐 아니라 realtime 콜백이 읽는 enabledRef도 함께 갱신해야
  // notify()가 옛 값을 들고 있지 않는다.
  useEffect(() => {
    function syncFromEvent(e: Event) {
      const detail = (e as CustomEvent<{ enabled: boolean }>).detail
      if (!detail || typeof detail.enabled !== 'boolean') return
      enabledRef.current = detail.enabled
      setEnabled(detail.enabled)
    }
    function syncFromStorage(e: StorageEvent) {
      if (e.key !== NOTIFY_SOUND_ENABLED_KEY) return
      const next = e.newValue === null ? true : e.newValue === 'true'
      enabledRef.current = next
      setEnabled(next)
    }
    window.addEventListener(NOTIFY_SOUND_EVENT, syncFromEvent)
    window.addEventListener('storage', syncFromStorage)
    return () => {
      window.removeEventListener(NOTIFY_SOUND_EVENT, syncFromEvent)
      window.removeEventListener('storage', syncFromStorage)
    }
  }, [])

  // ★setEnabled의 업데이터 함수 안에서 저장·이벤트 발행을 하지 않는다 — React 18은
  //   업데이터를 나중에(때로는 두 번) 실행할 수 있어 부수효과가 중복되거나 늦게
  //   나갈 수 있다(2026-09-17 assignedIdRef 버그와 같은 유형). enabledRef를 먼저
  //   읽고 확정한 값을 그대로 저장·전파한다.
  const toggle = useCallback(() => {
    const next = !enabledRef.current
    enabledRef.current = next
    setEnabled(next)
    setNotifySoundEnabled(next)
    if (next) void requestNotificationPermission()
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
