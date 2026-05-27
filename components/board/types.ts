export type TicketStatus = '접수' | '처리중' | '완료';
export type Priority = '긴급' | '보통' | '낮음';
export type InquiryType = '식단변경' | '납품문의' | '위생민원' | '계약관련' | '기타';

export const STATUS_STYLE: Record<TicketStatus, string> = {
  접수: 'bg-yellow-100 text-yellow-800',
  처리중: 'bg-blue-100 text-blue-800',
  완료: 'bg-green-100 text-green-800',
};

export const TYPE_STYLE: Record<InquiryType, string> = {
  식단변경: 'bg-[#E8F5E9] text-[#1B4332]',
  납품문의: 'bg-blue-50 text-blue-800',
  위생민원: 'bg-red-50 text-red-800',
  계약관련: 'bg-yellow-50 text-yellow-800',
  기타: 'bg-gray-100 text-gray-700',
};

export interface Msg {
  id: string;
  /** customer | staff | system (날짜구분/변경 안내) | memo (내부메모) */
  type: 'customer' | 'staff' | 'system' | 'memo';
  sender: string;
  content: string;
  time: string;
  read: boolean;
  attachment?: string;
}

export interface DeliverySlot {
  day: string;
  time: string;
}

export interface SharedFile {
  name: string;
  size: string;
  ext: 'xlsx' | 'pdf' | 'jpg' | 'png' | 'docx';
}

export interface ClientInfo {
  contactName: string;
  phone: string;
  email: string;
  contractStart: string;
  contractEnd: string;
  daysLeft: number;
  mealCount: number;
  region: string;
  nutritionist: string;
  allergyCount: number;
  memo: string;
  delivery: DeliverySlot[];
  files: SharedFile[];
  totalInquiries: number;
  avgRating: number;
}

export interface Ticket {
  id: string;
  org: string;
  tierIcon: '👑' | '⭐' | '🌱';
  tierColor: string;
  inquiryType: InquiryType;
  status: TicketStatus;
  priority: Priority;
  assignee: string;
  unread: number;
  time: string;
  ticketNo: string;
  createdAt: string;
  deadline?: string;
  msgs: Msg[];
  client: ClientInfo;
}
