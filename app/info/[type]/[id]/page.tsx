import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase-server';
import { SiteFooter } from '@/components/SubPage';

const TYPE_MAP: Record<string, { label: string; href: string }> = {
  health: { label: '건강정보지', href: '/info/health' },
  newmenu: { label: '이달의 신메뉴', href: '/info/newmenu' },
  recipe: { label: '생생현장레시피', href: '/info/recipe' },
  ingredient: { label: '식재료정보', href: '/info/ingredient' },
};

function formatDate(d: string) {
  const [y, m, day] = d.split('-');
  return `${y}년 ${Number(m)}월 ${Number(day)}일`;
}

export async function generateMetadata({
  params,
}: {
  params: { type: string; id: string };
}): Promise<Metadata> {
  const supabase = createClient();
  const { data } = await supabase
    .from('contents')
    .select('title')
    .eq('id', params.id)
    .maybeSingle();
  const label = TYPE_MAP[params.type]?.label ?? '콘텐츠';
  return {
    title: data?.title ? `${data.title} | 키즈밀` : `${label} | 키즈밀`,
  };
}

export default async function Page({
  params,
}: {
  params: { type: string; id: string };
}) {
  const supabase = createClient();
  const { data: item } = await supabase
    .from('contents')
    .select('id, title, body, date, image_urls, type')
    .eq('id', params.id)
    .eq('is_active', true)
    .maybeSingle();

  if (!item) notFound();

  const config =
    TYPE_MAP[params.type] ??
    TYPE_MAP[item.type] ?? {
      label: item.type,
      href: `/info/${item.type}`,
    };

  return (
    <>
      {item.image_urls?.[0] ? (
        <div className="relative h-64 sm:h-80 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.image_urls[0]}
            alt={item.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/50" />
          <div className="absolute inset-0 flex items-end">
            <div className="max-w-3xl mx-auto w-full px-4 sm:px-6 pb-8">
              <p className="text-white/70 text-sm mb-1">{config.label}</p>
              <h1 className="text-white font-bold text-2xl sm:text-3xl leading-tight">{item.title}</h1>
            </div>
          </div>
        </div>
      ) : (
        <div
          className="relative h-48 sm:h-56 flex items-end overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #1B4332 0%, #2D6A4F 100%)' }}
        >
          <div className="max-w-3xl mx-auto w-full px-4 sm:px-6 pb-8 pt-20">
            <p className="text-white/70 text-sm mb-1">{config.label}</p>
            <h1 className="text-white font-bold text-2xl sm:text-3xl leading-tight">{item.title}</h1>
          </div>
        </div>
      )}

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <div className="flex items-center gap-3 mb-8 text-sm">
          <Link
            href={config.href}
            className="flex items-center gap-1 text-[#2D6A4F] font-medium hover:underline"
          >
            ← 목록으로
          </Link>
          <span className="text-gray-200">|</span>
          <span className="text-gray-400">{formatDate(item.date)}</span>
        </div>

        <div className="text-[#1C2B1E] leading-relaxed whitespace-pre-wrap text-sm sm:text-base">
          {item.body}
        </div>

        <div className="mt-12 pt-6 border-t border-gray-100">
          <Link
            href={config.href}
            className="inline-flex items-center gap-2 text-[#2D6A4F] font-medium hover:text-[#1B4332] transition-colors text-sm"
          >
            ← 목록으로 돌아가기
          </Link>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
