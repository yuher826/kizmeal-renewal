import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import ErpShell from '@/components/erp/ErpShell'
import type { ErpUser } from '@/types/erp'

export const metadata = { title: '키즈밀 ERP' }

export default async function ErpProtectedLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/erp/login')

  const { data: adminData } = await supabase
    .from('admins')
    .select('id, name, email, role, access_scope, is_active')
    .eq('auth_id', user.id)
    .maybeSingle()

  if (!adminData) redirect('/erp/login')

  // 비활성 계정 차단
  if (adminData.is_active === false) redirect('/erp/login')

  // 홈페이지관리 전용 계정은 ERP 접근 불가 → 홈페이지관리로 이동
  if (adminData.access_scope === 'board_only') redirect('/board/admin')

  const erpUser: ErpUser = {
    id: adminData.id,
    name: adminData.name,
    email: adminData.email,
    role: (adminData.role as ErpUser['role']) ?? 'admin',
  }

  return (
    <ErpShell user={erpUser}>
      {children}
    </ErpShell>
  )
}
