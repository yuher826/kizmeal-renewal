import { redirect } from 'next/navigation'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export default async function ParentPortalLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll() {},
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/parent/login')

  const { data: parent } = await supabase
    .from('parents')
    .select('status')
    .eq('auth_id', user.id)
    .maybeSingle()

  if (!parent) redirect('/parent/login')
  if (parent.status === 'pending') redirect('/parent/pending')
  if (parent.status === 'rejected') redirect('/parent/rejected')

  return <>{children}</>
}
