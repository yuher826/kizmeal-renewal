import type { Metadata } from 'next';
import { PageHero, Breadcrumb, ComingSoonCard, PageFooterCTA, SiteFooter } from '@/components/SubPage';

export const metadata: Metadata = {
  title: '개인정보처리방침 | 키즈밀',
  description: '키즈밀의 개인정보 수집·이용·보관에 관한 방침을 안내합니다.',
};

export default function Page() {
  return (
    <>
      <PageHero title="개인정보처리방침" subtitle="개인정보의 안전한 처리 약속" />
      <Breadcrumb items={[{ label: '홈', href: '/' }, { label: '개인정보처리방침' }]} />
      <section className="max-w-5xl mx-auto py-20 px-4 sm:px-6 lg:px-8">
        <ComingSoonCard hint="개인정보 수집 항목, 이용 목적, 보관 기간, 제3자 제공 정책이 업데이트될 예정입니다." />
      </section>
      <PageFooterCTA />
      <SiteFooter />
    </>
  );
}
