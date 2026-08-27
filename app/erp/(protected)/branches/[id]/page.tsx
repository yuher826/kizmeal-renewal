import { createClient } from '@/lib/supabase-server'
import { BRANCH_ACCOUNT_ROLES, BRANCH_PROFILE_EDIT_ROLES } from '@/lib/roles'
import BranchProfileDetailClient from './BranchProfileDetailClient'

interface Props {
  params: { id: string }
}

export default async function BranchProfileDetailPage({ params }: Props) {
  const supabase = createClient()

  let isSuperAdmin = false
  let canManageBranchAccount = false
  let canEditProfile = false
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    const { data: adminData } = await supabase
      .from('admins')
      .select('role')
      .eq('auth_id', user.id)
      .maybeSingle()
    isSuperAdmin = adminData?.role === 'super_admin'
    // 같은 조회 결과에서 함께 계산 — admins를 두 번 읽지 않는다
    canManageBranchAccount = BRANCH_ACCOUNT_ROLES.includes(adminData?.role ?? '')
    canEditProfile = BRANCH_PROFILE_EDIT_ROLES.includes(adminData?.role ?? '')
  }

  return (
    <BranchProfileDetailClient
      id={params.id}
      isSuperAdmin={isSuperAdmin}
      canManageBranchAccount={canManageBranchAccount}
      canEditProfile={canEditProfile}
    />
  )
}
