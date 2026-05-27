import type { Metadata } from 'next';
import { PageHero, Breadcrumb, ComingSoonCard, PageFooterCTA, SiteFooter } from '@/components/SubPage';

export const metadata: Metadata = {
  title: '자주 묻는 질문 | 키즈밀',
  description: '키즈밀 이용 시 자주 묻는 질문과 답변을 확인하세요.',
};

export default function Page() {
  return (
    <>
      <PageHero title="자주 묻는 질문" subtitle="궁금한 점을 해결해드립니다" />
      <Breadcrumb items={[{ label: '홈', href: '/' }, { label: '자주 묻는 질문' }]} />
      <section className="max-w-5xl mx-auto py-20 px-4 sm:px-6 lg:px-8">
        <ComingSoonCard hint="카테고리별 FAQ, 검색 기능, 추천 질문이 업데이트될 예정입니다." />
      </section>
      <PageFooterCTA />
      <SiteFooter />
    </>
  );
}
