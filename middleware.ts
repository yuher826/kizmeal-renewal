import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { ROUTES } from '@/lib/routes'
import { canAccessErpPage, landingPathFor } from '@/lib/erp-access'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Board routes
  const isCustomerRoute =
    pathname.startsWith('/board/dashboard') ||
    pathname.startsWith('/board/inquiries') ||
    pathname.startsWith('/board/settings') ||
    pathname.startsWith('/board/notifications') ||
    pathname.startsWith('/board/customer')
  const isAdminRoute = pathname.startsWith('/board/admin')
  const isBoardLogin = pathname === '/board/login'
  const isChangePassword = pathname === '/board/change-password'

  // ERP routes
  const isErpLogin     = pathname === '/erp/login'
  const isErpProtected = pathname.startsWith('/erp') && !isErpLogin

  // Parent portal routes
  const isParentLogin = pathname === '/parent/login'
  const isParentPublic = pathname.startsWith('/parent/pending') ||
    pathname.startsWith('/parent/rejected') ||
    pathname.startsWith('/parent/forgot-password') ||
    pathname.startsWith('/parent/reset-password') ||
    pathname.startsWith('/parent/register')
  // 열거식 금지 — 공개 경로(위 5개 + 로그인)만 명시적으로 제외하고,
  // 그 외 /parent/* 전부를 기본적으로 "보호 대상"으로 취급한다.
  // (portal) 그룹 아래 새 페이지가 추가돼도 자동으로 보호되어 이번 같은 누락이 재발하지 않는다.
  const isParentPortal =
    pathname.startsWith('/parent/') && !isParentLogin && !isParentPublic

  // Nutritionist routes
  const isNutritionistRoute = pathname.startsWith('/nutritionist/dashboard') ||
    pathname.startsWith('/nutritionist/upload')

  // ── Board auth ──────────────────────────────────────────────
  if (!user && (isCustomerRoute || isAdminRoute || isChangePassword)) {
    const url = request.nextUrl.clone()
    url.pathname = '/board/login'
    return NextResponse.redirect(url)
  }

  // ── ERP auth (미인증 → /erp/login?next=) ─────────────────────
  if (!user && isErpProtected) {
    const redirectUrl = new URL('/erp/login', request.url)
    redirectUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(redirectUrl)
  }

  // ── ERP 역할 가드 (1층 매트릭스) ───────────────────────────────
  // is_active / access_scope 판정은 넣지 않는다 — layout이 이미 한다.
  // admin row가 없으면 통과시킨다 — layout이 /erp/login으로 처리한다.
  if (user && isErpProtected) {
    const { data: adminData } = await supabase
      .from('admins')
      .select('role, can_manage_templates')
      .eq('auth_id', user.id)
      .maybeSingle()

    if (adminData && !canAccessErpPage(adminData, pathname)) {
      const url = request.nextUrl.clone()
      url.pathname = landingPathFor(adminData)
      url.search = ''
      url.searchParams.set('denied', pathname)
      return NextResponse.redirect(url)
    }
  }

  // must_change_password 체크 (고객 라우트에서만)
  if (user && isCustomerRoute) {
    const { data: branchData } = await supabase
      .from('branches')
      .select('must_change_password')
      .eq('auth_id', user.id)
      .maybeSingle()

    if (branchData?.must_change_password) {
      const url = request.nextUrl.clone()
      url.pathname = '/board/change-password'
      return NextResponse.redirect(url)
    }
  }

  if (user && isBoardLogin) {
    const { data: adminData } = await supabase
      .from('admins')
      .select('id')
      .eq('auth_id', user.id)
      .maybeSingle()

    const url = request.nextUrl.clone()
    url.pathname = adminData ? ROUTES.BOARD_ADMIN_HOME : ROUTES.BOARD_CUSTOMER_HOME
    return NextResponse.redirect(url)
  }

  if (user && isAdminRoute) {
    const { data: adminData } = await supabase
      .from('admins')
      .select('id')
      .eq('auth_id', user.id)
      .maybeSingle()

    if (!adminData) {
      const url = request.nextUrl.clone()
      url.pathname = ROUTES.BOARD_CUSTOMER_HOME
      return NextResponse.redirect(url)
    }
  }

  // ── Parent portal auth ──────────────────────────────────────
  if (!user && isParentPortal) {
    const url = request.nextUrl.clone()
    url.pathname = '/parent/login'
    return NextResponse.redirect(url)
  }

  if (user && isParentLogin) {
    const { data: parent } = await supabase
      .from('parents')
      .select('status')
      .eq('auth_id', user.id)
      .maybeSingle()

    const url = request.nextUrl.clone()
    if (!parent) {
      return supabaseResponse
    } else if (parent.status === 'approved') {
      url.pathname = '/parent/dashboard'
    } else if (parent.status === 'pending') {
      url.pathname = '/parent/pending'
    } else {
      url.pathname = '/parent/rejected'
    }
    return NextResponse.redirect(url)
  }

  // ── Nutritionist auth ───────────────────────────────────────
  if (!user && isNutritionistRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/board/login'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/board/(.*)',
    '/erp/(.*)',
    '/parent/(.*)',
    '/nutritionist/(.*)',
    '/api/check-contract-expiry',
  ],
}
