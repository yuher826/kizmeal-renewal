import type { Metadata } from 'next';
import { PageHero, Breadcrumb, ComingSoonCard, PageFooterCTA, SiteFooter } from '@/components/SubPage';

export const metadata: Metadata = {
  title: 'ICANMEAL | 키즈밀',
  description: '아이들이 직접 만드는 안전한 쿠킹키트 ICANMEAL 단체주문 소개.',
};

export default function Page() {
  return (
    <>
      <PageHero title="ICANMEAL" subtitle="쿠킹키트 단체주문" />
      <Breadcrumb
        items={[
          { label: '홈', href: '/' },
          { label: '사업영역', href: '/business' },
          { label: 'ICANMEAL' },
        ]}
      />
      <section className="max-w-5xl mx-auto py-20 px-4 sm:px-6 lg:px-8">
        <ComingSoonCard hint="아이캔밀 쿠킹키트 라인업, 연령별 구성, 단체 주문 할인과 영양사 레시피가 업데이트될 예정입니다." />
      </section>
      <PageFooterCTA />
      <SiteFooter />
    </>
  );
}
