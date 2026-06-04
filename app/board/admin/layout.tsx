import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import AdminMobileNav from '@/components/board/AdminMobileNav'
import AdminTabBar from '@/components/board/AdminTabBar'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/board/login')

  const { data: adminData } = await supabase
    .from('admins')
    .select('id')
    .eq('auth_id', user.id)
    .maybeSingle()

  if (!adminData) redirect('/board/login')

  return (
    <>
      <AdminMobileNav />
      <AdminTabBar />
      {children}
    </>
  )
}
