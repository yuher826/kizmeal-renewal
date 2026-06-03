import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import CustomerMobileNav from '@/components/board/CustomerMobileNav'

export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/board/login')

  // Must be a branch user (master or member), not just any authenticated user
  const { data: branchData } = await supabase
    .from('branches')
    .select('id')
    .eq('auth_id', user.id)
    .maybeSingle()

  if (!branchData) {
    const { data: memberData } = await supabase
      .from('branch_members')
      .select('id')
      .eq('auth_id', user.id)
      .maybeSingle()

    if (!memberData) redirect('/board/login')
  }

  return (
    <>
      <CustomerMobileNav />
      {children}
    </>
  )
}
