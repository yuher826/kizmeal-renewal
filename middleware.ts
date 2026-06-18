import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

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
  const isParentPortal = pathname.startsWith('/parent/dashboard') ||
    pathname.startsWith('/parent/menu') ||
    pathname.startsWith('/parent/photos') ||
    pathname.startsWith('/parent/recipes') ||
    pathname.startsWith('/parent/mypage')
  const isParentLogin = pathname === '/parent/login'
  const isParentPublic = pathname.startsWith('/parent/pending') ||
    pathname.startsWith('/parent/rejected') ||
    pathname.startsWith('/parent/forgot-password') ||
    pathname.startsWith('/parent/reset-password') ||
    pathname.startsWith('/parent/register')

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
    url.pathname = adminData ? '/board/admin' : '/board/customer'
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
      url.pathname = '/board/customer'
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
    '/parent/login',
    '/parent/(dashboard|menu|photos|recipes|mypage)(.*)',
    '/nutritionist/(.*)',
    '/api/check-contract-expiry',
  ],
}
