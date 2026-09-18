'use client'

import { useState } from 'react'
import ErpSidebar from './ErpSidebar'
import ErpHeader from './ErpHeader'
import { ErpUserProvider } from './ErpUserProvider'
import type { ErpUser } from '@/types/erp'
import SessionChangeGuard from '@/components/SessionChangeGuard'
import { ROUTES } from '@/lib/routes'

interface Props {
  user: ErpUser
  children: React.ReactNode
}

export default function ErpShell({ user, children }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <ErpUserProvider user={user}>
      {/* 로그인 계정이 바뀌면 전 화면을 덮는다(B-5). 헤더 폴링도 이 가드 상태로 멈춘다 */}
      <SessionChangeGuard expectedAuthId={user.auth_id} loginPath={ROUTES.ERP_LOGIN} tone="erp">
      <div className="flex h-screen bg-slate-50 overflow-hidden">
        <ErpSidebar user={user} open={open} setOpen={setOpen} />
        <div className="flex-1 flex flex-col min-w-0">
          <ErpHeader user={user} onMenuClick={() => setOpen(true)} />
          <main className="flex-1 overflow-y-auto p-6">
            {children}
          </main>
        </div>
      </div>
      </SessionChangeGuard>
    </ErpUserProvider>
  )
}
