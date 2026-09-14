import {
  Utensils,
  ClipboardCheck,
  Building2,
  Palette,
  Megaphone,
  MessageSquare,
  Mail,
  BarChart2,
  UserCog,
  Tags,
} from 'lucide-react'
import type { ErpNavGroup } from '@/types/erp'

export const ERP_NAV_GROUPS: ErpNavGroup[] = [
  // 2026-09-14 권팀장 요청: 소통 관리를 맨 위로. 식단 관리가 원래 맨 위였던
  // 건 처음 만들 때 식단 자동화가 유일한 기능이어서였고, 지금은 권팀장이
  // CS를 가장 많이 쓴다. 영양사는 로그인 시 식단 자동화로 착지하므로
  // (lib/erp-access.ts LANDING_PREFERENCE) 순서가 바뀌어도 첫 화면은 그대로다.
  // 역할별로 순서를 다르게 두지 않는다 — 이 배열 하나를 모든 역할이 그대로
  // 쓰고(ErpSidebar.tsx), 역할별 차이는 canAccessErpPage가 항목을
  // 숨기는 것으로만 난다.
  {
    title: '소통 관리',
    items: [
      { label: '고객사 공지', href: '/erp/notices',   icon: Megaphone },
      { label: 'CS 관리',     href: '/erp/inquiries', icon: MessageSquare },
      // 2026-08-18 권팀장 요청 2번: 고객사 포털 파일보관함에 올릴 파일 관리
      // (건강정보지·유인물·식단사진). 식단표는 식단 자동화가 담당하므로 제외.
      { label: '파일보관함',  href: '/erp/files',     icon: Tags },
    ],
  },
  {
    title: '식단 관리',
    items: [
      { label: '식단 자동화', href: '/erp/diet',     icon: Utensils },
      { label: '식단 검토',   href: '/erp/review',   icon: ClipboardCheck },
      { label: '원 프로파일', href: '/erp/branches',       icon: Building2 },
      { label: '템플릿 관리', href: '/erp/diet/templates', icon: Palette },
    ],
  },
  {
    title: '배포 관리',
    items: [
      { label: '이메일 배포', href: '/erp/email', icon: Mail, disabled: true },
    ],
  },
  {
    title: '분석',
    items: [
      { label: '통계', href: '/erp/stats', icon: BarChart2, disabled: true },
    ],
  },
  {
    title: '시스템 관리',
    items: [
      { label: '관리자 관리', href: '/erp/admins', icon: UserCog },
      { label: '브랜드 관리', href: '/erp/brands', icon: Tags },
    ],
  },
]
