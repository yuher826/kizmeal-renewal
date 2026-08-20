'use client'

import { useEffect, useState, useCallback } from 'react'
import { LoaderCircle, CalendarDays, X } from 'lucide-react'

/**
 * 공휴일 확인 팝업 — /api/diet-automation/holidays GET/POST를 감싼다.
 *
 * 열리는 경로 2가지:
 *   1) "양식 준비" 클릭 → needsAttention일 때만 자동으로 열림 (③ 표시 시점)
 *      → 저장하면 onConfirmed()가 불려 부모가 handleGenerateForm()으로 이어간다
 *   2) "공휴일 설정 다시 보기" → 언제든 강제로 열림 (④ 다시 열기)
 *      → 저장은 'context'와 무관하게 항상 POST(mode:'confirm').
 *        저장 버튼을 안 누르고 닫으면(X·배경 클릭) **아무 요청도 안 나간다** —
 *        화면을 연 것만으로 confirmed_by/at을 덮으면 안 된다는 원칙(②).
 *
 * 미분류(added/unclassified)뿐 아니라 renamed도 "분류 필요" 영역에 넣는다(①).
 * closure_policy 승계가 이름 기준(add_holiday_closure_policy_260820.sql)이라
 * 이름이 바뀌면 승계가 끊기고, 임시공휴일이 정식 명칭으로 바뀌는 경우처럼
 * 성격 자체가 달라질 수도 있어 재확인이 필요하다. 기존/추정 정책을 프리필해
 * "그대로 저장"만 눌러도 되게 해서 부담은 줄인다.
 */

type ClosurePolicy = 'all_closed' | 'all_operating'

interface HolidayApi { date: string; name: string }
interface StoredHoliday extends HolidayApi {
  source: 'kasi_api' | 'manual'
  confirmedAt: string | null
  closurePolicy: ClosurePolicy | null
  confirmedByName?: string | null
}
interface PolicySuggestion { policy: ClosurePolicy; fromDate: string }
interface HolidaysResponse {
  year: number
  month: number
  fromApi: HolidayApi[]
  stored: StoredHoliday[]
  diff: {
    added: HolidayApi[]
    removed: StoredHoliday[]
    renamed: Array<{ date: string; from: string; to: string }>
    unclassified: StoredHoliday[]
    unchangedCount: number
    hasChanges: boolean
    needsAttention: boolean
  }
  policySuggestions: Record<string, PolicySuggestion>
}

/** 팝업에서 다루는 행 하나 — added/unclassified/renamed를 한 형태로 합친 것 */
interface ReviewItem {
  date: string
  name: string
  oldName?: string          // renamed일 때만 — "'설날' → '설날(대체)'"
  isManual: boolean
  suggestion?: { text: string; policy: ClosurePolicy }
}

const POLICY_LABEL: Record<ClosurePolicy, string> = {
  all_closed:    '전 원 휴무',
  all_operating: '전 원 정상운영',
}

function fmtDate(iso: string) {
  const [, m, d] = iso.split('-')
  return `${Number(m)}/${Number(d)}`
}
function fmtDateTime(iso: string | null | undefined) {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
  } catch { return '' }
}

/** GET 응답 → 분류가 필요한 행 목록 (added ∪ unclassified ∪ renamed, 날짜 중복 제거) */
function buildReviewItems(data: HolidaysResponse): ReviewItem[] {
  const storedByDate = new Map(data.stored.map(s => [s.date, s]))
  const renamedDates = new Set(data.diff.renamed.map(r => r.date))
  const items: ReviewItem[] = []

  const suggestionOf = (name: string) => {
    const sg = data.policySuggestions[name]
    if (!sg) return undefined
    return { text: `작년 ${fmtDate(sg.fromDate)}엔 '${POLICY_LABEL[sg.policy]}'로 하셨습니다`, policy: sg.policy }
  }

  for (const h of data.diff.added) {
    if (renamedDates.has(h.date)) continue  // 이론상 없지만 방어 — renamed 루프에서 처리
    items.push({ date: h.date, name: h.name, isManual: false, suggestion: suggestionOf(h.name) })
  }

  for (const h of data.diff.unclassified) {
    if (renamedDates.has(h.date)) continue  // renamed 루프에서 함께 처리(기존값 우선 프리필)
    items.push({
      date: h.date, name: h.name, isManual: h.source === 'manual',
      suggestion: suggestionOf(h.name),
    })
  }

  // ★① renamed는 이미 분류돼 있어도 무조건 포함 — 이름이 바뀌면 승계가 끊기고
  //   성격이 달라졌을 수 있어 사람이 한 번은 봐야 한다
  for (const r of data.diff.renamed) {
    const row = storedByDate.get(r.date)
    items.push({
      date: r.date, name: r.to, oldName: r.from,
      isManual: row?.source === 'manual',
      // 기존에 분류돼 있었다면 그 값이 최우선 프리필(그대로 넘기면 됨).
      // 미분류였다면 새 이름 기준 → 옛 이름 기준 순으로 승계 제안을 찾는다
      suggestion: row?.closurePolicy
        ? { text: `기존에 '${POLICY_LABEL[row.closurePolicy]}'로 분류돼 있었습니다`, policy: row.closurePolicy }
        : (suggestionOf(r.to) ?? suggestionOf(r.from)),
    })
  }

  return items.sort((a, b) => a.date.localeCompare(b.date))
}

interface Props {
  year: number
  month: number
  /** 'pre-generate' = 양식 준비 흐름 중 자동 오픈 / 'revisit' = 다시 보기로 수동 오픈 */
  context: 'pre-generate' | 'revisit'
  onClose: () => void
  /** context가 'pre-generate'일 때만: 저장 성공 후 다음 단계(폼 생성)로 진행 */
  onConfirmed?: () => void
}

export default function HolidayConfirmPopup({ year, month, context, onClose, onConfirmed }: Props) {
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)
  const [data,    setData]    = useState<HolidaysResponse | null>(null)
  const [choices, setChoices] = useState<Record<string, ClosurePolicy | null>>({})
  const [saving,  setSaving]  = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res  = await fetch(`/api/diet-automation/holidays?year=${year}&month=${month}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || '공휴일 조회에 실패했습니다.')
      setData(json)
      const items = buildReviewItems(json)
      setChoices(Object.fromEntries(items.map(it => [it.date, it.suggestion?.policy ?? null])))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [year, month])

  useEffect(() => { load() }, [load])

  async function handleSave() {
    if (!data) return
    const items = buildReviewItems(data)
    const unset = items.filter(it => !choices[it.date])
    if (unset.length > 0) {
      setError(`분류하지 않은 공휴일이 있습니다: ${unset.map(it => `${fmtDate(it.date)} ${it.name}`).join(', ')}`)
      return
    }

    // ★그 달의 최종 목록 전체를 보낸다(부분 아님) — 이미 분류된 것은 기존값,
    //   이번에 고른 것은 새 값. removed(=stored에만 있는 kasi_api)는 의도적으로
    //   뺀다 — route.ts confirm 모드가 "안 보낸 kasi_api 행=삭제"로 처리해서
    //   지정 취소를 이 목록으로 반영한다.
    type FinalRow = {
      date: string; name: string
      source: 'kasi_api' | 'manual'
      closurePolicy: ClosurePolicy | null
    }
    const storedByDate = new Map(data.stored.map(s => [s.date, s]))
    const finalList: FinalRow[] = data.fromApi.map(h => ({
      date: h.date,
      name: h.name,
      source: 'kasi_api',
      closurePolicy: choices[h.date] ?? storedByDate.get(h.date)?.closurePolicy ?? null,
    }))
    // stored에만 있는 manual 항목도 유지 (안 보내면 그대로 남긴 하기만, 명시적으로 포함해
    // 이번에 고른 분류가 있으면 반영되게)
    for (const s of data.stored) {
      if (s.source !== 'manual') continue
      if (finalList.some(f => f.date === s.date)) continue
      finalList.push({
        date: s.date, name: s.name, source: 'manual',
        closurePolicy: choices[s.date] ?? s.closurePolicy ?? null,
      })
    }

    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/diet-automation/holidays', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ year, month, mode: 'confirm', holidays: finalList }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || '저장에 실패했습니다.')

      if (context === 'pre-generate') {
        onConfirmed?.()
      } else {
        onClose()
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  const items = data ? buildReviewItems(data) : []

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-xl shadow-2xl max-h-[85vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-1">
          <h2 className="font-bold text-[#1C2B1E] text-lg flex items-center gap-2">
            <CalendarDays size={18} className="text-[#8B1E3F]" />
            {year}년 {month}월 공휴일 확인
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 -mr-1 -mt-1" aria-label="닫기">
            <X size={18} />
          </button>
        </div>

        {loading && (
          <div className="py-10 flex items-center justify-center text-gray-400 gap-2">
            <LoaderCircle size={18} className="animate-spin" /> 공휴일 정보를 확인하는 중...
          </div>
        )}

        {!loading && error && !data && (
          <div className="py-6 text-sm text-red-600">{error}</div>
        )}

        {!loading && data && (
          <>
            {items.length > 0 && (
              <div className="mt-4">
                <p className="text-xs text-gray-500 mb-3">
                  아래 공휴일은 원별 운영 여부를 먼저 정해야 식단표에 올바르게 표시됩니다.
                  &ldquo;전 원 정상운영&rdquo;으로 두면 평소처럼 메뉴가 채워지고,
                  &ldquo;전 원 휴무&rdquo;로 두면 이후 원별 예외만 확인하면 됩니다.
                </p>
                <ul className="space-y-3">
                  {items.map(it => (
                    <li key={it.date} className="border border-gray-200 rounded-xl p-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="text-sm font-medium text-[#1C2B1E]">
                          {fmtDate(it.date)} · {it.name}
                          {it.isManual && (
                            <span className="ml-1.5 text-[10px] text-gray-400 font-normal">(수동입력)</span>
                          )}
                        </div>
                      </div>
                      {it.oldName && (
                        <p className="text-[11px] text-amber-600 mb-1.5">
                          명칭 변경: &apos;{it.oldName}&apos; → &apos;{it.name}&apos;
                        </p>
                      )}
                      {it.suggestion && (
                        <p className="text-[11px] text-gray-400 mb-1.5">{it.suggestion.text}</p>
                      )}
                      <div className="flex gap-2">
                        {(['all_closed', 'all_operating'] as const).map(p => (
                          <button
                            key={p}
                            onClick={() => setChoices(c => ({ ...c, [it.date]: p }))}
                            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                              choices[it.date] === p
                                ? 'bg-[#8B1E3F] text-white border-[#8B1E3F]'
                                : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                            }`}
                          >
                            {POLICY_LABEL[p]}
                          </button>
                        ))}
                      </div>
                      {choices[it.date] === 'all_closed' && (
                        <p className="text-[11px] text-[#8B1E3F] mt-1.5">
                          휴무로 지정하면 다음 단계에서 예외 원을 확인합니다.
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {data.diff.removed.length > 0 && (
              <div className="mt-4 text-xs text-gray-400">
                지정 취소됨: {data.diff.removed.map(r => `${fmtDate(r.date)} ${r.name}`).join(', ')}
              </div>
            )}

            {items.length === 0 && data.diff.removed.length === 0 && (
              <div className="mt-4 text-sm text-gray-500 py-4">
                {year}년 {month}월은 확인할 변경 사항이 없습니다.
              </div>
            )}

            {/* ⑤ 결정 이력 — 가장 최근 확인 기록 하나만 작게 */}
            {(() => {
              const latest = data.stored
                .filter(s => s.confirmedAt)
                .sort((a, b) => (b.confirmedAt || '').localeCompare(a.confirmedAt || ''))[0]
              if (!latest) return null
              return (
                <p className="mt-4 text-[11px] text-gray-400">
                  마지막 확인: {latest.confirmedByName || '알 수 없음'} {fmtDateTime(latest.confirmedAt)}
                </p>
              )
            })()}

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
                disabled={saving || (items.length === 0 && data.diff.removed.length === 0)}
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
 * "양식 준비" 클릭 시 이 함수를 먼저 호출한다.
 *
 * 반환:
 *   { openPopup: false } — needsAttention 없음. 이미 POST(mode:'sync')까지
 *     끝낸 상태이므로 호출자는 바로 폼 생성으로 진행하면 된다.
 *     summary는 ⑥ 토스트 문구에 쓴다.
 *   { openPopup: true }  — 호출자가 <HolidayConfirmPopup>을 열어야 한다.
 *
 * ⚠️ needsAttention 없을 때의 sync POST는 "확인은 했다"는 흔적(synced_at)만
 *    남기고 confirmed_by/at은 절대 건드리지 않는다(route.ts가 보장) — 사람이
 *    바꾼 적 없는데 자동 호출로 결정자가 바뀌면 안 되기 때문.
 */
export async function checkHolidaysBeforeGenerate(
  year: number, month: number,
): Promise<{ openPopup: boolean; summary?: string }> {
  const res  = await fetch(`/api/diet-automation/holidays?year=${year}&month=${month}`)
  const json: HolidaysResponse = await res.json()
  if (!res.ok) {
    // 공휴일 API 장애로 폼 생성 자체를 막지 않는다 — gen_form.py도 DB 조회
    // 실패 시 경고만 내고 진행하는 동일한 설계
    return { openPopup: false }
  }

  if (json.diff.needsAttention) {
    return { openPopup: true }
  }

  // 변경 없음 → 조용히 sync만 남기고 요약 문구를 만든다 (⑥)
  // sync 모드는 route.ts에서 date만 읽고 나머지는 아예 안 본다(좁은 UPDATE) —
  // name/source 같은 다른 필드를 넣어도 무시되므로 여기서 만들 필요가 없다.
  try {
    await fetch('/api/diet-automation/holidays', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        year, month, mode: 'sync',
        holidays: json.fromApi.map(h => ({ date: h.date })),
      }),
    })
  } catch {
    // sync 실패는 치명적이지 않다 — 다음 호출 때 다시 시도됨
  }

  const sample = json.fromApi[0]
  const samplePolicy = sample
    ? json.stored.find(s => s.date === sample.date)?.closurePolicy
    : null
  const summary = sample
    ? `공휴일 확인 완료 — 이번 달 변경 없음(${sample.name} ${fmtDate(sample.date)}, ` +
      `${samplePolicy ? POLICY_LABEL[samplePolicy] : '기존 설정'} 유지)`
    : '공휴일 확인 완료 — 이번 달 해당 공휴일 없음'

  return { openPopup: false, summary }
}
