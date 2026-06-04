import type { Metadata } from 'next';
import { PageHero, Breadcrumb, PageFooterCTA, SiteFooter } from '@/components/SubPage';

export const metadata: Metadata = {
  title: '브랜드 스토리 | 키즈밀',
  description: '22년간 아이들의 밥상을 지켜온 키즈밀의 브랜드 스토리.',
};

const TIMELINE = [
  { year: '2025', items: ['POLY 강동', 'RISE 과천', 'ALTIORA 송파·위례', 'KPI 어학원'] },
  { year: '2024', items: ['DEP 압구정', 'POLY 동탄', 'RISE 강남·성동', 'SLP 송도·광명·광교', 'OMP월드어학원'] },
  { year: '2023', items: ['POLY 운정', '대치 POLY MAGNET', 'RISE 강동·동작', 'ALTIORA 미사', 'MapleBear 강남'] },
  { year: '2022', items: ['POLY 수지별관·하남·광교', '대치 MAGNET', 'KIVYS', 'ATP'] },
  { year: '2021', items: ['BIS', 'GEA', "Charlie's Big Red House 광교", 'HABA League', 'POLY 위례', 'BEK Lodge·Prep·Secondary', 'I CAN MEAL 온라인몰 OPEN'] },
  { year: '2020', items: ['LUXX', 'SLP', 'YBM ECC 청라', 'RISE 분당 영재원'] },
  { year: '2019', items: ['KIS', 'RISE 서초', 'POLY 화정', 'Till I\'m Eleven'] },
  { year: '2018', items: ['POLY 직영캠퍼스 10개원', 'RISE 분당'] },
  { year: '2017', items: ['JICS', 'RISE 목동', 'DEP'] },
  { year: '2016', items: ['SCI', 'CBIS.K', 'ELAN', 'CSIS'] },
  { year: '2015', items: ['SMKA', 'LATT'] },
  { year: '2014', items: ['LOTIS', 'Cubs Village', 'WYATT'] },
  { year: '2013', items: ['POLY 직영캠퍼스', 'BEK', 'PLATO KIDS'] },
  { year: '2012', items: ['Little Socie 외'] },
  { year: '2005', items: ['🎂 키즈밀 창립'], highlight: true },
];

export default function Page() {
  return (
    <>
      <PageHero title="BRAND STORY" subtitle="22년간 아이들의 밥상을 지켜온 이야기" />
      <Breadcrumb
        items={[
          { label: '홈', href: '/' },
          { label: '회사소개', href: '/about' },
          { label: '브랜드 스토리' },
        ]}
      />

      {/* Section 1 — WE ARE */}
      <section className="max-w-3xl mx-auto py-20 px-4 sm:px-6 lg:px-8 text-center">
        <p className="text-xs font-semibold tracking-widest text-[#2D6A4F] uppercase mb-4">WE ARE</p>
        <p className="text-gray-700 text-base sm:text-lg leading-relaxed mb-6">
          키즈밀은 친환경 아동 전문 단체급식<br />
          (Total Food Service)업체로서<br />
          단체급식 사업의 축적된 노하우와<br />
          아동영양교육의 연구개발을 바탕으로<br />
          다양한 아동식생활 사업에 참여하고 있으며,<br />
          종합 아동 식생활 문화를 창출하여<br />
          고객의 풍요로운 삶을 실현해 나가고 있습니다.
        </p>
        <p className="text-[#2D6A4F]/70 text-sm italic">
          Kizmeal is an eco-friendly total food service<br />
          company specializing in children&apos;s food service.
        </p>
      </section>

      {/* Section 2 — 연혁 타임라인 */}
      <section className="bg-[#F9FAFB] py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <h2 className="font-serif font-bold text-3xl sm:text-4xl text-[#1B4332] text-center mb-14">
            함께 걸어온 발자취
          </h2>

          <div className="relative">
            {/* 세로선 */}
            <div className="absolute left-[72px] sm:left-20 top-0 bottom-0 w-0.5 bg-[#2D6A4F]/20" />

            <div className="space-y-8">
              {TIMELINE.map((entry) => (
                <div key={entry.year} className="relative flex items-start gap-6 sm:gap-8">
                  {/* 연도 뱃지 */}
                  <div className="flex-shrink-0 w-[72px] sm:w-20 text-right">
                    <span
                      className={`inline-block font-serif font-bold text-sm px-2 py-1 rounded-lg ${
                        entry.highlight
                          ? 'bg-[#2D6A4F] text-white'
                          : 'bg-[#E8F5E9] text-[#2D6A4F]'
                      }`}
                    >
                      {entry.year}
                    </span>
                  </div>

                  {/* 원 마커 */}
                  <div
                    className={`flex-shrink-0 w-3 h-3 rounded-full mt-1.5 border-2 ${
                      entry.highlight
                        ? 'bg-[#2D6A4F] border-[#2D6A4F]'
                        : 'bg-white border-[#2D6A4F]'
                    }`}
                  />

                  {/* 내용 */}
                  <div className="flex-1 pb-2">
                    <p className="text-gray-700 text-sm leading-relaxed">
                      {entry.items.join(' / ')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <PageFooterCTA />
      <SiteFooter />
    </>
  );
}
