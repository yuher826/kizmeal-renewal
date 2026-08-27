import Link from 'next/link'
import { createClient } from '@/lib/supabase-server'
import { BRANCH_PROFILE_CREATE_ROLES } from '@/lib/roles'
import NewBranchProfileClient from './NewBranchProfileClient'

export default async function BranchProfileNewPage() {
  const supabase = createClient()

  let canCreate = false
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    const { data: adminData } = await supabase
      .from('admins')
      .select('role')
      .eq('auth_id', user.id)
      .maybeSingle()
    canCreate = BRANCH_PROFILE_CREATE_ROLES.includes(adminData?.role ?? '')
  }

  // 등록 화면은 상세와 달리 조회할 내용이 없다 — 빈 폼을 띄워봐야 의미가
  // 없으므로 상세 화면(disabled + 안내)과 달리 여기는 아예 숨긴다.
  if (!canCreate) {
    return (
      <main className="min-h-screen bg-[#F6FAF6] px-4 sm:px-6 py-6 sm:py-8">
        <div className="text-center py-20">
          <p className="text-slate-500 mb-4">원 등록 권한이 없습니다.</p>
          <Link href="/erp/branches" className="text-emerald-600 hover:underline text-sm">
            ← 목록으로 돌아가기
          </Link>
        </div>
      </main>
    )
  }

  return <NewBranchProfileClient />
}
