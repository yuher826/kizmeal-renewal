import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHero, Breadcrumb, PageFooterCTA, SiteFooter } from '@/components/SubPage';

export const metadata: Metadata = {
  title: '사업영역 | 키즈밀',
  description: 'KIZMEAL 단체급식과 ICANMEAL 쿠킹키트, 키즈밀의 두 가지 사업영역을 소개합니다.',
};

const CARDS = [
  {
    image: 'https://static.wixstatic.com/media/6db056_3da2625719504f9195a0f39b2f586efd~mv2.jpg',
    title: 'KIZMEAL',
    desc: '친환경 아동 전문 단체급식',
    href: '/business/kizmeal',
  },
  {
    image: 'https://static.wixstatic.com/media/6db056_dc3fcf5ee03040379c580c797e6a9f85~mv2.jpg',
    title: 'I CAN MEAL',
    desc: '교육용 요리활동 쿠킹키트',
    href: '/business/icanmeal',
  },
];

export default function Page() {
  return (
    <>
      <PageHero title="사업영역" subtitle="키즈밀의 두 가지 핵심 서비스" />
      <Breadcrumb items={[{ label: '홈', href: '/' }, { label: '사업영역' }]} />
      <section className="max-w-5xl mx-auto py-20 px-4 sm:px-6 lg:px-8">
        <div className="grid sm:grid-cols-2 gap-6">
          {CARDS.map((c) => (
            <div
              key={c.href}
              className="bg-white border border-[#E8F5E9] rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all group"
            >
              <div className="relative h-56 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={c.image}
                  alt={c.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-[#1B4332]/25" />
              </div>
              <div className="p-8">
                <h3 className="font-serif font-bold text-2xl text-[#1B4332] mb-2">{c.title}</h3>
                <p className="text-gray-500 mb-6">{c.desc}</p>
                <Link
                  href={c.href}
                  className="inline-flex items-center gap-2 bg-[#2D6A4F] hover:bg-[#1B4332] text-white font-medium px-5 py-2.5 rounded-xl transition-colors"
                >
                  자세히 보기 →
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>
      <PageFooterCTA />
      <SiteFooter />
    </>
  );
}
