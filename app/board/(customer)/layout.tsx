import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import CustomerMobileNav from '@/components/board/CustomerMobileNav'
import CustomerPopupNotice from '@/components/board/CustomerPopupNotice'
import SessionChangeGuard from '@/components/SessionChangeGuard'
import { ROUTES } from '@/lib/routes'

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

  // 로그인 계정이 바뀌면 전 화면을 덮는다(B-5) — 이 레이아웃의 원 확인은 서버 첫 렌더에서
  // 한 번만 돌아, 이미 열린 탭이 다른 탭 로그인으로 세션이 바뀐 것을 모른다
  return (
    <SessionChangeGuard expectedAuthId={user.id} loginPath={ROUTES.BOARD_LOGIN} tone="board">
      <CustomerPopupNotice />
      <CustomerMobileNav />
      {children}
    </SessionChangeGuard>
  )
}
