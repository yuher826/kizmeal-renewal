import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { DEPLOY_ROLES, EMERGENCY_DEPLOY_ROLES } from '@/lib/roles'
import { filterEligibleBranches } from '@/lib/pptx-eligibility'

export const maxDuration = 60

const FROM               = '키즈밀 급식 <meal@kizmeal.com>'
const DEPLOY_CHUNK_SIZE     = 5
const DEPLOY_CHUNK_DELAY_MS = 1000
const EMAIL_REGEX           = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type BranchProfile = {
  id:                  string
  short_code:          string
  display_name:        string | null
  distribution_email:  string | null
  distribution_emails: string[] | null
  diet_type:           string | null
  review_required:     boolean | null
  file_format:         string | null
  direct_delivery:     boolean | null
  contract_type:       string | null
}

type ReviewItemRow = {
  id:           string
  branch_id:    string | null
  branch_name:  string
  pptx_url:     string | null
  jpg_url:      string | null
  review_status: string
  memo_history:  unknown[]
}

type DownloadButton = { label: string; url: string }

function buildDietEmailHtml(
  branchName:  string,
  year:        number,
  month:       number,
  buttons:     DownloadButton[],
  testBanner?: string,
): string {
  const testBannerHtml = testBanner
    ? `<div style="background:#FEF3C7;border:1px solid #F59E0B;border-radius:8px;padding:12px 16px;margin-bottom:20px;text-align:left;">
        <p style="color:#92400E;font-size:13px;font-weight:bold;margin:0 0 4px;">⚠️ 테스트 발송입니다.</p>
        <p style="color:#92400E;font-size:12px;margin:0;">실제 수신자: ${testBanner}</p>
      </div>`
    : ''

  const buttonsHtml = buttons.map(b =>
    `<a href="${b.url}" style="display:inline-block;background:#1565C0;color:white;text-decoration:none;font-size:15px;font-weight:bold;padding:14px 40px;border-radius:14px;margin-bottom:12px;">${b.label}</a>`
  ).join('<br>')

  return `
<div style="font-family:'Apple SD Gothic Neo',Malgun Gothic,sans-serif;max-width:520px;margin:0 auto;background:#F6FAF6;padding:24px 16px;">
  <div style="background:white;border-radius:24px;padding:40px 32px;text-align:center;">
    <div style="width:64px;height:64px;background:linear-gradient(135deg,#2D6A4F,#52B788);border-radius:18px;display:inline-flex;align-items:center;justify-content:center;margin-bottom:20px;">
      <span style="color:white;font-size:28px;font-weight:bold;">K</span>
    </div>
    <h1 style="color:#1C2B1E;font-size:20px;font-weight:bold;margin:0 0 8px;">
      ${year}년 ${month}월 식단표가 도착했습니다 🥗
    </h1>
    ${testBannerHtml}
    <p style="color:#6B7280;font-size:14px;line-height:1.7;margin:0 0 24px;">
      안녕하세요, <strong>${branchName}</strong> 담당자님!<br>
      ${year}년 ${month}월 식단표를 아래 버튼에서 다운로드해 주세요.
    </p>
    ${buttonsHtml}
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

  let body: { year?: number; month?: number; branch_ids?: string[]; is_emergency?: boolean }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: '요청 형식 오류' }, { status: 400 })
  }

  const { year, month, branch_ids, is_emergency } = body
  if (!year || !month) {
    return NextResponse.json({ error: 'year, month 필드가 필요합니다.' }, { status: 400 })
  }

  const { data: adminRow } = await supabase
    .from('admins')
    .select('id, name, role')
    .eq('auth_id', user.id)
    .maybeSingle()

  const allowedRoles = is_emergency === true
    ? EMERGENCY_DEPLOY_ROLES
    : DEPLOY_ROLES
  if (!allowedRoles.includes(adminRow?.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const db = serviceKey ? createAdminClient(supabaseUrl, serviceKey) : supabase

  const isTestMode = process.env.EMAIL_TEST_MODE === 'true'
  const testEmail  = process.env.TEST_EMAIL || 'yuher@kizmeal.com'

  // weekly_menus 조회 (branch_id IS NULL 조건 제거 — 원별 메뉴도 커버)
  const { data: menuRows } = await db
    .from('weekly_menus')
    .select('id, status')
    .eq('year', year).eq('month', month).eq('diet_type', 'CK')

  const menuIds = (menuRows ?? []).map(r => r.id)
  if (!menuIds.length) {
    return NextResponse.json({ error: '식단 데이터를 찾을 수 없습니다.' }, { status: 404 })
  }

  // diet_review_items 조회 (branch_id 직접 필터)
  let itemsQuery = db
    .from('diet_review_items')
    .select('id, branch_id, branch_name, pptx_url, jpg_url, review_status, memo_history')
    .in('weekly_menu_id', menuIds)

  if (branch_ids && branch_ids.length > 0) {
    itemsQuery = itemsQuery.in('branch_id', branch_ids)
  }

  const { data: reviewItems } = await itemsQuery
  const allItems = (reviewItems ?? []) as ReviewItemRow[]

  if (!allItems.length) {
    return NextResponse.json({ error: '배포할 항목이 없습니다.' }, { status: 400 })
  }

  // branch_profiles 조회 (file_format, contract_type 포함)
  const branchIds = allItems.map(i => i.branch_id).filter(Boolean) as string[]
  const { data: profiles } = await db
    .from('branch_profiles')
    .select('id, short_code, display_name, distribution_email, distribution_emails, diet_type, review_required, file_format, direct_delivery, contract_type')
    .in('id', branchIds)

  // 임시원(contract_type='temporary') 코드 레벨 제외.
  // filterEligibleBranches 는 자격 0개면 throw 하는데, 이 라우트엔 최상위 try/catch 가
  // 없어(throw 시 프로덕션에서 "Internal Server Error"만 노출) 여기서 직접 잡아
  // 한글 400 으로 변환한다. 배포는 선택 배포라 대상이 정상적으로 0개일 수 있으므로
  // 500 이 아니라 400 이 맞다.
  let excludedIds: Set<string>
  try {
    const eligible    = filterEligibleBranches(profiles ?? [])
    const eligibleIds = new Set(eligible.map(p => p.id))
    excludedIds = new Set(
      (profiles ?? []).filter(p => !eligibleIds.has(p.id)).map(p => p.id),
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn('[deploy] 배포 자격 필터:', msg)
    return NextResponse.json(
      { error: '배포 가능한 원이 없습니다. (임시 계약 원만 선택되었을 수 있습니다)' },
      { status: 400 },
    )
  }

  const profileMap = new Map<string, BranchProfile>(
    (profiles ?? []).map((p: BranchProfile) => [p.id, p])
  )

  // 임시원에 해당하는 배포 항목을 배포 대상에서 제외
  const deployItems = allItems.filter(it => !(it.branch_id && excludedIds.has(it.branch_id)))

  const resend = new Resend(process.env.RESEND_API_KEY)
  const now    = new Date().toISOString()

  const success: { id: string; branch_name: string }[] = []
  const failed:  string[] = []
  const skipped: string[] = []

  for (let i = 0; i < deployItems.length; i += DEPLOY_CHUNK_SIZE) {
    const chunk = deployItems.slice(i, i + DEPLOY_CHUNK_SIZE)
    await Promise.all(chunk.map(async (item) => {
      const profile = item.branch_id ? profileMap.get(item.branch_id) : undefined

      // 이미 배포 완료된 원 스킵
      if (item.review_status === 'deployed') {
        console.log(`[deploy] 스킵 (이미 배포됨): ${item.branch_name}`)
        skipped.push(item.branch_name)
        return
      }

      // 배포 가능 조건 체크
      const isCk                     = profile?.diet_type === 'ck' || profile?.diet_type == null
      const reviewRequired           = profile?.review_required ?? false
      const canDeployWithoutApproval = !isCk && !reviewRequired

      if (is_emergency !== true && !canDeployWithoutApproval && item.review_status !== 'approved') {
        failed.push(item.branch_name)
        return
      }

      // 파일형식별 다운로드 버튼 구성
      // diet_review_items에 pdf_url 컬럼 없음 → PDF 형식은 pptx_url로 대체
      const fileFormat = (profile?.file_format ?? 'PPTX').toUpperCase()
      const buttons: DownloadButton[] = []

      if (fileFormat === 'JPG') {
        if (item.jpg_url) buttons.push({ label: '🖼️ 식단표 JPG 다운로드', url: item.jpg_url })
      } else if (fileFormat === 'PDF') {
        if (item.pptx_url) buttons.push({ label: '📄 식단표 PDF 다운로드', url: item.pptx_url })
      } else if (fileFormat === 'PDF+JPG') {
        if (item.pptx_url) buttons.push({ label: '📄 식단표 PDF 다운로드', url: item.pptx_url })
        if (item.jpg_url)  buttons.push({ label: '🖼️ 식단표 JPG 다운로드', url: item.jpg_url })
      } else {
        if (item.pptx_url) buttons.push({ label: '📊 식단표 PPTX 다운로드', url: item.pptx_url })
      }

      if (!buttons.length) {
        failed.push(item.branch_name)
        return
      }

      const emails: string[] = []
      if (
        profile?.distribution_email &&
        EMAIL_REGEX.test(profile.distribution_email) &&
        !emails.includes(profile.distribution_email)
      ) emails.push(profile.distribution_email)
      if (profile?.distribution_emails?.length) {
        for (const e of profile.distribution_emails) {
          if (e && EMAIL_REGEX.test(e) && !emails.includes(e)) emails.push(e)
        }
      }

      if (!emails.length) {
        if (profile?.direct_delivery) {
          skipped.push(item.branch_name)
          console.log(`[deploy] 직접전달 원 스킵: ${item.branch_name}`)
        } else {
          failed.push(item.branch_name)
        }
        return
      }

      const displayName = profile?.display_name || item.branch_name

      // 테스트모드: 수신자 교체 + 배너 추가
      const testBanner = isTestMode ? emails.join(', ') : undefined
      const subjectPfx = isTestMode ? '[TEST] ' : ''

      if (isTestMode) {
        console.log(`[테스트모드] ${item.branch_name} → ${emails.join(', ')} 대신 ${testEmail}로 발송`)
      }

      try {
        await resend.emails.send({
          from:    FROM,
          to:      isTestMode ? [testEmail] : [emails[0]],
          bcc:     !isTestMode && emails.length > 1 ? emails.slice(1) : undefined,
          subject: `${subjectPfx}[키즈밀] ${year}년 ${month}월 식단표가 도착했습니다 🥗`,
          html:    buildDietEmailHtml(displayName, year, month, buttons, testBanner),
        })

        const history = [
          ...(Array.isArray(item.memo_history) ? item.memo_history : []),
          {
            by:     adminRow!.name ?? user.email ?? adminRow!.id,
            role:   adminRow!.role,
            action: 'deployed',
            memo:   is_emergency === true
              ? '비상배포 완료'
              : (isTestMode ? '이메일 배포 완료 (테스트모드)' : '이메일 배포 완료'),
            at:     now,
          },
        ]

        await db.from('diet_review_items').update({
          review_status: 'deployed',
          deployed_by:   adminRow!.id,
          deployed_at:   now,
          memo_history:  history,
          updated_at:    now,
        }).eq('id', item.id)

        success.push({ id: item.id, branch_name: item.branch_name })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`[deploy] 발송 실패 - ${item.branch_name}:`, msg)
        failed.push(item.branch_name)
      }
    }))
    if (i + DEPLOY_CHUNK_SIZE < deployItems.length) {
      await new Promise<void>(r => setTimeout(r, DEPLOY_CHUNK_DELAY_MS))
    }
  }

  // 배포 성공한 원의 weekly_menus branch 행 → 'deployed' (부분/전체 공통)
  if (success.length > 0) {
    const successBranchIds = success
      .map(s => allItems.find(i => i.id === s.id)?.branch_id)
      .filter((id): id is string => !!id)
    console.log('[deploy] weekly_menus UPDATE 파라미터:', { year, month, successBranchIds })
    if (successBranchIds.length > 0) {
      const { data: updatedMenus, error: wm1Error } = await db
        .from('weekly_menus')
        .update({
          status: 'deployed',
          deployed_at: now,
          deployed_by: adminRow!.id,
        })
        .eq('year', year)
        .eq('month', month)
        .in('branch_id', successBranchIds)
        .select('id')

      if (wm1Error) {
        console.error('[deploy] weekly_menus 개별 업데이트 실패:', JSON.stringify(wm1Error))
      } else {
        console.log(`[deploy] weekly_menus ${updatedMenus?.length ?? 0}건 deployed 처리됨`)
      }
    }
  }

  // 전체 배포 시 공통 row (branch_id IS NULL 포함) 전체 업데이트
  if (!branch_ids || branch_ids.length === 0) {
    const { data: updatedAll, error: wm2Error } = await db
      .from('weekly_menus')
      .update({
        status: 'deployed',
        deployed_at: now,
        deployed_by: adminRow!.id,
      })
      .in('id', menuIds)
      .select('id')

    if (wm2Error) {
      console.error('[deploy] weekly_menus 전체 업데이트 실패:', JSON.stringify(wm2Error))
    } else {
      console.log(`[deploy] weekly_menus 전체 ${updatedAll?.length ?? 0}건 deployed 처리됨`)
    }
  }

  // 배포 완료 알림
  if (success.length > 0) {
    const branchList = success.slice(0, 3).map(s => s.branch_name).join(', ') + (success.length > 3 ? ` 외 ${success.length - 3}개원` : '')
    await db.from('diet_notifications').insert({
      type:           'deployed_complete',
      title:          `${year}년 ${month}월 식단표 배포 완료`,
      message:        `${branchList} 배포가 완료되었습니다. (총 ${success.length}개원)`,
      recipient_role: 'manager',
      weekly_menu_id: menuIds[0] ?? null,
      year,
      month,
    })
  }

  return NextResponse.json({
    success: failed.length === 0,
    sent:    success.length,
    failed:  failed.length,
    skipped: skipped.length,
    results: { success, failed, skipped },
  })
}
