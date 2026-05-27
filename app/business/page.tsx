import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHero, Breadcrumb, PageFooterCTA, SiteFooter } from '@/components/SubPage';

export const metadata: Metadata = {
  title: '사업영역 | 키즈밀',
  description: 'KIZMEAL 단체급식과 ICANMEAL 쿠킹키트, 키즈밀의 두 가지 사업영역을 소개합니다.',
};

const CARDS = [
  { icon: '🥗', title: 'KIZMEAL', desc: '친환경 아동 전문 단체급식', href: '/business/kizmeal' },
  { icon: '🍱', title: 'ICANMEAL', desc: '쿠킹키트 단체주문', href: '/business/icanmeal' },
];

export default function Page() {
  return (
    <>
      <PageHero title="사업영역" subtitle="키즈밀의 두 가지 핵심 서비스" />
      <Breadcrumb items={[{ label: '홈', href: '/' }, { label: '사업영역' }]} />
      <section className="max-w-5xl mx-auto py-20 px-4 sm:px-6 lg:px-8">
        <div className="grid sm:grid-cols-2 gap-6">
          {CARDS.map((c) => (
            <Link
              key={c.href}
              href={c.href}
              className="bg-white border border-[#E8F5E9] rounded-2xl p-10 hover:border-[#52B788] hover:-translate-y-1 transition-all shadow-sm hover:shadow-lg"
            >
              <div className="w-16 h-16 rounded-2xl bg-[#E8F5E9] flex items-center justify-center text-3xl mb-5">
                {c.icon}
              </div>
              <h3 className="font-serif font-bold text-2xl text-[#1B4332] mb-2">{c.title}</h3>
              <p className="text-gray-500">{c.desc}</p>
            </Link>
          ))}
        </div>
      </section>
      <PageFooterCTA />
      <SiteFooter />
    </>
  );
}
