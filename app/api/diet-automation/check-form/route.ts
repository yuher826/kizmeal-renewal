import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { UPLOAD_ROLES } from '@/lib/roles'

/**
 * GET /api/diet-automation/check-form?year=2026&month=7
 *
 * Storage(diet-files)에 해당 연월 빈폼 파일이 존재하는지 확인합니다.
 * 파일명 규칙은 gen_form.py의 storage_path_for()와 동일해야 합니다.
 *   → {year}/{mm}/blank_form_{yy}_{mm}_v6.xlsx
 *
 * 응답:
 *   { exists: boolean, storagePath: string, publicUrl: string }
 */
export async function GET(req: NextRequest) {
  // 1. 인증
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 2. 권한 (UPLOAD_ROLES: super_admin, manager, nutritionist_*)
  const { data: admin } = await supabase
    .from('admins').select('role').eq('auth_id', user.id).maybeSingle()

  if (!UPLOAD_ROLES.includes(admin?.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // 3. year, month 파라미터 파싱
  const { searchParams } = new URL(req.url)
  const year  = Number(searchParams.get('year'))
  const month = Number(searchParams.get('month'))
  if (!year || !month || month < 1 || month > 12) {
    return NextResponse.json(
      { error: 'year, month 파라미터가 유효하지 않습니다.' },
      { status: 400 },
    )
  }

  // 4. Storage 경로 구성 (gen_form.py storage_path_for와 동일 — ASCII key)
  const mm          = String(month).padStart(2, '0')
  const yy          = String(year % 100).padStart(2, '0')
  const storagePath = `${year}/${mm}/blank_form_${yy}_${mm}_v6.xlsx`

  // 5. PUBLIC URL 조립
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const publicUrl   = `${supabaseUrl}/storage/v1/object/public/diet-files/${storagePath}`

  // 6. HEAD 요청으로 파일 존재 여부 확인 (body 불필요 — 가장 가벼운 방식)
  try {
    const headRes = await fetch(publicUrl, { method: 'HEAD' })
    const exists  = headRes.ok   // 200 → true / 4xx → false

    return NextResponse.json({
      exists,
      storagePath,
      publicUrl: exists ? publicUrl : null,
    })
  } catch {
    // 네트워크 오류는 Storage 장애로 취급
    return NextResponse.json(
      { error: 'Storage 확인 중 오류가 발생했습니다.' },
      { status: 502 },
    )
  }
}
