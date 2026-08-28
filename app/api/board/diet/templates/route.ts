import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getYearOptions } from '@/lib/diet-utils'
import { canManageTemplates, canDeleteTemplate } from '@/lib/roles'
import {
  type StyleJson,
  type TemplateValidation,
  type TemplateAnalysis,
  buildStyleJson,
} from '@/lib/template-analysis'

// diet_templates.vacation_variant CHECK 제약과 동일해야 한다
const VACATION_VARIANTS = ['none', 'vacation_on', 'vacation_off'] as const
type VacationVariant = typeof VACATION_VARIANTS[number]

export type { StyleJson }

function makeSupabase() {
  const store = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (n: string) => store.get(n)?.value,
        set: (n: string, v: string, o: CookieOptions) => { try { store.set({ name: n, value: v, ...o }) } catch {} },
        remove: (n: string, o: CookieOptions) => { try { store.set({ name: n, value: '', ...o }) } catch {} },
      },
    }
  )
}

interface AdminRow {
  id: string
  role: string
  can_manage_templates: boolean | null
}

// ★기존 checkAdmin()은 boolean만 반환했다. GET 응답에 호출자 권한(permissions)을
// 실어 보내고 POST에서 role/can_manage_templates로 게이트하려면 admin 행
// 자체가 필요해 반환 타입을 넓혔다 — GET의 "행이 없으면 403" 동작 자체는
// 그대로다(분기 추가 없음, 반환값만 넓어짐).
async function getAdmin(supabase: ReturnType<typeof makeSupabase>, userId: string): Promise<AdminRow | null> {
  const { data } = await supabase
    .from('admins')
    .select('id, role, can_manage_templates')
    .eq('auth_id', userId)
    .eq('is_active', true)
    .maybeSingle()
  return data ?? null
}

/* ── GET: 템플릿 목록 ── */
export async function GET() {
  const supabase = makeSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '관리자 권한이 필요합니다' }, { status: 403 })
  const admin = await getAdmin(supabase, user.id)
  if (!admin) return NextResponse.json({ error: '관리자 권한이 필요합니다' }, { status: 403 })

  // 정렬: 연·월 내림차순(최신 달이 위) → 같은 (연,월) 안에서는 버전 내림차순.
  // year가 NULL인 레거시 행은 nullsFirst:false로 맨 뒤로 보낸다.
  const { data, error } = await supabase
    .from('diet_templates')
    .select('id, version, name, file_path, style_json, is_active, created_at, note, year, month, vacation_variant, validation_result')
    .order('year',    { ascending: false, nullsFirst: false })
    .order('month',   { ascending: false, nullsFirst: false })
    .order('version', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  // ★2차 방어선(UI)이 버튼 disabled 여부를 판단할 근거. 페이지가 admins를
  // 따로 조회하지 않도록 GET 응답에 호출자 권한을 함께 실어 보낸다.
  return NextResponse.json({
    templates: data || [],
    permissions: {
      canManage: canManageTemplates(admin),
      canDelete: canDeleteTemplate(admin),
    },
  })
}

/* ── POST: 템플릿 확정 (브라우저 직접 업로드 2단계) ──
   파일은 이미 브라우저가 prepare에서 받은 경로로 Storage에 직접 올렸다.
   이 함수는 JSON(수 KB)만 받아 그 경로에 파일이 실제로 있는지 확인한
   뒤 DB 행을 만든다. 기존 멀티파트 처리는 제거했다 — 경로를 둘로 두면
   어느 쪽이 쓰이는지 모호해진다. */
export async function POST(req: NextRequest) {
  const supabase = makeSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
  const admin = await getAdmin(supabase, user.id)
  if (!admin) return NextResponse.json({ error: '관리자 권한이 필요합니다' }, { status: 403 })
  // ★1차 방어선(API) — 템플릿 담당은 role이 아니라 배정(can_manage_templates)이다
  if (!canManageTemplates(admin)) {
    return NextResponse.json({ error: '템플릿 관리 담당자만 가능합니다' }, { status: 403 })
  }

  let body: {
    storagePath?: string
    name?: string
    note?: string
    year?: number
    month?: number
    vacationVariant?: string
    styleJson?: StyleJson
    validationResult?: TemplateValidation
    analysis?: TemplateAnalysis
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '요청 본문 파싱 실패' }, { status: 400 })
  }

  const storagePath = (body.storagePath || '').trim()
  const name = (body.name || '').trim()
  const note = (body.note || '').trim()
  const year  = body.year
  const month = body.month
  const vacationVariantRaw = (body.vacationVariant || '').trim()

  if (!storagePath) return NextResponse.json({ error: '업로드 경로가 없습니다' }, { status: 400 })
  if (!name) return NextResponse.json({ error: '템플릿 이름을 입력하세요' }, { status: 400 })

  // ── 연·월 필수 검증 (prepare와 동일 기준) ───────────────────────────────
  // resolve_template_set()(pptx-server)이 항상 구체적 year/month로 필터링
  // 하므로, 연·월이 없는 템플릿은 업로드해도 영원히 사용되지 않는다
  // (v1이 그 상태 — 2026-08-24에야 발견됨). 같은 실수를 새로 만들지 않는다.
  // ★클라이언트 검증만 믿지 않는다 — 여기서 안 막으면 DB CHECK 제약
  //   (diet_templates_year_month_pair)에 걸려 Postgres 에러가 그대로
  //   500으로 튀어나와 실무자에게 알 수 없는 화면이 뜬다.
  if (!year || !month) {
    return NextResponse.json({ error: '연도와 월을 선택하세요' }, { status: 400 })
  }
  const validYears = getYearOptions()
  if (!Number.isInteger(year) || !validYears.includes(year)) {
    return NextResponse.json(
      { error: `연도는 ${validYears[0]}~${validYears[validYears.length - 1]} 사이여야 합니다` },
      { status: 400 },
    )
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: '월은 1~12 사이여야 합니다' }, { status: 400 })
  }

  // 방학 구분 — 값이 없으면 'none'(무관/평월)으로 처리, 있으면 3종 중 하나여야 함
  let vacationVariant: VacationVariant = 'none'
  if (vacationVariantRaw) {
    if (!VACATION_VARIANTS.includes(vacationVariantRaw as VacationVariant)) {
      return NextResponse.json({ error: '방학 구분 값이 올바르지 않습니다' }, { status: 400 })
    }
    vacationVariant = vacationVariantRaw as VacationVariant
  }

  // ★클라이언트가 보낸 경로를 그대로 믿지 않는다 — 그 경로에 파일이 실제로
  //   올라와 있는지 Storage에서 확인한 뒤에만 DB 행을 만든다. 안 하면
  //   파일 없는 행이 생긴다. 존재 확인은 목록 조회(list)만 하므로 파일
  //   전체를 다시 내려받지 않는다.
  const pathParts = storagePath.split('/')
  const fileName = pathParts.pop() || ''
  const folder = pathParts.join('/')
  const { data: listed, error: listErr } = await supabase.storage
    .from('diet-templates')
    .list(folder, { search: fileName, limit: 1 })
  if (listErr || !listed?.some((f) => f.name === fileName)) {
    return NextResponse.json({ error: '업로드된 파일을 찾을 수 없습니다. 다시 업로드해 주세요.' }, { status: 400 })
  }

  // prepare가 발급한 경로에는 버전이 이미 박혀 있다(v{N}_...) — 별도로
  // 다시 계산하지 않고 경로에서 그대로 읽어 단일 소스로 둔다.
  const versionMatch = storagePath.match(/^diet-templates\/v(\d+)_/)
  const version = versionMatch ? Number(versionMatch[1]) : 0

  const styleJson: StyleJson = body.styleJson ?? buildStyleJson({}, [])
  const validationResult: TemplateValidation = body.validationResult ?? {
    valid: false, slide_count: 0, slides: [], summary: '검증 안 됨',
  }

  // DB 저장 (is_active = false — 관리자가 확인 후 직접 활성화)
  // ★스키마 변경 없이 구조 분석(analysis) 결과를 validation_result
  //   컬럼(JSONB)에 함께 담는다 — 새 컬럼 추가는 별도 판단이 필요하다.
  const { data: tmpl, error: dbErr } = await supabase
    .from('diet_templates')
    .insert({
      version,
      name,
      file_path:         storagePath,
      style_json:        styleJson,
      is_active:         false,
      created_by:        user.id,
      note:              note || null,
      validation_result: body.analysis ? { ...validationResult, analysis: body.analysis } : validationResult,
      year,
      month,
      vacation_variant:  vacationVariant,
    })
    .select()
    .single()

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

  return NextResponse.json({ template: tmpl, style_json: styleJson, validation_result: validationResult })
}
