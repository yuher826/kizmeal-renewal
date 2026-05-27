import type { Metadata } from 'next';
import { PageHero, Breadcrumb, ComingSoonCard, PageFooterCTA, SiteFooter } from '@/components/SubPage';

export const metadata: Metadata = {
  title: '이달의 신메뉴 | 키즈밀',
  description: '키즈밀이 이번 달 새롭게 선보이는 메뉴를 소개합니다.',
};

export default function Page() {
  return (
    <>
      <PageHero title="이달의 신메뉴" subtitle="새롭게 선보이는 메뉴" />
      <Breadcrumb
        items={[
          { label: '홈', href: '/' },
          { label: '이달의 정보', href: '/info' },
          { label: '이달의 신메뉴' },
        ]}
      />
      <section className="max-w-5xl mx-auto py-20 px-4 sm:px-6 lg:px-8">
        <ComingSoonCard hint="이달의 신메뉴 사진, 재료, 영양 정보와 영양사 코멘트가 업데이트될 예정입니다." />
      </section>
      <PageFooterCTA />
      <SiteFooter />
    </>
  );
}
