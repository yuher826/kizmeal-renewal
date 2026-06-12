import {
  Utensils,
  ClipboardCheck,
  Building2,
  BookUser,
  Megaphone,
  MessageSquare,
  Mail,
  BarChart2,
} from 'lucide-react'
import type { ErpNavGroup } from '@/types/erp'

export const ERP_NAV_GROUPS: ErpNavGroup[] = [
  {
    title: '식단 관리',
    items: [
      { label: '식단 자동화', href: '/erp/diet',     icon: Utensils },
      { label: '식단 검토',   href: '/erp/review',   icon: ClipboardCheck },
      { label: '원 프로파일', href: '/erp/branches', icon: Building2 },
    ],
  },
  {
    title: '원 관리',
    items: [
      { label: '원 정보 관리', href: '/erp/centers', icon: BookUser },
      { label: '가맹점 공지',  href: '/erp/notices', icon: Megaphone },
    ],
  },
  {
    title: '소통 관리',
    items: [
      { label: '운영 문의', href: '/erp/inquiries', icon: MessageSquare },
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
]
