import type { Metadata } from 'next';
import { PageHero, Breadcrumb, ComingSoonCard, PageFooterCTA, SiteFooter } from '@/components/SubPage';

export const metadata: Metadata = {
  title: '건강정보지 | 키즈밀',
  description: '아이들의 건강한 식생활을 위한 정보를 매월 업데이트합니다.',
};

export default function Page() {
  return (
    <>
      <PageHero title="건강정보지" subtitle="건강한 식생활 정보" />
      <Breadcrumb
        items={[
          { label: '홈', href: '/' },
          { label: '이달의 정보', href: '/info' },
          { label: '건강정보지' },
        ]}
      />
      <section className="max-w-5xl mx-auto py-20 px-4 sm:px-6 lg:px-8">
        <ComingSoonCard hint="월별 건강정보지 — 영양 칼럼, 계절별 식단 팁, 영유아 식습관 가이드가 업데이트될 예정입니다." />
      </section>
      <PageFooterCTA />
      <SiteFooter />
    </>
  );
}
