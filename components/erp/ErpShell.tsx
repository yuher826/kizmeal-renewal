'use client'

import { useState } from 'react'
import ErpSidebar from './ErpSidebar'
import ErpHeader from './ErpHeader'
import type { ErpUser } from '@/types/erp'

interface Props {
  user: ErpUser
  children: React.ReactNode
}

export default function ErpShell({ user, children }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <ErpSidebar user={user} open={open} setOpen={setOpen} />
      <div className="flex-1 flex flex-col min-w-0">
        <ErpHeader user={user} onMenuClick={() => setOpen(true)} />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
