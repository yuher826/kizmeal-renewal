'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

// ── Constants ────────────────────────────────────────────────────
const DURATION = 3800;

// ── Data ─────────────────────────────────────────────────────────
const SLIDES = [
  {
    num: '01', icon: '💬',
    title: '모든 원과의 대화를 한 곳에서',
    desc: '전화·카톡 대신 [키즈밀 전용 채널] 하나로.\n어느 원인지 [절대 놓치지 않아요].',
    toast: '목동poly에서 새 메시지 2건',
  },
  {
    num: '02', icon: '📎',
    title: '식단표·계약서, 파일도 바로 전송',
    desc: '이메일 없이 [대화창에서 직접] 파일을 주고받고,\n[모든 기록이 남아요].',
    toast: '6월_덕양P_식단표.pdf 수령 완료',
  },
  {
    num: '03', icon: '✅',
    title: '접수부터 완료까지 한눈에',
    desc: '[내 요청이 어디까지 됐는지] 투명하게.\n처리 상태가 [실시간으로 바뀌어요].',
    toast: '알레르기 변경 요청 처리 완료됐어요',
  },
  {
    num: '04', icon: '🔔',
    title: '중요한 알림, 절대 놓치지 않아요',
    desc: '처리 상태가 바뀌면 [즉시 알림].\n바쁜 중에도 [빠르게 확인]할 수 있어요.',
    toast: '강동ECC 답변이 도착했어요',
  },
  {
    num: '05', icon: '🔍',
    title: '지난 식단표·계약서, 언제든 다시',
    desc: '[지난달 파일도, 오래된 대화도]\n키워드 하나로 [바로 찾아요].',
    toast: '식단표 검색 결과 4건',
  },
  {
    num: '06', icon: '📢',
    title: '키즈밀 공지, 채널에서 바로',
    desc: '전화나 카톡으로 놓치던 공지가\n이제 [채널 안으로] 들어와요.',
    toast: '새 공지사항이 등록됐어요',
  },
];

const COUNTERS = [
  { fixed: '새벽 3시', label: '식재료 입고' },
  { value: 22,   suffix: '년', label: '급식 경력' },
  { value: 1200, suffix: '+', label: '월 처리 건수' },
] as const;

// ── Helpers ──────────────────────────────────────────────────────
function parseDesc(desc: string) {
  return desc.split('\n').map((line, li, arr) => {
    const parts = line.split(/\[([^\]]+)\]/g);
    return (
      <span key={li}>
        {parts.map((p, i) =>
          i % 2 === 1
            ? <span key={i} className="text-[#1B5E3B] font-semibold">{p}</span>
            : p
        )}
        {li < arr.length - 1 && <br />}
      </span>
    );
  });
}

function useCountUp(target: number, durationMs: number, active: boolean) {
  const [count, setCount] = useState(0);
  const started = useRef(false);
  useEffect(() => {
    if (!active || started.current) return;
    started.current = true;
    const t0 = performance.now();
    let raf: number;
    const tick = (now: number) => {
      const progress = Math.min((now - t0) / durationMs, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(ease * target));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps
  return count;
}

// ── Screen Mock-ups ───────────────────────────────────────────────

function ScreenChatList() {
  return (
    <div className="flex flex-col h-full bg-white">
      <div className="px-3 pt-3 pb-2 border-b border-gray-100">
        <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-1.5">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2.5">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <span className="text-[11px] text-gray-400">원 이름으로 검색</span>
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        {[
          { name: '목동poly',     sub: '내일 식단 확인 부탁드립니다',  badge: 2, active: true,  time: '방금' },
          { name: '강동ECC',      sub: '알레르기 변경 요청드려요',      badge: 1, active: false, time: '1분 전' },
          { name: '잉글리쉬파크', sub: '감사합니다!',                  badge: 0, active: false, time: '어제' },
          { name: '덕양poly',     sub: '6월 식단표 잘 받았어요',        badge: 0, active: false, time: '어제' },
          { name: '송파ECC',      sub: '계약서 확인했습니다',           badge: 0, active: false, time: '2일 전' },
        ].map((c, i) => (
          <div key={i} className={`flex items-center gap-3 px-3 py-3 ${i < 4 ? 'border-b border-gray-50' : ''} ${c.active ? 'bg-[#F0FAF4]' : ''}`}>
            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 ${c.active ? 'bg-[#1B5E3B]' : 'bg-[#52876A]'}`}>
              {c.name.slice(0, 2)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[11px] font-semibold text-gray-900">{c.name}</span>
                <span className="text-[9px] text-gray-400">{c.time}</span>
              </div>
              <p className="text-[10px] text-gray-500 truncate">{c.sub}</p>
            </div>
            {c.badge > 0 && (
              <div className="w-4 h-4 rounded-full bg-[#1B5E3B] flex items-center justify-center flex-shrink-0">
                <span className="text-[8px] text-white font-bold">{c.badge}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ScreenFileTransfer() {
  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="flex items-center gap-2 px-3 py-2.5 bg-white border-b border-gray-100">
        <div className="w-7 h-7 rounded-full bg-[#1B5E3B] flex items-center justify-center text-white text-[10px] font-bold">목동</div>
        <span className="text-[11px] font-semibold text-gray-800">목동poly</span>
        <div className="ml-auto w-1.5 h-1.5 rounded-full bg-green-400" />
      </div>
      <div className="flex-1 px-3 py-3 space-y-3 overflow-hidden">
        <div className="flex gap-2">
          <div className="w-6 h-6 rounded-full bg-gray-200 flex-shrink-0 flex items-center justify-center text-[9px] text-gray-600 font-bold">원</div>
          <div>
            <div className="bg-white rounded-2xl rounded-tl-sm px-3 py-2 shadow-sm border border-gray-100">
              <p className="text-[10px] text-gray-700">6월 식단표 요청드립니다</p>
            </div>
            <p className="text-[8px] text-gray-400 mt-0.5 ml-1">오전 10:12</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="bg-[#1B5E3B] rounded-2xl rounded-tr-sm px-3 py-2">
            <p className="text-[10px] text-white">네, 바로 보내드릴게요!</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl px-3 py-2 flex items-center gap-2.5 shadow-sm">
            <div className="w-8 h-8 rounded-lg bg-red-50 border border-red-100 flex items-center justify-center text-sm">📄</div>
            <div>
              <p className="text-[9px] font-semibold text-gray-800">6월_목동poly_식단표.pdf</p>
              <p className="text-[8px] text-gray-400">234 KB · PDF</p>
            </div>
            <div className="ml-auto text-[#1B5E3B] font-bold text-xs">↓</div>
          </div>
        </div>
        <div className="flex gap-2">
          <div className="w-6 h-6 rounded-full bg-gray-200 flex-shrink-0 flex items-center justify-center text-[9px] text-gray-600 font-bold">원</div>
          <div className="bg-white rounded-2xl rounded-tl-sm px-3 py-2 shadow-sm border border-gray-100">
            <p className="text-[10px] text-gray-700">감사해요! 생일간식 표기 확인했어요 😊</p>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 px-3 py-2.5 bg-white border-t border-gray-100">
        <div className="flex-1 bg-gray-100 rounded-full px-3 py-1.5 text-[10px] text-gray-400">메시지 입력...</div>
        <button className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-xs text-gray-500">📎</button>
        <button className="w-7 h-7 rounded-full bg-[#1B5E3B] flex items-center justify-center">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

function ScreenStatus() {
  const items = [
    { title: '알레르기 메뉴 변경 요청', badge: '처리중', badgeCls: 'bg-yellow-100 text-yellow-700', steps: [2, 1, 0] as const },
    { title: '6월 식단표 수정 요청',     badge: '완료',   badgeCls: 'bg-green-100 text-green-700',  steps: [2, 2, 2] as const },
    { title: '후식과일 일정 문의',       badge: '접수',   badgeCls: 'bg-blue-100 text-blue-700',    steps: [1, 0, 0] as const },
  ];
  const stepNames = ['접수', '처리중', '완료'];
  return (
    <div className="flex flex-col h-full bg-white">
      <div className="flex gap-1 px-3 pt-3 pb-2">
        {['전체', '처리중', '완료'].map((t, i) => (
          <button key={i} className={`text-[9px] px-2.5 py-1 rounded-full font-medium ${i === 0 ? 'bg-[#1B5E3B] text-white' : 'bg-gray-100 text-gray-500'}`}>{t}</button>
        ))}
      </div>
      <div className="flex-1 px-3 space-y-2 overflow-hidden">
        {items.map((item, i) => (
          <div key={i} className="bg-white border border-gray-100 rounded-xl p-3 shadow-sm">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[10px] font-semibold text-gray-800 truncate pr-2">{item.title}</span>
              <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${item.badgeCls}`}>{item.badge}</span>
            </div>
            <div className="flex items-center">
              {stepNames.map((name, si) => (
                <div key={si} className="flex items-center flex-1">
                  <div className="flex flex-col items-center gap-0.5">
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold ${
                      item.steps[si] === 2 ? 'bg-[#1B5E3B] text-white' :
                      item.steps[si] === 1 ? 'bg-yellow-400 text-white' :
                      'bg-gray-200 text-gray-400'
                    }`}>
                      {item.steps[si] === 2 ? '✓' : item.steps[si] === 1 ? '·' : '○'}
                    </div>
                    <span className={`text-[7px] font-medium ${item.steps[si] > 0 ? 'text-gray-700' : 'text-gray-400'}`}>{name}</span>
                  </div>
                  {si < 2 && (
                    <div className={`flex-1 h-0.5 mx-1 ${
                      item.steps[si] === 2 && item.steps[si + 1] > 0 ? 'bg-[#1B5E3B]' :
                      item.steps[si] === 1 ? 'bg-yellow-300' :
                      'bg-gray-200'
                    }`} />
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScreenNotifications() {
  const items = [
    { dot: 'bg-green-500',  bg: 'bg-green-50 border-green-100',  text: '6월 식단표 수정 요청 완료',    time: '방금',  unread: true },
    { dot: 'bg-yellow-400', bg: 'bg-yellow-50 border-yellow-100', text: '알레르기 변경 처리중',         time: '5분 전', unread: true },
    { dot: 'bg-blue-500',   bg: 'bg-blue-50 border-blue-100',    text: '잉글리쉬파크 새 요청 접수',   time: '방금',  unread: true },
    { dot: 'bg-gray-300',   bg: 'bg-white border-gray-100',      text: '영문 식단표 요청 완료',       time: '어제',  unread: false },
  ];
  return (
    <div className="flex flex-col h-full bg-white">
      <div className="flex items-center justify-between px-3 pt-3 pb-2 border-b border-gray-50">
        <span className="text-xs font-semibold text-gray-900">알림</span>
        <span className="text-[9px] px-1.5 py-0.5 bg-red-500 text-white rounded-full font-bold">새 알림 3</span>
      </div>
      <div className="flex-1 px-3 py-2 space-y-1.5 overflow-hidden">
        {items.map((item, i) => (
          <div key={i} className={`flex items-start gap-2.5 px-2.5 py-2.5 rounded-xl border ${item.bg}`}>
            <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1 ${item.dot}`} />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-medium text-gray-800 leading-snug">{item.text}</p>
              <p className="text-[8px] text-gray-400 mt-0.5">{item.time}</p>
            </div>
            {item.unread && <div className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0 mt-1" />}
          </div>
        ))}
      </div>
    </div>
  );
}

function ScreenSearch() {
  const results = [
    { icon: '📄', name: '6월_목동poly_식단표.pdf',            highlight: true },
    { icon: '📄', name: '5월_목동poly_식단표.pdf',            highlight: false },
    { icon: '💬', name: '"6월 식단표 확인 부탁드립니다" 대화', highlight: false },
    { icon: '📄', name: '4월_강동ECC_식단표.pdf',             highlight: false },
  ];
  return (
    <div className="flex flex-col h-full bg-white">
      <div className="px-3 pt-3 pb-2">
        <div className="flex items-center gap-2 bg-white border-2 border-[#1B5E3B] rounded-xl px-3 py-2 shadow-sm">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#1B5E3B" strokeWidth="2.5">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <span className="text-[11px] text-gray-800 flex-1">식단표</span>
          <span className="inline-block w-0.5 h-3.5 bg-[#1B5E3B] animate-pulse" />
        </div>
      </div>
      <div className="flex gap-1 px-3 pb-2">
        {['전체', '파일', '대화', '계약서'].map((t, i) => (
          <button key={i} className={`text-[9px] px-2 py-0.5 rounded-full font-medium ${i === 0 ? 'bg-[#1B5E3B] text-white' : 'bg-gray-100 text-gray-500'}`}>{t}</button>
        ))}
      </div>
      <div className="flex-1 px-3 space-y-1.5 overflow-hidden">
        {results.map((r, i) => (
          <div key={i} className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border ${r.highlight ? 'bg-[#E8F5EE] border-[#A8D5B5]' : 'bg-white border-gray-100'}`}>
            <span className="text-sm">{r.icon}</span>
            <span className={`text-[10px] truncate ${r.highlight ? 'text-[#1B5E3B] font-semibold' : 'text-gray-700'}`}>{r.name}</span>
            {r.highlight && <span className="ml-auto text-[8px] text-[#1B5E3B] font-medium whitespace-nowrap">최신</span>}
          </div>
        ))}
        <p className="text-[9px] text-gray-400 text-center pt-1">&quot;식단표&quot; 검색 결과 4건</p>
      </div>
    </div>
  );
}

function ScreenNotice() {
  const notices = [
    { tag: '중요', tagCls: 'bg-red-100 text-red-600',   icon: '🔴', title: '2026년 하절기 위생 안전 안내',  unread: true },
    { tag: '공지', tagCls: 'bg-blue-100 text-blue-600', icon: '📢', title: '6월 운영 일정 안내',           unread: true },
    { tag: '공지', tagCls: 'bg-blue-100 text-blue-600', icon: '📢', title: '알레르기 표기 변경 안내',       unread: false },
    { tag: '안내', tagCls: 'bg-gray-100 text-gray-600', icon: '📋', title: '5월 결산 내역 확인 요청',       unread: false },
  ];
  return (
    <div className="flex flex-col h-full bg-white">
      <div className="mx-3 mt-3 mb-2 rounded-xl px-4 py-3 flex items-center gap-3"
        style={{ background: 'linear-gradient(90deg, #1B5E3B, #2E7D52)' }}>
        <span className="text-xl">📣</span>
        <div>
          <p className="text-white text-[11px] font-semibold">키즈밀 공지사항</p>
          <p className="text-white/70 text-[9px]">새로운 공지가 등록됐어요</p>
        </div>
        <span className="ml-auto text-[8px] px-2 py-0.5 bg-white/20 rounded-full text-white">미읽음 2</span>
      </div>
      <div className="flex-1 px-3 space-y-1.5 overflow-hidden">
        {notices.map((n, i) => (
          <div key={i} className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border ${n.unread ? 'bg-[#F0FAF4] border-[#C8E6C9]' : 'bg-white border-gray-100'}`}>
            <span className="text-sm flex-shrink-0">{n.icon}</span>
            <div className="flex-1 min-w-0 flex items-center gap-1.5">
              <span className={`text-[8px] px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${n.tagCls}`}>{n.tag}</span>
              <span className="text-[10px] font-medium text-gray-800 truncate">{n.title}</span>
            </div>
            {n.unread && <div className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />}
          </div>
        ))}
      </div>
    </div>
  );
}

const SCREENS = [ScreenChatList, ScreenFileTransfer, ScreenStatus, ScreenNotifications, ScreenSearch, ScreenNotice];

// ── Counter Item ─────────────────────────────────────────────────
function CounterItem({ fixed, value, suffix, label, active }: { fixed?: string; value?: number; suffix?: string; label: string; active: boolean }) {
  const count = useCountUp(value ?? 0, 1500, !fixed && active);
  return (
    <div className="text-center">
      <div className="text-3xl sm:text-4xl font-bold font-serif text-[#1B5E3B] tabular-nums">
        {fixed ?? (count.toLocaleString() + (suffix ?? ''))}
      </div>
      <div className="text-xs sm:text-sm text-[#0D2016]/50 mt-1.5 font-medium tracking-wide">{label}</div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────
export default function CustomerChannelSection() {
  const [activeTab, setActiveTab]   = useState(0);
  const [paused, setPaused]         = useState(false);
  const [isVisible, setIsVisible]   = useState(false);
  const [toastVisible, setToastVisible] = useState(false);

  const sectionRef = useRef<HTMLElement>(null);

  // Intersection Observer — fires once
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setIsVisible(true); },
      { threshold: 0.2 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Auto-advance
  useEffect(() => {
    if (paused || !isVisible) return;
    const id = setTimeout(
      () => setActiveTab(prev => (prev + 1) % SLIDES.length),
      DURATION,
    );
    return () => clearTimeout(id);
  }, [activeTab, paused, isVisible]);

  // Toast: show 300 ms after tab switch, hide after 2.8 s total
  useEffect(() => {
    setToastVisible(false);
    const show = setTimeout(() => setToastVisible(true), 300);
    const hide = setTimeout(() => setToastVisible(false), 3100);
    return () => { clearTimeout(show); clearTimeout(hide); };
  }, [activeTab]);

  const handleTabClick = useCallback((i: number) => {
    setActiveTab(i);
  }, []);

  const ScreenComp = SCREENS[activeTab];

  return (
    <section
      ref={sectionRef}
      className="relative py-24 overflow-hidden"
      style={{
        background: [
          'radial-gradient(circle at 30% 50%, rgba(27,94,59,0.06), transparent 60%)',
          'radial-gradient(circle at 80% 20%, rgba(27,94,59,0.04), transparent 50%)',
          '#FAFDF9',
        ].join(', '),
      }}
    >
      {/* Concentric-wave background */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
        style={{ zIndex: 0 }}
      >
        {[130, 260, 390, 520, 650].map(r => (
          <circle key={r} cx="720" cy="450" r={r} fill="none" stroke="#1B5E3B" strokeWidth="0.8" opacity="0.10" />
        ))}
      </svg>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* ── Header ─────────────────────────────────────── */}
        <div className={`text-center mb-16 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>

          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-[#E8F5EE] border border-[#A8D5B5] text-[#1B5E3B] text-[11px] font-bold tracking-widest uppercase px-4 py-1.5 rounded-full mb-6">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#1B5E3B] opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#1B5E3B]" />
            </span>
            COMMUNICATION CHANNEL
          </div>

          {/* Title */}
          <h2 className={`font-serif font-semibold text-4xl sm:text-5xl text-[#0D2016] mb-5 leading-tight transition-all duration-700 delay-100 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            전화·카톡·문자,<br />이제 하나로
          </h2>

          {/* Subtitle */}
          <p className={`text-[#0D2016]/50 max-w-xl mx-auto text-base sm:text-lg leading-relaxed transition-all duration-700 delay-200 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            전화·카톡에 묻히던 중요한 문의가 이제 사라지지 않아요.<br className="hidden sm:block" />
            계약부터 식단표까지, 모든 소통이 한 곳에서 기록으로 남습니다.
          </p>

          {/* Counters */}
          <div className="flex justify-center gap-10 sm:gap-20 mt-12">
            {COUNTERS.map((c, i) => (
              <div
                key={i}
                className={`transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
                style={{ transitionDelay: `${300 + i * 100}ms` }}
              >
                <CounterItem
                  fixed={'fixed' in c ? c.fixed : undefined}
                  value={'value' in c ? c.value : undefined}
                  suffix={'suffix' in c ? c.suffix : undefined}
                  label={c.label}
                  active={isVisible}
                />
              </div>
            ))}
          </div>
        </div>

        {/* ── Main: Tabs + Device ─────────────────────────── */}
        <div className="flex flex-col md:flex-row gap-6 lg:gap-10 items-start">

          {/* Left: Tab list */}
          <div
            className={`w-full md:w-[220px] flex-shrink-0 transition-all duration-700 ${isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-12'}`}
            style={{ transitionDelay: '500ms' }}
          >
            {/* Mobile: horizontal scroll tabs */}
            <div className="flex md:hidden gap-2 overflow-x-auto pb-3 scrollbar-hide -mx-1 px-1">
              {SLIDES.map((s, i) => (
                <button
                  key={i}
                  onClick={() => handleTabClick(i)}
                  className={`flex-shrink-0 flex flex-col items-center gap-1 px-3 py-2.5 rounded-xl border transition-all ${
                    activeTab === i
                      ? 'bg-white border-[#1B5E3B] shadow-sm'
                      : 'bg-white/50 border-transparent'
                  }`}
                >
                  <span className="text-xl">{s.icon}</span>
                  <span className={`text-[9px] font-bold ${activeTab === i ? 'text-[#1B5E3B]' : 'text-gray-400'}`}>{s.num}</span>
                </button>
              ))}
            </div>

            {/* Desktop: vertical tabs */}
            <div
              className="hidden md:flex flex-col gap-1.5"
              onMouseEnter={() => setPaused(true)}
              onMouseLeave={() => setPaused(false)}
            >
              {SLIDES.map((s, i) => {
                const isActive = activeTab === i;
                return (
                  <button
                    key={i}
                    onClick={() => handleTabClick(i)}
                    className={`relative text-left px-4 py-3 rounded-xl transition-all duration-200 overflow-hidden ${
                      isActive ? 'bg-white shadow-md' : 'hover:bg-white/70'
                    }`}
                    style={{ borderLeft: isActive ? '3px solid #1B5E3B' : '3px solid transparent' }}
                  >
                    <div className="flex items-start gap-2.5">
                      <span className="text-xl leading-none mt-0.5 flex-shrink-0">{s.icon}</span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className={`text-[10px] font-bold tabular-nums ${isActive ? 'text-[#1B5E3B]' : 'text-gray-400'}`}>{s.num}</span>
                          <span className={`text-[11px] font-semibold leading-tight ${isActive ? 'text-[#0D2016]' : 'text-gray-500'}`}>{s.title}</span>
                        </div>
                        {isActive && (
                          <p className="text-[10px] text-gray-400 leading-snug mt-1 pr-1">
                            {s.desc.replace(/\[([^\]]+)\]/g, '$1').replace('\n', ' ')}
                          </p>
                        )}
                      </div>
                    </div>
                    {/* Progress bar */}
                    {isActive && (
                      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gray-100">
                        <div
                          key={`${activeTab}`}
                          className={`h-full channel-progress${paused ? ' paused' : ''}`}
                          style={{ background: 'linear-gradient(90deg, #1B5E3B, #2E7D52)' }}
                        />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: Device frame + Toast */}
          <div
            className={`flex-1 min-w-0 transition-all duration-700 ${isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-12'}`}
            style={{ transitionDelay: '500ms' }}
          >
            <div className="relative">

              {/* Floating toast */}
              <div
                className="absolute z-20 top-[-12px] right-[-12px] sm:right-[-16px] pointer-events-none"
              >
                <div
                  className="bg-white rounded-2xl px-3 py-2 flex items-center gap-2 transition-all duration-500"
                  style={{
                    boxShadow: '0 8px 32px rgba(13,32,22,0.15), 0 0 0 1px rgba(13,32,22,0.05)',
                    opacity: toastVisible ? 1 : 0,
                    transform: toastVisible ? 'translateX(0)' : 'translateX(18px)',
                    maxWidth: '240px',
                  }}
                >
                  <div className="w-6 h-6 rounded-full bg-[#E8F5EE] flex items-center justify-center flex-shrink-0">
                    <div className="w-2 h-2 rounded-full bg-[#1B5E3B]" />
                  </div>
                  <p className="text-[11px] font-medium text-gray-800 leading-tight">{SLIDES[activeTab].toast}</p>
                </div>
              </div>

              {/* macOS browser frame */}
              <div
                className="relative rounded-2xl overflow-hidden bg-white"
                style={{ boxShadow: '0 32px 80px rgba(13,32,22,0.12), 0 0 0 1px rgba(13,32,22,0.05)' }}
              >
                {/* Chrome bar */}
                <div
                  className="flex items-center gap-3 px-4 py-3"
                  style={{ background: 'linear-gradient(180deg, #E8E8E8 0%, #D4D4D4 100%)' }}
                >
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <div className="w-3 h-3 rounded-full bg-[#FF5F57] border border-[#E0443E]" />
                    <div className="w-3 h-3 rounded-full bg-[#FFBD2E] border border-[#DEA123]" />
                    <div className="w-3 h-3 rounded-full bg-[#28CA41] border border-[#1AAB29]" />
                  </div>
                  <div className="flex-1 max-w-[200px] mx-auto bg-white/80 rounded-md px-3 py-1 flex items-center gap-1.5">
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2">
                      <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                    <span className="text-[9px] text-gray-500 font-mono">kizmeal.com/board</span>
                  </div>
                  <div className="flex-shrink-0 w-12" />
                </div>

                {/* Screen */}
                <div className="bg-white relative overflow-hidden" style={{ height: '320px' }}>
                  <div key={activeTab} className="h-full channel-screen-in">
                    <ScreenComp />
                  </div>
                </div>

                {/* Bottom glow */}
                <div
                  className="absolute -bottom-5 left-1/2 -translate-x-1/2 pointer-events-none"
                  style={{
                    width: '70%',
                    height: '40px',
                    background: 'radial-gradient(ellipse, rgba(27,94,59,0.18) 0%, transparent 70%)',
                    filter: 'blur(14px)',
                  }}
                />
              </div>

              {/* Slide title + description below device */}
              <div className="mt-7 text-center px-2">
                <h3 className="font-serif font-semibold text-lg sm:text-xl text-[#0D2016] mb-2 transition-all duration-300">
                  {SLIDES[activeTab].title}
                </h3>
                <p className="text-[#0D2016]/50 text-sm leading-relaxed">
                  {parseDesc(SLIDES[activeTab].desc)}
                </p>
              </div>

              {/* Mobile: dot indicators */}
              <div className="flex md:hidden justify-center gap-2 mt-5">
                {SLIDES.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => handleTabClick(i)}
                    className={`h-1.5 rounded-full transition-all duration-300 ${activeTab === i ? 'w-6 bg-[#1B5E3B]' : 'w-1.5 bg-gray-300'}`}
                    aria-label={`슬라이드 ${i + 1}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
