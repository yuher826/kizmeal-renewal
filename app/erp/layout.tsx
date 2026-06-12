import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import ErpShell from '@/components/erp/ErpShell'
import type { ErpUser } from '@/types/erp'

export default async function ErpLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/board/login')

  const { data: adminData } = await supabase
    .from('admins')
    .select('id, name, email, role')
    .eq('auth_id', user.id)
    .maybeSingle()

  if (!adminData) redirect('/board/login')

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
