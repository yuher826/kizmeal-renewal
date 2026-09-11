'use client'

// SLA 기준 시간 설정 (2026-09-11 조사 확정 설계)
//
// 세 값(response/warning/escalate)을 다 받지 않고 목표 시간
// 하나만 받는다. escalate <= warning 이면 lib/sla.ts 가 빨강을
// 먼저 검사하므로 노랑 구간이 죽는다. 자동 계산이면 그 조합이
// 구조적으로 생길 수 없다.
// response_hours 는 배지 색에 관여하지 않고 "N시간 남음"
// 문구에만 쓰인다.
//
// ★DB 행을 나열하지 않는다★ — CATEGORY_LABELS 6종을 기준으로 행을
// 그리고 sla_rules 에 없으면 "미설정"으로 표시한다. 옛 카테고리
// (MEAL_COUNT/MENU/PHOTO/CONTRACT/SCHEDULE)는 이 화면에 나오지 않는다.

import { useState, useEffect, useCallback } from 'react'
import { ShieldAlert, Loader2, X } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { useErpUser } from '@/components/erp/ErpUserProvider'
import { CATEGORY_LABELS, CATEGORY_ICONS, type InquiryCategory, type SlaRule } from '@/lib/types'

// 목표 시간 → warning/escalate 자동 계산 비율.
// 기존 8행(2026-05-29 초기 INSERT) 실측 범위: warning 75~83%, escalate 108~125%.
const WARNING_RATIO = 0.8
const ESCALATE_RATIO = 1.15

function computeThresholds(targetHours: number) {
  return {
    warning_hours: Math.round(targetHours * WARNING_RATIO),
    escalate_hours: Math.round(targetHours * ESCALATE_RATIO),
  }
}

const SETTINGS_ALLOWED_ROLES = ['super_admin', 'manager']

export default function SlaSettingsPage() {
  const currentAdmin = useErpUser()
  const [rules, setRules] = useState<SlaRule[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  // 수정 모달 — /erp/admins 패턴(행별 모달, 인라인 편집 아님)
  const [editTarget, setEditTarget] = useState<InquiryCategory | null>(null)
  const [editTargetHours, setEditTargetHours] = useState('')
  const [saving, setSaving] = useState(false)
  const [editMsg, setEditMsg] = useState('')

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data, error } = await supabase.from('sla_rules').select('*')
    if (error) setLoadError('목록을 불러오지 못했습니다. 새로고침 해주세요.')
    else setRules((data ?? []) as SlaRule[])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const ruleByCategory = Object.fromEntries(rules.map(r => [r.category, r])) as Record<string, SlaRule>

  function openEditModal(category: InquiryCategory) {
    setEditTarget(category)
    const existing = ruleByCategory[category]
    setEditTargetHours(existing ? String(existing.response_hours) : '')
    setEditMsg('')
  }

  const targetHoursNum = parseInt(editTargetHours, 10)
  const isValidTarget = Number.isInteger(targetHoursNum) && targetHoursNum >= 1
  const preview = isValidTarget ? computeThresholds(targetHoursNum) : null

  async function handleEditSave() {
    if (!editTarget) return
    if (!isValidTarget) {
      setEditMsg('목표 시간은 1 이상의 정수로 입력해주세요')
      return
    }

    setSaving(true)
    setEditMsg('')
    try {
      const supabase = createClient()
      const { warning_hours, escalate_hours } = computeThresholds(targetHoursNum)
      const { error } = await supabase
        .from('sla_rules')
        .upsert(
          {
            category: editTarget,
            response_hours: targetHoursNum,
            warning_hours,
            escalate_hours,
          },
          { onConflict: 'category' },
        )
      if (error) {
        setEditMsg(`오류: ${error.message}`)
      } else {
        setEditTarget(null)
        await load()
      }
    } catch {
      setEditMsg('오류: 네트워크 문제')
    }
    setSaving(false)
  }

  // ── 로딩 ──
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={24} className="animate-spin text-emerald-600" />
      </div>
    )
  }

  // ── 접근 차단 (super_admin·manager만 — 미들웨어와 동일 규칙의 방어선) ──
  if (!SETTINGS_ALLOWED_ROLES.includes(currentAdmin.role)) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <ShieldAlert size={40} className="text-slate-300 mb-4" />
        <p className="text-slate-600 font-semibold">이 페이지에 접근할 권한이 없습니다</p>
        <p className="text-sm text-slate-400 mt-1">권한이 필요하면 슈퍼관리자에게 문의해주세요.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-slate-600">SLA 기준 시간 설정</h2>
        <p className="text-xs text-slate-400 mt-0.5">
          문의 카테고리별 목표 응답 시간을 설정합니다. 노랑·빨강 경고 시점은 목표 시간을 기준으로 자동 계산됩니다.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50">
              {['카테고리', '목표 시간', ''].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-bold text-slate-400">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(Object.keys(CATEGORY_LABELS) as InquiryCategory[]).map(category => {
              const rule = ruleByCategory[category]
              return (
                <tr key={category} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3.5 text-sm font-semibold text-slate-800">
                    {CATEGORY_ICONS[category]} {CATEGORY_LABELS[category]}
                  </td>
                  <td className="px-4 py-3.5 text-sm">
                    {rule
                      ? <span className="text-slate-700">{rule.response_hours}시간</span>
                      : <span className="text-slate-400">미설정</span>}
                  </td>
                  <td className="px-4 py-3.5">
                    <button
                      onClick={() => openEditModal(category)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-emerald-700 border border-slate-200 hover:border-emerald-300 rounded-lg px-2.5 py-1.5 transition-colors"
                    >
                      수정
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {loadError && (
        <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-600">{loadError}</div>
      )}

      <p className="text-xs text-slate-400">
        변경한 기준은 CS 화면을 새로고침한 뒤 반영됩니다.
      </p>

      {/* ── 수정 모달 ── */}
      {editTarget && (
        <div className="fixed inset-0 bg-black/40 z-30 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-slate-800">
                {CATEGORY_ICONS[editTarget]} {CATEGORY_LABELS[editTarget]} — SLA 설정
              </h2>
              <button onClick={() => setEditTarget(null)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">목표 시간 (시간 단위)</label>
              <input
                type="number"
                min={1}
                step={1}
                value={editTargetHours}
                onChange={e => setEditTargetHours(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="예: 4"
              />
            </div>

            <div className="bg-slate-50 rounded-xl px-4 py-3 text-xs text-slate-500">
              {preview
                ? `목표 ${targetHoursNum}시간으로 설정하면, ${preview.warning_hours}시간 경과 시 노랑, ${preview.escalate_hours}시간 경과 시 빨강으로 표시됩니다.`
                : '목표 시간을 입력하면 노랑·빨강 경고 시점이 여기에 표시됩니다.'}
            </div>

            {editMsg && (
              <div className="bg-red-50 rounded-xl px-4 py-3 text-sm text-red-600">{editMsg}</div>
            )}

            <button
              onClick={handleEditSave}
              disabled={saving || !editTargetHours.trim()}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-sm font-semibold transition-colors"
            >
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
