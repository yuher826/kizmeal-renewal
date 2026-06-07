'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function DietProfileRedirect({ params }: { params: { branchId: string } }) {
  const router = useRouter()
  useEffect(() => {
    router.replace(`/board/admin/diet/branch-profile/${params.branchId}`)
  }, [params.branchId, router])
  return null
}
