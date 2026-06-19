// CS 그룹별 색상 상수 — CS 관리 페이지 + 이력 검색 페이지에서 공유

export const GROUP_STYLES: Record<string, {
  headerBg: string     // 아코디언 헤더 배경
  dot: string          // 그룹 구분 dot 색상
  itemHoverBg: string  // 문의 아이템 hover 배경
  badgeBg: string      // 이력 검색 테이블 뱃지 배경색
  badgeText: string    // 이력 검색 테이블 뱃지 글자색
}> = {
  E:   { headerBg: 'bg-blue-50',   dot: 'bg-blue-500',   itemHoverBg: 'hover:bg-blue-50',   badgeBg: 'bg-blue-100',   badgeText: 'text-blue-700'   },
  P:   { headerBg: 'bg-green-50',  dot: 'bg-green-500',  itemHoverBg: 'hover:bg-green-50',  badgeBg: 'bg-green-100',  badgeText: 'text-green-700'  },
  R:   { headerBg: 'bg-purple-50', dot: 'bg-purple-500', itemHoverBg: 'hover:bg-purple-50', badgeBg: 'bg-purple-100', badgeText: 'text-purple-700' },
  MB:  { headerBg: 'bg-orange-50', dot: 'bg-orange-500', itemHoverBg: 'hover:bg-orange-50', badgeBg: 'bg-orange-100', badgeText: 'text-orange-700' },
  SLP: { headerBg: 'bg-pink-50',   dot: 'bg-pink-500',   itemHoverBg: 'hover:bg-pink-50',   badgeBg: 'bg-pink-100',   badgeText: 'text-pink-700'   },
  AO:  { headerBg: 'bg-teal-50',   dot: 'bg-teal-500',   itemHoverBg: 'hover:bg-teal-50',   badgeBg: 'bg-teal-100',   badgeText: 'text-teal-700'   },
}

export const FALLBACK_GROUP_STYLE = {
  headerBg: 'bg-slate-50',
  dot: 'bg-slate-400',
  itemHoverBg: 'hover:bg-slate-50',
  badgeBg: 'bg-slate-100',
  badgeText: 'text-slate-600',
}

export function getGroupStyle(tag: string | null | undefined) {
  return GROUP_STYLES[tag ?? ''] ?? FALLBACK_GROUP_STYLE
}
