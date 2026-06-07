'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import {
  DayMenuInput, MonthlyMenuData, MenuItemInput, SnackItemInput,
  OverrideItem, ALLERGEN_LIST, AllergenNum, MonthlyValidationResult,
} from '@/lib/types'
import { validateMonth, getBusinessDays } from '@/lib/diet-validation'

// ── 알레르기 체크박스 ─────────────────────────────────────────
function AllergenCheckbox({
  selected,
  onChange,
}: {
  selected: AllergenNum[]
  onChange: (nums: AllergenNum[]) => void
}) {
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {ALLERGEN_LIST.map(a => {
        const num = a.num as AllergenNum
        const checked = selected.includes(num)
        return (
          <button
            key={a.num}
            type="button"
            onClick={() => {
              const next = checked
                ? selected.filter(n => n !== num)
                : [...selected, num]
              onChange(next)
            }}
            className={`text-xs px-1.5 py-0.5 rounded border transition-colors
              ${checked
                ? 'bg-orange-500 text-white border-orange-500'
                : 'bg-white text-gray-500 border-gray-300 hover:border-orange-400'
              }`}
            title={a.label}
          >
            {a.num}
          </button>
        )
      })}
    </div>
  )
}

// ── 메뉴 항목 입력 ────────────────────────────────────────────
function MenuItemField({
  label,
  item,
  onChange,
  showIngpaExclude = false,
  showDessertPrefix = false,
  showSoupEmpty = false,
  showAndSauce = false,
  required = true,
  hasError = false,
}: {
  label: string
  item: MenuItemInput
  onChange: (item: MenuItemInput) => void
  showIngpaExclude?: boolean
  showDessertPrefix?: boolean
  showSoupEmpty?: boolean
  showAndSauce?: boolean
  required?: boolean
  hasError?: boolean
}) {
  return (
    <div className={`border rounded-lg p-2 space-y-1.5
      ${hasError ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-gray-50'}`}>
      <div className="flex items-center gap-2">
        <span className={`text-xs font-medium w-14 shrink-0
          ${required ? 'text-gray-700' : 'text-gray-400'}`}>
          {label}{!required && ' (선택)'}
        </span>
        <input
          type="text"
          value={item.value}
          onChange={e => onChange({ ...item, value: e.target.value })}
          placeholder={item.is_empty ? '(없음)' : `${label} 입력`}
          disabled={item.is_empty}
          className={`flex-1 text-sm border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-green-400
            ${item.is_empty ? 'bg-gray-200 text-gray-400' : 'bg-white border-gray-300'}`}
        />
        {showSoupEmpty && (
          <label className="flex items-center gap-1 text-xs text-gray-500 shrink-0 cursor-pointer">
            <input
              type="checkbox"
              checked={!!item.is_empty}
              onChange={e => onChange({ ...item, is_empty: e.target.checked, value: '' })}
              className="w-3 h-3"
            />
            국없음
          </label>
        )}
        {showIngpaExclude && (
          <label className="flex items-center gap-1 text-xs text-orange-600 shrink-0 cursor-pointer">
            <input
              type="checkbox"
              checked={!!item.ingpa_exclude}
              onChange={e => onChange({ ...item, ingpa_exclude: e.target.checked })}
              className="w-3 h-3"
            />
            잉파제외
          </label>
        )}
        {showDessertPrefix && (
          <label className="flex items-center gap-1 text-xs text-purple-600 shrink-0 cursor-pointer">
            <input
              type="checkbox"
              checked={!!item.is_dessert_prefix}
              onChange={e => onChange({ ...item, is_dessert_prefix: e.target.checked })}
              className="w-3 h-3"
            />
            후식-
          </label>
        )}
      </div>

      {!item.is_empty && (
        <AllergenCheckbox
          selected={item.allergens}
          onChange={allergens => onChange({ ...item, allergens })}
        />
      )}

      {showAndSauce && !item.is_empty && (
        <div className="pl-2 border-l-2 border-blue-300">
          <div className="flex items-center gap-1 mb-1">
            <span className="text-xs text-blue-500 font-medium">& 소스 연결</span>
            {!item.and_sauce && (
              <button
                type="button"
                onClick={() => onChange({ ...item, and_sauce: { value: '', allergens: [] } })}
                className="text-xs text-blue-400 hover:text-blue-600"
              >
                + 추가
              </button>
            )}
          </div>
          {item.and_sauce !== undefined && (
            <div className="space-y-1">
              <input
                type="text"
                value={item.and_sauce.value}
                onChange={e => onChange({ ...item, and_sauce: { ...item.and_sauce!, value: e.target.value } })}
                placeholder="소스명 (예: 브라운소스)"
                className="w-full text-xs border border-gray-300 rounded px-2 py-1"
              />
              <AllergenCheckbox
                selected={item.and_sauce.allergens}
                onChange={allergens => onChange({ ...item, and_sauce: { ...item.and_sauce!, allergens } })}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── 원별 예외 편집기 ──────────────────────────────────────────
function OverrideEditor({
  overrides,
  onChange,
}: {
  overrides: OverrideItem[]
  onChange: (overrides: OverrideItem[]) => void
}) {
  const addOverride = () => {
    onChange([...overrides, { target: [], type: 'replace', value: '', allergens: [] }])
  }
  const removeOverride = (i: number) => onChange(overrides.filter((_, idx) => idx !== i))
  const updateOverride = (i: number, o: OverrideItem) => {
    const next = [...overrides]
    next[i] = o
    onChange(next)
  }

  return (
    <div className="mt-1.5 space-y-2 pl-2 border-l-2 border-indigo-300">
      {overrides.map((o, i) => (
        <div key={i} className="bg-indigo-50 rounded p-2 space-y-1.5">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={o.target.join(',')}
              onChange={e => updateOverride(i, {
                ...o,
                target: e.target.value.split(',').map(t => t.trim()).filter(Boolean),
              })}
              placeholder="대상원 (예: 목동P 또는 P)"
              className="flex-1 text-xs border border-gray-300 rounded px-2 py-1"
            />
            <select
              value={o.type}
              onChange={e => updateOverride(i, { ...o, type: e.target.value as OverrideItem['type'] })}
              className="text-xs border border-gray-300 rounded px-1 py-1"
            >
              <option value="replace">교체</option>
              <option value="exclude">제외</option>
              <option value="full_replace">전체교체</option>
            </select>
            <button type="button" onClick={() => removeOverride(i)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
          </div>
          {o.type !== 'exclude' && (
            <div className="space-y-1">
              <input
                type="text"
                value={o.value ?? ''}
                onChange={e => updateOverride(i, { ...o, value: e.target.value })}
                placeholder={o.type === 'full_replace' ? '전체메뉴 (/ 로 구분)' : '대체 메뉴명'}
                className="w-full text-xs border border-gray-300 rounded px-2 py-1"
              />
              <AllergenCheckbox
                selected={o.allergens ?? []}
                onChange={allergens => updateOverride(i, { ...o, allergens })}
              />
            </div>
          )}
          {(o.target.includes('P') || o.target.includes('E') || o.target.includes('R')) && (
            <input
              type="text"
              value={o.exclude_targets?.join(',') ?? ''}
              onChange={e => updateOverride(i, {
                ...o,
                exclude_targets: e.target.value.split(',').map(t => t.trim()).filter(Boolean),
              })}
              placeholder="그룹에서 제외할 원 (예: 동탄P)"
              className="w-full text-xs border border-gray-200 rounded px-2 py-1 bg-red-50"
            />
          )}
        </div>
      ))}
      <button type="button" onClick={addOverride} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
        + 원별 예외 추가
      </button>
    </div>
  )
}

// ── 간식 항목 입력 ────────────────────────────────────────────
function SnackItemField({
  label,
  item,
  onChange,
  showEnglish = false,
  showCareEmpty = false,
}: {
  label: string
  item: SnackItemInput
  onChange: (item: SnackItemInput) => void
  showEnglish?: boolean
  showCareEmpty?: boolean
}) {
  const [showOverride, setShowOverride] = useState(false)

  return (
    <div className="border border-gray-200 rounded-lg p-2 space-y-1.5 bg-blue-50">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-blue-700 w-14 shrink-0">{label}</span>
        <input
          type="text"
          value={item.value}
          onChange={e => onChange({ ...item, value: e.target.value })}
          placeholder={item.is_empty ? '(미제공)' : `${label} 입력`}
          disabled={item.is_empty}
          className={`flex-1 text-sm border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400
            ${item.is_empty ? 'bg-gray-200 text-gray-400' : 'bg-white border-gray-300'}`}
        />
        <input
          type="number"
          value={item.calories || ''}
          onChange={e => onChange({ ...item, calories: Number(e.target.value) })}
          placeholder="Kcal"
          disabled={item.is_empty}
          className="w-16 text-xs border border-gray-300 rounded px-1 py-1 text-center bg-white"
        />
        <span className="text-xs text-gray-400">Kcal</span>
        {showCareEmpty && (
          <label className="flex items-center gap-1 text-xs text-gray-500 shrink-0 cursor-pointer">
            <input
              type="checkbox"
              checked={!!item.is_empty}
              onChange={e => onChange({ ...item, is_empty: e.target.checked, value: '', calories: 0 })}
              className="w-3 h-3"
            />
            미제공(-)
          </label>
        )}
      </div>

      {!item.is_empty && (
        <AllergenCheckbox
          selected={item.allergens}
          onChange={allergens => onChange({ ...item, allergens })}
        />
      )}

      {showEnglish && !item.is_empty && (
        <input
          type="text"
          value={item.value_en ?? ''}
          onChange={e => onChange({ ...item, value_en: e.target.value })}
          placeholder="영문 메뉴명 (English)"
          className="w-full text-xs border border-gray-200 rounded px-2 py-1 bg-yellow-50"
        />
      )}

      {!item.is_empty && (
        <div>
          <button
            type="button"
            onClick={() => setShowOverride(!showOverride)}
            className="text-xs text-indigo-500 hover:text-indigo-700"
          >
            {showOverride ? '▲' : '▼'} 원별 예외 {item.overrides?.length ? `(${item.overrides.length}개)` : '+ 추가'}
          </button>
          {showOverride && (
            <OverrideEditor
              overrides={item.overrides ?? []}
              onChange={overrides => onChange({ ...item, overrides })}
            />
          )}
        </div>
      )}
    </div>
  )
}

// ── 하루치 입력 컴포넌트 ─────────────────────────────────────
function DayMenuEditor({
  date,
  day,
  onChange,
  errorCodes,
  needsEnglish,
  hasCare,
}: {
  date: string
  day: DayMenuInput
  onChange: (day: DayMenuInput) => void
  errorCodes: string[]
  needsEnglish: boolean
  hasCare: boolean
}) {
  const dateObj = new Date(date + 'T12:00:00')
  const dayLabels = ['일', '월', '화', '수', '목', '금', '토']
  const dayLabel = dayLabels[dateObj.getDay()]
  const dateDisplay = `${dateObj.getMonth() + 1}/${dateObj.getDate()}(${dayLabel})`
  const isUnavailable = day.is_holiday || day.is_self_closed

  return (
    <div className={`border-2 rounded-xl overflow-hidden
      ${errorCodes.length > 0 ? 'border-red-300' : 'border-gray-200'}
      ${isUnavailable ? 'opacity-60' : ''}`}>
      {/* 날짜 헤더 */}
      <div className={`px-3 py-2 flex items-center justify-between
        ${day.birthday_mark ? 'bg-pink-100' : 'bg-gray-100'}`}>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-gray-800 text-sm">{dateDisplay}</span>
          {day.is_holiday && (
            <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">
              {day.holiday_name}
            </span>
          )}
          {day.birthday_mark && (
            <span className="text-xs bg-pink-200 text-pink-700 px-2 py-0.5 rounded-full">🎂 생일</span>
          )}
          {errorCodes.length > 0 && (
            <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">
              ❌ {errorCodes.length}개 오류
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer">
            <input
              type="checkbox"
              checked={day.is_self_closed}
              onChange={e => onChange({ ...day, is_self_closed: e.target.checked })}
              className="w-3 h-3"
            />
            자체휴무
          </label>
          <label className="flex items-center gap-1 text-xs text-pink-500 cursor-pointer">
            <input
              type="checkbox"
              checked={day.birthday_mark}
              onChange={e => onChange({ ...day, birthday_mark: e.target.checked })}
              className="w-3 h-3"
            />
            🎂생일
          </label>
          <label className="flex items-center gap-1 text-xs text-green-600 cursor-pointer">
            <input
              type="checkbox"
              checked={day.is_picnic}
              onChange={e => onChange({ ...day, is_picnic: e.target.checked })}
              className="w-3 h-3"
            />
            🏕소풍
          </label>
        </div>
      </div>

      {day.is_picnic && (
        <div className="px-3 py-2 bg-green-50 border-b border-green-200">
          <input
            type="text"
            value={day.picnic_menu ?? ''}
            onChange={e => onChange({ ...day, picnic_menu: e.target.value })}
            placeholder="도시락 메뉴 (예: 떡갈비주먹밥/치킨강정/야채고로케/과일2종)"
            className="w-full text-sm border border-green-300 rounded px-2 py-1 bg-white"
          />
        </div>
      )}

      {!isUnavailable && (
        <div className="p-3 space-y-2">
          <p className="font-medium text-xs text-gray-500">🍱 중식</p>
          <MenuItemField
            label="밥"
            item={day.rice}
            onChange={rice => onChange({ ...day, rice })}
            hasError={errorCodes.includes('V01')}
          />
          <MenuItemField
            label="국/찌개"
            item={day.soup}
            onChange={soup => onChange({ ...day, soup })}
            showSoupEmpty
            hasError={errorCodes.includes('V03')}
          />
          <MenuItemField
            label="반찬1"
            item={day.side1}
            onChange={side1 => onChange({ ...day, side1 })}
            showAndSauce
            hasError={errorCodes.includes('V02')}
          />
          <MenuItemField
            label="반찬2"
            item={day.side2 ?? { value: '', allergens: [] }}
            onChange={side2 => onChange({ ...day, side2 })}
            showAndSauce
            hasError={errorCodes.includes('V02')}
          />
          <MenuItemField
            label="반찬3"
            item={day.side3 ?? { value: '', allergens: [], ingpa_exclude: false, is_dessert_prefix: false }}
            onChange={side3 => onChange({ ...day, side3 })}
            showIngpaExclude
            showDessertPrefix
            required={false}
          />
          <MenuItemField
            label="김치"
            item={day.kimchi}
            onChange={kimchi => onChange({ ...day, kimchi })}
          />

          {/* 칼로리 */}
          <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-lg p-2 flex-wrap">
            <span className="text-xs font-medium text-yellow-700 w-10">칼로리</span>
            {([
              { key: 'calories', label: '총', unit: 'Kcal', w: 'w-20' },
              { key: 'carb',     label: '탄', unit: 'g',    w: 'w-14' },
              { key: 'protein',  label: '단', unit: 'g',    w: 'w-14' },
              { key: 'fat',      label: '지', unit: 'g',    w: 'w-14' },
            ] as const).map(f => (
              <div key={f.key} className="flex items-center gap-0.5">
                <span className="text-xs text-gray-500">{f.label}</span>
                <input
                  type="number"
                  value={(day as unknown as Record<string, number>)[f.key] || ''}
                  onChange={e => onChange({ ...day, [f.key]: Number(e.target.value) })}
                  className={`${f.w} text-xs border border-yellow-300 rounded px-1 py-1 text-center bg-white`}
                />
                <span className="text-xs text-gray-400">{f.unit}</span>
              </div>
            ))}
          </div>

          {/* 엘란/잉파 후식과일 행 */}
          <div className="flex items-center gap-2 bg-purple-50 border border-purple-200 rounded-lg p-2">
            <span className="text-xs font-medium text-purple-700 w-20 shrink-0">잉파/엘란행</span>
            <input
              type="text"
              value={day.ellan_ingpa_row}
              onChange={e => onChange({ ...day, ellan_ingpa_row: e.target.value })}
              placeholder="후식과일"
              className="flex-1 text-xs border border-purple-200 rounded px-2 py-1 bg-white"
            />
          </div>

          <p className="font-medium text-xs text-gray-500 mt-3">🍪 간식</p>
          <SnackItemField
            label="오전간식"
            item={day.snack_am}
            onChange={snack_am => onChange({ ...day, snack_am })}
            showEnglish={needsEnglish}
          />
          <SnackItemField
            label="오후간식"
            item={day.snack_pm}
            onChange={snack_pm => onChange({ ...day, snack_pm })}
            showEnglish={needsEnglish}
          />
          {hasCare && (
            <SnackItemField
              label="돌봄(저녁)"
              item={day.snack_care ?? { value: '', allergens: [], calories: 0 }}
              onChange={snack_care => onChange({ ...day, snack_care })}
              showCareEmpty
            />
          )}
        </div>
      )}
    </div>
  )
}

// ── 메인 페이지 ──────────────────────────────────────────────
const HOLIDAYS_2026: Record<string, string> = {
  '2026-01-01': '신정', '2026-02-17': '설날연휴', '2026-02-18': '설날',
  '2026-02-19': '설날연휴', '2026-03-01': '삼일절', '2026-05-05': '어린이날',
  '2026-05-25': '부처님오신날', '2026-06-06': '현충일', '2026-08-15': '광복절',
  '2026-09-24': '추석연휴', '2026-09-25': '추석', '2026-09-26': '추석연휴',
  '2026-10-03': '개천절', '2026-10-09': '한글날', '2026-12-25': '크리스마스',
}

function defaultMenuItem(): MenuItemInput { return { value: '', allergens: [] } }
function defaultSnack(): SnackItemInput  { return { value: '', allergens: [], calories: 0 } }

function createEmptyDay(dateStr: string): DayMenuInput {
  const isHoliday = !!HOLIDAYS_2026[dateStr]
  return {
    date: dateStr,
    is_holiday: isHoliday,
    holiday_name: HOLIDAYS_2026[dateStr],
    is_self_closed: false,
    is_picnic: false,
    birthday_mark: false,
    rice:   defaultMenuItem(),
    soup:   { ...defaultMenuItem(), is_empty: false },
    side1:  defaultMenuItem(),
    side2:  defaultMenuItem(),
    side3:  { value: '', allergens: [], ingpa_exclude: false, is_dessert_prefix: false },
    kimchi: defaultMenuItem(),
    calories: 0, carb: 0, protein: 0, fat: 0,
    ellan_ingpa_row: '후식과일',
    snack_am:   defaultSnack(),
    snack_pm:   defaultSnack(),
    snack_care: { value: '', allergens: [], calories: 0, is_empty: false },
  }
}

export default function DietInputPage() {
  const params = useParams()
  const router = useRouter()
  const year  = Number(params.year)
  const month = Number(params.month)

  const [monthData,  setMonthData]  = useState<MonthlyMenuData | null>(null)
  const [validation, setValidation] = useState<MonthlyValidationResult | null>(null)
  const [saving,     setSaving]     = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [lastSaved,  setLastSaved]  = useState<Date | null>(null)
  const [loading,    setLoading]    = useState(true)

  // 초기 데이터 로드
  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const supabase = createClient()
        const { data } = await supabase
          .from('weekly_menus')
          .select('id, menu_data')
          .eq('year', year)
          .eq('month', month)
          .eq('diet_type', 'CK')
          .is('branch_id', null)
          .maybeSingle()

        if (cancelled) return

        if (data?.menu_data) {
          setMonthData(data.menu_data as MonthlyMenuData)
        } else {
          const daysInMonth = new Date(year, month, 0).getDate()
          const days: Record<string, DayMenuInput> = {}
          for (let d = 1; d <= daysInMonth; d++) {
            const dow = new Date(year, month - 1, d).getDay()
            if (dow === 0 || dow === 6) continue
            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
            days[dateStr] = createEmptyDay(dateStr)
          }
          setMonthData({ year, month, diet_type: 'CK', month_note: '', days, status: 'draft' })
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [year, month])

  // 하루치 업데이트
  const updateDay = useCallback((date: string, day: DayMenuInput) => {
    setMonthData(prev => prev ? { ...prev, days: { ...prev.days, [date]: day } } : prev)
  }, [])

  // 실시간 검증
  useEffect(() => {
    if (!monthData) return
    setValidation(validateMonth(monthData))
  }, [monthData])

  // 날짜별 오류 코드 맵
  const errorsByDate: Record<string, string[]> = {}
  validation?.errors.forEach(e => {
    if (e.date) {
      if (!errorsByDate[e.date]) errorsByDate[e.date] = []
      errorsByDate[e.date].push(e.code)
    }
  })

  // 임시저장
  async function handleSave() {
    if (!monthData) return
    setSaving(true)
    try {
      const supabase = createClient()
      const fields = {
        year, month,
        diet_type: 'CK',
        branch_id: null,
        status: 'draft',
        month_note: monthData.month_note,
        menu_data: monthData,
        updated_at: new Date().toISOString(),
      }
      const { data: existing } = await supabase
        .from('weekly_menus').select('id')
        .eq('year', year).eq('month', month).eq('diet_type', 'CK')
        .is('branch_id', null).maybeSingle()

      const { error } = existing?.id
        ? await supabase.from('weekly_menus').update(fields).eq('id', existing.id)
        : await supabase.from('weekly_menus').insert(fields)
      if (error) throw error
      setLastSaved(new Date())
    } catch (e) {
      console.error('저장 실패:', e)
      alert('저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  // 제출
  async function handleSubmit() {
    if (!monthData || !validation?.isValid) return
    setSubmitting(true)
    try {
      const supabase = createClient()
      const now = new Date().toISOString()
      const fields = {
        year, month,
        diet_type: 'CK',
        branch_id: null,
        status: 'submitted',
        month_note: monthData.month_note,
        menu_data: { ...monthData, status: 'submitted' },
        submitted_at: now,
        updated_at: now,
      }
      const { data: existing } = await supabase
        .from('weekly_menus').select('id')
        .eq('year', year).eq('month', month).eq('diet_type', 'CK')
        .is('branch_id', null).maybeSingle()

      const { error } = existing?.id
        ? await supabase.from('weekly_menus').update(fields).eq('id', existing.id)
        : await supabase.from('weekly_menus').insert(fields)
      if (error) throw error

      await supabase.from('diet_notifications').insert({
        type: 'review_request',
        title: `${year}년 ${month}월 CK식단 검토 요청`,
        message: `${year}년 ${month}월 CK 공통 식단 입력이 완료되었습니다. 검토 후 승인해주세요.`,
        year, month,
        recipient_role: 'manager',
      })

      alert(`✅ ${year}년 ${month}월 식단 제출 완료!\n권팀장에게 검토 요청이 전송되었습니다.`)
      router.push('/board/admin/diet-automation')
    } catch (e) {
      console.error('제출 실패:', e)
      alert('제출 중 오류가 발생했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">불러오는 중...</p>
      </div>
    )
  }
  if (!monthData) return null

  const businessDays = getBusinessDays(year, month)
  const inputCount = businessDays.filter(d => {
    const day = monthData.days[d]
    return day && !day.is_holiday && !day.is_self_closed && day.rice?.value?.trim()
  }).length
  const completionRate = businessDays.length > 0
    ? Math.round((inputCount / businessDays.length) * 100) : 0
  const sortedDates = Object.keys(monthData.days).sort()

  return (
    <div className="p-4 max-w-3xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start gap-3">
          <Link href="/board/admin/diet-automation/input" className="text-gray-400 hover:text-[#2D6A4F] mt-1">←</Link>
          <div>
            <h1 className="text-xl font-bold text-gray-800">
              📋 {year}년 {month}월 CK 식단 입력
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              영업일 {businessDays.length}일
              {lastSaved && ` · 저장됨 ${lastSaved.toLocaleTimeString()}`}
            </p>
          </div>
        </div>
        <div className={`px-3 py-1.5 rounded-lg text-sm font-medium
          ${validation?.isValid
            ? 'bg-green-50 text-green-700 border border-green-200'
            : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
          {validation?.isValid
            ? '✅ 검증 통과'
            : `❌ 오류 ${validation?.errors?.length ?? 0}개`
          }
        </div>
      </div>

      {/* 진행률 + 메모 */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 space-y-3">
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600 shrink-0">입력 진행률</span>
          <div className="flex-1 bg-gray-200 rounded-full h-2">
            <div
              className="bg-green-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${completionRate}%` }}
            />
          </div>
          <span className="text-sm font-semibold text-gray-700 shrink-0">
            {inputCount}/{businessDays.length}일 ({completionRate}%)
          </span>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">📌 이달의 특이재료/메모</label>
          <input
            type="text"
            value={monthData.month_note}
            onChange={e => setMonthData({ ...monthData, month_note: e.target.value })}
            placeholder="예: 복분자, 감자 - 하절기"
            className="w-full text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-green-400"
          />
        </div>
      </div>

      {/* 오류 목록 */}
      {validation && !validation.isValid && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
          <p className="text-sm font-semibold text-red-700 mb-1.5">❌ 수정 필요 항목</p>
          <ul className="space-y-0.5">
            {validation.errors.slice(0, 5).map((e, i) => (
              <li key={i} className="text-xs text-red-600">
                [{e.code}]{e.date ? ` ${e.date}` : ''} {e.message}
              </li>
            ))}
            {validation.errors.length > 5 && (
              <li className="text-xs text-red-400">... 외 {validation.errors.length - 5}개</li>
            )}
          </ul>
        </div>
      )}

      {/* 날짜별 입력 */}
      <div className="space-y-3">
        {sortedDates.map(date => (
          <DayMenuEditor
            key={date}
            date={date}
            day={monthData.days[date]}
            onChange={day => updateDay(date, day)}
            errorCodes={errorsByDate[date] ?? []}
            needsEnglish={false}
            hasCare={false}
          />
        ))}
      </div>

      {/* 하단 액션 바 */}
      <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 mt-6 flex items-center justify-between gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 disabled:opacity-50 transition-colors"
        >
          {saving ? '저장 중...' : '💾 임시저장'}
        </button>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400 hidden sm:block">
            {validation?.isValid ? '모든 검증 통과!' : `${validation?.errors?.length ?? 0}개 오류 수정 후 제출 가능`}
          </span>
          <button
            onClick={handleSubmit}
            disabled={!validation?.isValid || submitting}
            className={`px-6 sm:px-8 py-2.5 rounded-xl font-semibold transition-colors text-sm
              ${validation?.isValid
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
          >
            {submitting ? '제출 중...' : '✅ 제출 — 권팀장 검토 요청'}
          </button>
        </div>
      </div>
    </div>
  )
}
