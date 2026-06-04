'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase';
import { SiteFooter } from '@/components/SubPage';

type Category = '전체' | '시설' | '급식' | '행사';

type PhotoItem = {
  id: string;
  title: string | null;
  image_urls: string[] | null;
  body: string | null;
  date: string;
};

const CATEGORIES: Category[] = ['전체', '시설', '급식', '행사'];

export default function GalleryPage() {
  const [items, setItems] = useState<PhotoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<Category>('전체');
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from('contents')
      .select('id, title, image_urls, body, date')
      .eq('type', 'photo')
      .eq('is_active', true)
      .eq('is_public', true)
      .is('branch_id', null)
      .order('date', { ascending: false })
      .then(({ data }) => {
        setItems((data as PhotoItem[]) ?? []);
        setLoading(false);
      });
  }, []);

  const filtered =
    activeCategory === '전체'
      ? items
      : items.filter((item) => item.body === activeCategory);

  const flatImages = filtered
    .filter((item) => !!item.image_urls?.[0])
    .map((item) => ({ url: item.image_urls![0], title: item.title }));

  const closeLightbox = useCallback(() => setLightboxIndex(null), []);

  const prevImage = useCallback(() => {
    setLightboxIndex((i) =>
      i !== null && flatImages.length > 0
        ? (i - 1 + flatImages.length) % flatImages.length
        : null
    );
  }, [flatImages.length]);

  const nextImage = useCallback(() => {
    setLightboxIndex((i) =>
      i !== null && flatImages.length > 0 ? (i + 1) % flatImages.length : null
    );
  }, [flatImages.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (lightboxIndex === null) return;
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') prevImage();
      if (e.key === 'ArrowRight') nextImage();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxIndex, closeLightbox, prevImage, nextImage]);

  return (
    <>
      {/* Hero */}
      <section
        className="relative h-64 flex items-center justify-center overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #1B4332 0%, #2D6A4F 100%)' }}
      >
        <div className="text-center pt-16 relative z-10">
          <div className="text-5xl mb-3">📸</div>
          <h1 className="font-serif font-bold text-white text-4xl lg:text-5xl mb-2">포토갤러리</h1>
          <p className="text-white/70 text-base sm:text-lg">키즈밀과 함께하는 소중한 순간들</p>
        </div>
        <div className="absolute bottom-0 inset-x-0 leading-[0] z-10">
          <svg
            viewBox="0 0 1440 72"
            preserveAspectRatio="none"
            className="w-full h-[48px] sm:h-[72px] block"
          >
            <path
              d="M0,36 C120,72 240,0 360,36 C480,72 600,0 720,36 C840,72 960,0 1080,36 C1200,72 1320,0 1440,36 L1440,72 L0,72 Z"
              fill="#ffffff"
            />
          </svg>
        </div>
      </section>

      {/* Category filter */}
      <section className="bg-white py-6">
        <div className="flex flex-wrap gap-2 justify-center px-4">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                activeCategory === cat
                  ? 'bg-[#2D6A4F] text-white shadow-md'
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-[#2D6A4F] hover:text-[#2D6A4F]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </section>

      {/* Photo Grid */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="aspect-square bg-gray-100 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : flatImages.length === 0 ? (
          <div className="bg-[#E8F5E9] rounded-2xl p-12 text-center">
            <div className="text-5xl mb-4">📸</div>
            <p className="text-[#2D6A4F] font-medium text-lg">소중한 순간들을 준비 중입니다 😊</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {flatImages.map((img, idx) => (
              <div
                key={idx}
                className="relative aspect-square overflow-hidden rounded-2xl cursor-pointer group"
                onClick={() => setLightboxIndex(idx)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.url}
                  alt={img.title ?? ''}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-300 flex items-end">
                  {img.title && (
                    <p className="opacity-0 group-hover:opacity-100 text-white text-sm font-medium p-4 transition-opacity duration-300">
                      {img.title}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center"
          onClick={closeLightbox}
          onTouchStart={(e) => {
            touchStartX.current = e.touches[0].clientX;
          }}
          onTouchEnd={(e) => {
            if (touchStartX.current === null) return;
            const diff = touchStartX.current - e.changedTouches[0].clientX;
            if (Math.abs(diff) > 50) {
              if (diff > 0) nextImage();
              else prevImage();
            }
            touchStartX.current = null;
          }}
        >
          {/* Close */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              closeLightbox();
            }}
            className="absolute top-4 right-4 text-white w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors text-xl z-10"
            aria-label="닫기"
          >
            ✕
          </button>

          {/* Prev */}
          {flatImages.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                prevImage();
              }}
              className="absolute left-4 text-white w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors text-xl z-10"
              aria-label="이전"
            >
              ←
            </button>
          )}

          {/* Image */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-w-4xl w-full mx-14 sm:mx-20"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={flatImages[lightboxIndex].url}
              alt={flatImages[lightboxIndex].title ?? ''}
              className="max-h-[90vh] w-full object-contain rounded-xl"
            />
            {flatImages[lightboxIndex].title && (
              <p className="text-white/80 text-center text-sm mt-3">
                {flatImages[lightboxIndex].title}
              </p>
            )}
            <p className="text-white/40 text-center text-xs mt-1">
              {lightboxIndex + 1} / {flatImages.length}
            </p>
          </div>

          {/* Next */}
          {flatImages.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                nextImage();
              }}
              className="absolute right-4 text-white w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors text-xl z-10"
              aria-label="다음"
            >
              →
            </button>
          )}
        </div>
      )}

      <SiteFooter />
    </>
  );
}
