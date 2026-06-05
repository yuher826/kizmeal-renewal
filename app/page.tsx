'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';

// ── Image constants ──────────────────────────────────────────────
const HERO_IMG =
  'https://static.wixstatic.com/media/6db056_ce4c6859040d478d8d18f18ede086348~mv2.jpg/v1/fill/w_1920,h_1080,al_c,q_90/6db056_ce4c6859040d478d8d18f18ede086348~mv2.jpg';
const FACILITY_BG =
  'https://static.wixstatic.com/media/6db056_0df0ecfdeb2941f783adcd8d75a3f4d8~mv2.jpg/v1/fill/w_1920,h_800,al_c,q_85,enc_auto/6db056_0df0ecfdeb2941f783adcd8d75a3f4d8~mv2.jpg';

function WaveDivider({ from, to }: { from: string; to: string }) {
  return (
    <div style={{ background: from }} className="overflow-hidden leading-[0] block">
      <svg viewBox="0 0 1440 72" preserveAspectRatio="none" className="w-full h-[48px] sm:h-[72px] block">
        <path
          d="M0,36 C120,72 240,0 360,36 C480,72 600,0 720,36 C840,72 960,0 1080,36 C1200,72 1320,0 1440,36 L1440,72 L0,72 Z"
          fill={to}
        />
      </svg>
    </div>
  );
}

const TRUST_ITEMS = [
  { icon: '⭐', title: '22년 운영 경력', desc: '업계 최장수 전문 기업' },
  { icon: '🌿', title: '친환경 식재료', desc: '국내산 친환경 재료 사용' },
  { icon: '✅', title: '영양사 전담 관리', desc: '임상영양사 상시 배치' },
  { icon: '🚛', title: '냉장 직배송', desc: '전용 냉장차 정시 납품' },
];

const MENU_ITEMS = [
  { emoji: '🥗', title: '영양 균형 도시락', desc: '영양사가 직접 설계한 5색 채소·단백질·탄수화물 균형 식단', tag: '인기', color: 'from-green-50 to-emerald-50', border: 'border-emerald-100' },
  { emoji: '🍱', title: '한식 정통 급식', desc: '국물류·나물·반찬이 어우러진 정성스러운 한식 정식 구성', tag: '추천', color: 'from-amber-50 to-orange-50', border: 'border-orange-100' },
  { emoji: '🥕', title: '유아 맞춤 이유식', desc: '월령별 식감·재료 조절, 알레르기 완전 배제 유아 전용 메뉴', tag: '알레르기 FREE', color: 'from-orange-50 to-red-50', border: 'border-red-100' },
  { emoji: '🍲', title: '제철 식재료 특선', desc: '국내산 제철 야채·과일을 활용한 계절 한정 특별 식단', tag: '제철', color: 'from-blue-50 to-cyan-50', border: 'border-cyan-100' },
  { emoji: '🥦', title: '채식·비건 옵션', desc: '동물성 재료 없이 완성된 영양 균형 채식 급식 메뉴', tag: '비건', color: 'from-lime-50 to-green-50', border: 'border-lime-100' },
  { emoji: '🎂', title: '생일·행사 특식', desc: '아이들이 좋아하는 파티 케이크·특별 간식 행사 패키지', tag: '스페셜', color: 'from-pink-50 to-rose-50', border: 'border-pink-100' },
];

const STATS = [
  { key: 'years' as const, value: 22, suffix: '년', label: '운영 경력' },
  { key: 'clients' as const, value: 340, suffix: '+', label: '계약 기관' },
  { key: 'satisfaction' as const, value: 98, suffix: '%', label: '만족도' },
  { key: 'meals' as const, value: 2700000, suffix: '+', label: '누적 제공 식수' },
];

const PROCESS_STEPS = [
  { num: '01', title: '상담 신청', desc: '전화 또는 온라인으로 기관 규모·인원·특이사항을 알려주세요.', icon: '📞' },
  { num: '02', title: '현장 방문 컨설팅', desc: '전담 영양사가 직접 방문해 시설 환경·식습관을 분석합니다.', icon: '🏫' },
  { num: '03', title: '맞춤 식단 설계', desc: '기관 특성에 맞는 월별 식단표·재료 계획을 수립합니다.', icon: '📋' },
  { num: '04', title: '위생 검수·납품', desc: '검증된 시설에서 정성껏 조리 후 냉장차량으로 안전하게 배송합니다.', icon: '🚚' },
];

const REVIEWS = [
  { name: '김○○ 원장님', org: '서울 서초구 어린이집', stars: 5, text: '아이들이 급식 시간을 가장 기다려요. 색깔도 예쁘고 맛도 좋아서 잔반이 거의 없어졌어요. 영양사 선생님도 매달 꼼꼼히 식단 설명해주셔서 부모님들도 만족하십니다.', avatar: '👩‍💼' },
  { name: '이○○ 원장님', org: '경기 분당구 유치원', stars: 5, text: '식재료 원산지 공개부터 알레르기 관리까지 철저하게 해주셔서 믿고 맡기고 있습니다. 3년째 이용 중인데 단 한 번도 문제가 없었어요.', avatar: '👨‍💼' },
  { name: '박○○ 선생님', org: '인천 연수구 어린이집', stars: 5, text: '갑자기 아이 수가 변경되거나 행사가 생겨도 유연하게 대처해주셔서 정말 든든합니다. 고객 응대도 항상 친절하고 빨라요.', avatar: '👩‍🏫' },
];

const FAQS = [
  { q: '최소 몇 명부터 계약이 가능한가요?', a: '10인 이상부터 계약 가능합니다. 소규모 어린이집도 맞춤 식단을 제공해드립니다. 5인 이상의 경우 협의 후 진행 가능하니 먼저 문의해 주세요.' },
  { q: '알레르기 아이도 안전하게 먹을 수 있나요?', a: '네, 입소 시 보호자로부터 알레르기 정보를 제공받아 해당 식재료를 완전히 배제한 별도 식단을 구성합니다. 조리 시 교차오염 방지 프로세스도 철저히 준수합니다.' },
  { q: '식단표를 미리 받아볼 수 있나요?', a: '매월 말 다음 달 식단표를 제공하며, 전용 앱을 통해 실시간으로 확인하실 수 있습니다. 부모님들께도 공유하실 수 있도록 PDF 형태로 발송해드립니다.' },
  { q: '납품 시간은 어떻게 되나요?', a: '기관과 협의된 시간에 맞춰 냉장 차량으로 정시 납품합니다. 주요 납품 시간은 오전 10~11시이며, 특별한 사정이 있을 경우 조율 가능합니다.' },
  { q: '계약 기간과 해지 조건은 어떻게 되나요?', a: '기본 계약 기간은 6개월이며, 1개월 전 사전 통보 시 해지 가능합니다. 특수한 사정(원 폐원, 휴원 등)의 경우 협의 후 조기 해지를 진행합니다.' },
];

export default function Home() {
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [counts, setCounts] = useState({ years: 0, clients: 0, satisfaction: 0, meals: 0 });
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const statsRef = useRef<HTMLDivElement>(null);
  const statsAnimated = useRef(false);

  const animateCounters = useCallback(() => {
    if (statsAnimated.current) return;
    statsAnimated.current = true;
    const duration = 2200;
    const steps = 70;
    const interval = duration / steps;
    STATS.forEach(({ key, value }) => {
      let step = 0;
      const timer = setInterval(() => {
        step++;
        const eased = 1 - Math.pow(1 - step / steps, 3);
        setCounts((prev) => ({ ...prev, [key]: Math.round(value * eased) }));
        if (step >= steps) clearInterval(timer);
      }, interval);
    });
  }, []);

  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 300);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add('visible')),
      { threshold: 0.15 }
    );
    document.querySelectorAll('.anim').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!statsRef.current) return;
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) animateCounters(); },
      { threshold: 0.4 }
    );
    io.observe(statsRef.current);
    return () => io.disconnect();
  }, [animateCounters]);

  return (
    <main className="overflow-x-hidden">

      {/* ── HERO ────────────────────────────────────────── */}
      <section className="relative flex items-center overflow-hidden" style={{ minHeight: '100vh' }}>
        <div
          className="absolute inset-0 z-0"
          style={{
            backgroundImage: `url('${HERO_IMG}')`,
            backgroundSize: 'cover',
            backgroundPosition: 'right center',
            backgroundRepeat: 'no-repeat',
          }}
        />
        <div
          className="absolute inset-0 z-[1]"
          style={{
            background:
              'linear-gradient(to right, rgba(27,67,50,0.97) 0%, rgba(27,67,50,0.97) 35%, rgba(27,67,50,0.85) 55%, rgba(27,67,50,0.60) 75%, rgba(27,67,50,0.30) 100%)',
          }}
        />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-32 w-full">
          <div className="max-w-md">
            <div className="inline-flex items-center border border-[#F4A261]/60 rounded-full px-4 py-1.5 mb-8">
              <span className="text-[#F4A261] text-xs font-semibold tracking-[0.2em] uppercase">
                ECO-FRIENDLY TOTAL FOOD SERVICE
              </span>
            </div>

            <h1 className="font-serif font-bold text-3xl lg:text-5xl text-white leading-[1.2] mb-6">
              아이들의 건강한<br />
              한 끼, 키즈밀이<br />
              책임집니다
            </h1>

            <p className="text-white text-base sm:text-lg leading-relaxed mb-10" style={{ opacity: 0.85 }}>
              우리 아이가 먹는 음식, 키즈밀이 책임집니다.
              <br />
              22년간 매일 아침 정성으로 만든 건강한 한 끼.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href="/inquiry"
                className="inline-flex items-center justify-center gap-2 bg-[#F4A261] hover:bg-[#e8935a] text-white font-semibold px-7 py-4 rounded-2xl transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
              >
                무료 상담 신청하기 →
              </Link>
              <Link
                href="/about"
                className="inline-flex items-center justify-center gap-2 border border-white text-white hover:bg-white/10 font-semibold px-7 py-4 rounded-2xl transition-all"
              >
                서비스 알아보기
              </Link>
            </div>
          </div>
        </div>

        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-10">
          <svg width="28" height="46" viewBox="0 0 28 46" fill="none" xmlns="http://www.w3.org/2000/svg" className="opacity-70">
            <rect x="1" y="1" width="26" height="44" rx="13" stroke="white" strokeWidth="1.5" />
            <rect x="12" y="8" width="4" height="9" rx="2" fill="white" className="animate-float" />
          </svg>
          <span className="text-white/50 text-xs tracking-widest uppercase">scroll</span>
        </div>

        <div className="absolute bottom-0 inset-x-0 z-[5] leading-[0]">
          <svg viewBox="0 0 1440 72" preserveAspectRatio="none" className="w-full h-[48px] sm:h-[72px] block">
            <path d="M0,36 C120,72 240,0 360,36 C480,72 600,0 720,36 C840,72 960,0 1080,36 C1200,72 1320,0 1440,36 L1440,72 L0,72 Z" fill="#1B4332" />
          </svg>
        </div>
      </section>

      {/* ── TRUST BAR ───────────────────────────────────── */}
      <section className="bg-[#1B4332] pt-2 pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-5 items-center mb-6">
            {TRUST_ITEMS.map((c, i) => (
              <div key={i} className="flex items-center gap-3 justify-center md:justify-start">
                <span className="text-xl">{c.icon}</span>
                <div>
                  <p className="text-white font-semibold text-sm">{c.title}</p>
                  <p className="text-white/55 text-xs">{c.desc}</p>
                </div>
              </div>
            ))}
            <div className="col-span-2 md:col-span-1 flex justify-center md:justify-end">
              <span className="inline-flex items-center gap-1.5 bg-white/10 border border-white/20 text-white/80 text-xs font-medium px-4 py-2 rounded-full whitespace-nowrap">
                <span className="text-[#52B788]">📍</span>
                경기도 · 서울 · 인천 · 전국
              </span>
            </div>
          </div>
        </div>
      </section>

      <WaveDivider from="#1B4332" to="#ffffff" />

      {/* ── ABOUT ───────────────────────────────────────── */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="section-divider" />
            <p className="text-[#2D6A4F] text-sm font-semibold tracking-widest uppercase mb-3 anim anim-up">WHY KIZMEAL</p>
            <h2 className="font-serif font-bold text-3xl sm:text-4xl text-[#0D1B0F] mb-4 anim anim-up delay-100">키즈밀이 선택받는 이유</h2>
            <p className="text-gray-500 max-w-xl mx-auto text-base leading-relaxed anim anim-up delay-200">
              22년의 운영 경험과 340개 이상의 계약 기관이 증명하는 신뢰, 키즈밀과 함께하세요.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: '🥗', title: '영양사 전담 식단 설계', desc: '임상영양사 자격을 보유한 전담 영양사가 월별 식단을 설계하고 영양 분석 리포트를 제공합니다. 기관의 연령별 특성에 맞는 최적 식단을 구성합니다.', delay: '' },
              { icon: '🔬', title: '철저한 위생 관리', desc: '식재료 입고부터 조리·포장까지 모든 과정을 국가 기준 위생 매뉴얼로 기록 관리합니다. 매월 위생 검사 결과를 투명하게 공개합니다.', delay: 'delay-200' },
              { icon: '🚛', title: '신선 냉장 직배송', desc: '조리 후 2시간 이내 전용 냉장차로 배송합니다. GPS 실시간 추적과 온도 로깅으로 식품 안전을 끝까지 책임집니다.', delay: 'delay-400' },
            ].map((card, i) => (
              <div key={i} className={`group bg-[#F9FDF9] hover:bg-white border border-[#E8F5E9] hover:border-[#52B788]/40 rounded-2xl p-8 transition-all food-card anim anim-up ${card.delay}`}>
                <div className="w-14 h-14 rounded-2xl bg-[#E8F5E9] flex items-center justify-center text-2xl mb-5 group-hover:scale-110 transition-transform">
                  {card.icon}
                </div>
                <h3 className="font-serif font-bold text-lg text-[#0D1B0F] mb-3">{card.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{card.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <WaveDivider from="#ffffff" to="#1B4332" />

      {/* ── STATS ───────────────────────────────────────── */}
      <section ref={statsRef} className="bg-[#1B4332] py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-10 text-center">
            {STATS.map(({ key, suffix, label }) => (
              <div key={key} className="anim anim-scale">
                <div className="font-serif font-bold text-6xl sm:text-7xl text-white leading-none mb-3">
                  {counts[key].toLocaleString()}
                  <span className="text-[#52B788]">{suffix}</span>
                </div>
                <p className="text-white/60 text-sm font-medium tracking-wide">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <WaveDivider from="#1B4332" to="#F8FDF8" />

      {/* ── MENU ────────────────────────────────────────── */}
      <section className="py-24 bg-[#F8FDF8]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="section-divider" />
            <p className="text-[#2D6A4F] text-sm font-semibold tracking-widest uppercase mb-3 anim anim-up">MENU</p>
            <h2 className="font-serif font-bold text-3xl sm:text-4xl text-[#0D1B0F] mb-4 anim anim-up delay-100">키즈밀 대표 메뉴</h2>
            <p className="text-gray-500 max-w-xl mx-auto text-base leading-relaxed anim anim-up delay-200">
              아이들의 입맛과 영양 모두를 고려한 다양한 급식 메뉴를 제공합니다.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {MENU_ITEMS.map((item, i) => (
              <div
                key={i}
                className={`relative overflow-hidden group rounded-2xl bg-gradient-to-br ${item.color} border ${item.border} p-6 food-card anim anim-up delay-${(i % 4 + 1) * 100}`}
              >
                <div className="flex items-start justify-between mb-4">
                  <span className="text-4xl group-hover:scale-110 transition-transform duration-300">{item.emoji}</span>
                  <span className="bg-white/80 text-[#2D6A4F] text-xs font-semibold px-3 py-1 rounded-full">{item.tag}</span>
                </div>
                <h3 className="font-serif font-bold text-lg text-[#0D1B0F] mb-2">{item.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{item.desc}</p>

                <div className="absolute inset-x-0 bottom-0 bg-[#2D6A4F]/90 backdrop-blur-sm py-3 px-5 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out">
                  <p className="text-white text-sm font-semibold text-center tracking-wide">
                    자세히 보기 →
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-10 anim anim-up delay-500">
            <Link href="/menu" className="inline-flex items-center gap-2 border-2 border-[#2D6A4F] text-[#2D6A4F] hover:bg-[#2D6A4F] hover:text-white font-semibold px-6 py-3 rounded-xl transition-all">
              전체 식단 보기
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
            </Link>
          </div>
        </div>
      </section>

      {/* ── FACILITY ────────────────────────────────────── */}
      <section className="relative py-32 overflow-hidden">
        <Image src={FACILITY_BG} alt="키즈밀 조리 시설" fill className="object-cover" sizes="100vw" />
        <div className="absolute inset-0 bg-[#0D1B0F]/70" />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <div className="section-divider" style={{ margin: '0 0 1.5rem' }} />
            <p className="text-[#52B788] text-sm font-semibold tracking-widest uppercase mb-4 anim anim-left">FACILITY</p>
            <h2 className="font-serif font-bold text-3xl sm:text-4xl text-white mb-6 anim anim-left delay-100">
              최고의 위생 시설에서<br />정성껏 조리합니다
            </h2>
            <p className="text-white/70 text-base leading-relaxed mb-10 anim anim-left delay-200">
              1,200m² 규모의 전용 급식 센터에서 위생과 맛을 동시에 책임집니다.
              식재료 입고부터 조리, 포장, 배송까지 전 과정이 엄격한 위생 기준에 따라 관리됩니다.
            </p>
            <div className="grid grid-cols-2 gap-4 anim anim-left delay-300">
              {[['1,200m²', '전용 급식센터'], ['매일 실시', '위생 점검'], ['-18°C', '냉동 보관'], ['GPS 추적', '배송 관리']].map(([val, label]) => (
                <div key={label} className="glass-card rounded-xl p-4">
                  <div className="font-serif font-bold text-xl text-[#52B788] mb-1">{val}</div>
                  <div className="text-white/70 text-sm">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="absolute bottom-0 inset-x-0 z-[5] leading-[0]">
          <svg viewBox="0 0 1440 72" preserveAspectRatio="none" className="w-full h-[48px] sm:h-[72px] block">
            <path d="M0,36 C120,72 240,0 360,36 C480,72 600,0 720,36 C840,72 960,0 1080,36 C1200,72 1320,0 1440,36 L1440,72 L0,72 Z" fill="#1B4332" />
          </svg>
        </div>
      </section>

      {/* ── ICANMEAL ────────────────────────────────────── */}
      <section className="bg-[#1B4332] py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-[#F4A261]/20 border border-[#F4A261]/40 text-[#F4A261] text-xs font-bold px-3 py-1.5 rounded-full mb-6 tracking-widest uppercase anim anim-left">
                <span className="w-2 h-2 rounded-full bg-[#F4A261] animate-pulse" />
                NEW SERVICE
              </div>
              <h2 className="font-serif font-bold text-3xl sm:text-5xl text-white leading-tight mb-6 anim anim-left delay-100">
                아이캔밀 —<br />쿠킹키트 단체주문
              </h2>
              <p className="text-white/70 text-base sm:text-lg leading-relaxed mb-8 anim anim-left delay-200">
                직접 만들며 배우는 건강한 식습관.
                <br />
                아이캔밀의 안전한 먹거리 쿠킹키트를
                <br />
                단체로 주문하실 수 있습니다.
              </p>
              <div className="flex flex-wrap gap-3 mb-8 anim anim-left delay-300">
                {['안전한 식재료', '연령별 맞춤 구성', '단체 할인 적용', '영양사 레시피 포함'].map((tag) => (
                  <span key={tag} className="bg-white/10 border border-white/20 text-white/80 text-xs px-3 py-1.5 rounded-full">
                    {tag}
                  </span>
                ))}
              </div>
              <Link
                href="/business/icanmeal"
                className="inline-flex items-center gap-2 border-2 border-white/60 hover:border-white text-white hover:bg-white hover:text-[#1B4332] font-semibold px-6 py-3.5 rounded-xl transition-all anim anim-left delay-400"
              >
                자세히 보기
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
              </Link>
            </div>

            <div className="relative anim anim-right delay-200">
              <div className="relative rounded-3xl overflow-hidden aspect-[4/3] shadow-2xl shadow-black/30">
                <Image src={FACILITY_BG} alt="아이캔밀 쿠킹키트" fill className="object-cover" sizes="(max-width: 1024px) 100vw, 50vw" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#1B4332]/60 to-transparent" />
                <div className="absolute bottom-6 left-6 right-6">
                  <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4">
                    <p className="text-white font-serif font-bold text-lg mb-0.5">아이캔밀 쿠킹키트</p>
                    <p className="text-white/70 text-sm">단체 주문 시 최대 30% 할인</p>
                  </div>
                </div>
              </div>
              <div className="absolute -top-4 -right-4 w-28 h-28 rounded-full border-2 border-[#52B788]/30 animate-spin-slow" />
            </div>
          </div>
        </div>
      </section>

      <WaveDivider from="#1B4332" to="#ffffff" />

      {/* ── 소통채널 ────────────────────────────────────── */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <div className="section-divider" />
            <p className="text-[#2D6A4F] text-sm font-semibold tracking-widest uppercase mb-3 anim anim-up">CUSTOMER CHANNEL</p>
            <h2 className="font-serif font-bold text-3xl sm:text-4xl text-[#0D1B0F] mb-4 anim anim-up delay-100">
              전화·카톡·문자, 이제 하나로
            </h2>
            <p className="text-gray-500 max-w-xl mx-auto text-base leading-relaxed anim anim-up delay-200">
              키즈밀 전용 소통 채널에서 담당자와 직접 소통하세요.
              모든 대화 기록이 안전하게 보관됩니다.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-12">
            {[
              { icon: '💬', title: '전용 채널', desc: '전화, 카톡, 문자를 하나의 채널로. 문의 내용이 자동으로 정리됩니다.' },
              { icon: '🔔', title: '실시간 알림', desc: '담당자가 답변하면 즉시 알림. 중요한 메시지를 절대 놓치지 마세요.' },
              { icon: '🔍', title: '히스토리 검색', desc: '지난 모든 대화를 검색하고 확인하세요. 계약서·식단표도 한 곳에서 관리.' },
            ].map((item, i) => (
              <div key={i} className={`text-center p-8 bg-[#F8FDF8] border border-[#E8F5E9] rounded-2xl food-card anim anim-up delay-${(i + 1) * 100}`}>
                <div className="w-14 h-14 rounded-2xl bg-[#E8F5E9] flex items-center justify-center text-2xl mx-auto mb-4">
                  {item.icon}
                </div>
                <h3 className="font-serif font-bold text-lg text-[#0D1B0F] mb-2">{item.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>

          <div className="text-center anim anim-up delay-400">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 bg-[#2D6A4F] hover:bg-[#1B4332] text-white font-semibold px-8 py-4 rounded-2xl transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 btn-primary"
            >
              지금 시작하기
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
            </Link>
          </div>
        </div>
      </section>

      <WaveDivider from="#ffffff" to="#ffffff" />

      {/* ── PROCESS ─────────────────────────────────────── */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="section-divider" />
            <p className="text-[#2D6A4F] text-sm font-semibold tracking-widest uppercase mb-3 anim anim-up">HOW IT WORKS</p>
            <h2 className="font-serif font-bold text-3xl sm:text-4xl text-[#0D1B0F] mb-4 anim anim-up delay-100">서비스 시작 절차</h2>
            <p className="text-gray-500 max-w-xl mx-auto text-base leading-relaxed anim anim-up delay-200">
              간단한 4단계로 키즈밀 서비스를 시작할 수 있습니다.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {PROCESS_STEPS.map((step, i) => (
              <div key={i} className={`relative anim anim-up delay-${(i + 1) * 100}`}>
                {i < 3 && <div className="hidden lg:block absolute top-10 left-[calc(100%-16px)] w-8 h-0.5 bg-[#E8F5E9] z-10" />}
                <div className="bg-[#F8FDF8] border border-[#E8F5E9] rounded-2xl p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="font-serif font-bold text-[#2D6A4F]/30 text-3xl">{step.num}</span>
                    <span className="text-2xl">{step.icon}</span>
                  </div>
                  <h3 className="font-serif font-bold text-[#0D1B0F] mb-2">{step.title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <WaveDivider from="#ffffff" to="#F8FDF8" />

      {/* ── REVIEWS ─────────────────────────────────────── */}
      <section className="py-24 bg-[#F8FDF8]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="section-divider" />
            <p className="text-[#2D6A4F] text-sm font-semibold tracking-widest uppercase mb-3 anim anim-up">REVIEWS</p>
            <h2 className="font-serif font-bold text-3xl sm:text-4xl text-[#0D1B0F] mb-4 anim anim-up delay-100">기관장님들의 이야기</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {REVIEWS.map((r, i) => (
              <div key={i} className={`bg-white border border-[#E8F5E9] rounded-2xl p-6 food-card anim anim-up delay-${(i + 1) * 200}`}>
                <div className="flex text-[#F4A261] mb-4 text-lg">
                  {Array.from({ length: r.stars }).map((_, j) => <span key={j}>★</span>)}
                </div>
                <p className="text-gray-600 text-sm leading-relaxed mb-6 italic">&ldquo;{r.text}&rdquo;</p>
                <div className="flex items-center gap-3 pt-4 border-t border-gray-50">
                  <div className="w-10 h-10 rounded-full bg-[#E8F5E9] flex items-center justify-center text-xl">{r.avatar}</div>
                  <div>
                    <div className="font-semibold text-[#0D1B0F] text-sm">{r.name}</div>
                    <div className="text-gray-400 text-xs">{r.org}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-10 anim anim-up delay-400">
            <Link href="/reviews" className="inline-flex items-center gap-2 border-2 border-[#2D6A4F] text-[#2D6A4F] hover:bg-[#2D6A4F] hover:text-white font-semibold px-6 py-3 rounded-xl transition-all">
              전체 후기 보기
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
            </Link>
          </div>
        </div>
      </section>

      <WaveDivider from="#F8FDF8" to="#ffffff" />

      {/* ── FAQ ─────────────────────────────────────────── */}
      <section className="py-24 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <div className="section-divider" />
            <p className="text-[#2D6A4F] text-sm font-semibold tracking-widest uppercase mb-3 anim anim-up">FAQ</p>
            <h2 className="font-serif font-bold text-3xl sm:text-4xl text-[#0D1B0F] anim anim-up delay-100">자주 묻는 질문</h2>
          </div>

          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <div key={i} className={`border rounded-xl overflow-hidden transition-all anim anim-up delay-${(i % 3 + 1) * 100} ${openFaq === i ? 'border-[#2D6A4F]' : 'border-gray-100'}`}>
                <button
                  className="w-full flex items-center justify-between p-5 text-left bg-white hover:bg-[#F8FDF8] transition-colors"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                >
                  <span className="font-semibold text-[#0D1B0F] text-sm sm:text-base pr-4">{faq.q}</span>
                  <span className={`text-[#2D6A4F] transition-transform duration-300 flex-shrink-0 ${openFaq === i ? 'rotate-180' : ''}`}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                  </span>
                </button>
                <div className={`faq-content ${openFaq === i ? 'open' : ''}`}>
                  <div className="px-5 pb-5 text-gray-500 text-sm leading-relaxed border-t border-gray-50 pt-4">{faq.a}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-10 anim anim-up delay-400">
            <Link href="/faq" className="inline-flex items-center gap-2 text-[#2D6A4F] hover:text-[#1B4332] font-semibold">
              전체 FAQ 보기 →
            </Link>
          </div>
        </div>
      </section>

      <WaveDivider from="#ffffff" to="#1B4332" />

      {/* ── CONTACT ─────────────────────────────────────── */}
      <section className="py-24 bg-[#1B4332]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-start">
            <div>
              <p className="text-[#52B788] text-sm tracking-widest uppercase mb-4 anim anim-left">CONTACT</p>
              <h2 className="font-serif font-bold text-3xl text-white leading-snug anim anim-left delay-100">
                새벽 3시부터 시작되는<br />22년의 약속
              </h2>
              <p className="text-white/70 text-base mt-4 anim anim-left delay-200">
                궁금한 점, 불편한 점<br />무엇이든 말씀해 주세요.<br />담당자가 직접 답변드립니다.
              </p>
            </div>

            <div className="anim anim-right delay-200">
              <div className="bg-white/10 backdrop-blur rounded-2xl p-8 border border-white/20">
                <div className="bg-[#52B788]/20 rounded-full p-3 w-fit">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#52B788" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                </div>
                <h3 className="text-white font-bold text-xl mt-4">온라인 문의</h3>
                <p className="text-white/70 text-sm mt-2">
                  서비스 도입, 가격, 메뉴 등<br />궁금한 점을 편하게 물어보세요.
                </p>
                <Link
                  href="/inquiry"
                  className="block bg-[#52B788] hover:bg-[#3d8b5f] text-white rounded-xl px-6 py-3 mt-6 w-full text-center font-semibold transition-colors duration-200"
                >
                  문의하기 →
                </Link>
                <p className="text-white/40 text-xs mt-3 text-center">영업일 기준 1-2일 내 답변드립니다</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────── */}
      <footer className="bg-[#0D1B0F] py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 mb-10">
            <div className="md:col-span-1">
              <Link href="/" className="flex items-center gap-2.5 mb-4">
                <div className="w-9 h-9 rounded-xl bg-[#2D6A4F] flex items-center justify-center text-white font-bold font-serif text-lg">K</div>
                <span className="font-serif font-bold text-white text-lg">키즈밀</span>
              </Link>
              <p className="text-white/40 text-sm leading-relaxed max-w-xs">
                아이들의 건강한 미래를 위해 최고의 급식을 제공합니다. 22년의 경험과 신뢰로 함께합니다.
              </p>
            </div>
            <div>
              <p className="text-white/70 font-medium text-sm mb-4">회사</p>
              <ul className="space-y-2">
                {[
                  { label: '브랜드 스토리', href: '/about/brand' },
                  { label: '경쟁력', href: '/about/competitivity' },
                  { label: 'CEO 인사말', href: '/about/ceo' },
                ].map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="text-white/40 hover:text-white/80 text-sm transition-colors">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-white/70 font-medium text-sm mb-4">서비스</p>
              <ul className="space-y-2">
                {[
                  { label: 'KIZMEAL', href: '/business/kizmeal' },
                  { label: 'ICANMEAL', href: '/business/icanmeal' },
                  { label: '이번 주 식단', href: '/menu' },
                  { label: '포토갤러리', href: '/gallery' },
                ].map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="text-white/40 hover:text-white/80 text-sm transition-colors">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-white/70 font-medium text-sm mb-4">고객지원</p>
              <ul className="space-y-2">
                {[
                  { label: '공지사항', href: '/notice' },
                  { label: '1:1 문의', href: '/inquiry' },
                  { label: '문의하기', href: '/inquiry' },
                  { label: '개인정보처리방침', href: '/privacy' },
                ].map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="text-white/40 hover:text-white/80 text-sm transition-colors">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="border-t border-white/10 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-white/30 text-xs">© 2024 키즈밀(KIZMEAL). All rights reserved.</p>
            <p className="text-white/30 text-xs">사업자등록번호: 140-81-17846 | 대표: 유성모 | 경기도 안양시 동안구 흥안대로439번길 30 8층 815호</p>
          </div>
        </div>
      </footer>

      {showScrollTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-6 right-6 z-50 w-11 h-11 bg-[#2D6A4F] hover:bg-[#1B4332] text-white rounded-full shadow-lg flex items-center justify-center transition-all hover:-translate-y-0.5"
          aria-label="맨 위로"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" /></svg>
        </button>
      )}
    </main>
  );
}
