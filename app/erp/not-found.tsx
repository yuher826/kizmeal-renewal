import Link from 'next/link'

export default function ErpNotFound() {
  return (
    <div className="h-screen flex flex-col items-center justify-center bg-slate-50">
      <div className="flex items-center">
        <span className="text-emerald-700 font-bold text-xl">KIZMEAL</span>
        <span className="bg-emerald-100 text-emerald-700 text-xs rounded px-2 py-0.5 ml-2">ERP</span>
      </div>

      <p className="text-8xl font-bold text-slate-200 mt-8">404</p>

      <p className="text-xl font-semibold text-slate-700 mt-4">페이지를 찾을 수 없어요</p>
      <p className="text-sm text-slate-400 mt-2">요청하신 페이지가 존재하지 않거나 이동되었습니다.</p>

      <div className="mt-8">
        {/* /erp/branches 등 특정 역할 전용 경로는 director 등에서 죽은 링크가 되므로
            전 역할이 접근 가능한 /erp/my-page 하나만 남긴다. */}
        <Link
          href="/erp/my-page"
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors"
        >
          마이페이지로
        </Link>
      </div>
    </div>
  )
}
