import type { Metadata } from 'next';
import { PageHero, Breadcrumb, PageFooterCTA, SiteFooter } from '@/components/SubPage';

export const metadata: Metadata = {
  title: 'CEO 인사말 | 키즈밀',
  description: '키즈밀 대표이사 유성모의 인사말과 경영 철학을 전합니다.',
};

const VALUES = [
  {
    icon: '🔄',
    title: '다양한 운영 방식',
    desc: '이동급식, 위탁급식, 교육용 쿠킹키트 등 다양한 운영 형태를 제공합니다. 전문 컨설팅으로 현장에 맞는 최적의 서비스를 제안합니다.',
  },
  {
    icon: '👥',
    title: '검증된 전문가 그룹',
    desc: '메뉴, 구매, 조리, 세척, 배송, CS 등 각 분야 전문가들을 통해 최상의 서비스를 제공합니다.',
  },
  {
    icon: '🛡️',
    title: '확고한 위생',
    desc: '창립 이래 단 한 차례도 변경되지 않은 위생과 식재 기준. 무엇과도 타협할 수 없는 우리의 원칙이자 자부심입니다.',
  },
  {
    icon: '💡',
    title: '끊임없는 혁신',
    desc: '고객 만족도 조사, 계절 맞춤 건강 메뉴, 매월 식생활 자료 제공 등 치열한 노력의 산물입니다.',
  },
];

export default function Page() {
  return (
    <>
      <PageHero title="CEO 인사말" subtitle="대표이사 인사말" />
      <Breadcrumb
        items={[
          { label: '홈', href: '/' },
          { label: '회사소개', href: '/about' },
          { label: 'CEO 인사말' },
        ]}
      />

      <section className="max-w-3xl mx-auto py-20 px-4 sm:px-6 lg:px-8">
        {/* 편지 카드 */}
        <div className="bg-white border border-[#E8F5E9] rounded-2xl p-8 sm:p-12 shadow-sm mb-10">
          <p className="text-gray-700 text-base sm:text-lg leading-relaxed whitespace-pre-line">
            {`안녕하십니까 고객 여러분,
키즈밀 대표이사 유성모입니다.

저희 키즈밀은 건강하고 정직한 먹거리 문화를
선도해가는 아동 전문 친환경 급식업체입니다.

2005년 '아동 전문 식생활의 새로운 패러다임'이라는
기치 아래 설립된 키즈밀은 다년간의 운영 노하우를 통해
프리미엄 급식시장에서 확고한 경쟁력을 구축해오고 있습니다.`}
          </p>
        </div>

        {/* 4개 핵심 가치 카드 2×2 */}
        <div className="grid sm:grid-cols-2 gap-5 mb-12">
          {VALUES.map((v) => (
            <div key={v.title} className="bg-[#E8F5E9] rounded-2xl p-6">
              <div className="text-3xl mb-3">{v.icon}</div>
              <h3 className="font-serif font-bold text-lg text-[#1B4332] mb-2">{v.title}</h3>
              <p className="text-gray-600 text-sm leading-relaxed">{v.desc}</p>
            </div>
          ))}
        </div>

        {/* 마무리 인용구 */}
        <div className="border-l-4 border-[#2D6A4F] pl-6 mb-10">
          <p className="font-serif text-[#1B4332] text-base sm:text-lg leading-relaxed italic">
            &ldquo;아이들에게 건강하고 올바른 먹거리를 제공하는 것이<br className="hidden sm:block" />
            바로 저희의 원칙이자 신념입니다.<br className="hidden sm:block" />
            앞으로도 키즈밀은 그 단순하지만 막중한 사명,<br className="hidden sm:block" />
            흔들리지 않고 지켜 나아갈 것을 약속드립니다.&rdquo;
          </p>
        </div>

        {/* 서명 */}
        <div className="text-right">
          <p className="font-serif font-bold text-[#1B4332] text-lg">대표이사&nbsp;&nbsp;유성모</p>
        </div>
      </section>

      <PageFooterCTA />
      <SiteFooter />
    </>
  );
}
