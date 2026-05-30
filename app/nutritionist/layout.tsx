import { redirect } from 'next/navigation'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export default async function NutritionistLayout({ children }: { children: React.ReactNode }) {
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
  if (!user) redirect('/board/login')

  // Must be a branch_member with nutritionist role
  const { data: member } = await supabase
    .from('branch_members')
    .select('id, role')
    .eq('auth_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (!member || member.role !== 'nutritionist') {
    redirect('/board/dashboard')
  }

  return <>{children}</>
}
