'use client'

import { useEffect, useState, useCallback, Fragment } from 'react'
import { LoaderCircle, Users, X, ChevronDown, ChevronRight as ChevronRightIcon } from 'lucide-react'

/**
 * 원별 공휴일 운영 예외 팝업 — ② 원별 아코디언 (2단 필터 2단계)
 *
 * HolidayConfirmPopup에서 '전 원 휴무'로 분류한 날짜만 이 팝업의 대상이 된다.
 * 대상 날짜가 없으면(모두 '전 원 정상운영'이었거나 공휴일 자체가 없음) 이
 * 팝업은 열 이유가 없다 — 호출부(page.tsx)가 checkBranchExceptionsNeeded()로
 * 먼저 확인하고, 필요할 때만 연다.
 *
 * 아코디언은 색상별(E/P/R/MB/SLP/AO) 그룹이 아니라 **운영 여부 기준 2그룹**이다
 * (review.tsx·branches.tsx의 원 계열 아코디언과는 다른 축):
 *   - "공휴일에 운영하는 원" — branch_profiles.operates_on_holidays=true 인
 *     원(현재 덕양P·광교SLP). 이미 알려진 예외이므로 기본 펼침 — 바로 확인 가능
 *   - "공휴일에 쉬는 원" — 나머지. 대부분 그대로 두면 되므로 기본 접힘
 * 각 그룹 내부 정렬은 기존 화면과 동일하게 group_tag → sort_order
 */

interface ClosedDate { date: string; name: string }
interface BranchRow {
  id:                        string
  shortCode:                 string | null
  branchFullName:            string | null
  groupTag:                  string | null
  sortOrder:                 number | null
  operatesOnHolidaysDefault: boolean
}
type OperationSource = 'default' | 'carried_over' | 'manual'
interface OperationCell {
  isOperating:    boolean
  source:         OperationSource
  decidedByName?: string | null
  decidedAt?:     string | null
}
interface BranchesResponse {
  year:        number
  month:       number
  closedDates: ClosedDate[]
  branches:    BranchRow[]
  operations:  Record<string, Record<string, OperationCell>>
}

const SOURCE_LABEL: Record<OperationSource, string> = {
  default:      '기본값',
  carried_over: '작년 승계',
  manual:       '직접 확인',
}

function fmtDate(iso: string) {
  const [, m, d] = iso.split('-')
  return `${Number(m)}/${Number(d)}`
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

export default function BranchHolidayExceptionPopup({ year, month, context, onClose, onDone }: Props) {
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)
  const [data,    setData]    = useState<BranchesResponse | null>(null)
  // choices[date][branchProfileId] = isOperating
  const [choices, setChoices] = useState<Record<string, Record<string, boolean>>>({})
  const [saving,  setSaving]  = useState(false)
  // 그룹 아코디언 상태 — 날짜별로 독립(날짜가 여러 개면 각자 펼침 상태를 따로 기억)
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res  = await fetch(`/api/diet-automation/holidays/branches?year=${year}&month=${month}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || '원별 예외 조회에 실패했습니다.')
      setData(json)

      const initChoices: Record<string, Record<string, boolean>> = {}
      const initOpen = new Set<string>()
      for (const c of json.closedDates as ClosedDate[]) {
        initChoices[c.date] = {}
        for (const b of json.branches as BranchRow[]) {
          initChoices[c.date][b.id] = json.operations[c.date]?.[b.id]?.isOperating ?? b.operatesOnHolidaysDefault
        }
        // "공휴일에 운영하는 원" 그룹은 날짜마다 기본 펼침
        initOpen.add(`${c.date}::operating`)
      }
      setChoices(initChoices)
      setOpenGroups(initOpen)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [year, month])

  useEffect(() => { load() }, [load])

  // 대상 날짜가 없으면(전 원 휴무로 분류된 공휴일이 이번 달에 없음) 확인할 게 없다.
  // pre-generate 흐름은 조용히 다음 단계로 넘어간다(checkHolidaysBeforeGenerate와
  // 동일한 "확인만 하면 되는" 원칙) — revisit은 사람이 직접 연 것이므로 안내만 하고 대기
  useEffect(() => {
    if (!loading && !error && data && data.closedDates.length === 0 && context === 'pre-generate') {
      onDone?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, error, data, context])

  function toggleGroup(key: string) {
    setOpenGroups(prev => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n })
  }
  function setChoice(date: string, branchId: string, isOperating: boolean) {
    setChoices(prev => ({ ...prev, [date]: { ...prev[date], [branchId]: isOperating } }))
  }

  async function handleSave() {
    if (!data) return
    const entries = data.closedDates.flatMap(c =>
      data.branches.map(b => ({
        date:            c.date,
        branchProfileId: b.id,
        isOperating:     choices[c.date]?.[b.id] ?? b.operatesOnHolidaysDefault,
      })),
    )

    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/diet-automation/holidays/branches', {
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
  // (로딩 중 잠깐 빈 화면이 뜨는 대신, 아래 loading 분기가 스피너를 보여준다)
  if (!loading && !error && data && data.closedDates.length === 0 && context === 'pre-generate') {
    return null
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-2xl shadow-2xl max-h-[85vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-1">
          <h2 className="font-bold text-[#1C2B1E] text-lg flex items-center gap-2">
            <Users size={18} className="text-[#8B1E3F]" />
            {year}년 {month}월 원별 공휴일 예외 확인
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 -mr-1 -mt-1" aria-label="닫기">
            <X size={18} />
          </button>
        </div>

        {loading && (
          <div className="py-10 flex items-center justify-center text-gray-400 gap-2">
            <LoaderCircle size={18} className="animate-spin" /> 원별 예외를 확인하는 중...
          </div>
        )}

        {!loading && error && !data && (
          <div className="py-6 text-sm text-red-600">{error}</div>
        )}

        {!loading && data && data.closedDates.length === 0 && (
          <div className="mt-4 text-sm text-gray-500 py-4">
            {year}년 {month}월은 &lsquo;전 원 휴무&rsquo;로 분류된 공휴일이 없어 확인할
            원별 예외가 없습니다.
          </div>
        )}

        {!loading && data && data.closedDates.length > 0 && (
          <>
            <p className="text-xs text-gray-500 mt-3 mb-4">
              아래 날짜는 &lsquo;전 원 휴무&rsquo;로 분류됐습니다. 예외적으로 운영하는
              원만 &ldquo;운영&rdquo;으로 바꿔주세요. 나머지는 그대로 두면 됩니다.
            </p>

            <div className="space-y-5">
              {data.closedDates.map(c => {
                const operatingBranches = data.branches.filter(b => choices[c.date]?.[b.id])
                const restingBranches    = data.branches.filter(b => !choices[c.date]?.[b.id])
                const sections: Array<{ key: string; label: string; branches: BranchRow[] }> = [
                  { key: 'operating', label: `공휴일에 운영하는 원 (${operatingBranches.length}개)`, branches: operatingBranches },
                  { key: 'resting',   label: `공휴일에 쉬는 원 (${restingBranches.length}개)`,      branches: restingBranches },
                ]

                return (
                  <div key={c.date} className="border border-gray-200 rounded-xl p-3">
                    <div className="text-sm font-semibold text-[#1C2B1E] mb-2">
                      {fmtDate(c.date)} · {c.name}
                    </div>

                    {sections.map(sec => {
                      const groupKey = `${c.date}::${sec.key}`
                      const isOpen = openGroups.has(groupKey)
                      return (
                        <Fragment key={groupKey}>
                          <div
                            onClick={() => toggleGroup(groupKey)}
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
                                const cell = data.operations[c.date]?.[b.id]
                                const current = choices[c.date]?.[b.id] ?? b.operatesOnHolidaysDefault
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
                                          onClick={() => setChoice(c.date, b.id, v)}
                                          className={`text-[11px] px-2.5 py-1 rounded-lg border transition-colors ${
                                            current === v
                                              ? 'bg-[#8B1E3F] text-white border-[#8B1E3F]'
                                              : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                                          }`}
                                        >
                                          {v ? '운영' : '휴무'}
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
 * "양식 준비" 흐름에서, 공휴일 분류(HolidayConfirmPopup) 확정 뒤 이 팝업을 열지
 * 미리 판단한다. '전 원 휴무' 대상 날짜가 없으면 열 필요가 없다.
 *
 * checkHolidaysBeforeGenerate()와 같은 이유로 실패해도 진행 자체는 막지 않는다
 * (gen_form.py의 DB 조회 실패 시 경고만 내고 진행하는 설계와 동일) — 다만
 * 이번엔 실패해도 사람이 다음 화면에서 "원별 예외 확인" 링크로 언제든 다시
 * 열어볼 수 있으므로, alert 없이 조용히 넘어간다(공휴일 분류 실패보다 한 단계
 * 덜 치명적 — 원별 예외가 비어 있어도 폼 생성 자체는 정상 동작한다).
 */
export async function checkBranchExceptionsNeeded(year: number, month: number): Promise<boolean> {
  try {
    const res  = await fetch(`/api/diet-automation/holidays/branches?year=${year}&month=${month}`)
    if (!res.ok) return false
    const json = await res.json()
    return (json.closedDates?.length ?? 0) > 0
  } catch {
    return false
  }
}
