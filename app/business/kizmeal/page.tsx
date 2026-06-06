import type { Metadata } from 'next';
import { Breadcrumb, PageFooterCTA, SiteFooter } from '@/components/SubPage';

export const metadata: Metadata = {
  title: 'KIZMEAL | 키즈밀',
  description: '친환경 아동 전문 단체급식 KIZMEAL 서비스 소개.',
};

export default function Page() {
  return (
    <>
      {/* Hero */}
      <section className="relative h-72 sm:h-96 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://static.wixstatic.com/media/6db056_3da2625719504f9195a0f39b2f586efd~mv2.jpg"
          alt="KIZMEAL 헤더"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-[#1B4332]/65" />
        <div className="relative z-10 flex flex-col items-center justify-center h-full text-center px-4 pt-20">
          <h1 className="font-serif font-bold text-white text-4xl lg:text-5xl mb-3">KIZMEAL</h1>
          <p className="text-white/80 text-base sm:text-lg">친환경 아동 전문 단체급식</p>
        </div>
      </section>

      <Breadcrumb
        items={[
          { label: '홈', href: '/' },
          { label: '사업영역', href: '/business' },
          { label: 'KIZMEAL' },
        ]}
      />

      {/* Section 1 — 감성 헤더 */}
      <section className="max-w-4xl mx-auto py-20 px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="font-serif font-bold text-3xl sm:text-4xl text-[#1B4332] mb-6">
          최고의 자부심에는 이유가 있습니다
        </h2>
        <p className="text-gray-600 text-base sm:text-lg leading-relaxed">
          키즈밀은 친환경 아동 전문 단체급식 (Total Food Service) 업체로서,
          다년간의 단체급식 사업으로 축적된 Know-How와 아동영양교육 관련
          연구개발을 바탕으로, 종합 아동 식생활 문화 창출과
          고객의 풍요로운 삶을 추구하고 있습니다.
        </p>
      </section>

      {/* Section 2 — 서비스 유형 */}
      <section className="max-w-5xl mx-auto pb-20 px-4 sm:px-6 lg:px-8">
        <div className="grid sm:grid-cols-2 gap-6">
          {/* 이동급식 카드 */}
          <div className="bg-[#E8F5E9] rounded-2xl p-8 sm:p-10">
            <div className="text-4xl mb-4">🚚</div>
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <h3 className="font-serif font-bold text-2xl text-[#1B4332]">이동급식 (CK)</h3>
              <span className="bg-[#2D6A4F] text-white text-xs px-2.5 py-1 rounded-full font-medium whitespace-nowrap">
                Central Kitchen
              </span>
            </div>
            <p className="text-gray-600 leading-relaxed">
              원내 조리시설이 구비돼있지 않은 고객사를 대상으로
              키즈밀 CK(Central Kitchen)에서 당일 조리한 음식을,
              온도 조절장치가 갖춰진 식품 전용 냉장탑차량으로
              매일 배송·회수해드리는 운영 형태입니다.
            </p>
          </div>

          {/* 위탁급식 카드 */}
          <div className="bg-white border border-gray-200 rounded-2xl p-8 sm:p-10">
            <div className="text-4xl mb-4">🏫</div>
            <h3 className="font-serif font-bold text-2xl text-[#1B4332] mb-2">위탁급식</h3>
            <p className="text-xs text-[#2D6A4F] font-medium mb-4">[식품위생법시행령] 제21조 제8호 마목</p>
            <p className="text-gray-600 leading-relaxed">
              시설 자체 내에 조리 및 급식운영 관리가 힘든 경우
              급식전문업체에게 위탁하여 이루어지는 급식 시스템입니다.
              친환경 아동급식을 원하는 고객에게 전문적인
              급식 운영 서비스를 책임있게 제공해 드립니다.
            </p>
          </div>
        </div>
      </section>

      {/* Section 3 — 차별점 */}
      <section className="bg-[#2D6A4F] py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="font-serif font-bold text-3xl sm:text-4xl text-white mb-5">
            키즈밀 급식은 어떤 점이 다른가요?
          </h2>
          <p className="text-white/80 text-base sm:text-lg leading-relaxed mb-4">
            최고의 교육은 고객사에서,<br />
            안전하고 바른 급식은 전문 기업 키즈밀이 제공해 드립니다.
          </p>
          <p className="text-white/65 text-base leading-relaxed max-w-2xl mx-auto mb-14">
            22년간의 친환경 급식 노하우를 기반으로
            영양전문 관리자가 체계적이고 균형 잡힌 영양공급,
            위생적이고 안전한 전문 급식을 제공합니다.
          </p>
          <div className="grid grid-cols-3 gap-6 sm:gap-10 max-w-2xl mx-auto">
            {[
              { stat: '22년', label: '친환경 급식 경력' },
              { stat: '18대', label: '냉장 전용 차량' },
              { stat: '새벽 3시', label: '매일 배송 시작' },
            ].map((item) => (
              <div key={item.stat} className="text-center">
                <p className="font-serif font-bold text-3xl sm:text-4xl text-white mb-1">{item.stat}</p>
                <p className="text-white/60 text-xs sm:text-sm">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Section 4 — CI STORY */}
      <section className="max-w-4xl mx-auto py-20 px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="font-serif font-bold text-3xl sm:text-4xl text-[#1B4332] mb-10">C.I. STORY</h2>
        <div className="flex justify-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://static.wixstatic.com/media/6db056_efa99d0b2d684f249f37e96ac82c72e8~mv2.png"
            alt="KIZMEAL CI"
            className="max-w-[280px] sm:max-w-sm w-full object-contain"
          />
        </div>
        <p className="text-gray-600 text-base sm:text-lg leading-relaxed">
          KIZMEAL은 친환경 급식을 기반으로<br />
          여러 브랜드를 아우르고 있는 복합적 기업입니다.
        </p>
      </section>

      <PageFooterCTA />
      <SiteFooter />
    </>
  );
}
