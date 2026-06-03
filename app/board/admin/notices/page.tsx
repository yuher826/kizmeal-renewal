'use client'

type Notice = {
  id: string
  title: string
  date: string
  target: string
  pinned: boolean
}

// 샘플 데이터 — 공지 테이블 연동은 추후
const SAMPLE: Notice[] = [
  { id: '1', title: '2026년 1학기 식자재 단가 안내', date: '2026-05-28', target: '전체 원', pinned: true },
  { id: '2', title: '여름철 식중독 예방 가이드 배포', date: '2026-05-20', target: '전체 원', pinned: false },
  { id: '3', title: '5월 신메뉴 레시피 업데이트', date: '2026-05-12', target: '유치원', pinned: false },
]

export default function AdminNoticesPage() {
  const pinned = SAMPLE.filter(n => n.pinned)
  const normal = SAMPLE.filter(n => !n.pinned)

  return (
    <div className="min-h-screen bg-[#F6FAF6] font-sans">
      <header className="bg-white border-b border-gray-100 px-4 sm:px-6 h-16 hidden sm:flex items-center justify-between sticky top-0 z-10">
        <div>
          <h1 className="font-bold text-[#1C2B1E] text-base">공지사항</h1>
          <p className="text-gray-400 text-xs">원에게 전달할 공지를 관리하세요</p>
        </div>
        <button
          type="button"
          className="bg-[#2D6A4F] hover:bg-[#1B4332] text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors inline-flex items-center gap-1.5"
        >
          <span>✏️</span> 공지 작성
        </button>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        {/* 고정 공지 */}
        {pinned.length > 0 && (
          <div className="space-y-3">
            {pinned.map(n => (
              <div key={n.id} className="bg-white rounded-2xl border-2 border-[#2D6A4F]/20 p-5 flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[11px] bg-[#2D6A4F] text-white font-bold px-2 py-0.5 rounded-full">📌 고정</span>
                    <span className="text-[11px] bg-[#E8F5E9] text-[#2D6A4F] font-medium px-2 py-0.5 rounded-full">{n.target}</span>
                  </div>
                  <h3 className="font-semibold text-[#1C2B1E] truncate">{n.title}</h3>
                  <p className="text-xs text-gray-400 mt-1">{n.date}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 일반 공지 */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[#F8FDF8]">
                  {['제목', '대상', '작성일', '고정'].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-bold text-gray-400 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {normal.map(n => (
                  <tr key={n.id} className="hover:bg-[#F8FDF8] transition-colors">
                    <td className="px-5 py-4 text-sm font-medium text-[#1C2B1E]">{n.title}</td>
                    <td className="px-5 py-4">
                      <span className="text-[11px] bg-[#E8F5E9] text-[#2D6A4F] font-medium px-2 py-0.5 rounded-full">{n.target}</span>
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-500">{n.date}</td>
                    <td className="px-5 py-4 text-sm text-gray-300">—</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 border-t border-gray-100">
            <p className="text-xs text-gray-400">공지 작성 및 저장 기능은 준비 중입니다</p>
          </div>
        </div>
      </div>
    </div>
  )
}
