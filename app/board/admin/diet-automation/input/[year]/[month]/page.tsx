'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import {
  DayMenuInput, MonthlyMenuData, MenuItemInput, SnackItemInput,
  OverrideItem, ALLERGEN_LIST, AllergenNum, CellSelection,
  BranchOption, MonthlyValidationResult,
} from '@/lib/types'
import { validateMonth, getBusinessDays } from '@/lib/diet-validation'

// ─── 상수 ──────────────────────────────────────────────────────────────
const HOLIDAYS_2026: Record<string, string> = {
  '2026-01-01':'신정','2026-02-17':'설날연휴','2026-02-18':'설날',
  '2026-02-19':'설날연휴','2026-03-01':'삼일절','2026-05-05':'어린이날',
  '2026-05-25':'부처님오신날','2026-06-06':'현충일','2026-08-15':'광복절',
  '2026-09-24':'추석연휴','2026-09-25':'추석','2026-09-26':'추석연휴',
  '2026-10-03':'개천절','2026-10-09':'한글날','2026-12-25':'크리스마스',
}

const DAY_KR = ['일','월','화','수','목','금','토']

const GRID_ROWS = [
  { key:'rice',            label:'밥',        type:'menu',    rowBg:'bg-white'      },
  { key:'soup',            label:'국/찌개',   type:'menu',    rowBg:'bg-white'      },
  { key:'side1',           label:'반찬1',     type:'menu',    rowBg:'bg-white'      },
  { key:'side2',           label:'반찬2',     type:'menu',    rowBg:'bg-white'      },
  { key:'side3',           label:'반찬3',     type:'menu',    rowBg:'bg-white'      },
  { key:'kimchi',          label:'김치',      type:'menu',    rowBg:'bg-white'      },
  { key:'ellan_ingpa_row', label:'잉파/엘란', type:'info',    rowBg:'bg-purple-50'  },
  { key:'calories',        label:'칼로리',    type:'info',    rowBg:'bg-yellow-50'  },
  { key:'DIVIDER',         label:'',          type:'divider', rowBg:''              },
  { key:'snack_am',        label:'오전간식',  type:'snack',   rowBg:'bg-blue-50'    },
  { key:'snack_pm',        label:'오후간식',  type:'snack',   rowBg:'bg-blue-50'    },
  { key:'snack_care',      label:'돌봄간식',  type:'snack',   rowBg:'bg-teal-50'    },
] as const

// ─── 주차 그룹핑 ────────────────────────────────────────────────────────
function getWeekGroups(year: number, month: number): Record<number, string[]> {
  const daysInMonth = new Date(year, month, 0).getDate()
  const groups: Record<number, string[]> = {}
  let weekNum = 1
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month - 1, d)
    const dow = date.getDay()
    if (dow === 0 || dow === 6) continue
    if (dow === 1 && d > 1) weekNum++
    const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`
    if (!groups[weekNum]) groups[weekNum] = []
    groups[weekNum].push(dateStr)
  }
  return groups
}

// ─── 기본값 ────────────────────────────────────────────────────────────
function emptyMenu(): MenuItemInput { return { value:'', allergens:[] } }
function emptySnack(): SnackItemInput { return { value:'', allergens:[], calories:0 } }

function createEmptyDay(dateStr: string): DayMenuInput {
  const isHoliday = !!HOLIDAYS_2026[dateStr]
  const dow = new Date(dateStr + 'T12:00:00').getDay()
  return {
    date: dateStr,
    is_holiday: isHoliday,
    holiday_name: HOLIDAYS_2026[dateStr],
    is_self_closed: false,
    is_picnic: false,
    birthday_mark: dow === 5,
    rice:   emptyMenu(),
    soup:   { ...emptyMenu(), is_empty: false },
    side1:  emptyMenu(),
    side2:  emptyMenu(),
    side3:  { value:'', allergens:[], ingpa_exclude:false, is_dessert_prefix:false },
    kimchi: emptyMenu(),
    calories:0, carb:0, protein:0, fat:0,
    ellan_ingpa_row: '',
    snack_am:   emptySnack(),
    snack_pm:   emptySnack(),
    snack_care: { value:'', allergens:[], calories:0, is_empty:false },
  }
}

// ─── 셀 표시 ───────────────────────────────────────────────────────────
type CellDisplay = { text:string; badges:string[]; isEmpty:boolean }

function getCellDisplay(day: DayMenuInput | undefined, field: string): CellDisplay {
  const empty: CellDisplay = { text:'', badges:[], isEmpty:true }
  if (!day) return empty
  const unavail = day.is_holiday || day.is_self_closed
  if (field === 'date_header') return empty
  if (unavail) return { text:'', badges:[], isEmpty:false }

  if (field === 'calories') {
    const cal = day.calories
    return { text: cal > 0 ? `${cal}K` : '', badges:[], isEmpty: cal <= 0 }
  }
  if (field === 'ellan_ingpa_row') {
    const v = day.ellan_ingpa_row
    return { text: v || '', badges:[], isEmpty: !v }
  }

  const dayRecord = day as unknown as Record<string, unknown>
  const item = dayRecord[field]
  if (!item || typeof item !== 'object') return empty
  const itemObj = item as Record<string, unknown>

  const val = (typeof itemObj.value === 'string' ? itemObj.value : '') || ''
  const rawAllergens = Array.isArray(itemObj.allergens) ? itemObj.allergens : []
  const allergens = rawAllergens as AllergenNum[]
  const badges = allergens.slice(0, 5).map(String)

  if (field.startsWith('snack')) {
    const isEmptySnack = itemObj.is_empty === true
    if (isEmptySnack) return { text:'(미제공)', badges:[], isEmpty:false }
    const calNum = typeof itemObj.calories === 'number' ? itemObj.calories : 0
    const cal = calNum ? ` ${calNum}K` : ''
    return { text: val ? val + cal : '', badges, isEmpty: !val }
  }

  const isEmptyMenu = itemObj.is_empty === true
  if (isEmptyMenu) return { text:'(없음)', badges:[], isEmpty:false }
  return { text: val, badges, isEmpty: !val }
}

// ─── 알레르기 선택기 ────────────────────────────────────────────────────
function AllergenSelector({
  selected, onChange,
}: { selected: AllergenNum[]; onChange: (v: AllergenNum[]) => void }) {
  return (
    <div className="mt-1">
      <p className="text-xs text-gray-400 mb-1">알레르기 (클릭 선택/해제)</p>
      <div className="flex flex-wrap gap-1">
        {ALLERGEN_LIST.map(a => {
          const n = a.num as AllergenNum
          const on = selected.includes(n)
          return (
            <button key={n} type="button" title={a.label}
              onClick={() => onChange(on ? selected.filter(x=>x!==n) : [...selected,n])}
              className={`w-7 h-7 rounded text-xs font-medium border transition-colors
                ${on ? 'bg-orange-500 text-white border-orange-500'
                     : 'bg-white text-gray-400 border-gray-200 hover:border-orange-400'}`}
            >{n}</button>
          )
        })}
      </div>
      {selected.length > 0 && (
        <p className="text-xs text-orange-600 mt-1 leading-snug">
          {[...selected].sort((a,b)=>a-b).map(n => ALLERGEN_LIST.find(a=>a.num===n)?.label).join(', ')}
        </p>
      )}
    </div>
  )
}

// ─── IME 안전 텍스트 입력 (한글 자모 분리 방지) ───────────────────────────
type ImeInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'onCompositionStart' | 'onCompositionEnd'
> & { value: string; onChange: (val: string) => void }

function ImeInput({ value, onChange, ...rest }: ImeInputProps) {
  const composingRef = useRef(false)
  const [localVal, setLocalVal] = useState(value)

  useEffect(() => {
    if (!composingRef.current) setLocalVal(value)
  }, [value])

  return (
    <input
      {...rest}
      value={localVal}
      onChange={e => {
        setLocalVal(e.target.value)
        if (!composingRef.current) onChange(e.target.value)
      }}
      onCompositionStart={() => { composingRef.current = true }}
      onCompositionEnd={e => {
        composingRef.current = false
        const val = (e.target as HTMLInputElement).value
        setLocalVal(val)
        onChange(val)
      }}
    />
  )
}

// ─── Override 편집기 ─────────────────────────────────────────────────────
function OverrideEditor({
  overrides, onChange,
}: { overrides: OverrideItem[]; onChange: (v: OverrideItem[]) => void }) {
  const add = () => onChange([...overrides, { target:[], type:'replace', value:'', allergens:[] }])
  const upd = (i: number, o: OverrideItem) => { const n=[...overrides]; n[i]=o; onChange(n) }
  const del = (i: number) => onChange(overrides.filter((_,idx)=>idx!==i))

  return (
    <div className="mt-2 space-y-2 border-l-2 border-indigo-200 pl-2">
      {overrides.map((o, i) => (
        <div key={i} className="bg-indigo-50 rounded-lg p-2 space-y-1.5">
          <div className="flex items-center gap-1">
            <input type="text" value={o.target.join(',')}
              onChange={e => upd(i,{...o,target:e.target.value.split(',').map(t=>t.trim()).filter(Boolean)})}
              placeholder="대상 (예: P, 목동P)"
              className="flex-1 text-xs border border-gray-300 rounded px-2 py-1 bg-white" />
            <select value={o.type}
              onChange={e => upd(i,{...o,type:e.target.value as OverrideItem['type']})}
              className="text-xs border border-gray-300 rounded px-1 py-1 bg-white">
              <option value="replace">교체</option>
              <option value="exclude">제외</option>
              <option value="full_replace">전체교체</option>
            </select>
            <button type="button" onClick={()=>del(i)}
              className="text-red-400 hover:text-red-600 text-sm leading-none">✕</button>
          </div>
          {o.type !== 'exclude' && (
            <input type="text" value={o.value ?? ''}
              onChange={e => upd(i,{...o,value:e.target.value})}
              placeholder={o.type==='full_replace' ? '전체메뉴 (/ 구분)' : '대체 메뉴명'}
              className="w-full text-xs border border-gray-300 rounded px-2 py-1 bg-white" />
          )}
          {o.target.some(t=>['P','E','R','SLP','MB'].includes(t)) && (
            <input type="text" value={o.exclude_targets?.join(',') ?? ''}
              onChange={e => upd(i,{...o,exclude_targets:e.target.value.split(',').map(t=>t.trim()).filter(Boolean)})}
              placeholder="그룹에서 제외할 원 (예: 동탄P)"
              className="w-full text-xs border border-red-200 rounded px-2 py-1 bg-red-50" />
          )}
          {o.type === 'replace' && (
            <AllergenSelector
              selected={(o.allergens ?? []) as AllergenNum[]}
              onChange={allergens => upd(i,{...o,allergens})} />
          )}
        </div>
      ))}
      <button type="button" onClick={add}
        className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
        + 원별 예외 추가
      </button>
    </div>
  )
}

// ─── 메뉴 에디터 (로컬 state) ───────────────────────────────────────────
function MenuEditor({
  day, fieldKey, upd,
}: {
  day: DayMenuInput
  fieldKey: 'rice'|'soup'|'side1'|'side2'|'side3'|'kimchi'
  upd: (updates: Partial<DayMenuInput>) => void
}) {
  const menuMap: Record<typeof fieldKey, MenuItemInput> = {
    rice: day.rice, soup: day.soup, side1: day.side1,
    side2: day.side2, side3: day.side3, kimchi: day.kimchi,
  }
  const item = menuMap[fieldKey]
  const setItem = (next: MenuItemInput) => {
    switch (fieldKey) {
      case 'rice':   upd({ rice:   next }); break
      case 'soup':   upd({ soup:   next }); break
      case 'side1':  upd({ side1:  next }); break
      case 'side2':  upd({ side2:  next }); break
      case 'side3':  upd({ side3:  next }); break
      case 'kimchi': upd({ kimchi: next }); break
    }
  }

  const isSoup  = fieldKey === 'soup'
  const hasSauce= fieldKey === 'side1' || fieldKey === 'side2'
  const isThird = fieldKey === 'side3'

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <ImeInput
          type="text"
          value={item.value}
          onChange={val => setItem({...item, value: val})}
          placeholder={isSoup && item.is_empty ? '(없음)' : '메뉴명 입력'}
          disabled={!!item.is_empty}
          className={`flex-1 text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-green-400
            ${item.is_empty ? 'bg-gray-100 text-gray-400' : 'bg-white border-gray-300'}`} />
        {isSoup && (
          <label className="flex items-center gap-1 text-xs text-gray-500 shrink-0 cursor-pointer">
            <input type="checkbox" checked={!!item.is_empty}
              onChange={e => setItem({...item,is_empty:e.target.checked,value:''})}
              className="w-3 h-3" /> 국없음
          </label>
        )}
      </div>
      {!item.is_empty && (
        <AllergenSelector selected={item.allergens}
          onChange={allergens => setItem({...item,allergens})} />
      )}
      {hasSauce && !item.is_empty && (
        <div className="border-l-2 border-blue-300 pl-2">
          <div className="flex items-center gap-1 mb-1">
            <span className="text-xs text-blue-500 font-medium">& 소스 연결</span>
            {!item.and_sauce && (
              <button type="button"
                onClick={() => setItem({...item,and_sauce:{value:'',allergens:[]}})}
                className="text-xs text-blue-400 hover:text-blue-600">+ 추가</button>
            )}
          </div>
          {item.and_sauce && (
            <div className="space-y-1">
              <ImeInput
                type="text"
                value={item.and_sauce.value}
                onChange={val => setItem({...item, and_sauce:{...item.and_sauce!, value: val}})}
                placeholder="소스명"
                className="w-full text-xs border border-gray-300 rounded px-2 py-1" />
              <AllergenSelector selected={item.and_sauce.allergens}
                onChange={allergens => setItem({...item,and_sauce:{...item.and_sauce!,allergens}})} />
            </div>
          )}
        </div>
      )}
      {isThird && (
        <div className="flex gap-3 flex-wrap">
          <label className="flex items-center gap-1 text-xs text-orange-600 cursor-pointer">
            <input type="checkbox" checked={!!item.ingpa_exclude}
              onChange={e => setItem({...item,ingpa_exclude:e.target.checked})}
              className="w-3 h-3" /> 잉파제외
          </label>
          <label className="flex items-center gap-1 text-xs text-purple-600 cursor-pointer">
            <input type="checkbox" checked={!!item.is_dessert_prefix}
              onChange={e => setItem({...item,is_dessert_prefix:e.target.checked})}
              className="w-3 h-3" /> 후식-
          </label>
        </div>
      )}
    </div>
  )
}

// ─── 간식 에디터 (로컬 state) ────────────────────────────────────────────
function SnackEditor({
  day, fieldKey, upd,
}: {
  day: DayMenuInput
  fieldKey: 'snack_am'|'snack_pm'|'snack_care'
  upd: (updates: Partial<DayMenuInput>) => void
}) {
  const [showOvr, setShowOvr] = useState(false)
  const snackMap: Record<typeof fieldKey, SnackItemInput | undefined> = {
    snack_am: day.snack_am, snack_pm: day.snack_pm, snack_care: day.snack_care,
  }
  const s = snackMap[fieldKey] ?? { value:'', allergens:[], calories:0 }
  const setItem = (next: SnackItemInput) => {
    switch (fieldKey) {
      case 'snack_am':   upd({ snack_am:   next }); break
      case 'snack_pm':   upd({ snack_pm:   next }); break
      case 'snack_care': upd({ snack_care: next }); break
    }
  }

  const isCare  = fieldKey === 'snack_care'
  const needsEn = !isCare

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <ImeInput
          type="text"
          value={s.value}
          onChange={val => setItem({...s, value: val})}
          placeholder={s.is_empty ? '(미제공)' : '간식명 입력'}
          disabled={!!s.is_empty}
          className={`flex-1 text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-400
            ${s.is_empty ? 'bg-gray-100 text-gray-400' : 'bg-white border-gray-300'}`} />
        <input type="number" value={s.calories || ''}
          onChange={e => setItem({...s,calories:Number(e.target.value)})}
          placeholder="Kcal" disabled={!!s.is_empty}
          className="w-14 text-xs border border-gray-300 rounded-lg px-1 py-2 text-center" />
        <span className="text-xs text-gray-400 shrink-0">K</span>
        {isCare && (
          <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer shrink-0">
            <input type="checkbox" checked={!!s.is_empty}
              onChange={e => setItem({...s,is_empty:e.target.checked,value:'',calories:0})}
              className="w-3 h-3" /> 미제공
          </label>
        )}
      </div>
      {!s.is_empty && (
        <AllergenSelector selected={s.allergens}
          onChange={allergens => setItem({...s,allergens})} />
      )}
      {needsEn && !s.is_empty && (
        <ImeInput
          type="text"
          value={s.value_en ?? ''}
          onChange={val => setItem({...s, value_en: val})}
          placeholder="영문명 (English)"
          className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-yellow-50" />
      )}
      {!s.is_empty && (
        <div>
          <button type="button" onClick={() => setShowOvr(v=>!v)}
            className="text-xs text-indigo-500 hover:text-indigo-700">
            {showOvr ? '▲' : '▼'} 원별 예외 {s.overrides?.length ? `(${s.overrides.length})` : ''}
          </button>
          {showOvr && (
            <OverrideEditor
              overrides={s.overrides ?? []}
              onChange={overrides => setItem({...s,overrides})} />
          )}
        </div>
      )}
    </div>
  )
}

// ─── 날짜 헤더 에디터 ───────────────────────────────────────────────────
function DateHeaderEditor({
  day, upd,
}: { day: DayMenuInput; upd: (updates: Partial<DayMenuInput>) => void }) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <label className="flex items-center gap-2 text-sm text-red-600 cursor-pointer">
          <input type="checkbox" checked={day.is_holiday}
            onChange={e => upd({is_holiday:e.target.checked, holiday_name:e.target.checked ? (day.holiday_name||'공휴일') : undefined})}
            className="w-4 h-4" /> 공휴일
        </label>
        {day.is_holiday && (
          <ImeInput
            type="text"
            value={day.holiday_name ?? ''}
            onChange={val => upd({holiday_name: val})}
            placeholder="공휴일명"
            className="w-full text-sm border border-red-200 rounded-lg px-2 py-1.5 bg-red-50" />
        )}
      </div>
      <div className="space-y-1">
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input type="checkbox" checked={day.is_self_closed}
            onChange={e => upd({is_self_closed:e.target.checked})}
            className="w-4 h-4" /> 휴원일
        </label>
        {day.is_self_closed && (
          <ImeInput
            type="text"
            value={day.self_closed_reason ?? ''}
            onChange={val => upd({self_closed_reason: val})}
            placeholder="휴무 사유 (예: 전체 현장학습)"
            className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5" />
        )}
      </div>
      <div className="space-y-1">
        <label className="flex items-center gap-2 text-sm text-green-600 cursor-pointer">
          <input type="checkbox" checked={day.is_picnic}
            onChange={e => upd({is_picnic:e.target.checked})}
            className="w-4 h-4" /> 🏕 전체 소풍 (공통 도시락)
        </label>
        {day.is_picnic && (
          <ImeInput
            type="text"
            value={day.picnic_menu ?? ''}
            onChange={val => upd({picnic_menu: val})}
            placeholder="도시락 메뉴 (예: 떡갈비주먹밥/치킨강정)"
            className="w-full text-xs border border-green-200 rounded-lg px-2 py-1.5 bg-green-50" />
        )}
      </div>
      <label className="flex items-center gap-2 text-sm text-pink-600 cursor-pointer">
        <input type="checkbox" checked={day.birthday_mark}
          onChange={e => upd({birthday_mark:e.target.checked})}
          className="w-4 h-4" /> 🎂 생일 표시
      </label>
    </div>
  )
}

// ─── 칼로리 에디터 ───────────────────────────────────────────────────────
function CaloriesEditor({
  day, upd,
}: { day: DayMenuInput; upd: (updates: Partial<DayMenuInput>) => void }) {
  const CAL_FIELDS = [
    { key:'calories', label:'총칼로리', unit:'Kcal' },
    { key:'carb',     label:'탄수화물', unit:'g'    },
    { key:'protein',  label:'단백질',   unit:'g'    },
    { key:'fat',      label:'지방',     unit:'g'    },
  ] as const

  return (
    <div className="space-y-2">
      {CAL_FIELDS.map(f => {
        const calMap: Record<typeof f.key, number> = {
          calories: day.calories, carb: day.carb, protein: day.protein, fat: day.fat,
        }
        const handleChange = (v: number) => {
          switch (f.key) {
            case 'calories': upd({ calories: v }); break
            case 'carb':     upd({ carb:     v }); break
            case 'protein':  upd({ protein:  v }); break
            case 'fat':      upd({ fat:      v }); break
          }
        }
        return (
          <div key={f.key} className="flex items-center gap-2">
            <span className="text-sm text-gray-600 w-20 shrink-0">{f.label}</span>
            <input type="number" value={calMap[f.key] || ''}
              onChange={e => handleChange(Number(e.target.value))}
              className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-yellow-400" />
            <span className="text-xs text-gray-400 w-8 shrink-0">{f.unit}</span>
          </div>
        )
      })}
      <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
        <span className="text-sm text-gray-600 w-20 shrink-0">잉파/엘란행</span>
        <ImeInput
          type="text"
          value={day.ellan_ingpa_row}
          onChange={val => upd({ellan_ingpa_row: val})}
          placeholder="후식과일"
          className="flex-1 text-sm border border-purple-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-purple-400 bg-purple-50" />
      </div>
    </div>
  )
}

// ─── 사이드 패널 ────────────────────────────────────────────────────────
const FIELD_LABELS: Record<string, string> = {
  date_header:'날짜 설정', rice:'밥', soup:'국/찌개',
  side1:'반찬1', side2:'반찬2', side3:'반찬3', kimchi:'김치',
  calories:'칼로리 & 잉파', ellan_ingpa_row:'잉파/엘란행',
  snack_am:'오전간식', snack_pm:'오후간식', snack_care:'돌봄간식',
}

function SidePanel({
  selection, day, onClose, onUpdate,
}: {
  selection: CellSelection
  day: DayMenuInput
  onClose: () => void
  onUpdate: (date: string, d: DayMenuInput) => void
}) {
  const { date, field } = selection
  const upd = useCallback((updates: Partial<DayMenuInput>) => {
    onUpdate(date, { ...day, ...updates })
  }, [date, day, onUpdate])

  const dateObj = new Date(date + 'T12:00:00')
  const dateLabel = `${dateObj.getMonth()+1}/${dateObj.getDate()}(${DAY_KR[dateObj.getDay()]})`
  const unavail = day.is_holiday || day.is_self_closed

  let body: React.ReactNode = null
  if (unavail && field !== 'date_header') {
    body = (
      <div className="text-center py-10 text-gray-400">
        <p className="text-3xl mb-2">{day.is_holiday ? '🏖️' : '🔒'}</p>
        <p className="text-sm">{day.is_holiday ? (day.holiday_name || '공휴일') : '휴원일'}</p>
        <p className="text-xs mt-1 text-gray-300">식단 없음 — 날짜 설정으로 변경 가능</p>
      </div>
    )
  } else if (field === 'date_header') {
    body = <DateHeaderEditor day={day} upd={upd} />
  } else if (field === 'calories' || field === 'ellan_ingpa_row') {
    body = <CaloriesEditor day={day} upd={upd} />
  } else if (field === 'snack_am' || field === 'snack_pm' || field === 'snack_care') {
    body = <SnackEditor day={day} fieldKey={field} upd={upd} />
  } else if (
    field === 'rice' || field === 'soup' ||
    field === 'side1' || field === 'side2' ||
    field === 'side3' || field === 'kimchi'
  ) {
    body = <MenuEditor day={day} fieldKey={field} upd={upd} />
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50 shrink-0">
        <div>
          <p className="text-xs text-gray-400">{dateLabel}</p>
          <p className="font-semibold text-gray-800 text-sm">{FIELD_LABELS[field] ?? field}</p>
        </div>
        <button type="button" onClick={onClose}
          className="text-gray-400 hover:text-gray-700 w-8 h-8 flex items-center justify-center rounded hover:bg-gray-200 transition-colors text-lg leading-none">
          ✕
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {body}
      </div>
    </div>
  )
}

// ─── 주간 그리드 ────────────────────────────────────────────────────────
function WeekGrid({
  weekDates, days, selection, onCellClick, errorsByDate,
}: {
  weekDates: string[]
  days: Record<string, DayMenuInput>
  selection: CellSelection | null
  onCellClick: (sel: CellSelection) => void
  errorsByDate: Record<string, string[]>
}) {
  if (weekDates.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-8">표시할 날짜 없음</p>
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
      <table className="w-full border-collapse text-xs min-w-[480px]">
        <colgroup>
          <col style={{ width:'72px' }} />
          {weekDates.map(d => <col key={d} />)}
        </colgroup>
        <tbody>
          {/* 날짜 헤더 행 */}
          <tr>
            <th className="sticky left-0 z-10 bg-gray-100 border border-gray-200 px-2 py-2 text-left text-gray-500 font-medium text-xs">
              날짜
            </th>
            {weekDates.map(date => {
              const day = days[date]
              const dateObj = new Date(date + 'T12:00:00')
              const isSel = selection?.date === date && selection?.field === 'date_header'
              const isHol = day?.is_holiday
              const isCls = day?.is_self_closed
              const isBd  = day?.birthday_mark && !isHol && !isCls
              const isClosedDay = isHol || isCls

              const hasAnyInput = day?.rice?.value?.trim() || day?.soup?.value?.trim()
              const hasErrors = (errorsByDate[date]?.length ?? 0) > 0
              const isError = !isClosedDay && !!hasAnyInput && hasErrors

              let bg = 'bg-white hover:bg-green-50'
              if (isHol)      bg = 'bg-red-50 hover:bg-red-100'
              else if (isCls) bg = 'bg-gray-100 hover:bg-gray-200'
              else if (isBd)  bg = 'bg-pink-50 hover:bg-pink-100'
              if (isSel)      bg = 'bg-green-200'

              return (
                <th key={date} onClick={() => onCellClick({date, field:'date_header'})}
                  className={`border border-gray-200 px-1 py-2 text-center cursor-pointer transition-colors
                    ${bg} ${isError ? 'outline outline-1 outline-red-400' : ''}`}
                >
                  <div className="text-xs font-semibold text-gray-700">
                    {dateObj.getMonth()+1}/{dateObj.getDate()}
                  </div>
                  <div className={`text-[10px] ${isHol||isCls ? 'text-red-400' : 'text-gray-400'}`}>
                    {DAY_KR[dateObj.getDay()]}
                  </div>
                  {isClosedDay ? (
                    <div className="text-[9px] text-gray-400">🔒</div>
                  ) : (
                    <div className={`text-[9px] ${!hasAnyInput ? 'text-gray-400' : hasErrors ? 'text-red-500' : 'text-green-500'}`}>
                      {!hasAnyInput ? '○' : hasErrors ? '❌' : '✅'}
                    </div>
                  )}
                  {isBd   && <div className="text-[10px]">🎂</div>}
                  {isHol  && day?.holiday_name && (
                    <div className="text-[9px] text-red-400 truncate max-w-[56px]">{day.holiday_name}</div>
                  )}
                  {isCls  && <div className="text-[9px] text-gray-400">휴원일</div>}
                </th>
              )
            })}
          </tr>

          {/* 데이터 행 */}
          {GRID_ROWS.map(row => {
            if (row.type === 'divider') {
              return (
                <tr key="divider">
                  <td colSpan={weekDates.length + 1}
                    className="bg-gray-100 border border-gray-200 text-center text-gray-400 py-0.5 text-[10px] font-medium">
                    간 식
                  </td>
                </tr>
              )
            }

            return (
              <tr key={row.key} className={row.rowBg}>
                <td className={`sticky left-0 z-10 border border-gray-200 px-2 py-1.5 font-medium text-gray-600 text-xs whitespace-nowrap ${row.rowBg}`}>
                  {row.label}
                </td>
                {weekDates.map(date => {
                  const day = days[date]
                  const unavail = day?.is_holiday || day?.is_self_closed
                  const isSel = selection?.date === date && selection?.field === row.key
                  const disp = getCellDisplay(day, row.key)

                  return (
                    <td key={date}
                      onClick={() => !unavail && onCellClick({ date, field: row.key as CellSelection['field'] })}
                      className={`border border-gray-200 px-1.5 py-1.5 text-center align-top max-w-[80px]
                        ${unavail ? 'bg-gray-50 cursor-default' : 'cursor-pointer hover:bg-green-50 transition-colors'}
                        ${isSel ? 'bg-green-100 ring-1 ring-green-400 ring-inset' : ''}
                        ${disp.isEmpty && !unavail ? 'text-gray-300' : 'text-gray-700'}
                      `}
                    >
                      {!unavail && (
                        <>
                          <div className="text-[11px] leading-tight line-clamp-2 break-all">
                            {disp.text}
                          </div>
                          {disp.badges.length > 0 && (
                            <div className="flex flex-wrap gap-0.5 justify-center mt-0.5">
                              {disp.badges.slice(0,4).map(b => (
                                <span key={b} className="text-[9px] bg-orange-100 text-orange-600 rounded px-0.5">{b}</span>
                              ))}
                              {disp.badges.length > 4 && (
                                <span className="text-[9px] text-gray-400">+{disp.badges.length-4}</span>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── 메인 페이지 ────────────────────────────────────────────────────────
export default function DietInputPage() {
  const params = useParams()
  const router = useRouter()
  const year  = Number(params.year)
  const month = Number(params.month)

  const [monthData,      setMonthData]      = useState<MonthlyMenuData | null>(null)
  const [validation,     setValidation]     = useState<MonthlyValidationResult | null>(null)
  const [selectedCell,   setSelectedCell]   = useState<CellSelection | null>(null)
  const [activeWeek,     setActiveWeek]     = useState(1)
  const [branches,       setBranches]       = useState<BranchOption[]>([])
  const [loading,        setLoading]        = useState(true)
  const [saving,         setSaving]         = useState(false)
  const [submitting,     setSubmitting]     = useState(false)
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle'|'saving'|'saved'|'error'>('idle')
  const [lastSaved,      setLastSaved]      = useState<Date | null>(null)
  const [saveError,      setSaveError]      = useState<string | null>(null)
  const [showErrors,     setShowErrors]     = useState(false)

  const autoSaveTimer  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const monthDataRef   = useRef<MonthlyMenuData | null>(null)
  const hasEditedRef   = useRef(false)
  const activeWeekRef  = useRef(activeWeek)
  useEffect(() => { monthDataRef.current  = monthData  }, [monthData])
  useEffect(() => { activeWeekRef.current = activeWeek }, [activeWeek])

  // ESC 키 → 패널 닫기
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelectedCell(null) }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  // ── 초기 로드 ──────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false

    async function initData() {
      setLoading(true)
      try {
        const supabase = createClient()
        const { data } = await supabase
          .from('weekly_menus').select('id, menu_data')
          .eq('year', year).eq('month', month).eq('diet_type','CK')
          .is('branch_id', null).maybeSingle()
        if (cancelled) return
        if (data?.menu_data) {
          setMonthData(data.menu_data as MonthlyMenuData)
        } else {
          const daysInMonth = new Date(year, month, 0).getDate()
          const days: Record<string, DayMenuInput> = {}
          for (let d = 1; d <= daysInMonth; d++) {
            if ([0,6].includes(new Date(year, month-1, d).getDay())) continue
            const ds = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`
            days[ds] = createEmptyDay(ds)
          }
          setMonthData({ year, month, diet_type:'CK', month_note:'', days, status:'draft' })
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    async function loadBranches() {
      try {
        const supabase = createClient()
        const { data } = await supabase
          .from('branch_profiles')
          .select('id, short_code, display_name, branch_full_name, group_tag, needs_english, snack_label, snack_childcare')
          .order('short_code')
        type BranchRow = {
          id?: string; short_code?: string; short_name?: string
          display_name?: string; branch_full_name?: string
          group_tag?: string; group_code?: string
          needs_english?: boolean; snack_label?: string; snack_childcare?: boolean
        }
        if (data && !cancelled) {
          setBranches((data as BranchRow[]).map(b => ({
            id:                  b.id || '',
            short_name:          b.short_code || b.short_name || '',
            branch_name:         b.display_name || b.branch_full_name || '',
            group_code:          b.group_tag || b.group_code || '',
            is_dongtan_exception:(b.display_name || b.branch_full_name || '').includes('동탄'),
            snack_label:         b.snack_label || '오전간식',
            needs_english:       b.needs_english || false,
            has_care_snack:      b.snack_childcare || false,
          })))
        }
      } catch { /* 원 목록 없어도 진행 */ }
    }

    initData()
    loadBranches()
    return () => { cancelled = true }
  }, [year, month])

  // ── 실시간 검증 ────────────────────────────────────────────────────
  useEffect(() => {
    if (!monthData) return
    setValidation(validateMonth(monthData))
  }, [monthData])

  // ── 자동저장 (3초 디바운스) ────────────────────────────────────────
  useEffect(() => {
    if (!monthData || loading || !hasEditedRef.current) return
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(async () => {
      const data = monthDataRef.current
      if (!data) return
      setAutoSaveStatus('saving')
      try {
        await saveToDb(data)
        setAutoSaveStatus('saved')
        setLastSaved(new Date())
        setSaveError(null)
      } catch (err) {
        const error = err as { code?: string; message?: string; details?: string; hint?: string }
        console.error('저장 에러 상세:', {
          code: error?.code,
          message: error?.message,
          details: error?.details,
          hint: error?.hint,
          full: JSON.stringify(error)
        })
        const msg = error?.message || error?.details || JSON.stringify(error)
        setSaveError(msg)
        setAutoSaveStatus('error')
      }
    }, 3000)
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current) }
  // saveToDb is defined in component scope; monthDataRef keeps latest value — intentional omission
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthData, loading])

  // ── DB 저장 ────────────────────────────────────────────────────────
  async function saveToDb(data: MonthlyMenuData, statusOverride?: string) {
    const supabase = createClient()
    const fields = {
      year, month, week_num: activeWeekRef.current, diet_type:'CK', branch_id:null,
      status: statusOverride ?? data.status,
      month_note: data.month_note,
      menu_data: data,
      updated_at: new Date().toISOString(),
    }
    const { data: existing } = await supabase
      .from('weekly_menus').select('id')
      .eq('year',year).eq('month',month).eq('diet_type','CK')
      .is('branch_id',null).maybeSingle()
    if (existing?.id) {
      const { error } = await supabase.from('weekly_menus').update(fields).eq('id', existing.id)
      if (error) throw error
    } else {
      const { error } = await supabase.from('weekly_menus').insert(fields)
      if (error) throw error
    }
  }

  // ── 하루치 업데이트 ─────────────────────────────────────────────────
  const updateDay = useCallback((date: string, day: DayMenuInput) => {
    hasEditedRef.current = true
    setMonthData(prev => prev ? { ...prev, days: { ...prev.days, [date]: day } } : prev)
  }, [])

  // ── 임시저장 ────────────────────────────────────────────────────────
  async function handleSave() {
    if (!monthData) return
    setSaving(true)
    setAutoSaveStatus('idle')
    try {
      await saveToDb(monthData)
      setLastSaved(new Date())
      setAutoSaveStatus('saved')
      setSaveError(null)
    } catch (err) {
      const error = err as { code?: string; message?: string; details?: string; hint?: string }
      console.error('저장 에러 상세:', {
        code: error?.code,
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        full: JSON.stringify(error)
      })
      const msg = error?.message || error?.details || JSON.stringify(error)
      setSaveError(msg)
      alert(`저장 중 오류가 발생했습니다.\n원인: ${msg}`)
    } finally {
      setSaving(false)
    }
  }

  // ── 제출 ────────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!monthData || !validation?.isValid) return
    if (!confirm(`${year}년 ${month}월 CK 식단을 검토 요청하겠습니까?`)) return
    setSubmitting(true)
    try {
      const supabase = createClient()
      const now = new Date().toISOString()
      const newData: MonthlyMenuData = { ...monthData, status:'submitted' }
      const fields = {
        year, month, week_num: activeWeek, diet_type:'CK', branch_id:null,
        status:'submitted', month_note:monthData.month_note,
        menu_data: newData, submitted_at: now, updated_at: now,
      }
      const { data: existing } = await supabase.from('weekly_menus').select('id')
        .eq('year',year).eq('month',month).eq('diet_type','CK')
        .is('branch_id',null).maybeSingle()
      if (existing?.id) {
        const { error } = await supabase.from('weekly_menus').update(fields).eq('id', existing.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('weekly_menus').insert(fields)
        if (error) throw error
      }
      await supabase.from('diet_notifications').insert({
        type:'review_request',
        title:`${year}년 ${month}월 CK식단 검토 요청`,
        message:`${year}년 ${month}월 CK 공통 식단 입력이 완료되었습니다. 검토 후 승인해주세요.`,
        year, month, recipient_role:'manager',
      })
      setMonthData(newData)
      alert(`✅ ${year}년 ${month}월 식단 제출 완료!\n권팀장에게 검토 요청이 전송되었습니다.`)
      router.push('/board/admin/diet-automation')
    } catch (err) {
      const error = err as { code?: string; message?: string; details?: string; hint?: string }
      console.error('저장 에러 상세:', {
        code: error?.code,
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        full: JSON.stringify(error)
      })
      const msg = error?.message || error?.details || JSON.stringify(error)
      alert(`제출 중 오류가 발생했습니다.\n원인: ${msg}`)
    } finally {
      setSubmitting(false)
    }
  }

  // ── 파생값 ──────────────────────────────────────────────────────────
  const weekGroups = getWeekGroups(year, month)
  const weekNums   = Object.keys(weekGroups).map(Number).sort((a,b)=>a-b)

  const errorsByDate: Record<string, string[]> = {}
  validation?.errors.forEach(e => {
    if (e.date) { if (!errorsByDate[e.date]) errorsByDate[e.date]=[]; errorsByDate[e.date].push(e.code) }
  })

  function getWeekStatus(wn: number): 'complete'|'error'|'closed'|'empty' {
    const dates = weekGroups[wn] || []
    const openDates = dates.filter(d => {
      const dy = monthData?.days[d]
      return dy && !dy.is_holiday && !dy.is_self_closed
    })
    if (openDates.length === 0) return 'closed'
    const hasAnyInput = openDates.some(d => monthData?.days[d]?.rice?.value?.trim())
    if (!hasAnyInput) return 'empty'
    const hasErrors = openDates.some(d => (errorsByDate[d]?.length ?? 0) > 0)
    return hasErrors ? 'error' : 'complete'
  }

  function jumpToDate(date: string) {
    for (const [wn, dates] of Object.entries(weekGroups)) {
      if ((dates as string[]).includes(date)) { setActiveWeek(Number(wn)); break }
    }
  }

  const businessDays   = getBusinessDays(year, month)
  const inputCount     = businessDays.filter(d => {
    const dy = monthData?.days[d]
    return dy && !dy.is_holiday && !dy.is_self_closed && dy.rice?.value?.trim()
  }).length
  const completionRate = businessDays.length > 0 ? Math.round((inputCount/businessDays.length)*100) : 0

  // ── 로딩 / null ─────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400 text-sm">불러오는 중...</p>
      </div>
    )
  }
  if (!monthData) return null

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _branches = branches  // loadBranches 결과 (향후 OverrideEditor에 연결 예정)
  const currentWeekDates = weekGroups[activeWeek] || []

  // ── 렌더 ────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col bg-[#F6FAF6]" style={{ height:'calc(100vh - 60px)' }}>

      {/* ── 상단 헤더 ──────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 px-4 py-2.5 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/board/admin/diet-automation/input"
            className="text-gray-400 hover:text-[#2D6A4F] transition-colors shrink-0 text-lg">←</Link>
          <div className="min-w-0">
            <h1 className="font-bold text-gray-800 text-sm sm:text-base leading-tight truncate">
              📋 {year}년 {month}월 CK 식단 입력
            </h1>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {autoSaveStatus === 'saved' && lastSaved && (
                <span className="text-xs text-green-500">✓ 자동저장됨 {lastSaved.toLocaleTimeString()}</span>
              )}
              {autoSaveStatus === 'saving' && (
                <span className="text-xs text-gray-400 animate-pulse">저장 중...</span>
              )}
              {autoSaveStatus === 'error' && (
                <span className="text-xs text-red-500 cursor-pointer leading-tight" onClick={handleSave}
                  title={saveError ?? '저장 실패'}>
                  ✕ 저장 실패 (클릭 재시도){saveError && ` — ${saveError.slice(0, 40)}`}
                </span>
              )}
              <span className="text-[11px] text-gray-400">{inputCount}/{businessDays.length}일 ({completionRate}%)</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button type="button" onClick={() => setShowErrors(v=>!v)}
            className={`text-xs px-2.5 py-1.5 rounded-lg border transition-colors
              ${validation?.isValid
                ? 'border-green-200 text-green-700 bg-green-50'
                : 'border-gray-200 text-gray-600 bg-gray-50 hover:bg-gray-100'}`}>
            {validation?.isValid ? '✅ OK' : `📝 ${validation?.errors.length ?? 0}개`}
          </button>
          <button onClick={handleSave} disabled={saving}
            className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 transition-colors">
            {saving ? '저장 중...' : '💾 저장'}
          </button>
          <button onClick={handleSubmit} disabled={!validation?.isValid || submitting}
            className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors
              ${validation?.isValid
                ? 'bg-[#2D6A4F] text-white hover:bg-[#1B4332]'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>
            {submitting ? '제출 중...' : '✅ 제출'}
          </button>
        </div>
      </div>

      {/* ── 오류 패널 ──────────────────────────────────────────── */}
      {showErrors && validation && !validation.isValid && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2 shrink-0">
          <div className="flex flex-wrap items-center gap-1.5">
            {validation.errors.slice(0,7).map((e, i) => (
              <button key={i} type="button"
                onClick={() => { if (e.date) { jumpToDate(e.date); setShowErrors(false) } }}
                className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded hover:bg-red-200 transition-colors">
                [{e.code}]{e.date ? ` ${e.date.slice(5)}` : ''} {e.message.slice(0,18)}
              </button>
            ))}
            {validation.errors.length > 7 && (
              <span className="text-xs text-red-400">외 {validation.errors.length-7}개</span>
            )}
          </div>
        </div>
      )}

      {/* ── 메모 + 진행률 ──────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-100 px-4 py-2 flex items-center gap-3 shrink-0">
        <span className="text-xs text-gray-500 shrink-0">📌</span>
        <input type="text" value={monthData.month_note}
          onChange={e => { hasEditedRef.current = true; setMonthData({...monthData, month_note:e.target.value}) }}
          placeholder="이달 특이재료/메모"
          className="flex-1 min-w-0 text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-green-400" />
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-20 bg-gray-200 rounded-full h-1.5">
            <div className="bg-green-500 h-1.5 rounded-full transition-all"
              style={{ width:`${completionRate}%` }} />
          </div>
          <span className="text-xs text-gray-600 font-semibold w-8 text-right">{completionRate}%</span>
        </div>
      </div>

      {/* ── 주차 탭 ────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-100 px-4 py-2 flex gap-1.5 shrink-0 overflow-x-auto">
        {weekNums.map(wn => {
          const st = getWeekStatus(wn)
          const icon = st==='complete'?'✅':st==='error'?'❌':st==='closed'?'🔒':null
          const wDates = weekGroups[wn] || []
          const firstD = wDates[0] ? new Date(wDates[0] + 'T12:00:00') : null
          const lastD  = wDates[wDates.length - 1] ? new Date(wDates[wDates.length - 1] + 'T12:00:00') : null
          const dateRange = firstD && lastD
            ? `${firstD.getMonth()+1}/${firstD.getDate()}~${lastD.getMonth()+1}/${lastD.getDate()}`
            : ''
          return (
            <button key={wn} type="button" onClick={() => setActiveWeek(wn)}
              className={`flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors shrink-0
                ${activeWeek===wn
                  ? 'bg-[#2D6A4F] text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-[#E8F5E9] hover:text-[#2D6A4F]'}`}>
              {icon && <span>{icon}</span>}
              <span>{wn}주</span>
              {dateRange && <span className="opacity-70 text-[10px]">{dateRange}</span>}
            </button>
          )
        })}
      </div>

      {/* ── 본문 ───────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* 그리드 */}
        <div className="flex-1 overflow-auto p-4">
          <WeekGrid
            weekDates={currentWeekDates}
            days={monthData.days}
            selection={selectedCell}
            onCellClick={cell => {
              if (selectedCell?.date===cell.date && selectedCell?.field===cell.field) {
                setSelectedCell(null)
              } else {
                setSelectedCell(cell)
              }
            }}
            errorsByDate={errorsByDate}
          />
        </div>

        {/* 사이드 패널 */}
        {selectedCell && monthData.days[selectedCell.date] && (
          <div className="w-72 sm:w-80 border-l border-gray-200 bg-white shrink-0 flex flex-col overflow-hidden">
            <SidePanel
              key={`${selectedCell.date}-${selectedCell.field}`}
              selection={selectedCell}
              day={monthData.days[selectedCell.date]}
              onClose={() => setSelectedCell(null)}
              onUpdate={updateDay}
            />
          </div>
        )}
      </div>
    </div>
  )
}
