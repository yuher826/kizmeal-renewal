'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

type PopupNotice = {
  id: string
  title: string
  content: string | null
  popup_until: string | null
}

const DISMISSED_KEY = 'kizmeal_dismissed_popup_notice_ids'

function getDismissedIds(): string[] {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function addDismissedId(id: string) {
  try {
    const next = Array.from(new Set([...getDismissedIds(), id]))
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(next))
  } catch {
    // localStorage 접근 실패해도 화면 흐름은 막지 않음
  }
}

// 고객 포털(원 담당자) 전용 긴급 팝업 공지.
// board/customer/layout.tsx 와 board/(customer)/layout.tsx 두 곳 모두에 삽입돼야
// 고객 포털 전 화면에서 노출된다(두 레이아웃으로 나뉜 기존 구조 — HANDOFF "반복 함정" 참고).
export default function CustomerPopupNotice() {
  const [queue, setQueue] = useState<PopupNotice[]>([])

  useEffect(() => {
    const supabase = createClient()

    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: branchRow } = await supabase
        .from('branches').select('id').eq('auth_id', user.id).maybeSingle()

      let branchId = branchRow?.id
      if (!branchId) {
        const { data: memberRow } = await supabase
          .from('branch_members').select('branch_id').eq('auth_id', user.id).maybeSingle()
        branchId = memberRow?.branch_id
      }
      if (!branchId) return

      const { data: rows } = await supabase
        .from('parent_notices')
        .select('id, title, content, popup_until')
        .eq('is_popup', true)
        .or(`branch_id.is.null,branch_id.eq.${branchId}`)
        .order('created_at', { ascending: false })

      if (!rows) return

      const now = Date.now()
      const dismissed = new Set(getDismissedIds())
      const active = rows.filter(n => {
        if (dismissed.has(n.id)) return false
        if (n.popup_until && new Date(n.popup_until).getTime() < now) return false
        return true
      })
      setQueue(active)
    }
    load()
  }, [])

  if (queue.length === 0) return null
  const current = queue[0]

  function handleConfirm() {
    addDismissedId(current.id)
    setQueue(prev => prev.slice(1))
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="긴급 공지"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-4"
    >
      <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl overflow-hidden">
        <div className="bg-[#2D6A4F] px-5 py-4">
          <span className="text-[11px] bg-white/20 text-white font-bold px-2 py-0.5 rounded-full">🔔 긴급 공지</span>
          <h2 className="text-white font-bold mt-2 leading-snug">{current.title}</h2>
        </div>
        <div className="px-5 py-4 max-h-[50vh] overflow-y-auto">
          <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">
            {current.content || '(내용 없음)'}
          </p>
        </div>
        <div className="px-5 pb-5">
          <button
            type="button"
            onClick={handleConfirm}
            className="w-full bg-[#2D6A4F] hover:bg-[#1B4332] text-white font-semibold py-3 rounded-xl transition-colors text-sm"
          >
            확인{queue.length > 1 ? ` (${queue.length - 1}건 더 있음)` : ''}
          </button>
        </div>
      </div>
    </div>
  )
}
