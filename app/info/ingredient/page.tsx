import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-server';
import { KIZMEAL_LOGO_PATH } from '@/lib/brand';
import { SiteFooter } from '@/components/SubPage';

export const metadata: Metadata = {
  title: '식재료정보 | 키즈밀',
  description: '제철 식재료와 영양 정보',
};

type Content = { id: string; title: string; date: string; image_urls: string[] | null };

function formatDate(d: string) {
  const [y, m, day] = d.split('-');
  return `${y}년 ${Number(m)}월 ${Number(day)}일`;
}

export default async function Page() {
  const supabase = createClient();
  const { data } = await supabase
    .from('contents')
    .select('id, title, date, image_urls')
    .eq('type', 'ingredient')
    .eq('is_public', true)
    .eq('is_active', true)
    .is('branch_id', null)
    .order('date', { ascending: false });

  const items = (data ?? []) as Content[];

  return (
    <>
      <section
        className="relative h-64 flex items-center overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #1B4332 0%, #2D6A4F 100%)' }}
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 w-full text-center pt-16">
          <div className="text-4xl mb-2">🌿</div>
          <h1 className="font-serif font-bold text-white text-3xl lg:text-4xl mb-2">식재료정보</h1>
          <p className="text-white/70 text-sm sm:text-base">제철 식재료와 영양 정보</p>
        </div>
        <div className="absolute bottom-0 inset-x-0 leading-[0]">
          <svg viewBox="0 0 1440 72" preserveAspectRatio="none" className="w-full h-12 sm:h-16 block">
            <path d="M0,36 C120,72 240,0 360,36 C480,72 600,0 720,36 C840,72 960,0 1080,36 C1200,72 1320,0 1440,36 L1440,72 L0,72 Z" fill="#ffffff" />
          </svg>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 pb-20 relative z-10">
        {items.length === 0 ? (
          <div className="bg-[#E8F5E9] rounded-2xl p-12 sm:p-16 text-center">
            <div className="w-16 h-16 rounded-2xl overflow-hidden flex items-center justify-center mx-auto mb-5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={KIZMEAL_LOGO_PATH} alt="키즈밀 로고" className="w-full h-full object-contain" />
            </div>
            <p className="font-serif font-semibold text-xl sm:text-2xl text-[#1B4332] mb-2">곧 업데이트될 예정입니다 😊</p>
            <p className="text-[#2D6A4F]/70 text-sm">키즈밀이 식재료 정보를 열심히 준비하고 있습니다.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map((item) => (
              <Link
                key={item.id}
                href={`/info/ingredient/${item.id}`}
                className="group bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md hover:-translate-y-1 transition-all duration-200"
              >
                {item.image_urls?.[0] ? (
                  <div className="aspect-video overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.image_urls[0]} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  </div>
                ) : (
                  <div className="aspect-video bg-gradient-to-br from-[#E8F5E9] to-[#B7E4C7] flex items-center justify-center">
                    <span className="text-4xl">🌿</span>
                  </div>
                )}
                <div className="p-5">
                  <span className="inline-block text-xs font-semibold px-2.5 py-1 rounded-full bg-[#E8F5E9] text-[#2D6A4F] mb-2">식재료정보</span>
                  <h2 className="font-semibold text-[#1C2B1E] text-sm leading-snug line-clamp-2 mb-2">{item.title}</h2>
                  <p className="text-xs text-gray-400">{formatDate(item.date)}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
      <SiteFooter />
    </>
  );
}
