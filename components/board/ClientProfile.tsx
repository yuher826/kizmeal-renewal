'use client';

import { useState } from 'react';
import type { Ticket } from './types';

const FILE_ICONS: Record<string, string> = {
  xlsx: '📊',
  pdf: '📄',
  jpg: '🖼️',
  png: '🖼️',
  docx: '📝',
};

interface Props {
  ticket: Ticket;
}

export default function ClientProfile({ ticket }: Props) {
  const { client } = ticket;
  const [tab, setTab] = useState<'info' | 'files'>('info');
  const [memo, setMemo] = useState(client.memo);
  const [editingMemo, setEditingMemo] = useState(false);

  const contractWarning = client.daysLeft <= 30;
  const contractDanger = client.daysLeft <= 14;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Profile header */}
      <div className="p-5 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-xl flex-shrink-0"
            style={{ background: ticket.tierColor }}
          >
            {ticket.org[0]}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-[#1C2B1E] text-sm truncate">{ticket.org}</span>
              <span className="text-base">{ticket.tierIcon}</span>
            </div>
            <div className="text-gray-400 text-xs">{ticket.ticketNo}</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-[#F8FDF8] rounded-xl p-2.5">
            <div className="text-gray-400 mb-0.5">총 문의</div>
            <div className="font-bold text-[#1C2B1E]">{client.totalInquiries}건</div>
          </div>
          <div className="bg-[#F8FDF8] rounded-xl p-2.5">
            <div className="text-gray-400 mb-0.5">평균 만족도</div>
            <div className="font-bold text-[#F4A261]">{'⭐'.repeat(Math.floor(client.avgRating))} {client.avgRating}</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-100 flex-shrink-0">
        {(['info', 'files'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${tab === t ? 'text-[#2D6A4F] border-b-2 border-[#2D6A4F]' : 'text-gray-400 hover:text-gray-600'}`}
          >
            {t === 'info' ? '👤 정보' : '📁 파일'}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {tab === 'info' ? (
          <div className="p-4 space-y-4">
            {/* Contact */}
            <div>
              <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">연락처</div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 w-4">👤</span>
                  <span className="text-[#1C2B1E]">{client.contactName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 w-4">📞</span>
                  <span className="text-[#1C2B1E]">{client.phone}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 w-4">✉️</span>
                  <span className="text-[#1C2B1E] text-xs">{client.email}</span>
                </div>
              </div>
            </div>

            {/* Contract */}
            <div>
              <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">계약 정보</div>
              <div className={`rounded-xl p-3 text-sm space-y-1.5 ${contractDanger ? 'bg-red-50 border border-red-200' : contractWarning ? 'bg-yellow-50 border border-yellow-200' : 'bg-[#F8FDF8] border border-[#E8F5E9]'}`}>
                <div className="flex justify-between">
                  <span className="text-gray-500">시작일</span>
                  <span className="font-medium text-[#1C2B1E]">{client.contractStart}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">만료일</span>
                  <div className="flex items-center gap-1.5">
                    <span className={`font-medium ${contractDanger ? 'text-red-600' : contractWarning ? 'text-yellow-700' : 'text-[#1C2B1E]'}`}>{client.contractEnd}</span>
                    {contractWarning && (
                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${contractDanger ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        D-{client.daysLeft}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">급식 인원</span>
                  <span className="font-medium text-[#1C2B1E]">{client.mealCount}명</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">서비스 지역</span>
                  <span className="font-medium text-[#1C2B1E] text-xs">{client.region}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">담당 영양사</span>
                  <span className="font-medium text-[#1C2B1E]">{client.nutritionist}</span>
                </div>
              </div>
            </div>

            {/* Allergy */}
            {client.allergyCount > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-3">
                <div className="flex items-center gap-2 text-sm">
                  <span>⚠️</span>
                  <span className="font-semibold text-orange-800">알레르기 학생 {client.allergyCount}명 관리 중</span>
                </div>
              </div>
            )}

            {/* Memo */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">특이사항 메모</div>
                <button onClick={() => setEditingMemo(!editingMemo)} className="text-xs text-[#2D6A4F] font-medium hover:underline">
                  {editingMemo ? '저장' : '편집'}
                </button>
              </div>
              {editingMemo ? (
                <textarea
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  rows={3}
                  className="w-full text-sm border border-[#2D6A4F]/30 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/20 resize-none"
                />
              ) : (
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-sm text-gray-700 leading-relaxed">
                  {memo}
                </div>
              )}
            </div>

            {/* Delivery schedule */}
            <div>
              <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">이번 주 납품 일정</div>
              <div className="space-y-1.5">
                {client.delivery.map((d, i) => (
                  <div key={i} className="flex items-center justify-between bg-[#F8FDF8] border border-[#E8F5E9] rounded-xl px-3 py-2">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-[#2D6A4F]">🚛</span>
                      <span className="font-medium text-[#1C2B1E]">{d.day}</span>
                    </div>
                    <span className="text-sm font-bold text-[#2D6A4F]">{d.time}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">공유 파일</div>
            <div className="space-y-2">
              {client.files.map((f, i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-[#F8FDF8] border border-[#E8F5E9] rounded-xl hover:border-[#2D6A4F]/30 transition-colors cursor-pointer">
                  <span className="text-xl">{FILE_ICONS[f.ext] ?? '📄'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-[#1C2B1E] truncate">{f.name}</div>
                    <div className="text-xs text-gray-400">{f.size}</div>
                  </div>
                  <button className="text-gray-400 hover:text-[#2D6A4F] transition-colors">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
