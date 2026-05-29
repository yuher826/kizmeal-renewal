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

  const isCustomerRoute =
    pathname.startsWith('/board/dashboard') ||
    pathname.startsWith('/board/inquiries') ||
    pathname.startsWith('/board/settings')
  const isAdminRoute = pathname.startsWith('/board/admin')
  const isLoginPage = pathname === '/board/login'

  // Redirect unauthenticated users to login
  if (!user && (isCustomerRoute || isAdminRoute)) {
    const url = request.nextUrl.clone()
    url.pathname = '/board/login'
    return NextResponse.redirect(url)
  }

  // Redirect authenticated users away from login
  if (user && isLoginPage) {
    const { data: adminData } = await supabase
      .from('admins')
      .select('id')
      .eq('auth_id', user.id)
      .maybeSingle()

    const url = request.nextUrl.clone()
    url.pathname = adminData ? '/board/admin' : '/board/dashboard'
    return NextResponse.redirect(url)
  }

  // Block non-admins from admin routes
  if (user && isAdminRoute) {
    const { data: adminData } = await supabase
      .from('admins')
      .select('id')
      .eq('auth_id', user.id)
      .maybeSingle()

    if (!adminData) {
      const url = request.nextUrl.clone()
      url.pathname = '/board/dashboard'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/board/:path*'],
}
