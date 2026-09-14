'use client'

import { createContext, useContext } from 'react'

/**
 * 홈페이지관리(board admin) 페이지 접근 판정에 필요한 admin 최소 형태.
 * app/board/admin/layout.tsx가 이미 조회해둔 adminData를 그대로 담는다 —
 * 추가 쿼리 없음. components/erp/ErpUserProvider.tsx와 같은 구조.
 */
export type BoardAdminUser = {
  id: string
  role: string
  access_scope: string | null
  is_active: boolean | null
  can_manage_templates?: boolean | null
  can_handle_cs?: boolean | null
  can_write_notices?: boolean | null
}

const BoardAdminUserContext = createContext<BoardAdminUser | null>(null)

export function BoardAdminUserProvider({ user, children }: { user: BoardAdminUser; children: React.ReactNode }) {
  return <BoardAdminUserContext.Provider value={user}>{children}</BoardAdminUserContext.Provider>
}

/**
 * 컨텍스트가 없으면 조용히 null을 반환하지 않고 throw 한다.
 * 조용히 넘기면 BoardAdminUserProvider 밖에서 쓴 실수가 "권한 없음"으로
 * 둔갑해 디버깅이 어려워진다.
 */
export function useBoardAdminUser(): BoardAdminUser {
  const ctx = useContext(BoardAdminUserContext)
  if (!ctx) throw new Error('useBoardAdminUser는 BoardAdminUserProvider 안에서만 쓸 수 있다')
  return ctx
}
