import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHero, Breadcrumb, PageFooterCTA, SiteFooter } from '@/components/SubPage';

export const metadata: Metadata = {
  title: '회사소개 | 키즈밀',
  description: '22년 경력의 키즈밀, 브랜드 스토리·경쟁력·CEO 인사말·시설 안내를 한 곳에서 확인하세요.',
};

const CARDS = [
  {
    icon: '👋',
    title: 'CEO 인사말',
    desc: '키즈밀의 경영 철학과 비전',
    href: '/about/ceo',
  },
  {
    icon: '🏢',
    title: '브랜드 스토리',
    desc: '22년간 걸어온 키즈밀의 발자취',
    href: '/about/brand',
  },
  {
    icon: '💪',
    title: '경쟁력',
    desc: '키즈밀만의 차별화된 강점',
    href: '/about/competitivity',
  },
  {
    icon: '🏭',
    title: '시설 안내',
    desc: '청결하고 체계적인 시설 시스템',
    href: '/facility',
  },
];

export default function Page() {
  return (
    <>
      <PageHero title="회사소개" subtitle="키즈밀이 걸어온 길과 가치" />
      <Breadcrumb items={[{ label: '홈', href: '/' }, { label: '회사소개' }]} />
      <section className="max-w-5xl mx-auto py-20 px-4 sm:px-6 lg:px-8">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {CARDS.map((c) => (
            <Link
              key={c.href}
              href={c.href}
              className="bg-white border border-[#E8F5E9] rounded-2xl p-8 hover:border-[#52B788] hover:-translate-y-1 transition-all shadow-sm hover:shadow-lg"
            >
              <div className="w-14 h-14 rounded-2xl bg-[#E8F5E9] flex items-center justify-center text-2xl mb-4">
                {c.icon}
              </div>
              <h3 className="font-serif font-bold text-lg text-[#1B4332] mb-2">{c.title}</h3>
              <p className="text-gray-500 text-sm">{c.desc}</p>
            </Link>
          ))}
        </div>
      </section>
      <PageFooterCTA />
      <SiteFooter />
    </>
  );
}
