import type { Metadata } from 'next';
import { Breadcrumb, PageFooterCTA, SiteFooter } from '@/components/SubPage';

export const metadata: Metadata = {
  title: 'ICANMEAL | 키즈밀',
  description: '아이들이 직접 만드는 교육용 요리활동 쿠킹키트 ICANMEAL 소개.',
};

const LEARN_CARDS = [
  {
    icon: '🌍',
    title: '문화와 전통',
    desc: '쿠킹키트는 12절기, 명절, 세계음식, 제철 식재료 등 다양한 주제로 구성되어 있어요. 요리활동을 통해 전통과 세계문화를 배우고 식재료에 대한 흥미를 높일 수 있답니다!',
  },
  {
    icon: '👁️',
    title: '오감 발달',
    desc: '요리활동은 신체의 오감(시각/청각/후각/촉각/미각)을 자극하여 지능과 감성을 발달시켜요!',
  },
  {
    icon: '🥦',
    title: '올바른 식습관',
    desc: '식재료가 음식으로 변화하는 과정에 직접 참여함으로써 편식하지 않는 올바른 식생활을 갖출 수 있어요!',
  },
  {
    icon: '🤝',
    title: '협동심',
    desc: '함께하는 요리활동을 통해 서로 돕고 협력하는 태도를 기를 수 있어요!',
  },
];

const GROW_CARDS = [
  {
    icon: '🧠',
    title: '소근육 발달',
    desc: '요리활동은 손가락의 작은 근육을 사용하므로 뇌/신경 성장에 도움이 되는 소근육 발달을 키워줘요!',
  },
  {
    icon: '💚',
    title: '정서 안정',
    desc: '유아기는 감정이 풍부해지고 자아가 형성되는 중요한 시기에요. 말로 표현하기 어려운 감정 및 스트레스를 요리활동을 통해 해소할 수 있답니다!',
  },
  {
    icon: '⭐',
    title: '자신감',
    desc: '요리가 완성되는 과정을 통해 사고를 확장하고 자신감을 키울 수 있어요!',
  },
];

export default function Page() {
  return (
    <>
      {/* Hero */}
      <section className="relative h-72 sm:h-96 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://static.wixstatic.com/media/6db056_dc3fcf5ee03040379c580c797e6a9f85~mv2.jpg"
          alt="ICANMEAL 헤더"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-[#1B4332]/65" />
        <div className="relative z-10 flex flex-col items-center justify-center h-full text-center px-4 pt-20">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://static.wixstatic.com/media/6db056_0014f085b033470cbbf1d42471b67dae~mv2.png"
            alt="ICANMEAL 로고"
            className="h-14 sm:h-18 object-contain mb-3"
          />
          <p className="text-white/80 text-base sm:text-lg">교육용 요리활동 쿠킹키트</p>
        </div>
      </section>

      <Breadcrumb
        items={[
          { label: '홈', href: '/' },
          { label: '사업영역', href: '/business' },
          { label: 'ICANMEAL' },
        ]}
      />

      {/* Section 1 — 감성 헤더 */}
      <section className="max-w-4xl mx-auto py-20 px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="font-serif font-bold text-3xl sm:text-4xl text-[#1B4332] mb-6">
          교육용 요리활동 쿠킹키트, I CAN MEAL
        </h2>
        <p className="text-gray-600 text-base sm:text-lg leading-relaxed mb-5">
          아이들과 즐겁게 홈스쿨링 놀이를 찾고 계신 부모님,<br />
          요리수업 키트가 필요하신 유아교육 기관 및 선생님들을 위한
        </p>
        <p className="font-serif font-bold text-xl sm:text-2xl text-[#2D6A4F]">
          지식은 쏙쏙 넣어주고 창의력은 쑥쑥 자라는 I CAN MEAL!
        </p>
      </section>

      {/* Section 2 — 배움의 즐거움 */}
      <section className="bg-[#E8F5E9] py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <h2 className="font-serif font-bold text-3xl sm:text-4xl text-[#1B4332] text-center mb-12">
            배움이 즐거워지는 I CAN MEAL!
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {LEARN_CARDS.map((card) => (
              <div key={card.title} className="bg-white rounded-2xl p-6 shadow-sm">
                <div className="text-3xl mb-3">{card.icon}</div>
                <h3 className="font-serif font-bold text-lg text-[#1B4332] mb-2">{card.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{card.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Section 3 — 몸과 마음 */}
      <section className="max-w-5xl mx-auto py-20 px-4 sm:px-6 lg:px-8">
        <h2 className="font-serif font-bold text-3xl sm:text-4xl text-[#1B4332] text-center mb-12">
          몸과 마음이 튼튼해지는 I CAN MEAL!
        </h2>
        <div className="grid sm:grid-cols-3 gap-6">
          {GROW_CARDS.map((card) => (
            <div key={card.title} className="bg-[#F9FAFB] border border-[#E8F5E9] rounded-2xl p-6">
              <div className="text-3xl mb-3">{card.icon}</div>
              <h3 className="font-serif font-bold text-lg text-[#1B4332] mb-2">{card.title}</h3>
              <p className="text-gray-600 text-sm leading-relaxed">{card.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Section 4 — 키트 이미지 갤러리 */}
      <section className="max-w-5xl mx-auto pb-20 px-4 sm:px-6 lg:px-8">
        <div className="grid sm:grid-cols-2 gap-5">
          <div className="rounded-2xl overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://static.wixstatic.com/media/6db056_bdb238ec8c9d4678b298f5225b4a60b1~mv2.jpg"
              alt="ICANMEAL 쿠킹키트 1"
              className="w-full h-64 sm:h-80 object-cover"
            />
          </div>
          <div className="rounded-2xl overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://static.wixstatic.com/media/6db056_81305711f6b5492885dde408c35d003a~mv2.jpg"
              alt="ICANMEAL 쿠킹키트 2"
              className="w-full h-64 sm:h-80 object-cover"
            />
          </div>
        </div>
      </section>

      <PageFooterCTA />
      <SiteFooter />
    </>
  );
}
