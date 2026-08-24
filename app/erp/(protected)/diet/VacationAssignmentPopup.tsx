'use client'

import { useEffect, useState, useCallback, Fragment } from 'react'
import { LoaderCircle, Palmtree, X, ChevronDown, ChevronRight as ChevronRightIcon } from 'lucide-react'

/**
 * 원별 방학 양식(O/X) 배정 팝업 — HANDOFF "④ 원별 방학 양식 선택" / 착수 순서 8번
 *
 * 이 연월에 디자이너가 방학O·방학X 양식을 둘 다(또는 하나라도) 올렸을 때만
 * 뜬다 — 대상 여부는 `/api/diet-automation/vacation`의 `vacationAvailable`이
 * `diet_templates.vacation_variant`를 직접 조회해 판정한다(달 하드코딩 없음).
 * 호출부(page.tsx)가 checkVacationAssignmentNeeded()로 먼저 확인하고,
 * 필요할 때만 연다 — 오늘 만든 BranchHolidayExceptionPopup과 동일 원칙.
 *
 * 아코디언도 같은 방식 — 계열(E/P/R/MB/SLP/AO) 그룹이 아니라 **배정 여부
 * 기준 2그룹**: "방학O 배정"(기본 펼침) / "방학X 배정"(기본 접힘). 방학O가
 * 소수·확인 대상이라는 점에서 공휴일 예외 화면의 "운영하는 원" 그룹과
 * 같은 위치 — 처음엔 전 원이 기본값(방학X)이라 "O 0개/X 49개"로 뜨는 게
 * 정상이다(공휴일 화면의 최초 버그와 겉보기 비슷해 보이니 혼동 주의).
 */

interface BranchRow {
  id:             string
  shortCode:      string | null
  branchFullName: string | null
  groupTag:       string | null
  sortOrder:      number | null
}
type AssignmentSource = 'default' | 'carried_over' | 'manual'
interface AssignmentCell {
  hasVacation:    boolean
  source:         AssignmentSource
  decidedByName?: string | null
  decidedAt?:     string | null
}
interface VacationResponse {
  year:               number
  month:              number
  vacationAvailable:  boolean
  branches:           BranchRow[]
  assignments:        Record<string, AssignmentCell>
}

const SOURCE_LABEL: Record<AssignmentSource, string> = {
  default:      '기본값',
  carried_over: '작년 승계',
  manual:       '직접 확인',
}

function branchLabel(b: BranchRow) {
  return b.branchFullName || b.shortCode || '(이름 없음)'
}

interface Props {
  year:    number
  month:   number
  /** 'pre-generate' = 양식 준비 흐름 중 자동 오픈 / 'revisit' = 다시 보기로 수동 오픈 */
  context: 'pre-generate' | 'revisit'
  onClose: () => void
  /** context가 'pre-generate'일 때만: 저장(또는 대상 없음 확인) 후 다음 단계로 진행 */
  onDone?: () => void
}

export default function VacationAssignmentPopup({ year, month, context, onClose, onDone }: Props) {
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)
  const [data,    setData]    = useState<VacationResponse | null>(null)
  // choices[branchProfileId] = hasVacation
  const [choices, setChoices] = useState<Record<string, boolean>>({})
  const [saving,  setSaving]  = useState(false)
  // 그룹 아코디언 상태 — "방학O 배정"은 기본 펼침
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set(['on']))

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res  = await fetch(`/api/diet-automation/vacation?year=${year}&month=${month}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || '방학 배정 조회에 실패했습니다.')
      setData(json)

      // ★오늘(2026-08-24) 공휴일 예외 화면에서 이 줄을 빠뜨려 "0개/49개"로
      //   잘못 뜨는 버그가 났다 — initChoices를 계산만 하고 state에 반영을
      //   안 하면 그룹 분리 로직이 항상 undefined를 읽는다. 반드시 확인할 것.
      const initChoices: Record<string, boolean> = {}
      for (const b of json.branches as BranchRow[]) {
        initChoices[b.id] = json.assignments?.[b.id]?.hasVacation ?? false
      }
      setChoices(initChoices)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [year, month])

  useEffect(() => { load() }, [load])

  // 이 연월이 방학 배정 대상이 아니면(방학 양식 자체가 없음) 확인할 게 없다.
  // pre-generate 흐름은 조용히 다음 단계로 넘어간다(checkHolidaysBeforeGenerate와
  // 동일한 "확인만 하면 되는" 원칙) — revisit은 사람이 직접 연 것이므로 안내만 하고 대기
  useEffect(() => {
    if (!loading && !error && data && !data.vacationAvailable && context === 'pre-generate') {
      onDone?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, error, data, context])

  function toggleGroup(key: string) {
    setOpenGroups(prev => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n })
  }
  function setChoice(branchId: string, hasVacation: boolean) {
    setChoices(prev => ({ ...prev, [branchId]: hasVacation }))
  }

  async function handleSave() {
    if (!data) return
    const entries = data.branches.map(b => ({
      branchProfileId: b.id,
      hasVacation:      choices[b.id] ?? false,
    }))

    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/diet-automation/vacation', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ year, month, entries }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || '저장에 실패했습니다.')

      if (context === 'pre-generate') onDone?.()
      else onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  // pre-generate에서 대상 없음 → onDone이 이미 불렸으므로 아무것도 그리지 않는다.
  if (!loading && !error && data && !data.vacationAvailable && context === 'pre-generate') {
    return null
  }

  const onBranches  = data ? data.branches.filter(b => choices[b.id]) : []
  const offBranches = data ? data.branches.filter(b => !choices[b.id]) : []
  const sections: Array<{ key: string; label: string; branches: BranchRow[] }> = [
    { key: 'on',  label: `방학O 배정 (${onBranches.length}개)`,  branches: onBranches },
    { key: 'off', label: `방학X 배정 (${offBranches.length}개)`, branches: offBranches },
  ]

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-2xl shadow-2xl max-h-[85vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-1">
          <h2 className="font-bold text-[#1C2B1E] text-lg flex items-center gap-2">
            <Palmtree size={18} className="text-[#8B1E3F]" />
            {year}년 {month}월 원별 방학 양식 배정
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 -mr-1 -mt-1" aria-label="닫기">
            <X size={18} />
          </button>
        </div>

        {loading && (
          <div className="py-10 flex items-center justify-center text-gray-400 gap-2">
            <LoaderCircle size={18} className="animate-spin" /> 방학 배정을 확인하는 중...
          </div>
        )}

        {!loading && error && !data && (
          <div className="py-6 text-sm text-red-600">{error}</div>
        )}

        {!loading && data && !data.vacationAvailable && (
          <div className="mt-4 text-sm text-gray-500 py-4">
            {year}년 {month}월은 방학 양식(O/X)이 없어 확인할 원별 배정이 없습니다.
          </div>
        )}

        {!loading && data && data.vacationAvailable && (
          <>
            <p className="text-xs text-gray-500 mt-3 mb-4">
              {year}년 {month}월은 방학O·방학X 양식이 있습니다. 방학이 있는 원만
              &ldquo;방학O&rdquo;로 바꿔주세요. 나머지는 그대로 두면 됩니다.
            </p>

            <div className="border border-gray-200 rounded-xl p-3">
              {sections.map(sec => {
                const isOpen = openGroups.has(sec.key)
                return (
                  <Fragment key={sec.key}>
                    <div
                      onClick={() => toggleGroup(sec.key)}
                      className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 cursor-pointer hover:bg-gray-100 mb-1"
                    >
                      <span className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
                        {isOpen ? <ChevronDown size={13} /> : <ChevronRightIcon size={13} />}
                        {sec.label}
                      </span>
                    </div>
                    {isOpen && (
                      <ul className="mb-2 divide-y divide-gray-100">
                        {sec.branches.length === 0 && (
                          <li className="px-3 py-2 text-xs text-gray-300">해당 원 없음</li>
                        )}
                        {sec.branches.map(b => {
                          const cell = data.assignments[b.id]
                          const current = choices[b.id] ?? false
                          return (
                            <li key={b.id} className="px-3 py-2 flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <div className="text-xs font-medium text-[#1C2B1E] truncate">
                                  {branchLabel(b)}
                                  {b.groupTag && (
                                    <span className="ml-1.5 text-[10px] text-gray-400 font-normal">
                                      {b.groupTag}
                                    </span>
                                  )}
                                </div>
                                {cell && cell.source !== 'default' && (
                                  <div className="text-[10px] text-gray-400">
                                    {SOURCE_LABEL[cell.source]}
                                    {cell.decidedByName ? ` · ${cell.decidedByName}` : ''}
                                  </div>
                                )}
                              </div>
                              <div className="flex gap-1.5 shrink-0">
                                {([true, false] as const).map(v => (
                                  <button
                                    key={String(v)}
                                    onClick={() => setChoice(b.id, v)}
                                    className={`text-[11px] px-2.5 py-1 rounded-lg border transition-colors ${
                                      current === v
                                        ? 'bg-[#8B1E3F] text-white border-[#8B1E3F]'
                                        : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                                    }`}
                                  >
                                    {v ? '방학O' : '방학X'}
                                  </button>
                                ))}
                              </div>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </Fragment>
                )
              })}
            </div>

            {error && <p className="mt-3 text-xs text-red-600">{error}</p>}

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={onClose}
                disabled={saving}
                className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                취소
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 text-sm rounded-lg bg-[#8B1E3F] text-white hover:bg-[#7A1936] disabled:opacity-50 flex items-center gap-1.5"
              >
                {saving && <LoaderCircle size={14} className="animate-spin" />}
                {context === 'pre-generate' ? '확정하고 양식 준비' : '저장'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/**
 * "양식 준비" 흐름에서, 원별 공휴일 예외 확인(BranchHolidayExceptionPopup) 뒤
 * 이 팝업을 열지 미리 판단한다. 이 연월에 방학 양식(O/X)이 없으면 열 필요가 없다.
 *
 * checkBranchExceptionsNeeded()와 같은 이유로 실패해도 진행 자체는 막지
 * 않는다 — 방학 배정이 비어 있어도(전 원 방학X로 폴백) 폼 생성 자체는
 * template_resolver.py가 안전하게 처리한다(HANDOFF 5단계 완료분).
 */
export async function checkVacationAssignmentNeeded(year: number, month: number): Promise<boolean> {
  try {
    const res  = await fetch(`/api/diet-automation/vacation?year=${year}&month=${month}`)
    if (!res.ok) return false
    const json = await res.json()
    return Boolean(json.vacationAvailable)
  } catch {
    return false
  }
}
