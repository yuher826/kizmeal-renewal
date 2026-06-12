import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '키즈밀 소통 관리시스템',
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
