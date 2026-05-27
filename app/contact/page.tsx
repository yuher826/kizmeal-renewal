import type { Metadata } from 'next';
import { PageHero, Breadcrumb, ComingSoonCard, PageFooterCTA, SiteFooter } from '@/components/SubPage';

export const metadata: Metadata = {
  title: '문의하기 | 키즈밀',
  description: '키즈밀에 무엇이든 문의하세요. 담당자가 빠르게 응답해드립니다.',
};

export default function Page() {
  return (
    <>
      <PageHero title="문의하기" subtitle="언제든지 연락주세요" />
      <Breadcrumb items={[{ label: '홈', href: '/' }, { label: '문의하기' }]} />
      <section className="max-w-5xl mx-auto py-20 px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-2 gap-8">
          <div className="bg-[#F8FDF8] border border-[#E8F5E9] rounded-2xl p-8">
            <h2 className="font-serif font-bold text-xl text-[#1B4332] mb-6">연락처</h2>
            <div className="space-y-4">
              {[
                { icon: '📞', label: '전화 상담', val: '031-000-0000' },
                { icon: '📧', label: '이메일', val: 'hello@kizmeal.com' },
                { icon: '🕐', label: '상담 시간', val: '평일 09:00 – 18:00' },
                { icon: '📍', label: '주소', val: '경기도 성남시' },
              ].map((info) => (
                <div key={info.label} className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#E8F5E9] flex items-center justify-center text-lg">
                    {info.icon}
                  </div>
                  <div>
                    <div className="text-[#6B7B6E] text-xs">{info.label}</div>
                    <div className="text-[#1B4332] font-medium">{info.val}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <ComingSoonCard hint="문의 폼, 첨부파일, 카테고리 선택, 자동 회신 메일 기능이 업데이트될 예정입니다." />
        </div>
      </section>
      <PageFooterCTA />
      <SiteFooter />
    </>
  );
}
