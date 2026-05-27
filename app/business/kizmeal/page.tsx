import type { Metadata } from 'next';
import { PageHero, Breadcrumb, ComingSoonCard, PageFooterCTA, SiteFooter } from '@/components/SubPage';

export const metadata: Metadata = {
  title: 'KIZMEAL | 키즈밀',
  description: '친환경 아동 전문 단체급식 KIZMEAL 서비스 소개.',
};

export default function Page() {
  return (
    <>
      <PageHero title="KIZMEAL" subtitle="친환경 아동 전문 단체급식" />
      <Breadcrumb
        items={[
          { label: '홈', href: '/' },
          { label: '사업영역', href: '/business' },
          { label: 'KIZMEAL' },
        ]}
      />
      <section className="max-w-5xl mx-auto py-20 px-4 sm:px-6 lg:px-8">
        <ComingSoonCard hint="키즈밀 단체급식 서비스의 메뉴 구성, 식재료 관리, 운영 프로세스 상세 정보가 업데이트될 예정입니다." />
      </section>
      <PageFooterCTA />
      <SiteFooter />
    </>
  );
}
