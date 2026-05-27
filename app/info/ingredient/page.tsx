import type { Metadata } from 'next';
import { PageHero, Breadcrumb, ComingSoonCard, PageFooterCTA, SiteFooter } from '@/components/SubPage';

export const metadata: Metadata = {
  title: '식재료정보 | 키즈밀',
  description: '키즈밀이 사용하는 친환경·국내산 식재료의 원산지와 인증 정보를 공개합니다.',
};

export default function Page() {
  return (
    <>
      <PageHero title="식재료정보" subtitle="믿을 수 있는 식재료" />
      <Breadcrumb
        items={[
          { label: '홈', href: '/' },
          { label: '이달의 정보', href: '/info' },
          { label: '식재료정보' },
        ]}
      />
      <section className="max-w-5xl mx-auto py-20 px-4 sm:px-6 lg:px-8">
        <ComingSoonCard hint="키즈밀에서 사용하는 식재료의 원산지, 친환경 인증 정보, 공급망 투명성 자료가 업데이트될 예정입니다." />
      </section>
      <PageFooterCTA />
      <SiteFooter />
    </>
  );
}
