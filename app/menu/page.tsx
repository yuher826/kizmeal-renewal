import type { Metadata } from 'next';
import { PageHero, Breadcrumb, ComingSoonCard, PageFooterCTA, SiteFooter } from '@/components/SubPage';

export const metadata: Metadata = {
  title: '이번 주 식단 | 키즈밀',
  description: '키즈밀이 이번 주에 제공하는 정성스러운 식단표를 확인하세요.',
};

export default function Page() {
  return (
    <>
      <PageHero title="이번 주 식단" subtitle="정성으로 만든 건강한 한 끼" />
      <Breadcrumb items={[{ label: '홈', href: '/' }, { label: '이번 주 식단' }]} />
      <section className="max-w-5xl mx-auto py-20 px-4 sm:px-6 lg:px-8">
        <ComingSoonCard hint="이번 주 요일별 식단표, 알레르기 정보, 영양 분석 리포트가 업데이트될 예정입니다." />
      </section>
      <PageFooterCTA />
      <SiteFooter />
    </>
  );
}
