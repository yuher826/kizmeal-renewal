'use client'

import { usePathname } from 'next/navigation'
import BoardSidebar from '@/components/board/BoardSidebar'

export default function BoardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  // 로그인/소통채널 랜딩은 사이드바 없이 전체 화면 유지
  const noSidebar = pathname === '/board/login' || pathname === '/board'

  if (noSidebar) {
    return <div className="min-h-screen bg-[#F0F4F0]">{children}</div>
  }

  return (
    <div className="min-h-screen bg-[#F0F4F0] lg:flex">
      <BoardSidebar />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )
}
