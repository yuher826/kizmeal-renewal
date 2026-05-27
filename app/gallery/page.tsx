import type { Metadata } from 'next';
import { PageHero, Breadcrumb, ComingSoonCard, PageFooterCTA, SiteFooter } from '@/components/SubPage';

export const metadata: Metadata = {
  title: '포토갤러리 | 키즈밀',
  description: '키즈밀의 생생한 현장 사진과 행사 갤러리를 만나보세요.',
};

export default function Page() {
  return (
    <>
      <PageHero title="포토갤러리" subtitle="키즈밀의 생생한 현장" />
      <Breadcrumb items={[{ label: '홈', href: '/' }, { label: '포토갤러리' }]} />
      <section className="max-w-5xl mx-auto py-20 px-4 sm:px-6 lg:px-8">
        <ComingSoonCard hint="조리시설, 배송 현장, 어린이집·유치원 급식 시간의 생생한 사진이 업데이트될 예정입니다." />
      </section>
      <PageFooterCTA />
      <SiteFooter />
    </>
  );
}
