'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase';

type DropdownItem = { icon: string; label: string; href: string };
type NavItem = {
  key: string;
  label: string;
  href?: string;
  dropdown?: DropdownItem[];
  matchPrefixes?: string[];
};

const NAV: NavItem[] = [
  { key: 'home', label: '홈', href: '/' },
  {
    key: 'about',
    label: '회사소개',
    matchPrefixes: ['/about', '/facility'],
    dropdown: [
      { icon: '🏢', label: '브랜드 스토리', href: '/about/brand' },
      { icon: '💪', label: '경쟁력', href: '/about/competitivity' },
      { icon: '👋', label: 'CEO 인사말', href: '/about/ceo' },
      { icon: '🏭', label: '시설 안내', href: '/facility' },
    ],
  },
  {
    key: 'business',
    label: '사업영역',
    matchPrefixes: ['/business'],
    dropdown: [
      { icon: '🥗', label: 'KIZMEAL', href: '/business/kizmeal' },
      { icon: '🍱', label: 'ICANMEAL', href: '/business/icanmeal' },
    ],
  },
  {
    key: 'info',
    label: '식단&정보',
    matchPrefixes: ['/menu', '/info'],
    dropdown: [
      { icon: '📋', label: '이번 주 식단', href: '/menu' },
      { icon: '📰', label: '건강정보지', href: '/info/health' },
      { icon: '⭐', label: '이달의 신메뉴', href: '/info/newmenu' },
      { icon: '👨‍🍳', label: '생생현장레시피', href: '/info/recipe' },
      { icon: '🌿', label: '식재료정보', href: '/info/ingredient' },
    ],
  },
  { key: 'gallery', label: '포토갤러리', href: '/gallery' },
  {
    key: 'support',
    label: '고객지원',
    matchPrefixes: ['/notice'],
    dropdown: [
      { icon: '💬', label: '1:1 문의', href: '/login' },
      { icon: '📢', label: '공지사항', href: '/notice' },
    ],
  },
  { key: 'contact', label: '문의하기', href: '/contact' },
];

function isActive(item: NavItem, pathname: string): boolean {
  if (item.href && pathname === item.href) return true;
  if (item.matchPrefixes?.some((p) => pathname.startsWith(p))) return true;
  if (item.key === 'support' && pathname === '/login') return true;
  return false;
}

export default function Navigation() {
  const pathname = usePathname();
  const [isScrolled, setIsScrolled] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [mobileExpanded, setMobileExpanded] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [parentName, setParentName] = useState('');
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const navRef = useRef<HTMLDivElement>(null);
  const isHome = pathname === '/';

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 50);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getSession().then(({ data }) => {
      setIsLoggedIn(!!data.session);
      if (data.session) {
        supabase.from('parents').select('name').eq('auth_id', data.session.user.id).maybeSingle()
          .then(({ data: p }) => setParentName(p?.name || data.session!.user.email?.split('@')[0] || ''));
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session);
      if (session) {
        supabase.from('parents').select('name').eq('auth_id', session.user.id).maybeSingle()
          .then(({ data: p }) => setParentName(p?.name || session.user.email?.split('@')[0] || ''));
      } else {
        setParentName('');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!navRef.current?.contains(e.target as Node)) setOpenMenu(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    setIsMobileOpen(false);
    setMobileExpanded(null);
    setOpenMenu(null);
  }, [pathname]);

  async function handleNavLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = '/';
  }

  const handleEnter = (key: string) => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setOpenMenu(key);
  };
  const handleLeave = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => setOpenMenu(null), 150);
  };

  const solidBg = !isHome || isScrolled;
  const navBg = solidBg
    ? 'bg-white/95 backdrop-blur-md shadow-sm border-b border-gray-100'
    : 'bg-transparent';
  const navText = solidBg ? 'text-[#1C2B1E]' : 'text-white';

  return (
    <nav className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${navBg}`} ref={navRef}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
        <Link href="/" className="flex items-center gap-2.5 flex-shrink-0">
          <div className="w-9 h-9 rounded-xl bg-[#2D6A4F] flex items-center justify-center text-white font-bold text-lg font-serif">K</div>
          <span className={`font-serif font-bold text-lg leading-none transition-colors ${navText}`}>키즈밀</span>
        </Link>

        <ul className="hidden lg:flex items-center gap-1">
          {NAV.map((item) => {
            const active = isActive(item, pathname);
            const activeColor = active ? 'text-[#F4A261]' : '';
            const underline = active ? 'border-b-2 border-[#F4A261]' : 'border-b-2 border-transparent';

            if (!item.dropdown) {
              return (
                <li key={item.key}>
                  <Link
                    href={item.href!}
                    className={`px-3 py-2 text-sm font-medium transition-colors hover:text-[#52B788] ${navText} ${activeColor} ${underline}`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            }

            const isOpen = openMenu === item.key;
            return (
              <li
                key={item.key}
                className="relative"
                onMouseEnter={() => handleEnter(item.key)}
                onMouseLeave={handleLeave}
              >
                <button
                  type="button"
                  className={`px-3 py-2 text-sm font-medium transition-colors hover:text-[#52B788] inline-flex items-center gap-1 ${navText} ${activeColor} ${underline}`}
                  onClick={() => setOpenMenu(isOpen ? null : item.key)}
                  aria-expanded={isOpen}
                >
                  {item.label}
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                <div
                  className={`absolute top-full left-1/2 -translate-x-1/2 mt-2 min-w-[220px] bg-white rounded-2xl border border-[#E8F5E9] p-2 transition-all duration-200 ease-out z-[1000] ${
                    isOpen
                      ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto'
                      : 'opacity-0 -translate-y-2 scale-95 pointer-events-none'
                  }`}
                  style={{ boxShadow: '0 20px 40px rgba(45,106,79,0.12)' }}
                >
                  {item.dropdown.map((d) => {
                    const itemActive = pathname === d.href;
                    return (
                      <Link
                        key={d.href}
                        href={d.href}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors duration-150 ${
                          itemActive
                            ? 'bg-[#E8F5E9] text-[#2D6A4F]'
                            : 'text-[#1C2B1E] hover:bg-[#E8F5E9] hover:text-[#2D6A4F]'
                        }`}
                      >
                        <span className="text-lg flex-shrink-0">{d.icon}</span>
                        <span>{d.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </li>
            );
          })}
        </ul>

        <div className="flex items-center gap-3 flex-shrink-0">
          {!isLoggedIn && (
            <Link
              href="/login"
              className="hidden lg:inline-flex items-center gap-2 bg-[#F4A261] hover:bg-[#e8935a] text-white text-sm font-semibold px-5 py-2 rounded-xl transition-colors"
            >
              로그인
            </Link>
          )}
          {isLoggedIn && (
            <div className="hidden lg:flex items-center gap-3">
              <Link
                href="/parent/dashboard"
                className={`text-sm font-semibold hover:opacity-80 transition-opacity ${!solidBg ? 'text-white' : 'text-[#2D6A4F]'}`}
              >
                {parentName} 님 👋
              </Link>
              <button
                type="button"
                onClick={handleNavLogout}
                className={`text-xs transition-colors ${!solidBg ? 'text-white/70 hover:text-white' : 'text-gray-400 hover:text-gray-600'}`}
              >
                로그아웃
              </button>
            </div>
          )}
          <button
            className={`lg:hidden p-2 rounded-lg ${navText}`}
            onClick={() => setIsMobileOpen((v) => !v)}
            aria-label="메뉴"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {isMobileOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <>
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </>
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <div
        className={`lg:hidden bg-white border-t border-gray-100 overflow-hidden transition-all duration-300 ${
          isMobileOpen ? 'max-h-[80vh] overflow-y-auto' : 'max-h-0'
        }`}
      >
        <div className="px-4 py-4">
          {NAV.map((item) => {
            const active = isActive(item, pathname);
            if (!item.dropdown) {
              return (
                <Link
                  key={item.key}
                  href={item.href!}
                  className={`block py-3 font-medium border-b border-gray-50 ${
                    active ? 'text-[#F4A261]' : 'text-[#1C2B1E]'
                  }`}
                  onClick={() => setIsMobileOpen(false)}
                >
                  {item.label}
                </Link>
              );
            }
            const expanded = mobileExpanded === item.key;
            return (
              <div key={item.key} className="border-b border-gray-50">
                <button
                  type="button"
                  className={`w-full py-3 flex items-center justify-between font-medium ${
                    active ? 'text-[#F4A261]' : 'text-[#1C2B1E]'
                  }`}
                  onClick={() => setMobileExpanded(expanded ? null : item.key)}
                >
                  <span>{item.label}</span>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                <div
                  className={`overflow-hidden transition-all duration-300 ease-out ${
                    expanded ? 'max-h-96' : 'max-h-0'
                  }`}
                >
                  <div className="pb-3 pl-2 space-y-1">
                    {item.dropdown.map((d) => (
                      <Link
                        key={d.href}
                        href={d.href}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[#1C2B1E] hover:bg-[#E8F5E9] hover:text-[#2D6A4F]"
                        onClick={() => setIsMobileOpen(false)}
                      >
                        <span className="text-base">{d.icon}</span>
                        <span>{d.label}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
          {!isLoggedIn && (
            <Link
              href="/login"
              className="mt-4 block text-center bg-[#F4A261] hover:bg-[#e8935a] text-white py-3 rounded-xl font-semibold"
              onClick={() => setIsMobileOpen(false)}
            >
              로그인
            </Link>
          )}
          {isLoggedIn && (
            <div className="mt-4 border-t border-gray-100 pt-4 space-y-1">
              <Link
                href="/parent/dashboard"
                className={`block text-center font-semibold py-3 ${isHome ? 'text-white' : 'text-[#2D6A4F]'}`}
                onClick={() => setIsMobileOpen(false)}
              >
                {parentName} 님 👋
              </Link>
              <button
                type="button"
                onClick={handleNavLogout}
                className={`w-full text-center text-sm py-2 transition-colors ${isHome ? 'text-white/70 hover:text-white' : 'text-gray-400 hover:text-gray-600'}`}
              >
                로그아웃
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
