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
    .select('id, access_scope, is_active')
    .eq('auth_id', user.id)
    .maybeSingle()

  if (!adminData) redirect('/board/login')

  // 비활성 계정 차단
  if (adminData.is_active === false) redirect('/board/login')

  // ERP 전용 계정은 홈페이지관리 접근 불가 → ERP로 이동
  if (adminData.access_scope === 'erp_only') redirect('/erp/diet')

  return (
    <>
      <AdminMobileNav />
      <AdminTabBar />
      {children}
    </>
  )
}
