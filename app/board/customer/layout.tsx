import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'

export default async function BoardCustomerLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/board/login')

  // 가맹점(원) 또는 가맹점 멤버만 접근 허용
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

  return <>{children}</>
}
