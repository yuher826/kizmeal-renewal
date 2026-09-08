// ============================================================
// 관리자 상단 탭 2분류 정의 (홈페이지&포털 / 서비스문의)
// AdminTabBar · BoardSidebar · AdminMobileNav 가 공유한다.
// ============================================================

export type AdminTabKey = 'home' | 'service'

export interface AdminMenuItem {
  icon: string
  label: string
  href: string
}

export interface AdminTab {
  key: AdminTabKey
  icon: string
  label: string
  shortLabel: string
  description: string
  items: AdminMenuItem[]
}

export const ADMIN_TABS: AdminTab[] = [
  {
    key: 'home',
    icon: '🌐',
    label: '홈페이지 & 포털',
    shortLabel: '홈페이지&포털',
    description: '홈페이지와 학부모 포털에 보여지는 콘텐츠와 학부모 소통을 관리합니다',
    items: [
      { icon: '📝', label: '콘텐츠 관리', href: '/board/admin/content' },
      { icon: '📢', label: '홈페이지 공지', href: '/board/admin/notices' },
      { icon: '👨‍👩‍👧', label: '학부모 승인', href: '/board/admin/parents' },
      { icon: '💚', label: '학부모 문의', href: '/board/admin/parent-inquiries' },
    ],
  },
  {
    key: 'service',
    icon: '📋',
    label: '서비스문의',
    shortLabel: '서비스문의',
    description: '홈페이지 방문자의 도입/계약 문의입니다. 영업 기회로 이어지는 소중한 창구입니다',
    items: [
      { icon: '🔵', label: '문의 목록', href: '/board/admin/service-inquiries' },
    ],
  },
]

export function getAdminTab(key: AdminTabKey): AdminTab {
  return ADMIN_TABS.find(t => t.key === key) || ADMIN_TABS[0]
}

/**
 * 현재 URL(경로 + ?type=) 기준으로 활성 탭을 판별한다.
 */
export function getActiveAdminTab(pathname: string): AdminTabKey {
  // 홈페이지 & 포털
  if (
    pathname.startsWith('/board/admin/content') ||
    pathname.startsWith('/board/admin/parents') ||
    pathname.startsWith('/board/admin/parent-inquiries') ||
    pathname.startsWith('/board/admin/notices')
  ) {
    return 'home'
  }

  // 서비스 문의 (구 public-inquiries 경로도 포함)
  if (
    pathname.startsWith('/board/admin/service-inquiries') ||
    pathname.startsWith('/board/admin/public-inquiries')
  ) {
    return 'service'
  }

  // 대시보드 포함 나머지는 홈페이지&포털
  return 'home'
}

/**
 * 허용 목록 밖 /board/admin/* 를 전부 닫는다.
 * 목록의 출처는 ADMIN_TABS 하나뿐 — 메뉴에서 지우면 접근도 함께 닫힌다.
 *
 * `/` 경계를 붙이는 이유 — 단순 startsWith면 /board/admin/notices 가
 * /board/admin/notices-old 같은 경로까지 삼킨다.
 * (lib/erp-access.ts canAccessErpPage와 같은 이유)
 *
 * 최장 prefix 매칭은 두지 않는다 — ERP는 규칙마다 allow 함수가 달라
 * 어느 규칙이 이기는지가 결과를 바꾸지만, 여기는 판정이 boolean 하나라
 * 겹쳐도 결과가 같다.
 */
export function canAccessAdminPage(pathname: string): boolean {
  if (pathname === '/board/admin') return true   // 허브는 ADMIN_TABS에 없다
  return ADMIN_TABS.some(tab =>
    tab.items.some(item =>
      pathname === item.href || pathname.startsWith(`${item.href}/`)
    )
  )
}
