import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { UPLOAD_ROLES } from '@/lib/roles'
import { EXCLUDED_CONTRACT_TYPE } from '@/lib/pptx-eligibility'

// 크레오(임시원) 식단표 직접 업로드
//   - 이미 완성된 PDF 식단표를 diet-files 버킷에 올리고 weekly_menus에 기록
//   - PPTX 자동생성 파이프라인을 거치지 않고 고객/학부모 포털에 바로 노출시키는 용도
//   - 임시원(contract_type='temporary') 전용. 필터링은 DB 쿼리가 아닌 조회 후 코드 레벨에서 수행.

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  // ── 인증: 업로드 권한 admin ──
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })

  const { data: admin } = await supabase
    .from('admins').select('role').eq('auth_id', user.id).maybeSingle()
  if (!UPLOAD_ROLES.includes(admin?.role ?? '')) {
    return NextResponse.json({ error: '접근 권한이 없습니다' }, { status: 403 })
  }

  // ── DB 쓰기용 service-role 클라이언트 ──
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const url        = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const dbClient   = serviceKey ? createAdminClient(url, serviceKey) : supabase

  // ── 대상 원 프로파일 조회 (branch_profiles.id = params.id) ──
  const { data: profile, error: profileErr } = await dbClient
    .from('branch_profiles')
    .select('id, contract_type, short_code, branch_full_name')
    .eq('id', params.id)
    .maybeSingle()

  if (profileErr || !profile) {
    return NextResponse.json({ error: '원 프로파일을 찾을 수 없습니다' }, { status: 404 })
  }

  // 임시원 전용 (조회 후 코드 레벨 판단)
  if (profile.contract_type !== EXCLUDED_CONTRACT_TYPE) {
    return NextResponse.json(
      { error: '식단표 직접 업로드는 임시원(temporary)만 사용할 수 있습니다' },
      { status: 400 }
    )
  }

  // ── FormData 파싱 ──
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: '파일 형식 오류' }, { status: 400 })
  }

  const file  = formData.get('file') as File | null
  const year  = parseInt(formData.get('year')  as string || '0')
  const month = parseInt(formData.get('month') as string || '0')

  if (!file || !year || !month) {
    return NextResponse.json({ error: '파일·연도·월은 필수입니다' }, { status: 400 })
  }

  // PDF 검증 (MIME 또는 확장자)
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
  if (!isPdf) {
    return NextResponse.json({ error: 'PDF 파일만 업로드할 수 있습니다' }, { status: 400 })
  }

  // ── Storage 업로드: diet-files/{YYYY}/{MM}/{profileId 앞8자리}_{YYYYMM}.pdf ──
  const mm         = String(month).padStart(2, '0')
  const id8        = profile.id.slice(0, 8)
  const fileName   = `${id8}_${year}${mm}.pdf`
  const storagePath = `${year}/${mm}/${fileName}`

  let publicUrl: string
  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const { error: uploadErr } = await dbClient.storage
      .from('diet-files')
      .upload(storagePath, buffer, { contentType: 'application/pdf', upsert: true })
    if (uploadErr) {
      console.error('[diet-upload] Storage 업로드 오류:', uploadErr)
      return NextResponse.json({ error: `파일 업로드에 실패했습니다: ${uploadErr.message}` }, { status: 500 })
    }
    const { data: urlData } = dbClient.storage.from('diet-files').getPublicUrl(storagePath)
    publicUrl = urlData.publicUrl
  } catch (err) {
    console.error('[diet-upload] Storage 예외:', err)
    return NextResponse.json({ error: '파일 업로드 중 오류가 발생했습니다' }, { status: 500 })
  }

  // ── weekly_menus upsert (포털 노출 조건 충족) ──
  // branch_id = branch_profiles.id (★branches.id 아님)
  const { error: upsertErr } = await dbClient
    .from('weekly_menus')
    .upsert({
      branch_id:  profile.id,
      year,
      month,
      diet_type:  'CK',
      week_num:   null,
      status:     'generation_complete',
      pdf_url:    publicUrl,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'branch_id,year,month,diet_type' })

  if (upsertErr) {
    console.error('[diet-upload] weekly_menus upsert 오류:', upsertErr)
    return NextResponse.json(
      { error: `식단표 기록에 실패했습니다 (${upsertErr.code}: ${upsertErr.message})` },
      { status: 500 }
    )
  }

  return NextResponse.json({
    success: true,
    year,
    month,
    pdf_url: publicUrl,
    branch_full_name: profile.branch_full_name ?? profile.short_code,
  })
}
