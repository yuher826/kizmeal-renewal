'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { getYearOptions } from '@/lib/diet-utils'

interface StyleJson {
  headerColor: string; accentColor: string; sectionBgColor: string
  headerBgColor: string; weekTitleColor: string; weekBorderColor: string
  borderColor: string; fontFamily: string
  rawColors: string[]; rawFonts: string[]
}

// diet_templates.vacation_variant CHECK 제약과 동일해야 한다
type VacationVariant = 'none' | 'vacation_on' | 'vacation_off'

const VACATION_VARIANT_LABEL: Record<VacationVariant, string> = {
  none:         '무관(평월)',
  vacation_on:  '방학O',
  vacation_off: '방학X',
}

// route.ts의 TemplateValidation과 동일한 모양(서버 파일에서 export 안 하고
// 있어 StyleJson처럼 화면 쪽에도 그대로 미러링). 레거시 행은 컬럼 DEFAULT가
// '{}'라 필드가 비어 있을 수 있으므로 전부 optional로 선언한다.
interface SlideValidation {
  slide: string
  valid: boolean
  names_found: Record<string, boolean>
  missing: string[]
}
interface TemplateValidation {
  valid?: boolean
  slide_count?: number
  slides?: SlideValidation[]
  summary?: string
}

interface DietTemplate {
  id: string; version: number; name: string; file_path: string
  style_json: StyleJson; is_active: boolean
  created_at: string; note?: string
  year: number | null; month: number | null
  vacation_variant: VacationVariant
  validation_result: TemplateValidation | null
}

// ── 연·월 그룹핑 (2026-08-25 재구성) ─────────────────────────────────────
// 기존엔 "활성 1개(상단) + 나머지(하단)" 이분법이었다. 같은 달에 방학O·
// 방학X가 동시에 active일 수 있는 새 모델에서는 이게 깨진다 —
// templates.find(t=>t.is_active)가 하나만 집고, 나머지 활성 템플릿은
// is_active=true라서 !t.is_active 필터에도 안 걸려 화면에서 통째로
// 사라진다. 1차 축을 연·월로 바꾸고 활성 여부는 행 배지로만 표시한다.
interface TemplateGroup {
  key: string             // '2026-08' 형태, 레거시는 'legacy'
  year: number | null
  month: number | null
  templates: DietTemplate[]
}

// GET route.ts가 이미 year DESC NULLS LAST → month DESC NULLS LAST →
// version DESC로 정렬해서 준다 — 그래서 templates를 순서대로 훑으며
// Map에 넣기만 해도 레거시(year/month NULL) 그룹이 자연히 맨 끝에 온다.
// 이 함수가 별도로 재정렬하지 않는 이유는 그 정렬 규칙 하나만 신뢰의
// 근원(source of truth)으로 두기 위함 — 여기서 또 정렬하면 두 곳이
// 어긋날 때 뭐가 맞는지 알 수 없어진다.
function groupTemplates(templates: DietTemplate[]): TemplateGroup[] {
  const map = new Map<string, TemplateGroup>()
  for (const t of templates) {
    const key = t.year != null && t.month != null
      ? `${t.year}-${String(t.month).padStart(2, '0')}`
      : 'legacy'
    let group = map.get(key)
    if (!group) {
      group = { key, year: t.year, month: t.month, templates: [] }
      map.set(key, group)
    }
    group.templates.push(t)
  }
  return Array.from(map.values())
}

// 그룹 헤더에 표시할 "그 (연,월)에서 실제로 active인 variant 현황".
// ★결론(배지)만 보여주면 판정 기준이 렌더링 코드 안에 묻힌다 — 근거
// (방학O/방학X 각각의 active 여부)를 항상 같이 보여준다.
// 이 표시는 pptx-server의 resolve_template_set()이 그 달 active 템플릿을
// variant별로 모으는 것과 같은 기준이다 — 화면과 파이프라인이 같은 것을
// 본다. 판정은 active인 것만 센다(비활성 템플릿은 파이프라인이 안 씀).
function vacationStatus(group: TemplateGroup): { statusText: string; warnBadge: string | null } {
  const activeVariants = new Set(group.templates.filter(t => t.is_active).map(t => t.vacation_variant))
  const hasOn   = activeVariants.has('vacation_on')
  const hasOff  = activeVariants.has('vacation_off')
  const hasNone = activeVariants.has('none')

  if (hasOn && hasOff) return { statusText: '방학O ✅ · 방학X ✅', warnBadge: null }
  if (hasOn || hasOff) {
    // 방학 축 중 하나만 active — 평월에 방학 그림이 붙거나 반대로 빠지는
    // 사고(pick_template() 오배정 방지 작업, 3d4a81d)를 막았어도, "아예 안
    // 올라옴" 자체는 화면에서 실무자가 직접 알아채야 한다.
    return { statusText: `방학O ${hasOn ? '✅' : '❌'} · 방학X ${hasOff ? '✅' : '❌'}`, warnBadge: '⚠️ 쌍 미완성' }
  }
  // 평월(방학 없는 달)은 none 하나만 active인 게 정상 — 배지를 띄우지 않는다.
  if (hasNone) return { statusText: '공용 ✅', warnBadge: null }
  return { statusText: '', warnBadge: '⚠️ 활성 템플릿 없음' }
}

const DEFAULT_STYLE: StyleJson = {
  headerColor: '#1B4332', accentColor: '#2D6A4F',
  sectionBgColor: '#E8F5E9', headerBgColor: '#F8FDF8',
  weekTitleColor: '#2D6A4F', weekBorderColor: '#2D6A4F',
  borderColor: '#ccc', fontFamily: "'Malgun Gothic', sans-serif",
  rawColors: [], rawFonts: [],
}

function MiniPreview({ style }: { style: StyleJson }) {
  const s = { ...DEFAULT_STYLE, ...style }
  const DAYS = ['월','화','수','목','금']
  const SECTIONS = ['오전간식','오후간식','돌봄간식']
  return (
    <div style={{ fontFamily: s.fontFamily, fontSize: '9px', width: '100%' }}>
      <div style={{ textAlign: 'center', marginBottom: 6 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: s.headerColor }}>키즈밀 튼튼 식단 2026년 7월</div>
        <div style={{ fontSize: 10, color: s.accentColor, marginTop: 1 }}>○○ 어린이집</div>
      </div>
      <div style={{ fontWeight: 700, fontSize: 8, color: s.weekTitleColor, borderLeft: `2px solid ${s.weekBorderColor}`, paddingLeft: 3, marginBottom: 3 }}>1주</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 7 }}>
        <thead>
          <tr>
            <th style={{ background: s.sectionBgColor, color: s.headerColor, border: `1px solid ${s.borderColor}`, padding: '2px 3px', fontWeight: 700, width: 40 }}>구분</th>
            {DAYS.map(d => (
              <th key={d} style={{ background: s.headerBgColor, border: `1px solid ${s.borderColor}`, padding: '2px 3px', fontWeight: 700 }}>{d}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {SECTIONS.map(sec => (
            <tr key={sec}>
              <td style={{ background: s.headerBgColor, color: s.accentColor, border: `1px solid ${s.borderColor}`, padding: '2px 3px', fontWeight: 600, whiteSpace: 'nowrap' }}>{sec}</td>
              {DAYS.map(d => (
                <td key={d} style={{ border: `1px solid ${s.borderColor}`, padding: '2px 3px', textAlign: 'center', color: '#333' }}>
                  {d === '월' ? '샘플 메뉴①②' : '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ marginTop: 4, fontSize: 6, color: '#666', borderTop: `1px solid ${s.borderColor}`, paddingTop: 3 }}>
        ※ 알레르기: ①난류 ②우유 ③메밀 ④땅콩 ...
      </div>
    </div>
  )
}

export default function DietTemplatesPage() {
  const [templates, setTemplates]       = useState<DietTemplate[]>([])
  const [loading,   setLoading]         = useState(true)
  const [uploading, setUploading]       = useState(false)
  const [file,      setFile]            = useState<File | null>(null)
  const [name,      setName]            = useState('')
  const [note,      setNote]            = useState('')
  // 연·월 기본값 — 다른 식단 화면(app/erp/(protected)/diet/page.tsx)의
  // pptxYear/pptxMonth와 동일하게 "현재 연·월"을 기본값으로 쓴다.
  const [uploadYear,  setUploadYear]  = useState(() => new Date().getFullYear())
  const [uploadMonth, setUploadMonth] = useState(() => new Date().getMonth() + 1)
  const [uploadVariant, setUploadVariant] = useState<VacationVariant>('none')
  const [dragging,  setDragging]        = useState(false)
  const [toast,     setToast]           = useState('')
  const [preview,   setPreview]         = useState<{ tmpl: DietTemplate; styles: StyleJson } | null>(null)
  const [pendingStyle, setPendingStyle] = useState<{ id: string; style: StyleJson } | null>(null)
  const [legacyOpen, setLegacyOpen]     = useState(false)  // 레거시 그룹 기본 접힘
  const fileRef = useRef<HTMLInputElement>(null)

  const flash = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 4000) }

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/board/diet/templates')
    if (res.ok) {
      const json = await res.json()
      setTemplates(json.templates || [])
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const groups      = groupTemplates(templates)
  const monthGroups = groups.filter(g => g.key !== 'legacy')
  const legacyGroup = groups.find(g => g.key === 'legacy')

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f && (f.name.endsWith('.pptx') || f.name.endsWith('.ppt'))) setFile(f)
    else flash('pptx 파일만 지원합니다')
  }, [])

  async function handleUpload() {
    if (!file || !name.trim() || !uploadYear || !uploadMonth) return
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('name', name.trim())
    fd.append('note', note.trim())
    fd.append('year', String(uploadYear))
    fd.append('month', String(uploadMonth))
    fd.append('vacation_variant', uploadVariant)

    const res = await fetch('/api/board/diet/templates', { method: 'POST', body: fd })
    const json = await res.json()
    setUploading(false)

    if (!res.ok) { flash('업로드 실패: ' + json.error); return }

    setPendingStyle({ id: json.template.id, style: json.style_json })
    setFile(null); setName(''); setNote('')
    await load()
    flash('업로드 완료! 미리보기를 확인하고 적용하세요.')
  }

  async function activate(id: string) {
    const res = await fetch(`/api/board/diet/templates/${id}/activate`, { method: 'PATCH' })
    const json = await res.json()
    if (!res.ok) { flash('활성화 실패: ' + json.error); return }
    setPendingStyle(null)
    await load()
    flash('✅ 템플릿이 활성화되었습니다. 다음 PDF 생성부터 적용됩니다.')
  }

  async function deleteTemplate(id: string) {
    if (!confirm('이 버전을 삭제하시겠습니까?')) return
    const res = await fetch(`/api/board/diet/templates/${id}`, { method: 'DELETE' })
    const json = await res.json()
    if (!res.ok) { flash('삭제 실패: ' + json.error); return }
    await load()
    flash('삭제되었습니다')
  }

  // 그룹(연·월/레거시) 안의 템플릿 행 하나 — 기존에 있던 것(이름·버전·비고·
  // 업로드일·미리보기/활성화/삭제)을 전부 유지하고 variant 라벨·활성 배지·
  // 검증 결과를 추가했다. 검증 실패도 표시만 하고 업로드를 막지 않는다
  // (디자이너 원본은 이름표가 없는 게 정상 — 이름표는 생성 파이프라인이
  // 나중에 자동으로 붙인다). validation_result는 지금까지 DB에 저장만
  // 되고 화면엔 전혀 안 보였다(GET select에도 없었다).
  function renderRow(t: DietTemplate) {
    const validation = t.validation_result
    const validationLabel = validation?.summary ?? '검증 정보 없음'
    const validationOk = validation?.valid === true
    return (
      <div key={t.id} className="px-6 py-3.5 flex items-center justify-between hover:bg-[#F8FDF8]">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
              {VACATION_VARIANT_LABEL[t.vacation_variant]}
            </span>
            {t.is_active && (
              <span className="text-xs bg-[#2D6A4F] text-white px-2 py-0.5 rounded-full font-semibold">✅ 활성</span>
            )}
            <span className="text-sm font-semibold text-[#1C2B1E]">{t.name}</span>
            <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded font-mono">v{t.version}</span>
          </div>
          {t.note && <p className="text-xs text-gray-400 mt-0.5">{t.note}</p>}
          <p className="text-xs text-gray-400 mt-0.5">
            업로드 {new Date(t.created_at).toLocaleDateString('ko-KR')}
            {' · '}
            <span className={validationOk ? 'text-[#2D6A4F]' : 'text-yellow-700'}>{validationLabel}</span>
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => setPreview({ tmpl: t, styles: { ...DEFAULT_STYLE, ...t.style_json } })}
            className="text-xs text-gray-500 hover:text-[#2D6A4F] font-medium">미리보기</button>
          {!t.is_active && (
            <button onClick={() => activate(t.id)}
              className="text-xs bg-[#E8F5E9] text-[#2D6A4F] font-semibold px-3 py-1.5 rounded-lg hover:bg-[#C8E6C9] transition-colors">
              활성화
            </button>
          )}
          {!t.is_active && (
            <button onClick={() => deleteTemplate(t.id)}
              className="text-xs text-red-400 hover:text-red-600 font-medium">삭제</button>
          )}
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-[#F6FAF6] px-4 sm:px-6 py-6 sm:py-8">
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-[#2D6A4F] text-white px-6 py-3 rounded-2xl shadow-lg text-sm font-semibold max-w-sm text-center">
          {toast}
        </div>
      )}

      {preview && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-xl shadow-2xl">
            <h2 className="font-bold text-[#1C2B1E] text-lg mb-1">{preview.tmpl.name}</h2>
            <p className="text-xs text-gray-400 mb-4">v{preview.tmpl.version} · {new Date(preview.tmpl.created_at).toLocaleDateString('ko-KR')}</p>
            <div className="border border-gray-200 rounded-xl p-4 bg-white mb-5">
              <MiniPreview style={preview.styles} />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setPreview(null)}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 rounded-xl text-sm">닫기</button>
              <button onClick={() => { activate(preview.tmpl.id); setPreview(null) }}
                className="flex-1 bg-[#2D6A4F] hover:bg-[#1B4332] text-white font-semibold py-3 rounded-xl text-sm">
                이 디자인으로 적용
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-2xl">🎨</span>
          <h1 className="text-xl sm:text-2xl font-bold text-[#1C2B1E]">식단표 템플릿 관리</h1>
        </div>
        <p className="text-sm text-gray-500 ml-9">코드 수정 없이 디자인을 업데이트하세요</p>
      </div>

      <div className="space-y-5">

        {pendingStyle && (() => {
          const tmpl = templates.find(t => t.id === pendingStyle.id)
          return tmpl ? (
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-base">🆕</span>
                <p className="font-bold text-blue-800">{tmpl.name} — 미리보기 확인 후 적용하세요</p>
              </div>
              <div className="border border-blue-200 rounded-xl p-4 bg-white mb-4">
                <MiniPreview style={{ ...DEFAULT_STYLE, ...pendingStyle.style }} />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setPendingStyle(null)}
                  className="flex-1 bg-white border border-blue-300 text-blue-700 font-semibold py-2.5 rounded-xl text-sm">
                  나중에 적용
                </button>
                <button onClick={() => activate(pendingStyle.id)}
                  className="flex-1 bg-[#2D6A4F] hover:bg-[#1B4332] text-white font-bold py-2.5 rounded-xl text-sm">
                  이 디자인으로 적용하기
                </button>
              </div>
            </div>
          ) : null
        })()}

        <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
          <h2 className="font-bold text-[#1C2B1E]">새 템플릿 업로드</h2>
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-colors ${
              dragging ? 'border-[#2D6A4F] bg-[#E8F5E9]' : 'border-gray-200 hover:border-[#52B788] hover:bg-[#F8FDF8]'
            }`}
          >
            <input ref={fileRef} type="file" accept=".pptx,.ppt" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
            <div className="text-4xl mb-2">{file ? '📊' : '📎'}</div>
            {file ? (
              <><p className="font-semibold text-[#1C2B1E] text-sm">{file.name}</p>
              <p className="text-xs text-gray-400">{(file.size / 1024).toFixed(0)} KB</p></>
            ) : (
              <><p className="font-semibold text-gray-600 text-sm">pptx 파일을 드래그하거나 클릭</p>
              <p className="text-xs text-gray-400 mt-1">.pptx 파일만 지원 · 색상/폰트 자동 추출</p></>
            )}
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 mb-1.5 block">버전 이름 <span className="text-red-500">*</span></label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="예: 2026 키즈밀 디자인 v3"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]" />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 mb-1.5 block">변경 메모 (선택)</label>
            <input type="text" value={note} onChange={e => setNote(e.target.value)}
              placeholder="예: 헤더 색상 변경, 폰트 업데이트"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]" />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 mb-1.5 block">
              적용 연·월 <span className="text-red-500">*</span>
            </label>
            <p className="text-xs text-gray-400 mb-1.5">
              연·월이 없는 템플릿은 활성화해도 생성에 쓰이지 않습니다(레거시 v1과 동일한 문제).
            </p>
            <div className="flex gap-2">
              <select value={uploadYear} onChange={e => setUploadYear(Number(e.target.value))}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]">
                {getYearOptions(uploadYear).map(y => <option key={y} value={y}>{y}년</option>)}
              </select>
              <select value={uploadMonth} onChange={e => setUploadMonth(Number(e.target.value))}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]">
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m}>{m}월</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 mb-1.5 block">방학 구분</label>
            <select value={uploadVariant} onChange={e => setUploadVariant(e.target.value as VacationVariant)}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]">
              {(Object.keys(VACATION_VARIANT_LABEL) as VacationVariant[]).map(v => (
                <option key={v} value={v}>{VACATION_VARIANT_LABEL[v]}</option>
              ))}
            </select>
          </div>
          <button type="button" onClick={handleUpload} disabled={!file || !name.trim() || !uploadYear || !uploadMonth || uploading}
            className="w-full bg-[#2D6A4F] hover:bg-[#1B4332] disabled:bg-gray-300 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2">
            {uploading ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>분석 중...</> : '업로드 및 스타일 분석'}
          </button>
        </div>

        {loading ? (
          <div className="h-16 bg-gray-50 rounded-xl animate-pulse" />
        ) : templates.length === 0 ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 text-sm text-yellow-700">
            업로드된 템플릿이 없습니다. 기본 키즈밀 스타일로 PDF가 생성됩니다.
          </div>
        ) : (
          <>
            {/* 연·월 그룹 — 실무자는 "8월 템플릿"을 찾지 "v7"을 찾지 않는다.
                활성 여부는 축이 아니라 각 행의 배지로만 표시(위 groupTemplates/
                vacationStatus 주석 참고) */}
            {monthGroups.map(group => {
              const { statusText, warnBadge } = vacationStatus(group)
              return (
                <div key={group.key} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2 flex-wrap">
                    <h2 className="font-bold text-[#1C2B1E]">{group.year}년 {group.month}월</h2>
                    {statusText && <span className="text-xs text-gray-500">{statusText}</span>}
                    {warnBadge && (
                      <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full font-semibold">
                        {warnBadge}
                      </span>
                    )}
                  </div>
                  <div className="divide-y divide-gray-50">
                    {group.templates.map(t => renderRow(t))}
                  </div>
                </div>
              )
            })}

            {/* 레거시(year/month NULL) — 맨 아래, 기본 접힘. 삭제는 보류 상태다
                (유대표 결정 2026-08-24) */}
            {legacyGroup && (
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <button type="button" onClick={() => setLegacyOpen(v => !v)}
                  className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50">
                  <div>
                    <h2 className="font-bold text-[#1C2B1E]">레거시 (효과없음) · {legacyGroup.templates.length}건</h2>
                    <p className="text-xs text-gray-400 mt-0.5">
                      연·월이 지정되지 않아 생성 파이프라인(resolve_template_set())이 참조하지 않습니다
                    </p>
                  </div>
                  <span className="text-xs text-gray-400 font-medium shrink-0 ml-3">{legacyOpen ? '▲ 접기' : '▼ 펼치기'}</span>
                </button>
                {legacyOpen && (
                  <div className="divide-y divide-gray-50 border-t border-gray-100">
                    {legacyGroup.templates.map(t => renderRow(t))}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-2xl px-5 py-4 text-xs text-gray-600 space-y-1">
          <p className="font-bold text-yellow-800 mb-1.5">💡 템플릿 관리 안내</p>
          <p>• pptx 파일에서 색상과 폰트를 자동으로 추출합니다</p>
          <p>• [활성화]된 템플릿은 다음 PDF 생성부터 즉시 반영됩니다</p>
          <p>• 활성화된 템플릿은 삭제할 수 없습니다 (다른 버전 활성화 후 삭제)</p>
          <p>• 활성 템플릿이 없으면 기본 키즈밀 스타일로 자동 적용됩니다</p>
        </div>

      </div>
    </main>
  )
}
