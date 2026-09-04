import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { landingPathFor } from '@/lib/erp-access'
import { ROUTES } from '@/lib/routes'

export default async function ErpPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect(ROUTES.ERP_LOGIN)

  const { data: adminData } = await supabase
    .from('admins')
    .select('role, can_manage_templates')
    .eq('auth_id', user.id)
    .maybeSingle()

  if (!adminData) redirect(ROUTES.ERP_LOGIN)

  redirect(landingPathFor(adminData))
}
