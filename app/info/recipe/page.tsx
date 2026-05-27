import type { Metadata } from 'next';
import { PageHero, Breadcrumb, ComingSoonCard, PageFooterCTA, SiteFooter } from '@/components/SubPage';

export const metadata: Metadata = {
  title: '생생현장레시피 | 키즈밀',
  description: '키즈밀 조리 현장에서 직접 만드는 생생한 레시피를 공유합니다.',
};

export default function Page() {
  return (
    <>
      <PageHero title="생생현장레시피" subtitle="현장에서 직접 만드는 레시피" />
      <Breadcrumb
        items={[
          { label: '홈', href: '/' },
          { label: '이달의 정보', href: '/info' },
          { label: '생생현장레시피' },
        ]}
      />
      <section className="max-w-5xl mx-auto py-20 px-4 sm:px-6 lg:px-8">
        <ComingSoonCard hint="현장 조리사가 직접 알려주는 단체급식용 레시피와 동영상이 업데이트될 예정입니다." />
      </section>
      <PageFooterCTA />
      <SiteFooter />
    </>
  );
}
