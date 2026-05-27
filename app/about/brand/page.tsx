import type { Metadata } from 'next';
import { PageHero, Breadcrumb, ComingSoonCard, PageFooterCTA, SiteFooter } from '@/components/SubPage';

export const metadata: Metadata = {
  title: '브랜드 스토리 | 키즈밀',
  description: '키즈밀의 22년 이야기, 브랜드 철학과 비전을 소개합니다.',
};

export default function Page() {
  return (
    <>
      <PageHero title="브랜드 스토리" subtitle="키즈밀의 22년 이야기" />
      <Breadcrumb
        items={[
          { label: '홈', href: '/' },
          { label: '회사소개', href: '/about' },
          { label: '브랜드 스토리' },
        ]}
      />
      <section className="max-w-5xl mx-auto py-20 px-4 sm:px-6 lg:px-8">
        <ComingSoonCard hint="키즈밀의 창립 배경, 22년의 발자취, 핵심 가치와 비전을 담은 브랜드 스토리가 업데이트될 예정입니다." />
      </section>
      <PageFooterCTA />
      <SiteFooter />
    </>
  );
}
