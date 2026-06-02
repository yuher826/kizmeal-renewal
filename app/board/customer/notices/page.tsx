'use client'

type Notice = {
  id: string
  title: string
  date: string
  pinned: boolean
  read: boolean
}

// 샘플 데이터 — 공지 테이블 연동은 추후
const SAMPLE: Notice[] = [
  { id: '1', title: '2026년 1학기 식자재 단가 안내', date: '2026-05-28', pinned: true, read: false },
  { id: '2', title: '여름철 식중독 예방 가이드 배포', date: '2026-05-20', pinned: false, read: false },
  { id: '3', title: '5월 신메뉴 레시피 업데이트', date: '2026-05-12', pinned: false, read: true },
]

function NoticeRow({ n }: { n: Notice }) {
  return (
    <div className={`p-5 flex items-start justify-between gap-4 ${n.read ? 'opacity-70' : ''}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          {n.pinned && <span className="text-[11px] bg-[#2D6A4F] text-white font-bold px-2 py-0.5 rounded-full">📌 고정</span>}
          {!n.read && <span className="w-2 h-2 rounded-full bg-[#F4A261] inline-block" />}
        </div>
        <h3 className={`truncate ${n.read ? 'font-medium text-gray-500' : 'font-semibold text-[#1C2B1E]'}`}>{n.title}</h3>
        <p className="text-xs text-gray-400 mt-1">{n.date}</p>
      </div>
      <span className={`text-[11px] font-medium px-2 py-1 rounded-full flex-shrink-0 ${
        n.read ? 'bg-gray-100 text-gray-400' : 'bg-[#FFF4E6] text-[#F4A261]'
      }`}>
        {n.read ? '읽음' : '안읽음'}
      </span>
    </div>
  )
}

export default function CustomerNoticesPage() {
  const pinned = SAMPLE.filter(n => n.pinned)
  const normal = SAMPLE.filter(n => !n.pinned)

  return (
    <div className="min-h-screen bg-[#F6FAF6] font-sans">
      <header className="bg-white border-b border-gray-100 px-4 sm:px-6 h-16 flex items-center sticky top-0 z-10">
        <div>
          <h1 className="font-bold text-[#1C2B1E] text-base">공지사항</h1>
          <p className="text-gray-400 text-xs">키즈밀 본사 공지를 확인하세요</p>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        {/* 고정 공지 */}
        {pinned.length > 0 && (
          <div className="space-y-3">
            {pinned.map(n => (
              <div key={n.id} className="bg-white rounded-2xl border-2 border-[#2D6A4F]/20">
                <NoticeRow n={n} />
              </div>
            ))}
          </div>
        )}

        {/* 일반 공지 */}
        <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50 overflow-hidden">
          {normal.map(n => <NoticeRow key={n.id} n={n} />)}
        </div>

        <p className="text-center text-xs text-gray-400">공지 알림 연동은 준비 중입니다</p>
      </div>
    </div>
  )
}
