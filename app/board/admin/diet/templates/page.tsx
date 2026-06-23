'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function DietTemplatesRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/erp/diet/templates') }, [router])
  return (
    <div className="min-h-screen bg-[#F6FAF6] flex items-center justify-center">
      <p className="text-gray-400 text-sm">이동 중...</p>
    </div>
  )
}
