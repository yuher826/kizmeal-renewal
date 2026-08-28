'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { getYearOptions } from '@/lib/diet-utils'
import { createClient } from '@/lib/supabase'
import {
  type StyleJson,
  type TemplateValidation,
  type TemplateAnalysis,
  DEFAULT_STYLE,
  parseThemeXml,
  buildStyleJson,
  validateTemplateZip,
  analyzeTemplate,
  describeWideImage,
} from '@/lib/template-analysis'

// diet_templates.vacation_variant CHECK 제약과 동일해야 한다
type VacationVariant = 'none' | 'vacation_on' | 'vacation_off'

const VACATION_VARIANT_LABEL: Record<VacationVariant, string> = {
  none:         '무관(평월)',
  vacation_on:  '방학O',
  vacation_off: '방학X',
}

// route.ts POST 확정 시 analysis를 스키마 변경 없이 validation_result
// (JSONB) 안에 함께 저장한다 — 레거시 행은 이 필드가 없을 수 있다.
type StoredValidation = TemplateValidation & { analysis?: TemplateAnalysis }

interface DietTemplate {
  id: string; version: number; name: string; file_path: string
  style_json: StyleJson; is_active: boolean
  created_at: string; note?: string
  year: number | null; month: number | null
  vacation_variant: VacationVariant
  validation_result: StoredValidation | null
}

// GET 응답에 실려 오는 호출자 권한 — 업로드/활성화(canManage)와 삭제
// (canDelete)는 별개 축이다(삭제가 더 좁다). 이 페이지가 admins를 따로
// 조회하지 않고 이 값만으로 버튼 disabled 여부를 판단한다.
interface TemplatePermissions {
  canManage: boolean
  canDelete: boolean
}
const NO_PERMISSIONS: TemplatePermissions = { canManage: false, canDelete: false }

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

const NAME_LABEL: Record<string, string> = {
  MENU_TABLE:   '메뉴표',
  ORIGIN_BOX:   '원산지',
  MATERIAL_BOX: '원재료',
  ALLERGY_BOX:  '알레르기',
}

// "양식 점검 결과" — 이 양식으로 식단표를 만들 수 있는지 자동으로 확인한
// 결과를 항목마다 ✅/❌와 쉬운 한 줄 설명으로 보여준다.
// ★예전 MiniPreview는 "2026년 7월"·"샘플 메뉴①②"가 하드코딩된 가짜
//   미리보기였다(색상만 진짜였다). 실제 검증·구조 분석 데이터로 대체한다.
function InspectionResultCard({ style, validation, analysis }: {
  style: StyleJson
  validation: TemplateValidation | null
  analysis?: TemplateAnalysis | null
}) {
  const s = { ...DEFAULT_STYLE, ...style }
  const hasAnalysis = !!analysis && analysis.slides.length > 0
  const rowCounts = hasAnalysis
    ? Array.from(new Set(analysis!.slides.map(sl => sl.rowCount).filter((n): n is number => n != null)))
    : []
  const wideImages = hasAnalysis
    ? analysis!.slides.flatMap(sl => sl.wideImages.map(img => ({ slide: sl.slide, img })))
    : []
  const slideCountDisplay = hasAnalysis ? analysis!.slideCount : (validation?.slide_count ?? 0)
  const failingSlides = validation ? validation.slides.filter(sl => !sl.valid) : []

  return (
    <div className="space-y-3">
      <div>
        <p className="font-bold text-[#1C2B1E] text-sm">📋 양식 점검 결과</p>
        <p className="text-xs text-gray-500 mt-0.5">이 양식으로 식단표를 만들 수 있는지 자동으로 확인한 결과입니다.</p>
      </div>

      <div className="space-y-2.5 text-sm border-t border-gray-100 pt-3">
        {/* 슬라이드 수 · 행 수 */}
        <div className="flex items-start gap-2">
          <span>{hasAnalysis ? '✅' : slideCountDisplay > 0 ? 'ℹ️' : '⚠️'}</span>
          <div>
            <p className="font-medium text-[#1C2B1E]">
              슬라이드 {slideCountDisplay}장{rowCounts.length > 0 && ` · ${rowCounts.map(n => `${n}행`).join(' / ')}`}
            </p>
            <p className="text-xs text-gray-500">원마다 간식 칸 수가 달라 여러 종류가 필요합니다</p>
          </div>
        </div>

        {/* 이름표 4개 */}
        <div className="flex items-start gap-2">
          <span>{validation == null ? 'ℹ️' : validation.valid ? '✅' : '❌'}</span>
          <div className="flex-1">
            <p className="font-medium text-[#1C2B1E]">이름표 4개 확인 (메뉴표·원산지·원재료·알레르기)</p>
            {validation == null ? (
              <p className="text-xs text-gray-500">검증 정보가 없습니다</p>
            ) : validation.valid ? (
              <p className="text-xs text-gray-500">메뉴가 들어갈 자리를 찾았습니다</p>
            ) : (
              <div className="mt-1 space-y-1">
                {failingSlides.map(sl => {
                  const labels = sl.missing.map(m => NAME_LABEL[m] ?? m).join('·')
                  return (
                    <p key={sl.slide} className="text-xs text-red-600">
                      ❌ {sl.slide}에 {labels} 이름표가 없습니다
                      <span className="block text-gray-500">→ 디자이너께 {labels} 안내 문구가 빠졌는지 확인해 주세요</span>
                    </p>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* 가로 그림 */}
        <div className="flex items-start gap-2">
          <span>{wideImages.length > 0 ? '🖼️' : 'ℹ️'}</span>
          <div>
            {wideImages.length > 0 ? (
              wideImages.map(({ slide, img }, i) => (
                <div key={`${slide}-${i}`} className={i > 0 ? 'mt-1.5' : ''}>
                  <p className="font-medium text-[#1C2B1E]">{slide} · {describeWideImage(img)}</p>
                  <p className="text-xs text-gray-500">방학이나 연휴 안내 그림으로 보입니다. 디자이너가 넣은 것이 맞는지 확인해 주세요</p>
                </div>
              ))
            ) : (
              <p className="text-xs text-gray-500">가로로 긴 그림이 없습니다</p>
            )}
          </div>
        </div>

        {/* 색상·폰트 */}
        <div className="flex items-start gap-2">
          <span>✅</span>
          <div className="flex-1">
            <p className="font-medium text-[#1C2B1E]">색상·폰트 추출 완료</p>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              {(style.rawColors.length ? style.rawColors.slice(0, 8) : [s.headerColor, s.accentColor, s.sectionBgColor]).map((c, i) => {
                const hex = c.startsWith('#') ? c : `#${c}`
                return <span key={i} title={hex} className="w-4 h-4 rounded-full border border-gray-200 inline-block" style={{ background: hex }} />
              })}
              <span className="text-xs text-gray-400 ml-1">{s.fontFamily.split(',')[0].replace(/'/g, '')}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function DietTemplatesPage() {
  const [templates, setTemplates]       = useState<DietTemplate[]>([])
  const [permissions, setPermissions]   = useState<TemplatePermissions>(NO_PERMISSIONS)
  const [loading,   setLoading]         = useState(true)
  const [analyzing, setAnalyzing]       = useState(false)
  const [uploading, setUploading]       = useState(false)
  const [file,      setFile]            = useState<File | null>(null)
  const [inspection, setInspection]     = useState<{ style: StyleJson; validation: TemplateValidation; analysis: TemplateAnalysis } | null>(null)
  const [name,      setName]            = useState('')
  const [note,      setNote]            = useState('')
  // 연·월 기본값 — 다른 식단 화면(app/erp/(protected)/diet/page.tsx)의
  // pptxYear/pptxMonth와 동일하게 "현재 연·월"을 기본값으로 쓴다.
  const [uploadYear,  setUploadYear]  = useState(() => new Date().getFullYear())
  const [uploadMonth, setUploadMonth] = useState(() => new Date().getMonth() + 1)
  const [uploadVariant, setUploadVariant] = useState<VacationVariant>('none')
  const [dragging,  setDragging]        = useState(false)
  const [toast,     setToast]           = useState('')
  const [preview,   setPreview]         = useState<DietTemplate | null>(null)
  const [pendingId, setPendingId]       = useState<string | null>(null)
  const [legacyOpen, setLegacyOpen]     = useState(false)  // 레거시 그룹 기본 접힘
  const fileRef = useRef<HTMLInputElement>(null)

  const flash = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 4000) }

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/board/diet/templates')
    if (res.ok) {
      const json = await res.json()
      setTemplates(json.templates || [])
      setPermissions(json.permissions || NO_PERMISSIONS)
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const groups      = groupTemplates(templates)
  const monthGroups = groups.filter(g => g.key !== 'legacy')
  const legacyGroup = groups.find(g => g.key === 'legacy')

  // 파일을 pptx 형식 그대로 브라우저에서 JSZip으로 열어 검증·스타일·구조
  // 분석까지 전부 끝낸다(서버로는 아직 아무것도 안 보낸다). JSZip은
  // 초기 번들을 키우지 않도록 dynamic import.
  async function analyzeFile(f: File) {
    setAnalyzing(true)
    setInspection(null)
    try {
      const JSZipModule = (await import('jszip')).default
      const buffer = await f.arrayBuffer()
      const zip = await JSZipModule.loadAsync(buffer)

      let themeXml = ''
      const themeFile = zip.file('ppt/theme/theme1.xml')
      if (themeFile) themeXml = await themeFile.async('string')
      else {
        const found = zip.file(/^ppt\/theme\/theme\d+\.xml$/)[0]
        if (found) themeXml = await found.async('string')
      }
      let style: StyleJson = buildStyleJson({}, [])
      if (themeXml) {
        const { colors, fonts } = parseThemeXml(themeXml)
        style = buildStyleJson(colors, fonts)
      }

      const validation = await validateTemplateZip(zip)
      const analysis = await analyzeTemplate(zip)
      setInspection({ style, validation, analysis })
    } catch (err) {
      flash('pptx 파일을 열지 못했습니다: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setAnalyzing(false)
    }
  }

  function pickFile(f: File | null) {
    setFile(f)
    setInspection(null)
    if (f) analyzeFile(f)
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f && (f.name.endsWith('.pptx') || f.name.endsWith('.ppt'))) pickFile(f)
    else flash('pptx 파일만 지원합니다')
  }, [])

  // 직접 업로드 3단계: ①경로 발급(prepare) ②Storage에 파일 직접 업로드
  // (Vercel 서버를 거치지 않음) ③확정(JSON, 수 KB). Vercel 서버리스
  // 함수 요청 본문 상한(4.5MB)에 8MB대 pptx가 413으로 막히는 문제를
  // 이렇게 피한다.
  async function handleRegister() {
    if (!file || !name.trim() || !uploadYear || !uploadMonth || !inspection) return
    setUploading(true)

    const prepRes = await fetch('/api/board/diet/templates/prepare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year: uploadYear, month: uploadMonth, vacationVariant: uploadVariant }),
    })
    const prepJson = await prepRes.json()
    if (!prepRes.ok) { flash('등록 실패: ' + prepJson.error); setUploading(false); return }
    const storagePath: string = prepJson.storagePath

    const supabase = createClient()
    // ★from()의 버킷명과 경로 앞 중복("diet-templates/" 폴더)은 서버
    //   prepare가 발급한 경로 그대로 써야 한다 — 기존 파일과 규칙이 같다.
    const { error: uploadErr } = await supabase.storage
      .from('diet-templates')
      .upload(storagePath, file, {
        contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        upsert: false,
      })
    if (uploadErr) { flash('파일 업로드 실패: ' + uploadErr.message); setUploading(false); return }

    const confirmRes = await fetch('/api/board/diet/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storagePath,
        name: name.trim(),
        note: note.trim(),
        year: uploadYear,
        month: uploadMonth,
        vacationVariant: uploadVariant,
        styleJson: inspection.style,
        validationResult: inspection.validation,
        analysis: inspection.analysis,
      }),
    })
    const confirmJson = await confirmRes.json()

    if (!confirmRes.ok) {
      // ★확정이 실패하면 방금 Storage에 올린 파일이 고아로 남는다 —
      //   지워서 정리한다. 지우기도 실패하면 경로를 화면에 보여줘 수동
      //   정리가 가능하게 한다.
      const { error: removeErr } = await supabase.storage.from('diet-templates').remove([storagePath])
      flash(removeErr
        ? `등록 실패: ${confirmJson.error} (업로드된 파일 삭제도 실패 — 경로: ${storagePath})`
        : `등록 실패: ${confirmJson.error}`)
      setUploading(false)
      return
    }

    setPendingId(confirmJson.template.id)
    setFile(null); setName(''); setNote(''); setInspection(null)
    setUploading(false)
    await load()
    flash('등록 완료! 점검 결과를 확인하고 적용하세요.')
  }

  async function activate(id: string) {
    const res = await fetch(`/api/board/diet/templates/${id}/activate`, { method: 'PATCH' })
    const json = await res.json()
    if (!res.ok) { flash('활성화 실패: ' + json.error); return }
    setPendingId(null)
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
  // 검증 결과를 추가했다. 검증 실패도 표시만 하고 등록을 막지 않는다
  // (디자이너 원본은 이름표가 없는 게 정상 — 이름표는 생성 파이프라인이
  // 나중에 자동으로 붙인다).
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
          <button onClick={() => setPreview(t)}
            className="text-xs text-gray-500 hover:text-[#2D6A4F] font-medium">점검 결과</button>
          {/* ★권한 없으면 숨기지 않고 disabled + 이유 안내 — 숨기면
              "왜 버튼이 없지?" 문의가 발생한다. 이유를 화면이 말하게 한다. */}
          {!t.is_active && (
            <button onClick={() => activate(t.id)} disabled={!permissions.canManage}
              title={permissions.canManage ? undefined : '템플릿 관리 담당자만 가능합니다'}
              className="text-xs bg-[#E8F5E9] text-[#2D6A4F] font-semibold px-3 py-1.5 rounded-lg hover:bg-[#C8E6C9] transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#E8F5E9]">
              활성화
            </button>
          )}
          {!t.is_active && (
            <button onClick={() => deleteTemplate(t.id)} disabled={!permissions.canDelete}
              title={permissions.canDelete ? undefined : '최고관리자만 가능합니다'}
              className="text-xs text-red-400 hover:text-red-600 font-medium disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-red-400">삭제</button>
          )}
        </div>
      </div>
    )
  }

  const pendingTemplate = pendingId ? templates.find(t => t.id === pendingId) ?? null : null

  return (
    <main className="min-h-screen bg-[#F6FAF6] px-4 sm:px-6 py-6 sm:py-8">
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-[#2D6A4F] text-white px-6 py-3 rounded-2xl shadow-lg text-sm font-semibold max-w-sm text-center">
          {toast}
        </div>
      )}

      {preview && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-xl shadow-2xl max-h-[85vh] overflow-y-auto">
            <h2 className="font-bold text-[#1C2B1E] text-lg mb-1">{preview.name}</h2>
            <p className="text-xs text-gray-400 mb-4">v{preview.version} · {new Date(preview.created_at).toLocaleDateString('ko-KR')}</p>
            <div className="border border-gray-200 rounded-xl p-4 bg-white mb-5">
              <InspectionResultCard style={preview.style_json} validation={preview.validation_result} analysis={preview.validation_result?.analysis} />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setPreview(null)}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 rounded-xl text-sm">닫기</button>
              <button onClick={() => { activate(preview.id); setPreview(null) }} disabled={!permissions.canManage}
                title={permissions.canManage ? undefined : '템플릿 관리 담당자만 가능합니다'}
                className="flex-1 bg-[#2D6A4F] hover:bg-[#1B4332] text-white font-semibold py-3 rounded-xl text-sm disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#2D6A4F]">
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

        {pendingTemplate && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-base">🆕</span>
              <p className="font-bold text-blue-800">{pendingTemplate.name} — 미리보기 확인 후 적용하세요</p>
            </div>
            <div className="border border-blue-200 rounded-xl p-4 bg-white mb-4">
              <InspectionResultCard
                style={pendingTemplate.style_json}
                validation={pendingTemplate.validation_result}
                analysis={pendingTemplate.validation_result?.analysis}
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setPendingId(null)}
                className="flex-1 bg-white border border-blue-300 text-blue-700 font-semibold py-2.5 rounded-xl text-sm">
                나중에 적용
              </button>
              <button onClick={() => activate(pendingTemplate.id)} disabled={!permissions.canManage}
                title={permissions.canManage ? undefined : '템플릿 관리 담당자만 가능합니다'}
                className="flex-1 bg-[#2D6A4F] hover:bg-[#1B4332] text-white font-bold py-2.5 rounded-xl text-sm disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#2D6A4F]">
                이 디자인으로 적용하기
              </button>
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
          <h2 className="font-bold text-[#1C2B1E]">새 템플릿 등록</h2>
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-colors ${
              dragging ? 'border-[#2D6A4F] bg-[#E8F5E9]' : 'border-gray-200 hover:border-[#52B788] hover:bg-[#F8FDF8]'
            }`}
          >
            <input ref={fileRef} type="file" accept=".pptx,.ppt" className="hidden" onChange={e => pickFile(e.target.files?.[0] || null)} />
            <div className="text-4xl mb-2">{file ? '📊' : '📎'}</div>
            {file ? (
              <><p className="font-semibold text-[#1C2B1E] text-sm">{file.name}</p>
              <p className="text-xs text-gray-400">{(file.size / 1024).toFixed(0)} KB</p></>
            ) : (
              <><p className="font-semibold text-gray-600 text-sm">pptx 파일을 드래그하거나 클릭</p>
              <p className="text-xs text-gray-400 mt-1">.pptx 파일만 지원 · 색상/폰트/구조 자동 점검</p></>
            )}
          </div>

          {analyzing && (
            <div className="flex items-center justify-center gap-2 text-xs text-gray-500 py-2">
              <span className="w-3.5 h-3.5 border-2 border-gray-300 border-t-[#2D6A4F] rounded-full animate-spin" />
              양식을 점검하는 중...
            </div>
          )}

          {inspection && !analyzing && (
            <div className="border border-gray-200 rounded-xl p-4 bg-[#F8FDF8]">
              <InspectionResultCard style={inspection.style} validation={inspection.validation} analysis={inspection.analysis} />
            </div>
          )}

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
          <button type="button" onClick={handleRegister}
            disabled={!file || !name.trim() || !uploadYear || !uploadMonth || !inspection || analyzing || uploading || !permissions.canManage}
            title={permissions.canManage ? undefined : '템플릿 관리 담당자만 가능합니다'}
            className="w-full bg-[#2D6A4F] hover:bg-[#1B4332] disabled:bg-gray-300 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2">
            {uploading ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>등록 중...</> : '이 양식으로 등록'}
          </button>
          {/* ★숨기지 않고 이유를 화면이 말하게 한다 — 버튼이 disabled인
              것만 보면 실무자는 "왜 안 되지"를 문의로 물어야 알 수 있다 */}
          {!loading && !permissions.canManage && (
            <p className="text-xs text-yellow-700 text-center">템플릿 관리 담당자만 가능합니다</p>
          )}
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
          <p>• pptx 파일에서 색상·폰트·구조(행 수, 이름표, 가로 그림)를 자동으로 점검합니다</p>
          <p>• [활성화]된 템플릿은 다음 PDF 생성부터 즉시 반영됩니다</p>
          <p>• 활성화된 템플릿은 삭제할 수 없습니다 (다른 버전 활성화 후 삭제)</p>
          <p>• 활성 템플릿이 없으면 기본 키즈밀 스타일로 자동 적용됩니다</p>
        </div>

      </div>
    </main>
  )
}
