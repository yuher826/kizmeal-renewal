'use client';

import { useState, useMemo } from 'react';
import type { Ticket, TicketStatus } from './types';
import { STATUS_STYLE, TYPE_STYLE } from './types';

const FILTER_TABS: { label: string; value: TicketStatus | 'all' }[] = [
  { label: '전체', value: 'all' },
  { label: '처리중', value: '처리중' },
  { label: '접수', value: '접수' },
  { label: '완료', value: '완료' },
];

interface Props {
  tickets: Ticket[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export default function TicketList({ tickets, selectedId, onSelect }: Props) {
  const [filter, setFilter] = useState<TicketStatus | 'all'>('all');
  const [search, setSearch] = useState('');

  const unprocessed = tickets.filter((t) => t.status !== '완료').length;

  const filtered = useMemo(() => {
    let list = filter === 'all' ? tickets : tickets.filter((t) => t.status === filter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (t) =>
          t.org.toLowerCase().includes(q) ||
          t.inquiryType.includes(q) ||
          t.client.contactName.toLowerCase().includes(q)
      );
    }
    return list;
  }, [tickets, filter, search]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[#1C2B1E] text-sm">소통 채널</span>
            {unprocessed > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                {unprocessed}
              </span>
            )}
          </div>
          <button className="w-7 h-7 bg-[#2D6A4F] hover:bg-[#1B4332] text-white rounded-lg flex items-center justify-center text-lg transition-colors" title="새 문의">
            +
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="11" cy="11" r="8" /><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="기관명, 유형 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#F8FDF8] border border-gray-100 rounded-xl pl-8 pr-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/20 focus:border-[#2D6A4F]/40"
          />
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 px-3 py-2 border-b border-gray-50 flex-shrink-0">
        {FILTER_TABS.map((tab) => {
          const count = tab.value === 'all' ? tickets.length : tickets.filter((t) => t.status === tab.value).length;
          return (
            <button
              key={tab.value}
              onClick={() => setFilter(tab.value)}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${filter === tab.value ? 'bg-[#2D6A4F] text-white' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'}`}
            >
              {tab.label}
              {count > 0 && (
                <span className={`ml-1 ${filter === tab.value ? 'text-white/80' : 'text-gray-300'}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Ticket list */}
      <div className="flex-1 overflow-y-auto py-2 px-2">
        {filtered.length === 0 ? (
          <div className="text-center text-gray-400 text-sm py-10">검색 결과가 없습니다</div>
        ) : (
          filtered.map((ticket) => (
            <button
              key={ticket.id}
              onClick={() => onSelect(ticket.id)}
              className={`w-full text-left p-3 rounded-xl mb-1.5 transition-all ${selectedId === ticket.id ? 'bg-[#E8F5E9] border border-[#2D6A4F]/30 border-l-4 border-l-[#2D6A4F]' : 'hover:bg-gray-50 border border-transparent'}`}
            >
              <div className="flex items-start gap-2.5">
                {/* Avatar */}
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0 mt-0.5"
                  style={{ background: ticket.tierColor }}
                >
                  {ticket.org[0]}
                </div>

                <div className="flex-1 min-w-0">
                  {/* Org + tier + priority */}
                  <div className="flex items-center gap-1 mb-0.5">
                    {ticket.priority === '긴급' && (
                      <span className="text-red-500 text-xs font-bold">🔴</span>
                    )}
                    <span className="font-semibold text-[#1C2B1E] text-xs truncate">{ticket.org}</span>
                    <span className="text-sm flex-shrink-0">{ticket.tierIcon}</span>
                  </div>

                  {/* Last message preview */}
                  {ticket.msgs.length > 0 && (
                    <div className="text-xs text-gray-400 truncate mb-1.5">
                      {ticket.msgs[ticket.msgs.length - 1].content.replace(/\n/g, ' ')}
                    </div>
                  )}

                  {/* Tags */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`text-xs px-1.5 py-0.5 rounded-md font-medium ${TYPE_STYLE[ticket.inquiryType]}`}>
                      {ticket.inquiryType}
                    </span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-md font-medium ${STATUS_STYLE[ticket.status]}`}>
                      {ticket.status}
                    </span>
                    {ticket.deadline && (
                      <span className="text-xs px-1.5 py-0.5 rounded-md font-medium bg-red-100 text-red-700">
                        {ticket.deadline}
                      </span>
                    )}
                  </div>
                </div>

                {/* Time + unread */}
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span className="text-[10px] text-gray-400">{ticket.time}</span>
                  {ticket.unread > 0 && (
                    <span className="bg-[#2D6A4F] text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                      {ticket.unread}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))
        )}
      </div>

      {/* New inquiry button */}
      <div className="p-3 border-t border-gray-100 flex-shrink-0">
        <button className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-[#2D6A4F]/30 hover:border-[#2D6A4F] text-[#2D6A4F] font-medium text-xs py-2.5 rounded-xl transition-all hover:bg-[#E8F5E9]">
          + 새 문의 접수
        </button>
      </div>
    </div>
  );
}
