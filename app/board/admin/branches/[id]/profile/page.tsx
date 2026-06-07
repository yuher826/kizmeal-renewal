'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
export default function BranchProfileRedirect({ params }: { params: { id: string } }) {
  const router = useRouter()
  useEffect(() => {
    router.replace(`/board/admin/diet/branch-profile/${params.id}`)
  }, [params.id, router])
  return null
}
