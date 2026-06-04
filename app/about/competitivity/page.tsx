import type { Metadata } from 'next';
import { Breadcrumb, PageFooterCTA, SiteFooter } from '@/components/SubPage';

export const metadata: Metadata = {
  title: '경쟁력 | 키즈밀',
  description: '맛은 기본, 안전과 위생은 생명. 키즈밀만의 차별화된 경쟁력을 소개합니다.',
};

const SECTIONS = [
  {
    num: '01',
    title: '메뉴 관리',
    desc: '창립이래 한 번도 변경되지 않은 키즈밀의 식재 기준은 그 어떤 것과도 타협할 수 없는 원칙이자 자부심입니다. 대내외적으로 끊임없이 불거지는 식품 이슈 속에서도 저희가 당당하게 정도를 걸을 수 있었던 것은 이 확고한 기준들을 묵묵히 지켜왔기 때문입니다.',
    bg: 'bg-white',
  },
  {
    num: '02',
    title: '맞춤 식단',
    desc: '다년간 현장 경험을 바탕으로 기관 특성에 맞는 맞춤 식단을 제공합니다. 고객과의 약속을 최우선으로 월간 식단표를 계획적으로 운영합니다.',
    bg: 'bg-[#E8F5E9]',
  },
  {
    num: '03',
    title: '건강지킴이',
    desc: '엄선된 제철식품과 화학조미료 무첨가 원칙. 우리 농산물을 최대한 이용하고 알레르기 학생을 위한 1:1 알레르기 케어를 실시합니다.',
    bg: 'bg-white',
  },
  {
    num: '04',
    title: '고객과 함께',
    desc: '정기적인 고객 만족도 조사, 월별 메뉴 피드백을 통해 호응도 높은 메뉴를 다시 제공하는 LOVE CALL 메뉴를 운영합니다.',
    bg: 'bg-[#E8F5E9]',
  },
];

export default function Page() {
  return (
    <>
      {/* Hero Image */}
      <section className="relative h-72 sm:h-96 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://static.wixstatic.com/media/6db056_ce4c6859040d478d8d18f18ede086348~mv2.jpg"
          alt="경쟁력 헤더"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-[#1B4332]/65" />
        <div className="relative z-10 flex flex-col items-center justify-center h-full text-center px-4 pt-20">
          <h1 className="font-serif font-bold text-white text-4xl lg:text-5xl mb-3">COMPETITIVITY</h1>
          <p className="text-white/85 text-base sm:text-lg mb-2">맛은 기본, 안전과 위생은 생명입니다</p>
          <p className="text-white/65 text-sm sm:text-base max-w-xl">
            20년 이상 쌓인 노하우와 자체 위생 점검 시스템,<br />
            매일 진행되는 영양사 모니터링으로 다가가겠습니다.
          </p>
        </div>
      </section>

      <Breadcrumb
        items={[
          { label: '홈', href: '/' },
          { label: '회사소개', href: '/about' },
          { label: '경쟁력' },
        ]}
      />

      {/* 4개 경쟁력 섹션 */}
      {SECTIONS.map((s) => (
        <section key={s.num} className={`${s.bg} py-16 sm:py-20 px-4 sm:px-6 lg:px-8`}>
          <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-start gap-8">
            <div className="flex-shrink-0">
              <span className="font-serif font-bold text-6xl sm:text-7xl text-[#2D6A4F]/20 leading-none">
                {s.num}
              </span>
            </div>
            <div className="flex-1">
              <h2 className="font-serif font-bold text-2xl sm:text-3xl text-[#1B4332] mb-4">
                {s.title}
              </h2>
              <p className="text-gray-600 text-base leading-relaxed">{s.desc}</p>
            </div>
          </div>
        </section>
      ))}

      <PageFooterCTA />
      <SiteFooter />
    </>
  );
}
