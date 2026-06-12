import { createClient } from '@/lib/supabase-server'
import BranchProfileDetailClient from './BranchProfileDetailClient'

interface Props {
  params: { id: string }
}

export default async function BranchProfileDetailPage({ params }: Props) {
  const supabase = createClient()

  let isSuperAdmin = false
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    const { data: adminData } = await supabase
      .from('admins')
      .select('role')
      .eq('auth_id', user.id)
      .maybeSingle()
    isSuperAdmin = adminData?.role === 'super_admin'
  }

  return <BranchProfileDetailClient id={params.id} isSuperAdmin={isSuperAdmin} />
}
