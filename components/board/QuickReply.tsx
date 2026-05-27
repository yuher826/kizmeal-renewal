'use client';

const TEMPLATES = [
  { id: 1, label: '[납품 시간]', text: '안녕하세요! 오전 7시 30분 도착 예정입니다 😊' },
  { id: 2, label: '[식단 변경 확인]', text: '확인했습니다. 재고 상황 확인 후 30분 내 연락드리겠습니다.' },
  { id: 3, label: '[원산지 문서]', text: '원산지 증명서 파일 첨부드립니다. 확인 부탁드립니다.' },
  { id: 4, label: '[처리 완료]', text: '처리가 완료되었습니다. 추가 문의사항 있으시면 언제든 연락주세요 🙏' },
  { id: 5, label: '[빠른 응대]', text: '안녕하세요! 문의 접수되었습니다. 담당자 확인 후 빠르게 연락드리겠습니다.' },
];

interface Props {
  onSelect: (text: string) => void;
  onClose: () => void;
}

export default function QuickReply({ onSelect, onClose }: Props) {
  return (
    <div className="absolute bottom-full left-0 mb-2 w-80 bg-white border border-gray-200 rounded-2xl shadow-2xl z-50 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-[#F8FDF8]">
        <div className="flex items-center gap-2">
          <span className="text-sm">📋</span>
          <span className="font-semibold text-sm text-[#1C2B1E]">빠른 답변 템플릿</span>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="p-2">
        {TEMPLATES.map((t) => (
          <button
            key={t.id}
            onClick={() => { onSelect(t.text); onClose(); }}
            className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-[#E8F5E9] transition-colors group"
          >
            <div className="text-xs font-bold text-[#2D6A4F] mb-0.5">{t.label}</div>
            <div className="text-sm text-gray-600 leading-snug">{t.text}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
