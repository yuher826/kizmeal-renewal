import type { Metadata } from 'next';
import { PageHero, Breadcrumb, ComingSoonCard, PageFooterCTA, SiteFooter } from '@/components/SubPage';

export const metadata: Metadata = {
  title: 'CEO 인사말 | 키즈밀',
  description: '키즈밀 대표이사의 인사말과 경영 철학을 전합니다.',
};

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
      <section className="max-w-5xl mx-auto py-20 px-4 sm:px-6 lg:px-8">
        <ComingSoonCard hint="대표이사 인사말과 키즈밀의 경영 철학, 고객과 아이들에게 전하는 약속이 업데이트될 예정입니다." />
      </section>
      <PageFooterCTA />
      <SiteFooter />
    </>
  );
}
