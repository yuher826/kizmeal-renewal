'use client'

import { useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

/* ─── Types ─── */
interface MenuItem { name: string; allergens: number[] }
interface SectionRow { section: string; items: (MenuItem | null)[] }
interface SpecialNote {
  dayIndex: number; text: string
  colorHex: string
  colorType: 'branch_warning' | 'seasonal' | 'special_menu' | 'special_ingredient' | 'special' | 'none'
}
interface WeekData {
  weekNumber: number
  dates: string[]
  sections: SectionRow[]
  specialNotes: SpecialNote[]
  newMenuProposals: { section: string; dayIndex: number; item: MenuItem }[]
}
export interface ParsedDiet {
  dietType: 'CK' | '위탁'
  yearMonth: string
  title: string
  weeks: WeekData[]
}

/* ─── Helpers ─── */
const ALLERGEN_CHARS: Record<string, number> = {
  '①':1,'②':2,'③':3,'④':4,'⑤':5,'⑥':6,'⑦':7,'⑧':8,'⑨':9,'⑩':10,
  '⑪':11,'⑫':12,'⑬':13,'⑭':14,'⑮':15,'⑯':16,'⑰':17,'⑱':18,'⑲':19,
}
const ALLERGEN_RE = /[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲]/g

function parseMenuItem(raw: string): MenuItem {
  const allergens: number[] = []
  const name = raw.replace(ALLERGEN_RE, m => { allergens.push(ALLERGEN_CHARS[m]); return '' }).trim()
  return { name, allergens: Array.from(new Set(allergens)).sort((a, b) => a - b) }
}

function normalizeHex(hex: string | undefined): string {
  return (hex || '').replace('#', '').toUpperCase().padStart(6, '0')
}

function detectColorType(hex: string): SpecialNote['colorType'] {
  const h = normalizeHex(hex)
  if (!h || h === '000000' || h === 'FFFFFF') return 'none'
  if (['FF0000', 'E40000', 'FF0100'].some(c => h.startsWith(c.slice(0,4)))) return 'branch_warning'
  if (h.startsWith('C0000')) return 'seasonal'
  if (h === '004F88' || h.startsWith('004E')) return 'special_menu'
  if (h === '00408A' || h.startsWith('0040')) return 'special_ingredient'
  if (h === '008A3E' || h.startsWith('0089') || h.startsWith('008A')) return 'special'
  return 'none'
}

const COLOR_LABEL: Record<SpecialNote['colorType'], string> = {
  branch_warning: '원별 주의',
  seasonal: '계절 주의',
  special_menu: '특별메뉴',
  special_ingredient: '특별 재료',
  special: '특별 표시',
  none: '',
}
const COLOR_CLASS: Record<SpecialNote['colorType'], string> = {
  branch_warning: 'text-red-600 bg-red-50',
  seasonal: 'text-rose-800 bg-rose-50',
  special_menu: 'text-blue-700 bg-blue-50',
  special_ingredient: 'text-indigo-700 bg-indigo-50',
  special: 'text-green-700 bg-green-50',
  none: 'text-gray-400',
}

const WEEK_RE  = /^[1-5]주/
const SECTION_NAMES = ['오전','오후','돌봄','방과후','교.추','교사','추가']
const CIRCLED = (n: number) => String.fromCharCode(0x245f + n)
const DAYS = ['월','화','수','목','금']

/* ─── Excel Parser ─── */
async function parseExcel(file: File, dietType: 'CK' | '위탁', yearMonth: string): Promise<ParsedDiet> {
  const XLSX = await import('xlsx')
  const buf  = await file.arrayBuffer()
  const wb   = XLSX.read(buf, { type: 'array', cellStyles: true, cellDates: true })
  const ws   = wb.Sheets[wb.SheetNames[0]]
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1')

  function cellVal(r: number, c: number): string {
    const addr = XLSX.utils.encode_cell({ r, c })
    const cell = ws[addr]
    if (!cell) return ''
    return String(cell.v ?? cell.w ?? '').trim()
  }
  function cellColor(r: number, c: number): string {
    const addr = XLSX.utils.encode_cell({ r, c })
    const cell = ws[addr]
    const s = cell?.s as Record<string, unknown> | undefined
    if (!s) return ''
    // Try font color first, then fill
    const font = s.font as Record<string, unknown> | undefined
    const fontColor = (font?.color as Record<string, unknown>)?.rgb as string || ''
    if (fontColor && fontColor !== '000000' && fontColor !== 'FF000000') return fontColor
    const fg = (s.fgColor as Record<string, unknown>)?.rgb as string || ''
    if (fg && fg !== 'FFFFFFFF' && fg !== '00000000') return fg
    return ''
  }

  // Extract title from first rows
  let title = ''
  for (let r = 0; r <= Math.min(3, range.e.r); r++) {
    const v = cellVal(r, 0)
    if (v.length > 5) { title = v; break }
  }

  const weeks: WeekData[] = []
  let currentWeek: WeekData | null = null
  let currentSection = ''

  for (let r = 0; r <= range.e.r; r++) {
    const aCell = cellVal(r, 0)
    const isWeekHeader = WEEK_RE.test(aCell)

    if (isWeekHeader) {
      // New week
      const wNum = parseInt(aCell)
      const dates = DAYS.map((_, i) => cellVal(r, i + 1))
      currentWeek = { weekNumber: wNum, dates, sections: [], specialNotes: [], newMenuProposals: [] }
      weeks.push(currentWeek)
      currentSection = ''
      continue
    }

    if (!currentWeek) continue

    // Detect section label in column A
    const isSectionLabel = SECTION_NAMES.some(s => aCell.startsWith(s)) || aCell === '교.추'
    if (isSectionLabel) currentSection = aCell || currentSection

    if (currentSection) {
      // Read menus B-F (cols 1-5)
      const items: (MenuItem | null)[] = DAYS.map((_, i) => {
        const v = cellVal(r, i + 1)
        return v ? parseMenuItem(v) : null
      })

      const hasMenu = items.some(Boolean)
      const isNewProposal = DAYS.some((_, i) => {
        const v = cellVal(r, i + 1)
        return v.includes('본사제안신메뉴') || v.includes('신메뉴')
      })

      if (hasMenu) {
        // Find or create section row in currentWeek
        let secRow = currentWeek.sections.find(s => s.section === currentSection)
        if (!secRow) {
          secRow = { section: currentSection, items: Array(5).fill(null) }
          currentWeek.sections.push(secRow)
        }
        // Merge: if cell already has value, append; otherwise set
        items.forEach((item, i) => {
          if (!item) return
          const existing = secRow!.items[i]
          if (existing) {
            existing.name += '\n' + item.name
            existing.allergens = Array.from(new Set([...existing.allergens, ...item.allergens])).sort((a, b) => a - b)
          } else {
            secRow!.items[i] = item
          }
        })

        if (isNewProposal) {
          items.forEach((item, dayIndex) => {
            if (item && (item.name.includes('본사제안신메뉴') || item.name.includes('신메뉴'))) {
              currentWeek!.newMenuProposals.push({ section: currentSection, dayIndex, item })
            }
          })
        }
      }

      // Read G column (col 6) for special notes
      const gVal = cellVal(r, 6)
      if (gVal) {
        const hex = cellColor(r, 6)
        const colorType = detectColorType(hex)
        // Find which day this note applies to (try to match date in text, else all)
        DAYS.forEach((_, dayIndex) => {
          if (gVal) {
            const existing = currentWeek!.specialNotes.find(n => n.dayIndex === dayIndex && n.text === gVal)
            if (!existing) {
              currentWeek!.specialNotes.push({ dayIndex, text: gVal, colorHex: hex, colorType })
            }
          }
        })
      }
    }
  }

  return { dietType, yearMonth, title, weeks }
}

/* ─── Component ─── */
export default function DietUploadPage() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const [dietType,  setDietType]  = useState<'CK' | '위탁'>('CK')
  const [yearMonth, setYearMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [file,      setFile]      = useState<File | null>(null)
  const [dragging,  setDragging]  = useState(false)
  const [parsing,   setParsing]   = useState(false)
  const [parsed,    setParsed]    = useState<ParsedDiet | null>(null)
  const [activeWeek,setActiveWeek]= useState(0)
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState('')

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f?.name.endsWith('.xlsx') || f?.name.endsWith('.xls')) setFile(f)
    else setError('xlsx 파일만 지원합니다')
  }, [])

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) setFile(f)
  }

  async function handleParse() {
    if (!file) return
    setParsing(true); setError(''); setParsed(null)
    try {
      const result = await parseExcel(file, dietType, yearMonth)
      setParsed(result)
      setActiveWeek(0)
    } catch (e) {
      setError('파싱 실패: ' + (e instanceof Error ? e.message : String(e)))
    } finally { setParsing(false) }
  }

  async function handleSave() {
    if (!parsed) return
    setSaving(true)
    const supabase = createClient()
    const { data, error: err } = await supabase.from('diet_uploads').insert({
      diet_type:   parsed.dietType,
      year_month:  parsed.yearMonth,
      file_name:   file?.name,
      parsed_data: parsed,
      status:      'uploaded',
    }).select().single()
    setSaving(false)
    if (err) { setError('저장 실패: ' + err.message); return }
    router.push(`/board/admin/diet/generate?upload_id=${data.id}&year_month=${parsed.yearMonth}`)
  }

  const week = parsed?.weeks[activeWeek]

  return (
    <div className="min-h-screen bg-[#F6FAF6] font-sans">
      <header className="bg-white border-b border-gray-100 px-4 sm:px-6 py-4 hidden sm:flex items-center gap-3 sticky top-0 z-10">
        <Link href="/board/admin/diet" className="text-gray-400 hover:text-gray-600">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5m7-7l-7 7 7 7"/>
          </svg>
        </Link>
        <h1 className="font-bold text-[#1C2B1E]">식단표 엑셀 업로드</h1>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-5">

        {/* 설정 */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 flex flex-wrap gap-5">
          <div>
            <label className="text-xs font-bold text-gray-500 mb-2 block">식단표 타입</label>
            <div className="flex gap-2">
              {(['CK','위탁'] as const).map(t => (
                <button key={t} type="button" onClick={() => setDietType(t)}
                  className={`px-5 py-2 rounded-xl border font-semibold text-sm transition-all ${
                    dietType === t ? 'bg-[#2D6A4F] border-[#2D6A4F] text-white' : 'border-gray-200 text-gray-600 hover:border-[#52B788]'
                  }`}>{t}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 mb-2 block">년월</label>
            <input type="month" value={yearMonth} onChange={e => setYearMonth(e.target.value)}
              className="px-4 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]" />
          </div>
        </div>

        {/* 파일 업로드 */}
        {!parsed && (
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
            className={`bg-white rounded-2xl border-2 border-dashed p-12 flex flex-col items-center justify-center cursor-pointer transition-colors ${
              dragging ? 'border-[#2D6A4F] bg-[#E8F5E9]' : 'border-gray-200 hover:border-[#52B788] hover:bg-[#F8FDF8]'
            }`}
          >
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={onFileSelect} />
            <div className="text-4xl mb-3">{file ? '📊' : '📂'}</div>
            {file ? (
              <>
                <p className="font-semibold text-[#1C2B1E] text-sm">{file.name}</p>
                <p className="text-xs text-gray-400 mt-1">{(file.size / 1024).toFixed(1)} KB</p>
              </>
            ) : (
              <>
                <p className="font-semibold text-gray-700">엑셀 파일을 드래그하거나 클릭하여 업로드</p>
                <p className="text-xs text-gray-400 mt-1">.xlsx 파일만 지원</p>
              </>
            )}
          </div>
        )}

        {file && !parsed && (
          <button type="button" onClick={handleParse} disabled={parsing}
            className="w-full bg-[#2D6A4F] hover:bg-[#1B4332] disabled:bg-gray-300 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2">
            {parsing ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>파싱 중...</> : '📊 파싱 시작'}
          </button>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {/* 미리보기 */}
        {parsed && (
          <>
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-bold text-[#1C2B1E]">{parsed.title || `${yearMonth} 식단표`}</p>
                  <p className="text-xs text-gray-400">{parsed.dietType} · {parsed.weeks.length}주 인식</p>
                </div>
                <button type="button" onClick={() => { setParsed(null); setFile(null) }}
                  className="text-xs text-gray-400 hover:text-gray-600">다시 업로드</button>
              </div>

              {/* 주차 탭 */}
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                {parsed.weeks.map((w, i) => (
                  <button key={w.weekNumber} type="button" onClick={() => setActiveWeek(i)}
                    className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      activeWeek === i ? 'bg-[#2D6A4F] text-white' : 'bg-gray-100 text-gray-600 hover:bg-[#E8F5E9]'
                    }`}>
                    {w.weekNumber}주
                  </button>
                ))}
              </div>
            </div>

            {/* 주차별 메뉴 테이블 */}
            {week && (
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-[#F8FDF8]">
                        <th className="px-3 py-2.5 text-left font-bold text-gray-500 w-24 whitespace-nowrap">구분</th>
                        {DAYS.map((d, i) => (
                          <th key={d} className="px-3 py-2.5 text-center font-bold text-gray-500 whitespace-nowrap">
                            {d}<br/><span className="font-normal text-gray-400">{week.dates[i]}</span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {week.sections.map(sec => (
                        <tr key={sec.section} className="hover:bg-[#F8FDF8]">
                          <td className="px-3 py-2.5 font-semibold text-[#2D6A4F] whitespace-nowrap">{sec.section}</td>
                          {sec.items.map((item, i) => (
                            <td key={i} className="px-3 py-2.5 text-center align-top">
                              {item ? (
                                <>
                                  <p className="text-gray-800 whitespace-pre-wrap">{item.name}</p>
                                  {item.allergens.length > 0 && (
                                    <p className="text-red-500 font-bold mt-0.5">
                                      {item.allergens.map(n => CIRCLED(n)).join('')}
                                    </p>
                                  )}
                                </>
                              ) : <span className="text-gray-300">—</span>}
                            </td>
                          ))}
                        </tr>
                      ))}
                      {/* Special notes row */}
                      {week.specialNotes.length > 0 && (
                        <tr>
                          <td className="px-3 py-2.5 font-semibold text-gray-500 whitespace-nowrap">특이사항</td>
                          {DAYS.map((_, i) => {
                            const notes = week.specialNotes.filter(n => n.dayIndex === i && n.colorType !== 'none')
                            return (
                              <td key={i} className="px-3 py-2.5 text-center align-top">
                                {notes.map((n, j) => (
                                  <span key={j} className={`inline-block text-[10px] px-1.5 py-0.5 rounded font-medium leading-tight ${COLOR_CLASS[n.colorType]}`}>
                                    {n.text}
                                  </span>
                                ))}
                              </td>
                            )
                          })}
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 범례 */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <p className="text-xs font-bold text-gray-500 mb-2">특이사항 색상 범례</p>
              <div className="flex flex-wrap gap-2">
                {(Object.entries(COLOR_LABEL) as [SpecialNote['colorType'], string][])
                  .filter(([k, v]) => k !== 'none' && v)
                  .map(([type, label]) => (
                    <span key={type} className={`text-xs px-2.5 py-1 rounded-lg font-medium ${COLOR_CLASS[type]}`}>
                      {label}
                    </span>
                  ))}
              </div>
            </div>

            <button type="button" onClick={handleSave} disabled={saving}
              className="w-full bg-[#F97316] hover:bg-[#EA6C0A] disabled:bg-gray-300 text-white font-bold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2">
              {saving ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>저장 중...</> : '다음: 원별 생성 →'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
