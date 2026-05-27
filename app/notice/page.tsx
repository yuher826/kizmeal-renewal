import type { Metadata } from 'next';
import { PageHero, Breadcrumb, ComingSoonCard, PageFooterCTA, SiteFooter } from '@/components/SubPage';

export const metadata: Metadata = {
  title: '공지사항 | 키즈밀',
  description: '키즈밀의 새로운 소식과 안내 사항을 확인하세요.',
};

export default function Page() {
  return (
    <>
      <PageHero title="공지사항" subtitle="키즈밀 새소식" />
      <Breadcrumb items={[{ label: '홈', href: '/' }, { label: '공지사항' }]} />
      <section className="max-w-5xl mx-auto py-20 px-4 sm:px-6 lg:px-8">
        <ComingSoonCard hint="공지사항 목록, 카테고리(긴급/일반/이벤트), 검색 기능이 업데이트될 예정입니다." />
      </section>
      <PageFooterCTA />
      <SiteFooter />
    </>
  );
}
