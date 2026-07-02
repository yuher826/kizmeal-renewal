import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { UPLOAD_ROLES } from '@/lib/roles'

export async function GET(req: NextRequest) {
  // 1. 인증
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 2. 권한 (UPLOAD_ROLES) + admin.id 확보
  const { data: admin } = await supabase
    .from('admins').select('id, role').eq('auth_id', user.id).maybeSingle()

  if (!UPLOAD_ROLES.includes(admin?.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // 3. year, month 파싱
  const { searchParams } = new URL(req.url)
  const year  = Number(searchParams.get('year'))
  const month = Number(searchParams.get('month'))
  if (!year || !month) {
    return NextResponse.json({ error: 'year, month 파라미터가 필요합니다.' }, { status: 400 })
  }

  // 4. Storage 경로 규칙 (gen_form.py storage_path_for와 동일 — ASCII key)
  const mm = String(month).padStart(2, '0')
  const yy = String(year % 100).padStart(2, '0')
  const storagePath = `${year}/${mm}/blank_form_${yy}_${mm}_v6.xlsx`

  // 5. public URL 조립
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const publicUrl   = `${supabaseUrl}/storage/v1/object/public/diet-files/${storagePath}`

  // 6. 파일 취득
  const fileRes = await fetch(publicUrl)
  if (!fileRes.ok) {
    return NextResponse.json(
      { error: '아직 이번 달 양식이 준비되지 않았습니다' },
      { status: 404 },
    )
  }
  const buffer = await fileRes.arrayBuffer()

  // 7. 다운로드 이력 기록 (service_role) — 실패해도 다운로드는 진행
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (serviceKey && admin?.id) {
    try {
      const dbClient = createAdminClient(supabaseUrl, serviceKey)
      await dbClient.from('form_downloads').insert({
        admin_id:     admin.id,
        year,
        month,
        storage_path: storagePath,
      })
    } catch {
      // 이력 기록 실패는 무시 (다운로드 우선)
    }
  }

  // 8. 응답 (xlsx MIME + 한글 표시명)
  const filename = `키즈밀_식단표_${yy}_${mm}_v6.xlsx`
  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  })
}
