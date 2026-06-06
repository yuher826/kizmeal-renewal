import Link from 'next/link';
import CustomerChannelSection from '@/components/CustomerChannelSection';

export const metadata = {
  title: '파트너 서비스 | 키즈밀',
  description: '키즈밀과 함께하는 파트너 원에게 제공되는 전용 서비스입니다.',
};

export default function PartnerPage() {
  return (
    <main className="overflow-x-hidden">

      {/* ① 히어로 */}
      <section
        className="relative flex items-center justify-center overflow-hidden"
        style={{ minHeight: '72vh' }}
      >
        {/* 그라데이션 배경 */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(135deg, #0D2016 0%, #1B4332 40%, #2D6A4F 75%, #52B788 100%)',
          }}
        />
        {/* 원형 글로우 장식 */}
        <div
          className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full opacity-20 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #52B788, transparent 70%)' }}
        />
        <div
          className="absolute -bottom-24 -left-24 w-[400px] h-[400px] rounded-full opacity-10 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #B7E4C7, transparent 70%)' }}
        />

        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-24 text-center">
          {/* 배지 */}
          <div className="inline-flex items-center gap-2 border border-[#52B788]/50 rounded-full px-4 py-1.5 mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-[#52B788] animate-pulse" />
            <span className="text-[#52B788] text-xs font-semibold tracking-[0.2em] uppercase">
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
            제공되는 전용 서비스입니다.
          </p>

          <Link
            href="/inquiry"
            className="inline-flex items-center gap-2 bg-[#52B788] hover:bg-[#40916C] text-white font-semibold px-8 py-4 rounded-2xl transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
          >
            도입 문의하기
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </div>
      </section>

      {/* ② 소통채널 섹션 재사용 */}
      <CustomerChannelSection />

      {/* ③ Coming Soon */}
      <section className="py-24 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <div className="section-divider" />
            <h2 className="font-serif font-bold text-3xl sm:text-4xl text-[#0D2016] mt-2">
              더 많은 서비스가 준비 중이에요
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {/* 카드 1 */}
            <div className="relative rounded-2xl border border-[#E8F5E9] bg-[#F8FDF8] p-8 overflow-hidden">
              {/* 흐림 오버레이 */}
              <div className="absolute inset-0 backdrop-blur-[1px] bg-white/30 rounded-2xl z-10" />
              <div className="relative z-0">
                <div className="w-14 h-14 rounded-2xl bg-[#E8F5E9] flex items-center justify-center text-3xl mb-5">
                  🍱
                </div>
                <h3 className="font-serif font-bold text-xl text-[#0D2016] mb-2">식단표 자동 배포</h3>
                <p className="text-gray-500 text-sm leading-relaxed">
                  매달 49개 원 식단표를<br />클릭 한 번으로 자동 배포
                </p>
              </div>
              <div className="absolute top-4 right-4 z-20">
                <span className="text-[11px] font-bold px-3 py-1.5 rounded-full bg-[#1B5E3B] text-white tracking-wide">
                  COMING SOON
                </span>
              </div>
            </div>

            {/* 카드 2 */}
            <div className="relative rounded-2xl border border-[#E8F5E9] bg-[#F8FDF8] p-8 overflow-hidden">
              <div className="absolute inset-0 backdrop-blur-[1px] bg-white/30 rounded-2xl z-10" />
              <div className="relative z-0">
                <div className="w-14 h-14 rounded-2xl bg-[#E8F5E9] flex items-center justify-center text-3xl mb-5">
                  👨‍👩‍👧
                </div>
                <h3 className="font-serif font-bold text-xl text-[#0D2016] mb-2">학부모 포털</h3>
                <p className="text-gray-500 text-sm leading-relaxed">
                  우리 아이 급식사진·식단표를<br />학부모가 직접 확인
                </p>
              </div>
              <div className="absolute top-4 right-4 z-20">
                <span className="text-[11px] font-bold px-3 py-1.5 rounded-full bg-gray-400 text-white tracking-wide">
                  준비중
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ④ 하단 CTA */}
      <section className="py-20 bg-[#E8F5EE]">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <h2 className="font-serif font-bold text-3xl sm:text-4xl text-[#0D2016] mb-4">
            파트너 원이 되어보세요
          </h2>
          <p className="text-[#0D2016]/50 text-base mb-8">
            키즈밀의 22년 노하우와 전용 시스템을 함께 사용하세요.
          </p>
          <Link
            href="/inquiry"
            className="inline-flex items-center gap-2 bg-[#1B5E3B] hover:bg-[#0D2016] text-white font-semibold px-8 py-4 rounded-2xl transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
          >
            지금 문의하기
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </div>
      </section>

    </main>
  );
}
