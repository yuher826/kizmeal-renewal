// 학부모 1:1 문의 카테고리 정의 (학부모 포털 · 관리자 공용)

export interface ParentInquiryCategory {
  key: string
  icon: string
  label: string
}

export const PARENT_INQ_CATEGORIES: ParentInquiryCategory[] = [
  { key: 'ALLERGY',   icon: '🚨', label: '알레르기 관련' },
  { key: 'MENU',      icon: '🍱', label: '식단 관련' },
  { key: 'PHOTO',     icon: '📸', label: '급식사진 관련' },
  { key: 'COMPLAINT', icon: '😤', label: '불만/건의' },
  { key: 'GENERAL',   icon: '💬', label: '일반 문의' },
]

export const PARENT_INQ_CATEGORY_MAP: Record<string, ParentInquiryCategory> =
  Object.fromEntries(PARENT_INQ_CATEGORIES.map(c => [c.key, c]))
