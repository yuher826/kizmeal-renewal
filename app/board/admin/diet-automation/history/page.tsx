import Link from 'next/link'

export default function DietHistoryPage() {
  return (
    <main className="min-h-screen bg-[#F6FAF6] flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl p-8 shadow-sm text-center max-w-sm w-full">
        <p className="text-4xl mb-4">📋</p>
        <h1 className="text-lg font-bold text-[#1C2B1E] mb-2">배포 이력</h1>
        <p className="text-sm text-gray-500 mb-6">
          배포 이력 기능은 배포 완료 후 제공됩니다.
        </p>
        <Link
          href="/board/admin/diet-automation"
          className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#2D6A4F] text-white text-sm font-semibold hover:bg-[#1B4332] transition-colors"
        >
          ← 식단표 자동화로 돌아가기
        </Link>
      </div>
    </main>
  )
}
