import type { Metadata } from 'next';
import { PageHero, Breadcrumb, ComingSoonCard, PageFooterCTA, SiteFooter } from '@/components/SubPage';

export const metadata: Metadata = {
  title: '경쟁력 | 키즈밀',
  description: '키즈밀이 340개 이상의 기관에서 선택받는 이유를 소개합니다.',
};

export default function Page() {
  return (
    <>
      <PageHero title="경쟁력" subtitle="키즈밀이 특별한 이유" />
      <Breadcrumb
        items={[
          { label: '홈', href: '/' },
          { label: '회사소개', href: '/about' },
          { label: '경쟁력' },
        ]}
      />
      <section className="max-w-5xl mx-auto py-20 px-4 sm:px-6 lg:px-8">
        <ComingSoonCard hint="영양사 전담 식단 설계, 위생 관리 시스템, 냉장 직배송 등 키즈밀만의 핵심 경쟁력이 자세히 소개될 예정입니다." />
      </section>
      <PageFooterCTA />
      <SiteFooter />
    </>
  );
}
