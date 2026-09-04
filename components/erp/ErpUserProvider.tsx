'use client'

import { createContext, useContext } from 'react'
import type { ErpUser } from '@/types/erp'

const ErpUserContext = createContext<ErpUser | null>(null)

export function ErpUserProvider({ user, children }: { user: ErpUser; children: React.ReactNode }) {
  return <ErpUserContext.Provider value={user}>{children}</ErpUserContext.Provider>
}

/**
 * 컨텍스트가 없으면 조용히 null을 반환하지 않고 throw 한다.
 * 조용히 넘기면 ErpUserProvider 밖에서 쓴 실수가 "권한 없음"으로
 * 둔갑해 디버깅이 어려워진다.
 */
export function useErpUser(): ErpUser {
  const ctx = useContext(ErpUserContext)
  if (!ctx) throw new Error('useErpUser는 ErpUserProvider 안에서만 쓸 수 있다')
  return ctx
}
