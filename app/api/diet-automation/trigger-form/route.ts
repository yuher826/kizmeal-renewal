import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { UPLOAD_ROLES } from '@/lib/roles'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: admin } = await supabase
    .from('admins').select('role').eq('auth_id', user.id).maybeSingle()

  if (!UPLOAD_ROLES.includes(admin?.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: { year: number; month: number }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '요청 형식 오류' }, { status: 400 })
  }

  const { year, month } = body
  if (!year || !month) {
    return NextResponse.json({ error: 'year, month 필드가 필요합니다.' }, { status: 400 })
  }

  // GitHub Actions workflow_dispatch 트리거
  const pat = process.env.GITHUB_PAT
  if (!pat) {
    return NextResponse.json(
      { error: 'GITHUB_PAT 환경변수가 설정되지 않았습니다.' },
      { status: 500 },
    )
  }

  const ghRes = await fetch(
    'https://api.github.com/repos/yuher826/kizmeal-renewal/actions/workflows/generate-form.yml/dispatches',
    {
      method: 'POST',
      headers: {
        Authorization:        `Bearer ${pat}`,
        Accept:               'application/vnd.github+json',
        'Content-Type':       'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({
        ref:    'master',
        inputs: { year: String(year), month: String(month) },
      }),
    },
  )

  if (!ghRes.ok) {
    const errText = await ghRes.text()
    return NextResponse.json(
      { error: `GitHub Actions 트리거 실패: ${errText}` },
      { status: 500 },
    )
  }

  return NextResponse.json({ success: true, message: '빈 폼 생성 시작' })
}
