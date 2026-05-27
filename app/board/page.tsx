'use client';

// TODO: Supabase 연결 — replace INITIAL_TICKETS with real-time data
// import { createClient } from '@/lib/supabase'

import { useState, useCallback } from 'react';
import type { Ticket, TicketStatus, Msg } from '@/components/board/types';
import TicketList from '@/components/board/TicketList';
import ChatWindow from '@/components/board/ChatWindow';
import ClientProfile from '@/components/board/ClientProfile';

// ── Mock data ─────────────────────────────────────────────────────
const INITIAL_TICKETS: Ticket[] = [
  {
    id: '1',
    org: '햇살어린이집',
    tierIcon: '👑',
    tierColor: '#F4A261',
    inquiryType: '식단변경',
    status: '처리중',
    priority: '긴급',
    assignee: '김민지',
    unread: 2,
    time: '09:42',
    ticketNo: '#TK-2025-001',
    createdAt: '2025.05.27',
    msgs: [
      { id: 'm1-0', type: 'system', sender: '', content: '2025년 5월 27일 화요일', time: '', read: true },
      { id: 'm1-1', type: 'system', sender: '', content: '티켓이 생성되었습니다.', time: '09:28', read: true },
      {
        id: 'm1-2', type: 'customer', sender: '김혜진 원장',
        content: '안녕하세요! 이번 주 목요일 닭갈비를 제육볶음으로 변경 가능할까요?\n알레르기 학생이 2명 생겼어요.',
        time: '09:30', read: true,
      },
      {
        id: 'm1-3', type: 'staff', sender: '김민지',
        content: '안녕하세요 김혜진 원장님 😊\n네, 확인해드리겠습니다!\n어떤 알레르기인지 여쭤봐도 될까요?',
        time: '09:35', read: true,
      },
      {
        id: 'm1-4', type: 'customer', sender: '김혜진 원장',
        content: '닭고기 알레르기입니다. 되도록 빨리 확인 부탁드려요~',
        time: '09:38', read: true,
      },
      {
        id: 'm1-5', type: 'staff', sender: '김민지',
        content: '재고 확인 중입니다!\n10분 내로 연락드리겠습니다 🙏',
        time: '09:42', read: false,
      },
      {
        id: 'm1-6', type: 'memo', sender: '김민지',
        content: '목요일 제육볶음 재고 확인 필요. 김민지 팀장에게 전달 요청.',
        time: '09:43', read: false,
      },
    ],
    client: {
      contactName: '김혜진 원장',
      phone: '010-1234-5678',
      email: 'hatssal@email.com',
      contractStart: '2024.03.01',
      contractEnd: '2025.12.31',
      daysLeft: 218,
      mealCount: 85,
      region: '경기도 수원시',
      nutritionist: '이영희',
      allergyCount: 3,
      memo: 'VIP 기관. 알레르기 학생 관리 철저히 필요. 원장님 직접 소통 선호.',
      delivery: [
        { day: '화요일', time: '07:30' },
        { day: '목요일', time: '07:30' },
      ],
      files: [
        { name: '식단표_5월.xlsx', size: '245KB', ext: 'xlsx' },
        { name: '원산지증명서_5월.pdf', size: '1.2MB', ext: 'pdf' },
        { name: '계약서_2025.pdf', size: '3.4MB', ext: 'pdf' },
      ],
      totalInquiries: 12,
      avgRating: 4.8,
    },
  },
  {
    id: '2',
    org: '사랑유치원',
    tierIcon: '⭐',
    tierColor: '#52B788',
    inquiryType: '납품문의',
    status: '완료',
    priority: '보통',
    assignee: '이수현',
    unread: 0,
    time: '어제 14:50',
    ticketNo: '#TK-2025-002',
    createdAt: '2025.05.26',
    msgs: [
      { id: 'm2-0', type: 'system', sender: '', content: '2025년 5월 26일 월요일', time: '', read: true },
      {
        id: 'm2-1', type: 'customer', sender: '이수진 원장',
        content: '이번 주 화요일 납품이 평소보다 30분 늦었어요. 다음에도 이런 일이 생기면 미리 연락 주셨으면 좋겠어요.',
        time: '14:20', read: true,
      },
      {
        id: 'm2-2', type: 'staff', sender: '이수현',
        content: '죄송합니다 이수진 원장님. 도로 공사로 지연됐습니다.\n다음 주부터 10분 일찍 출발하도록 조치하겠습니다.',
        time: '14:35', read: true,
      },
      {
        id: 'm2-3', type: 'customer', sender: '이수진 원장',
        content: '네 감사합니다! 😊 앞으로도 잘 부탁드려요.',
        time: '14:50', read: true,
      },
      { id: 'm2-4', type: 'system', sender: '', content: '이수진 원장님이 ⭐⭐⭐⭐⭐ 만족도를 남겼습니다.', time: '14:52', read: true },
      {
        id: 'm2-5', type: 'memo', sender: '이수현',
        content: '납품 시간 관련 드라이버 교육 필요. 사전 연락 프로세스 개선 건의.',
        time: '15:00', read: true,
      },
    ],
    client: {
      contactName: '이수진 원장',
      phone: '010-9876-5432',
      email: 'sarang@email.com',
      contractStart: '2023.09.01',
      contractEnd: '2025.08.31',
      daysLeft: 96,
      mealCount: 62,
      region: '서울 강남구',
      nutritionist: '이영희',
      allergyCount: 1,
      memo: '납품 시간에 민감한 기관. 사전 연락 필수.',
      delivery: [
        { day: '화요일', time: '07:30' },
        { day: '금요일', time: '07:30' },
      ],
      files: [
        { name: '식단표_5월.xlsx', size: '198KB', ext: 'xlsx' },
        { name: '계약서_2023.pdf', size: '2.1MB', ext: 'pdf' },
      ],
      totalInquiries: 8,
      avgRating: 4.9,
    },
  },
  {
    id: '3',
    org: '무지개키즈',
    tierIcon: '🌱',
    tierColor: '#74C69D',
    inquiryType: '위생민원',
    status: '접수',
    priority: '긴급',
    assignee: '박지원',
    unread: 1,
    time: '2시간 전',
    ticketNo: '#TK-2025-003',
    createdAt: '2025.05.27',
    msgs: [
      { id: 'm3-0', type: 'system', sender: '', content: '2025년 5월 27일 화요일', time: '', read: true },
      { id: 'm3-1', type: 'system', sender: '', content: '티켓이 생성되었습니다.', time: '11:10', read: true },
      {
        id: 'm3-2', type: 'customer', sender: '박미영 원장',
        content: '안녕하세요. 오늘 납품된 시금치에서 이물질이 발견되었습니다. 조치 부탁드립니다.',
        time: '11:12', read: false,
        attachment: '시금치_이물질.jpg',
      },
      { id: 'm3-3', type: 'system', sender: '', content: '📎 시금치_이물질.jpg 파일이 첨부되었습니다.', time: '11:12', read: false },
      {
        id: 'm3-4', type: 'memo', sender: '박지원',
        content: '위생팀 긴급 확인 요청. 해당 배치 번호 추적 필요. 오늘 오후까지 원인 파악.',
        time: '11:15', read: false,
      },
    ],
    client: {
      contactName: '박미영 원장',
      phone: '010-5555-1234',
      email: 'rainbow@email.com',
      contractStart: '2025.01.01',
      contractEnd: '2025.12.31',
      daysLeft: 218,
      mealCount: 48,
      region: '인천 연수구',
      nutritionist: '최영수',
      allergyCount: 0,
      memo: '신규 기관. 민원 발생 시 즉각 대응 필요.',
      delivery: [
        { day: '월요일', time: '07:45' },
        { day: '수요일', time: '07:45' },
        { day: '금요일', time: '07:45' },
      ],
      files: [
        { name: '식단표_5월.xlsx', size: '156KB', ext: 'xlsx' },
      ],
      totalInquiries: 3,
      avgRating: 4.2,
    },
  },
  {
    id: '4',
    org: '하늘초등학교',
    tierIcon: '👑',
    tierColor: '#F4A261',
    inquiryType: '계약관련',
    status: '접수',
    priority: '보통',
    assignee: '김민지',
    unread: 0,
    time: '어제',
    ticketNo: '#TK-2025-004',
    createdAt: '2025.05.26',
    deadline: 'D-15',
    msgs: [
      { id: 'm4-0', type: 'system', sender: '', content: '2025년 5월 26일 월요일', time: '', read: true },
      {
        id: 'm4-1', type: 'customer', sender: '최은정 영양사',
        content: '안녕하세요. 내년 2학기 계약 연장 관련하여 미팅 일정을 잡고 싶습니다. 가능한 날짜를 알려주세요.',
        time: '10:30', read: true,
      },
      {
        id: 'm4-2', type: 'staff', sender: '김민지',
        content: '안녕하세요 최은정 영양사님 😊\n담당자가 일정 확인 후 연락드리겠습니다. 6월 초 방문 가능하신가요?',
        time: '11:00', read: true,
      },
      {
        id: 'm4-3', type: 'memo', sender: '김민지',
        content: '계약 만료 D-15. 갱신 미팅 일정 조율 시급. 이사님 보고 필요.',
        time: '11:05', read: true,
      },
    ],
    client: {
      contactName: '최은정 영양사',
      phone: '010-7777-8888',
      email: 'sky@school.kr',
      contractStart: '2024.06.01',
      contractEnd: '2025.06.11',
      daysLeft: 15,
      mealCount: 320,
      region: '경기도 성남시',
      nutritionist: '이영희',
      allergyCount: 7,
      memo: 'VIP 대형 기관. 계약 갱신 최우선 대응. 이사님 미팅 검토.',
      delivery: [
        { day: '월요일', time: '06:30' },
        { day: '수요일', time: '06:30' },
        { day: '금요일', time: '06:30' },
      ],
      files: [
        { name: '식단표_5월.xlsx', size: '412KB', ext: 'xlsx' },
        { name: '원산지증명서_5월.pdf', size: '2.3MB', ext: 'pdf' },
        { name: '계약서_2024.pdf', size: '5.1MB', ext: 'pdf' },
      ],
      totalInquiries: 27,
      avgRating: 4.7,
    },
  },
  {
    id: '5',
    org: '별빛어린이집',
    tierIcon: '⭐',
    tierColor: '#52B788',
    inquiryType: '식단변경',
    status: '처리중',
    priority: '보통',
    assignee: '이수현',
    unread: 0,
    time: '3일 전',
    ticketNo: '#TK-2025-005',
    createdAt: '2025.05.24',
    msgs: [
      { id: 'm5-0', type: 'system', sender: '', content: '2025년 5월 24일 토요일', time: '', read: true },
      {
        id: 'm5-1', type: 'customer', sender: '정다은 원장',
        content: '다음 달부터 채식 학생이 3명 추가됩니다. 대체 메뉴 구성 부탁드립니다.',
        time: '14:10', read: true,
      },
      {
        id: 'm5-2', type: 'staff', sender: '이수현',
        content: '안녕하세요 정다은 원장님 😊\n채식 대체 메뉴로 구성해드리겠습니다!\n영양사 선생님과 협의 후 연락드릴게요.',
        time: '14:25', read: true,
      },
      { id: 'm5-3', type: 'system', sender: '', content: '2025년 5월 25일 일요일', time: '', read: true },
      {
        id: 'm5-4', type: 'staff', sender: '이수현',
        content: '채식 식단 초안 완성했습니다. 내일 오전에 공유드릴게요 😊',
        time: '18:30', read: true,
      },
      {
        id: 'm5-5', type: 'memo', sender: '이수현',
        content: '채식 3명 추가. 6월 식단 수정 필요. 영양사 이영희에게 전달 완료.',
        time: '18:32', read: true,
      },
    ],
    client: {
      contactName: '정다은 원장',
      phone: '010-3333-4444',
      email: 'starlight@email.com',
      contractStart: '2024.09.01',
      contractEnd: '2025.08.31',
      daysLeft: 96,
      mealCount: 55,
      region: '서울 마포구',
      nutritionist: '이영희',
      allergyCount: 2,
      memo: '채식 학생 관리 중. 6월부터 3명 추가 예정.',
      delivery: [
        { day: '화요일', time: '07:30' },
        { day: '목요일', time: '07:30' },
      ],
      files: [
        { name: '식단표_5월.xlsx', size: '223KB', ext: 'xlsx' },
        { name: '채식메뉴_초안.pdf', size: '890KB', ext: 'pdf' },
      ],
      totalInquiries: 5,
      avgRating: 4.6,
    },
  },
];

// ── Page ──────────────────────────────────────────────────────────
type MobileTab = 'list' | 'chat' | 'info';

export default function BoardPage() {
  const [tickets, setTickets] = useState<Ticket[]>(INITIAL_TICKETS);
  const [selectedId, setSelectedId] = useState<string | null>('1');
  const [mobileTab, setMobileTab] = useState<MobileTab>('list');

  const selectedTicket = tickets.find((t) => t.id === selectedId) ?? null;

  // TODO: Supabase 연결 — replace with realtime subscription
  const selectTicket = useCallback((id: string) => {
    setSelectedId(id);
    setTickets((prev) => prev.map((t) => (t.id === id ? { ...t, unread: 0 } : t)));
    setMobileTab('chat');
  }, []);

  // TODO: Supabase 연결 — replace with insert mutation
  const addMsg = useCallback((ticketId: string, msg: Msg) => {
    setTickets((prev) =>
      prev.map((t) =>
        t.id === ticketId ? { ...t, msgs: [...t.msgs, msg], time: msg.time } : t
      )
    );
  }, []);

  // TODO: Supabase 연결 — replace with update mutation
  const changeStatus = useCallback((ticketId: string, status: TicketStatus) => {
    setTickets((prev) => prev.map((t) => (t.id === ticketId ? { ...t, status } : t)));
  }, []);

  const MOBILE_TABS: { key: MobileTab; label: string; icon: string }[] = [
    { key: 'list', label: '목록', icon: '📋' },
    { key: 'chat', label: '채팅', icon: '💬' },
    { key: 'info', label: '정보', icon: '👤' },
  ];

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[#F0F4F0] font-sans">
      {/* ── Header ── */}
      <header className="bg-white border-b border-gray-100 px-4 sm:px-6 py-3 flex items-center justify-between flex-shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
          <a href="/" className="text-gray-400 hover:text-gray-600 text-sm transition-colors hidden sm:flex items-center gap-1">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5m7-7l-7 7 7 7" /></svg>
            홈
          </a>
          <span className="text-gray-200 hidden sm:block">|</span>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-[#2D6A4F] rounded-lg flex items-center justify-center text-white font-bold text-sm">K</div>
            <span className="font-bold text-[#1C2B1E] text-sm">소통 채널</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-[#E8F5E9] flex items-center justify-center text-sm font-bold text-[#2D6A4F]">김</div>
            <span className="text-sm text-gray-600 font-medium">김민지</span>
          </div>
          <a href="/board/admin" className="text-xs bg-[#E8F5E9] text-[#2D6A4F] font-semibold px-3 py-1.5 rounded-lg hover:bg-[#2D6A4F] hover:text-white transition-colors">
            관리자 대시보드
          </a>
        </div>
      </header>

      {/* ── 3-Panel body ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Ticket list */}
        <div className={`w-[260px] flex-shrink-0 bg-white border-r border-gray-100 flex-col overflow-hidden ${mobileTab === 'list' ? 'flex' : 'hidden'} md:flex`}>
          <TicketList tickets={tickets} selectedId={selectedId} onSelect={selectTicket} />
        </div>

        {/* Middle: Chat window */}
        <div className={`flex-1 min-w-0 flex-col overflow-hidden ${mobileTab === 'chat' ? 'flex' : 'hidden'} md:flex`}>
          {selectedTicket ? (
            <ChatWindow ticket={selectedTicket} onAddMsg={addMsg} onChangeStatus={changeStatus} />
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <div className="text-5xl mb-3">💬</div>
                <div className="text-sm font-medium">티켓을 선택하세요</div>
              </div>
            </div>
          )}
        </div>

        {/* Right: Client profile */}
        <div className={`w-[280px] flex-shrink-0 bg-white border-l border-gray-100 flex-col overflow-hidden ${mobileTab === 'info' ? 'flex' : 'hidden'} md:flex`}>
          {selectedTicket ? (
            <ClientProfile ticket={selectedTicket} />
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-300">
              <div className="text-center text-sm">
                <div className="text-4xl mb-2">👤</div>
                <div>티켓을 선택하세요</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Mobile bottom tab bar ── */}
      <nav className="md:hidden flex bg-white border-t border-gray-200 flex-shrink-0">
        {MOBILE_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setMobileTab(tab.key)}
            className={`flex-1 flex flex-col items-center gap-0.5 py-3 text-xs font-semibold transition-colors ${mobileTab === tab.key ? 'text-[#2D6A4F]' : 'text-gray-400'}`}
          >
            <span className="text-lg">{tab.icon}</span>
            <span>{tab.label}</span>
            {tab.key === 'list' && tickets.filter((t) => t.unread > 0).length > 0 && (
              <div className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
            )}
          </button>
        ))}
      </nav>
    </div>
  );
}
