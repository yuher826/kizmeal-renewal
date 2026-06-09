import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

export const maxDuration = 60

const FROM = 'onboarding@resend.dev'

type GenResult = {
  branch_name: string
  pdf_url:     string
  pptx_url:    string
  status:      string
}

type BranchProfile = {
  short_code:          string
  display_name:        string | null
  distribution_email:  string | null
  distribution_emails: string[] | null
}

function buildDietEmailHtml(
  branchName: string,
  year:       number,
  month:      number,
  pdfUrl:     string,
  pptxUrl?:   string,
): string {
  return `
<div style="font-family:'Apple SD Gothic Neo',Malgun Gothic,sans-serif;max-width:520px;margin:0 auto;background:#F6FAF6;padding:24px 16px;">
  <div style="background:white;border-radius:24px;padding:40px 32px;text-align:center;">
    <div style="width:64px;height:64px;background:linear-gradient(135deg,#2D6A4F,#52B788);border-radius:18px;display:inline-flex;align-items:center;justify-content:center;margin-bottom:20px;">
      <span style="color:white;font-size:28px;font-weight:bold;">K</span>
    </div>
    <h1 style="color:#1C2B1E;font-size:20px;font-weight:bold;margin:0 0 8px;">
      ${year}년 ${month}월 식단표가 도착했습니다 🥗
    </h1>
    <p style="color:#6B7280;font-size:14px;line-height:1.7;margin:0 0 24px;">
      안녕하세요, <strong>${branchName}</strong> 담당자님!<br>
      ${year}년 ${month}월 식단표를 아래 버튼에서 다운로드해 주세요.
    </p>
    <a
      href="${pdfUrl}"
      style="display:inline-block;background:#2D6A4F;color:white;text-decoration:none;font-size:15px;font-weight:bold;padding:14px 40px;border-radius:14px;margin-bottom:12px;"
    >
      📄 식단표 PDF 다운로드
    </a>
    ${pptxUrl ? `
    <br>
    <a
      href="${pptxUrl}"
      style="display:inline-block;background:#E3F2FD;color:#1565C0;text-decoration:none;font-size:14px;font-weight:bold;padding:12px 32px;border-radius:12px;margin-top:8px;"
    >
      📊 PPTX 파일 다운로드
    </a>` : ''}
    <p style="color:#9CA3AF;font-size:12px;margin:24px 0 0;line-height:1.6;">
      파일은 Supabase Storage에 안전하게 보관됩니다.<br>
      문의사항은 키즈밀 관리팀으로 연락해주세요.
    </p>
  </div>
  <p style="text-align:center;color:#9CA3AF;font-size:11px;margin-top:16px;">키즈밀 · 건강한 급식 솔루션</p>
</div>`
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: adminRow } = await supabase
    .from('admins').select('id, role').eq('auth_id', user.id).maybeSingle()

  if (!['super_admin', 'manager'].includes(adminRow?.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: { year?: number; month?: number }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: '요청 형식 오류' }, { status: 400 })
  }

  const { year, month } = body
  if (!year || !month) {
    return NextResponse.json({ error: 'year, month 필드가 필요합니다.' }, { status: 400 })
  }

  const serviceKey   = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const dbClient     = serviceKey ? createAdminClient(supabaseUrl, serviceKey) : supabase

  // weekly_menus 조회
  const { data: menuRow } = await dbClient
    .from('weekly_menus')
    .select('id, status, generation_results')
    .eq('year', year).eq('month', month).eq('diet_type', 'CK').is('branch_id', null)
    .maybeSingle()

  if (!menuRow) {
    return NextResponse.json({ error: '식단 데이터를 찾을 수 없습니다.' }, { status: 404 })
  }

  const allowedStatuses = ['generated', 'review_requested', 'approved']
  if (!allowedStatuses.includes(menuRow.status)) {
    return NextResponse.json(
      { error: `배포 불가 상태입니다. (현재: ${menuRow.status})` },
      { status: 400 },
    )
  }

  const genResults = menuRow.generation_results as { results?: GenResult[] } | null
  const successResults = (genResults?.results ?? []).filter(r => r.status === 'success' && r.pdf_url)

  if (!successResults.length) {
    return NextResponse.json({ error: 'PDF URL이 있는 성공 결과가 없습니다.' }, { status: 400 })
  }

  // branch_profiles 일괄 조회
  const { data: profiles } = await dbClient
    .from('branch_profiles')
    .select('short_code, display_name, distribution_email, distribution_emails')
    .eq('contract_status', 'active')

  const profileMap = new Map<string, BranchProfile>(
    (profiles ?? []).map((p: BranchProfile) => [p.short_code, p]),
  )

  const resend = new Resend(process.env.RESEND_API_KEY)

  type SendResult = { branch_name: string; emails: string[]; success: boolean; error?: string }
  const sendResults: SendResult[] = []

  await Promise.all(
    successResults.map(async result => {
      const profile = profileMap.get(result.branch_name)
      const emails: string[] = []
      if (profile?.distribution_email)      emails.push(profile.distribution_email)
      if (profile?.distribution_emails?.length) {
        for (const e of profile.distribution_emails) {
          if (e && !emails.includes(e)) emails.push(e)
        }
      }

      if (!emails.length) {
        sendResults.push({ branch_name: result.branch_name, emails: [], success: false, error: '배포 이메일 미등록' })
        return
      }

      const displayName = profile?.display_name || result.branch_name

      try {
        await resend.emails.send({
          from:    FROM,
          to:      emails,
          subject: `[키즈밀] ${year}년 ${month}월 식단표가 도착했습니다 🥗`,
          html:    buildDietEmailHtml(displayName, year, month, result.pdf_url, result.pptx_url),
        })
        sendResults.push({ branch_name: result.branch_name, emails, success: true })
      } catch (err) {
        sendResults.push({ branch_name: result.branch_name, emails, success: false, error: String(err) })
      }
    }),
  )

  const sent   = sendResults.filter(r => r.success).length
  const failed = sendResults.filter(r => !r.success).length

  // weekly_menus status → 'deployed'
  await dbClient.from('weekly_menus').update({
    status:      'deployed',
    deployed_at: new Date().toISOString(),
    deployed_by: adminRow!.id,
  }).eq('id', menuRow.id)

  // 배포 완료 알림
  await dbClient.from('diet_notifications').insert({
    type:           'deploy_complete',
    title:          `${year}년 ${month}월 식단표 배포 완료`,
    message:        `${sent}개원 이메일 발송 완료${failed > 0 ? ` (실패 ${failed}개)` : ''}`,
    recipient_role: 'super_admin',
    weekly_menu_id: menuRow.id,
    year,
    month,
  })

  return NextResponse.json({ success: failed === 0, sent, failed, results: sendResults })
}
