import Link from 'next/link';

type Crumb = { label: string; href?: string };

export function PageHero({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <section
      className="relative pt-32 pb-20 h-72 flex items-center"
      style={{ background: 'linear-gradient(135deg, #1B4332 0%, #2D6A4F 100%)' }}
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 w-full text-center">
        <h1 className="font-serif font-bold text-white text-4xl lg:text-5xl mb-3">{title}</h1>
        {subtitle && <p className="text-white/70 text-base sm:text-lg">{subtitle}</p>}
      </div>
      <div className="absolute bottom-0 inset-x-0 leading-[0]">
        <svg viewBox="0 0 1440 72" preserveAspectRatio="none" className="w-full h-[48px] sm:h-[72px] block">
          <path
            d="M0,36 C120,72 240,0 360,36 C480,72 600,0 720,36 C840,72 960,0 1080,36 C1200,72 1320,0 1440,36 L1440,72 L0,72 Z"
            fill="#ffffff"
          />
        </svg>
      </div>
    </section>
  );
}

export function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-8" aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-2 text-sm text-[#6B7B6E]">
        {items.map((c, i) => {
          const last = i === items.length - 1;
          return (
            <li key={i} className="flex items-center gap-2">
              {c.href && !last ? (
                <Link href={c.href} className="hover:text-[#2D6A4F] transition-colors">
                  {c.label}
                </Link>
              ) : (
                <span className={last ? 'font-medium text-[#2D6A4F]' : ''}>{c.label}</span>
              )}
              {!last && <span className="text-[#9BAA9D]">/</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function ComingSoonCard({ hint }: { hint: string }) {
  return (
    <div className="bg-[#E8F5E9] rounded-2xl p-10 sm:p-16 text-center">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#2D6A4F] text-white font-serif font-bold text-2xl mb-6">
        K
      </div>
      <p className="font-serif font-semibold text-xl sm:text-2xl text-[#1B4332] mb-3">
        실무자 기획 후 업데이트 예정
      </p>
      <p className="text-[#2D6A4F]/80 text-sm sm:text-base leading-relaxed max-w-2xl mx-auto">
        {hint}
      </p>
      {/* TODO: 실무자 기획 내용으로 교체 */}
    </div>
  );
}

export function PageFooterCTA() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-20 flex items-center justify-between gap-4 flex-wrap">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-[#2D6A4F] hover:text-[#1B4332] font-medium transition-colors"
      >
        ← 홈으로
      </Link>
      <Link
        href="/contact"
        className="inline-flex items-center gap-2 bg-[#F4A261] hover:bg-[#e8935a] text-white font-semibold px-6 py-3 rounded-xl transition-colors shadow-md"
      >
        문의하기 →
      </Link>
    </div>
  );
}

export function SiteFooter() {
  const cols: { title: string; links: { label: string; href: string }[] }[] = [
    {
      title: '회사',
      links: [
        { label: '브랜드 스토리', href: '/about/brand' },
        { label: '경쟁력', href: '/about/competitivity' },
        { label: 'CEO 인사말', href: '/about/ceo' },
      ],
    },
    {
      title: '서비스',
      links: [
        { label: 'KIZMEAL', href: '/business/kizmeal' },
        { label: 'ICANMEAL', href: '/business/icanmeal' },
        { label: '이번 주 식단', href: '/menu' },
      ],
    },
    {
      title: '고객지원',
      links: [
        { label: '포토갤러리', href: '/gallery' },
        { label: '공지사항', href: '/notice' },
        { label: '1:1 문의', href: '/login' },
        { label: '문의하기', href: '/contact' },
      ],
    },
  ];

  return (
    <footer className="bg-[#0D1B0F] py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-4 gap-8 mb-10">
          <div className="md:col-span-1">
            <Link href="/" className="flex items-center gap-2.5 mb-4">
              <div className="w-9 h-9 rounded-xl bg-[#2D6A4F] flex items-center justify-center text-white font-bold font-serif text-lg">K</div>
              <span className="font-serif font-bold text-white text-lg">키즈밀</span>
            </Link>
            <p className="text-white/40 text-sm leading-relaxed max-w-xs">
              아이들의 건강한 미래를 위해 최고의 급식을 제공합니다. 22년의 경험과 신뢰로 함께합니다.
            </p>
          </div>
          {cols.map((col) => (
            <div key={col.title}>
              <p className="text-white/70 font-medium text-sm mb-4">{col.title}</p>
              <ul className="space-y-2">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="text-white/40 hover:text-white/80 text-sm transition-colors">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-white/10 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-white/30 text-xs">© 2024 키즈밀(KIZMEAL). All rights reserved.</p>
          <div className="flex items-center gap-4 text-xs">
            <Link href="/privacy" className="text-white/40 hover:text-white/70 transition-colors">
              개인정보처리방침
            </Link>
            <span className="text-white/30">사업자등록번호: 000-00-00000</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
