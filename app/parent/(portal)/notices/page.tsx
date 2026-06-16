'use client'

import { useState } from 'react'
import BottomNav from '@/components/parent/BottomNav'

type Tab = 'all' | 'branch'

type Notice = {
  id: string
  title: string
  content: string
  created_at: string
  is_pinned: boolean
  branch_id: string | null
  attachment_url: string | null
  read_at: string | null
}

// TODO: Supabase 연결 시 아래 mock 데이터를 제거하고 실제 조회로 교체
// parent_notices 테이블: branch_id IS NULL → 전체 공지, branch_id = 내 원 → 우리 원 공지
const MOCK_NOTICES: Notice[] = [
  {
    id: '1',
    title: '2026년 여름 급식 안전 수칙 안내',
    content: '무더운 여름철을 맞아 급식 위생 및 안전에 관한 수칙을 안내드립니다.\n\n1. 식재료는 매일 신선한 것으로 공급됩니다.\n2. 조리 후 2시간 이내에 배식이 완료됩니다.\n3. 알레르기 유발 식품은 별도 표시되어 있습니다.\n\n더 궁금한 사항은 담당 영양사에게 문의해 주세요.',
    created_at: '2026-06-01',
    is_pinned: true,
    branch_id: null,
    attachment_url: null,
    read_at: '2026-06-03T10:00:00Z',
  },
  {
    id: '2',
    title: '6월 건강 간식 프로그램 시작 안내',
    content: '이번 달부터 건강 간식 프로그램이 시작됩니다.\n매주 화요일과 목요일 오후 간식으로 제철 과일과 채소를 제공합니다.\n\n자세한 내용은 첨부파일을 참고해 주세요.',
    created_at: '2026-05-28',
    is_pinned: false,
    branch_id: null,
    attachment_url: 'https://example.com/health-snack-guide.pdf',
    read_at: null,
  },
  {
    id: '3',
    title: '식품 알레르기 현황 조사 안내',
    content: '아이들의 안전한 급식을 위해 식품 알레르기 현황을 조사합니다.\n알레르기가 있는 경우 담임선생님께 알려주시고, 급식 신청서에 반드시 기재해 주세요.',
    created_at: '2026-05-20',
    is_pinned: false,
    branch_id: null,
    attachment_url: null,
    read_at: null,
  },
  {
    id: '4',
    title: '6월 특별 행사 식단 안내',
    content: '6월 현충일 연휴를 맞아 특별 식단이 준비되어 있습니다.\n아이들이 좋아하는 메뉴로 구성하였으니 많은 기대 바랍니다!\n\n• 6월 6일 (금): 불고기 덮밥 특식\n• 6월 7일 (토): 정상 운영',
    created_at: '2026-06-02',
    is_pinned: true,
    branch_id: 'branch-1',
    attachment_url: null,
    read_at: null,
  },
  {
    id: '5',
    title: '7월 방학 중 급식 운영 일정',
    content: '여름 방학 중에도 돌봄 이용 아동을 위해 정상 급식이 운영됩니다.\n자세한 일정은 첨부파일을 확인해 주세요.',
    created_at: '2026-05-15',
    is_pinned: false,
    branch_id: 'branch-1',
    attachment_url: 'https://example.com/summer-schedule.pdf',
    read_at: null,
  },
]

export default function ParentNoticesPage() {
  const [tab, setTab] = useState<Tab>('all')
  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null)
  const [localRead, setLocalRead] = useState<Set<string>>(new Set())

  const filtered = MOCK_NOTICES.filter(n =>
    tab === 'all' ? n.branch_id === null : n.branch_id !== null
  )
  const pinned = filtered.filter(n => n.is_pinned)
  const normal = filtered.filter(n => !n.is_pinned)

  function isRead(notice: Notice) {
    return !!notice.read_at || localRead.has(notice.id)
  }

  function openNotice(notice: Notice) {
    setSelectedNotice(notice)
    // TODO: Supabase 연결 시 아래 주석 해제
    // await supabase.from('parent_notice_reads').upsert({ notice_id: notice.id, user_id: currentUserId })
    setLocalRead(prev => { const next = new Set(prev); next.add(notice.id); return next })
  }

  const unreadCount = MOCK_NOTICES.filter(n => !isRead(n)).length

  return (
    <div className="min-h-screen bg-[#F6FAF6] pb-20">
      <header className="bg-white border-b border-gray-100 px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <h1 className="font-bold text-[#1C2B1E]">공지사항</h1>
          {unreadCount > 0 && (
            <span className="text-[11px] bg-blue-500 text-white font-bold px-2 py-0.5 rounded-full min-w-[18px] text-center">
              {unreadCount}
            </span>
          )}
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">
        {/* Tabs */}
        <div className="flex gap-1 bg-white border border-gray-100 rounded-2xl p-1">
          {([
            { key: 'all' as Tab, label: '📢 전체 공지' },
            { key: 'branch' as Tab, label: '🏫 우리 원 공지' },
          ] as const).map(t => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                tab === t.key
                  ? 'bg-[#2D6A4F] text-white'
                  : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 py-16 flex flex-col items-center gap-3">
            <span className="text-5xl">🔔</span>
            <p className="text-gray-400 text-sm font-medium">등록된 공지사항이 없습니다</p>
          </div>
        ) : (
          <>
            {pinned.length > 0 && (
              <div className="space-y-3">
                {pinned.map(n => (
                  <PinnedCard key={n.id} notice={n} read={isRead(n)} onClick={() => openNotice(n)} />
                ))}
              </div>
            )}

            {normal.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                {normal.map((n, i) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => openNotice(n)}
                    className={`w-full text-left px-5 py-4 flex items-start gap-3 hover:bg-[#F8FDF8] transition-colors ${
                      i > 0 ? 'border-t border-gray-50' : ''
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${isRead(n) ? 'text-gray-400' : 'text-[#1C2B1E]'}`}>
                        {n.title}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">{n.created_at}</p>
                    </div>
                    {!isRead(n) && (
                      <span className="mt-1.5 w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {selectedNotice && (
        <NoticeModal notice={selectedNotice} onClose={() => setSelectedNotice(null)} />
      )}

      <BottomNav />
    </div>
  )
}

function PinnedCard({ notice, read, onClick }: { notice: Notice; read: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left bg-white rounded-2xl border-2 border-[#2D6A4F]/20 p-5 hover:border-[#2D6A4F]/40 transition-colors"
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[11px] bg-[#2D6A4F] text-white font-bold px-2 py-0.5 rounded-full">
              📌 중요
            </span>
          </div>
          <p className={`text-sm font-semibold truncate ${read ? 'text-gray-400' : 'text-[#1C2B1E]'}`}>
            {notice.title}
          </p>
          <p className="text-xs text-gray-400 mt-1">{notice.created_at}</p>
        </div>
        {!read && (
          <span className="mt-1 w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
        )}
      </div>
    </button>
  )
}

function NoticeModal({ notice, onClose }: { notice: Notice; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
    >
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-lg max-h-[80vh] flex flex-col z-10 shadow-2xl">
        <div className="flex items-start justify-between p-5 border-b border-gray-100">
          <div className="flex-1 pr-4">
            {notice.is_pinned && (
              <span className="inline-flex items-center text-[11px] bg-[#2D6A4F] text-white font-bold px-2 py-0.5 rounded-full mb-2">
                📌 중요 공지
              </span>
            )}
            <h2 className="font-bold text-[#1C2B1E] text-base leading-snug">{notice.title}</h2>
            <p className="text-xs text-gray-400 mt-1">{notice.created_at}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 -mt-1 -mr-1"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">{notice.content}</p>
        </div>

        {notice.attachment_url && (
          <div className="px-5 pt-4 border-t border-gray-100">
            <a
              href={notice.attachment_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-[#2D6A4F] font-medium bg-[#F0FBF4] rounded-xl px-4 py-3 hover:bg-[#E0F7EA] transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
              </svg>
              첨부파일 다운로드
            </a>
          </div>
        )}

        <div className="px-5 py-5 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="w-full bg-[#2D6A4F] text-white font-semibold py-3 rounded-2xl hover:bg-[#1B4332] transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}
