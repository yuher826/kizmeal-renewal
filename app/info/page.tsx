import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHero, Breadcrumb, PageFooterCTA, SiteFooter } from '@/components/SubPage';

export const metadata: Metadata = {
  title: '이달의 정보 | 키즈밀',
  description: '건강정보지·신메뉴·현장 레시피·식재료 정보를 한 곳에서 만나보세요.',
};

const CARDS = [
  { icon: '📰', title: '건강정보지', desc: '건강한 식생활 정보', href: '/info/health' },
  { icon: '⭐', title: '이달의 신메뉴', desc: '새롭게 선보이는 메뉴', href: '/info/newmenu' },
  { icon: '👨‍🍳', title: '생생현장레시피', desc: '현장에서 직접 만드는 레시피', href: '/info/recipe' },
  { icon: '🌿', title: '식재료정보', desc: '믿을 수 있는 식재료', href: '/info/ingredient' },
];

export default function Page() {
  return (
    <>
      <PageHero title="이달의 정보" subtitle="키즈밀이 전하는 식생활 인사이트" />
      <Breadcrumb items={[{ label: '홈', href: '/' }, { label: '이달의 정보' }]} />
      <section className="max-w-5xl mx-auto py-20 px-4 sm:px-6 lg:px-8">
        <div className="grid sm:grid-cols-2 gap-6">
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
