// ============================================================
// 관리자 상단 탭 3분류 정의 (홈페이지&포털 / 운영관리 / 서비스문의)
// AdminTabBar · BoardSidebar · AdminMobileNav 가 공유한다.
// ============================================================

export type AdminTabKey = 'home' | 'ops' | 'service'

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
      { icon: '📢', label: '홈페이지 공지', href: '/board/admin/notices?type=public' },
      { icon: '👨‍👩‍👧', label: '학부모 승인', href: '/board/admin/parents' },
      { icon: '💚', label: '학부모 문의', href: '/board/admin/parent-inquiries' },
    ],
  },
  {
    key: 'ops',
    icon: '⚙️',
    label: '운영관리',
    shortLabel: '운영관리',
    description: '계약 원의 식단 배포와 운영 문의를 관리합니다',
    items: [
      { icon: '🏠', label: '대시보드', href: '/board/admin' },
      { icon: '🏫', label: '원 관리', href: '/board/admin/branches' },
      { icon: '🍱', label: '식단표 배포', href: '/board/admin/diet' },
      { icon: '📣', label: '가맹점 공지', href: '/board/admin/notices?type=branch' },
      { icon: '🟠', label: '운영 문의', href: '/board/admin/inquiries' },
      { icon: '📊', label: '통계', href: '/board/admin/stats' },
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
  return ADMIN_TABS.find(t => t.key === key) || ADMIN_TABS[1]
}

/**
 * 현재 URL(경로 + ?type=) 기준으로 활성 탭을 판별한다.
 */
export function getActiveAdminTab(pathname: string, type: string | null): AdminTabKey {
  // 홈페이지 & 포털
  if (
    pathname.startsWith('/board/admin/content') ||
    pathname.startsWith('/board/admin/parents') ||
    pathname.startsWith('/board/admin/parent-inquiries') ||
    (pathname.startsWith('/board/admin/notices') && type === 'public')
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

  // 그 외 전부 운영관리 (대시보드, 원관리, 식단, 가맹점공지, 운영문의, 통계)
  return 'ops'
}
