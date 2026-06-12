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

      <div className="mt-8 flex gap-3">
        <Link
          href="/erp/diet"
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors"
        >
          ERP 메인으로
        </Link>
        <Link
          href="/erp/branches"
          className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 px-6 py-2.5 rounded-lg text-sm transition-colors"
        >
          원 프로파일 목록으로
        </Link>
      </div>
    </div>
  )
}
