import type { Metadata } from 'next';
import { PageHero, Breadcrumb, ComingSoonCard, PageFooterCTA, SiteFooter } from '@/components/SubPage';

export const metadata: Metadata = {
  title: '이용후기 | 키즈밀',
  description: '340개 고객사가 들려주는 키즈밀 진솔한 이용 후기.',
};

export default function Page() {
  return (
    <>
      <PageHero title="이용후기" subtitle="340개 고객사의 진솔한 후기" />
      <Breadcrumb items={[{ label: '홈', href: '/' }, { label: '이용후기' }]} />
      <section className="max-w-5xl mx-auto py-20 px-4 sm:px-6 lg:px-8">
        <ComingSoonCard hint="고객사 인터뷰, 학부모 후기, 별점·키워드별 필터 기능이 업데이트될 예정입니다." />
      </section>
      <PageFooterCTA />
      <SiteFooter />
    </>
  );
}
