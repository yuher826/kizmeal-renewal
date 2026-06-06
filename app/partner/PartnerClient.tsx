'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import CustomerChannelSection from '@/components/CustomerChannelSection';

// ── Data ─────────────────────────────────────────────────────────
const BEFORE_AFTER = [
  { before: '전화·카톡 혼재',    after: '채널 하나로 통합' },
  { before: '대화 기록 사라짐',  after: '영구 보관' },
  { before: '파일 찾기 어려움',  after: '키워드 즉시 검색' },
  { before: '처리 여부 불명확',  after: '접수→처리→완료 추적' },
  { before: '학부모 개별 연락',  after: '학부모 포털 자동 알림' },
  { before: '식단표 수동 배포',  after: '식단표 자동 배포' },
];

const STEPS = [
  { num: '01', title: '계약 체결',        desc: '담당자와 간단한 상담 후 계약' },
  { num: '02', title: '3일 이내 세팅 완료', desc: '계정 발급·초기 설정 모두 저희가' },
  { num: '03', title: '바로 사용 시작',    desc: '별도 교육 없이 바로 사용 가능' },
];

const SERVICE_CARDS = [
  {
    icon: '💬',
    title: '파트너 소통채널',
    badge: '서비스 중',
    badgeCls: 'bg-[#E8F5EE] text-[#1B5E3B]',
    desc: '전화·카톡 대신 전용 채널 하나로\n모든 소통과 파일을 한 곳에서',
    active: true,
  },
  {
    icon: '👨‍👩‍👧',
    title: '학부모 포털',
    badge: '서비스 중',
    badgeCls: 'bg-[#E8F5EE] text-[#1B5E3B]',
    desc: '급식사진·식단표·레시피를\n학부모가 앱처럼 바로 확인\n원 전용 QR 코드로 간편 가입\n앱 스토어 설치 없이 바로 사용',
    active: true,
  },
  {
    icon: '🍱',
    title: '식단표 자동 배포',
    badge: '준비중',
    badgeCls: 'bg-gray-100 text-gray-500',
    desc: '매달 전 원 식단표를\n클릭 한 번으로 자동 배포',
    active: false,
  },
];

const FAQS = [
  {
    q: '계약은 어떻게 진행되나요?',
    a: '담당 영양사가 고객사를 방문하거나 전화로 간단한 상담을 진행한 후, 계약서를 작성합니다. 계약 후 3일 이내에 시스템 세팅이 완료됩니다.',
  },
  {
    q: '식단표는 어떻게 받을 수 있나요?',
    a: '매월 말 다음 달 식단표를 전용 소통채널로 발송해드립니다. 학부모 포털에도 자동으로 공유되어 학부모님들이 직접 확인하실 수 있습니다.',
  },
  {
    q: '배송 시간은 언제인가요?',
    a: '기관과 협의된 시간에 맞춰 냉장 차량으로 정시 납품합니다. 주요 납품 시간은 오전 10~11시이며, 특별한 사정이 있을 경우 조율 가능합니다.',
  },
  {
    q: '위생 관리는 어떻게 하나요?',
    a: 'HACCP 인증 시설에서 조리되며, 새벽 3시 식재료 입고부터 냉장 직배송까지 전 과정이 위생 기준에 따라 관리됩니다. 정기적인 위생 점검 결과를 공유해드립니다.',
  },
];

// ── Component ─────────────────────────────────────────────────────
export default function PartnerPageClient() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [showFloat, setShowFloat] = useState(false);

  // Floating button
  useEffect(() => {
    const onScroll = () => setShowFloat(window.scrollY > 200);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Scroll-in animations (same pattern as homepage)
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add('visible')),
      { threshold: 0.12 },
    );
    document.querySelectorAll('.partner-anim').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <main className="overflow-x-hidden">

      {/* ① 히어로 ─────────────────────────────────────── */}
      <section
        className="relative flex flex-col items-center justify-center overflow-hidden"
        style={{
          minHeight: '80vh',
          background: 'linear-gradient(135deg, #1B5E3B 0%, #2E7D52 100%)',
        }}
      >
        {/* 글로우 장식 */}
        <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(183,228,199,0.12), transparent 70%)' }} />
        <div className="absolute -bottom-32 -left-32 w-[500px] h-[500px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(183,228,199,0.08), transparent 70%)' }} />

        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-12 text-center w-full">
          {/* 배지 */}
          <div className="inline-flex items-center gap-2 border border-white/30 rounded-full px-4 py-1.5 mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-[#52B788] animate-pulse" />
            <span className="text-white/80 text-xs font-semibold tracking-[0.2em] uppercase">
              PARTNER SERVICE
            </span>
          </div>

          <h1
            className="font-serif font-bold text-white leading-tight mb-6"
            style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)' }}
          >
            22년의 신뢰,<br />이제 시스템으로 만납니다
          </h1>

          <p className="text-white/70 text-base sm:text-lg leading-relaxed mb-10 max-w-xl mx-auto">
            키즈밀과 함께하는 파트너 원에게<br className="hidden sm:block" />
            제공되는 전용 디지털 서비스입니다.
          </p>

          <Link
            href="/inquiry"
            className="inline-flex items-center gap-2 bg-white text-[#1B5E3B] hover:bg-[#F0FAF4] font-semibold px-8 py-4 rounded-2xl transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
          >
            도입 문의하기 →
          </Link>
        </div>

        {/* 차별점 3개 인라인 */}
        <div className="relative z-10 w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
          <div className="grid grid-cols-3 gap-3 sm:gap-6 bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-4 sm:p-6">
            {[
              { icon: '🌅', title: '새벽 3시', sub: '식재료 입고' },
              { icon: '🏆', title: '22년', sub: '친환경 급식 경력' },
              { icon: '🚚', title: '18대', sub: '냉장 직영 배송' },
            ].map((item, i) => (
              <div key={i} className="text-center">
                <div className="text-xl sm:text-3xl mb-1">{item.icon}</div>
                <div className="text-white font-bold text-base sm:text-xl font-serif">{item.title}</div>
                <div className="text-white/60 text-xs sm:text-sm mt-0.5">{item.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ② Before / After ──────────────────────────────── */}
      <section className="py-24 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <div className="section-divider" />
            <h2 className="font-serif font-bold text-3xl sm:text-4xl text-[#0D2016] anim anim-up partner-anim">
              이런 불편함, 겪어보셨나요?
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 max-w-3xl mx-auto">
            {/* Before */}
            <div className="bg-red-50 border border-red-100 rounded-2xl p-6 anim anim-up partner-anim">
              <div className="flex items-center gap-2 mb-5">
                <span className="w-3 h-3 rounded-full bg-red-400" />
                <span className="font-bold text-red-500 text-sm tracking-wide">Before (기존)</span>
              </div>
              <ul className="space-y-3">
                {BEFORE_AFTER.map((item, i) => (
                  <li key={i} className="flex items-center gap-2.5 text-sm">
                    <span className="text-red-400 flex-shrink-0 font-bold text-base">✕</span>
                    <span className="text-red-700/60 line-through decoration-red-300/60">{item.before}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* After */}
            <div className="bg-[#F0FAF4] border border-[#A8D5B5] rounded-2xl p-6 anim anim-up delay-100 partner-anim">
              <div className="flex items-center gap-2 mb-5">
                <span className="w-3 h-3 rounded-full bg-[#1B5E3B]" />
                <span className="font-bold text-[#1B5E3B] text-sm tracking-wide">After (키즈밀)</span>
              </div>
              <ul className="space-y-3">
                {BEFORE_AFTER.map((item, i) => (
                  <li key={i} className="flex items-center gap-2.5 text-sm">
                    <span className="text-[#1B5E3B] flex-shrink-0 font-bold text-base">✓</span>
                    <span className="text-[#0D2016] font-medium">{item.after}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ③ 소통채널 슬라이드쇼 ─────────────────────────── */}
      <CustomerChannelSection />

      {/* ④ 중간 CTA ─────────────────────────────────────── */}
      <section className="py-20 bg-[#1B5E3B]">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <p className="text-[#52B788] text-sm font-semibold tracking-widest uppercase mb-4 anim anim-up partner-anim">
            READY TO START
          </p>
          <h2 className="font-serif font-bold text-3xl sm:text-4xl text-white mb-8 anim anim-up delay-100 partner-anim">
            지금 바로 시작할 수 있어요
          </h2>
          <Link
            href="/inquiry"
            className="inline-flex items-center gap-2 bg-white text-[#1B5E3B] hover:bg-[#F0FAF4] font-semibold px-8 py-4 rounded-2xl transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 anim anim-up delay-200 partner-anim"
          >
            무료 도입 상담 신청
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </div>
      </section>

      {/* ⑤ 이용 시작 프로세스 ──────────────────────────── */}
      <section className="py-24 bg-[#F8FDF8]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="section-divider" />
            <h2 className="font-serif font-bold text-3xl sm:text-4xl text-[#0D2016] anim anim-up partner-anim">
              도입이 어렵지 않아요
            </h2>
          </div>

          <div className="grid sm:grid-cols-3 gap-6">
            {STEPS.map((step, i) => (
              <div key={i} className={`relative anim anim-up partner-anim delay-${(i + 1) * 100}`}>
                {/* 화살표 */}
                {i < 2 && (
                  <div className="hidden sm:flex absolute top-8 left-[calc(100%-4px)] z-10 items-center justify-center w-8">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#A8D5B5" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </div>
                )}
                <div className="bg-white border border-[#E8F5E9] rounded-2xl p-6 text-center h-full">
                  <div className="w-12 h-12 rounded-full bg-[#1B5E3B] text-white font-bold font-serif text-base flex items-center justify-center mx-auto mb-4">
                    {step.num}
                  </div>
                  <h3 className="font-serif font-bold text-[#0D2016] text-base mb-2">{step.title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ⑥ 서비스 카드 3개 ────────────────────────────── */}
      <section className="py-24 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <div className="section-divider" />
            <h2 className="font-serif font-bold text-3xl sm:text-4xl text-[#0D2016] anim anim-up partner-anim">
              파트너 원을 위한 서비스
            </h2>
          </div>

          <div className="grid sm:grid-cols-3 gap-6 items-stretch">
            {SERVICE_CARDS.map((card, i) => (
              <div
                key={i}
                className={`relative rounded-2xl border p-6 transition-all duration-300 flex flex-col anim anim-up partner-anim delay-${(i + 1) * 100} ${
                  card.active
                    ? 'border-[#E8F5E9] bg-[#F8FDF8] hover:-translate-y-1 hover:shadow-lg'
                    : 'border-gray-200 bg-gray-50 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-[#E8F5EE] flex items-center justify-center text-2xl">
                    {card.icon}
                  </div>
                  <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${card.badgeCls}`}>
                    {card.badge}
                  </span>
                </div>
                <h3 className="font-serif font-bold text-[#0D2016] text-lg mb-2">{card.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed whitespace-pre-line flex-1">{card.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ⑦ FAQ ──────────────────────────────────────────── */}
      <section className="py-24 bg-[#F8FDF8]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <div className="section-divider" />
            <h2 className="font-serif font-bold text-3xl sm:text-4xl text-[#0D2016] anim anim-up partner-anim">
              자주 묻는 질문
            </h2>
          </div>

          <div className="space-y-3">
            {FAQS.map((faq, i) => {
              const isOpen = openIndex === i;
              return (
                /* 애니메이션 래퍼: className 고정 → visible 클래스가 React 재렌더 시 지워지지 않음 */
                <div key={i} className={`anim anim-up partner-anim delay-${(i % 3 + 1) * 100}`}>
                  {/* 상태 기반 div: 애니메이션 클래스 없음 */}
                  <div className={`border rounded-xl overflow-hidden transition-colors duration-200 ${isOpen ? 'border-[#2D6A4F]' : 'border-gray-100'}`}>
                    <button
                      type="button"
                      className="w-full flex items-center justify-between p-5 text-left bg-white hover:bg-[#F8FDF8] transition-colors"
                      onClick={() => setOpenIndex(isOpen ? null : i)}
                    >
                      <span className="font-semibold text-[#0D2016] text-sm sm:text-base pr-4">{faq.q}</span>
                      <span className={`text-[#2D6A4F] transition-transform duration-300 flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </span>
                    </button>
                    <div
                      style={{
                        maxHeight: isOpen ? '300px' : '0',
                        overflow: 'hidden',
                        transition: 'max-height 0.4s ease',
                      }}
                    >
                      <div className="px-5 pb-5 text-gray-500 text-sm leading-relaxed border-t border-gray-50 pt-4">
                        {faq.a}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ⑧ 하단 CTA ─────────────────────────────────────── */}
      <section
        className="py-24 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #1B5E3B 0%, #2E7D52 100%)' }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(circle at 70% 50%, rgba(82,183,136,0.15), transparent 60%)' }}
        />
        <div className="relative z-10 max-w-2xl mx-auto px-4 text-center">
          <h2 className="font-serif font-bold text-3xl sm:text-4xl text-white mb-4 anim anim-up partner-anim">
            파트너 원이 되어보세요
          </h2>
          <p className="text-white/70 text-base sm:text-lg leading-relaxed mb-10 anim anim-up delay-100 partner-anim">
            22년 급식 노하우와 최신 디지털 시스템을<br className="hidden sm:block" />
            함께 경험하세요.
          </p>
          <Link
            href="/inquiry"
            className="inline-flex items-center gap-2 bg-white text-[#1B5E3B] hover:bg-[#F0FAF4] font-semibold px-8 py-4 rounded-2xl transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 anim anim-up delay-200 partner-anim"
          >
            지금 문의하기 →
          </Link>
        </div>
      </section>

      {/* 플로팅 문의 버튼 ────────────────────────────────── */}
      <div
        className={`fixed bottom-6 right-6 z-50 transition-all duration-500 ${
          showFloat ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
      >
        <Link
          href="/inquiry"
          className="flex items-center gap-2 bg-[#1B5E3B] hover:bg-[#0D2016] text-white font-semibold px-5 py-3 rounded-2xl transition-all hover:-translate-y-0.5"
          style={{ boxShadow: '0 8px 32px rgba(27,94,59,0.40)' }}
        >
          <span className="text-lg">💬</span>
          도입 문의하기
        </Link>
      </div>

    </main>
  );
}
