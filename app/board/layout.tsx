'use client'

export default function BoardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F0F4F0]">
      {children}
    </div>
  )
}
