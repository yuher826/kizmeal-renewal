'use client'

import { usePathname } from 'next/navigation'

export default function ConditionalNav({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  if (pathname.startsWith('/erp') || pathname.startsWith('/board') || pathname.startsWith('/parent')) return null
  return <>{children}</>
}
