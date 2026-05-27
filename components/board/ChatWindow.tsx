'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type { Ticket, TicketStatus, Msg } from './types';
import { STATUS_STYLE, TYPE_STYLE } from './types';
import QuickReply from './QuickReply';

const ASSIGNEES = ['김민지', '이수현', '박지원', '최영훈'];
const STATUSES: TicketStatus[] = ['접수', '처리중', '완료'];

interface Props {
  ticket: Ticket;
  onAddMsg: (ticketId: string, msg: Msg) => void;
  onChangeStatus: (ticketId: string, status: TicketStatus) => void;
}

function MsgBubble({ msg }: { msg: Msg }) {
  if (msg.type === 'system') {
    return (
      <div className="flex justify-center my-3">
        <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1 rounded-full">{msg.content}</span>
      </div>
    );
  }

  if (msg.type === 'memo') {
    return (
      <div className="mx-4 my-2">
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="text-xs">🔒</span>
            <span className="text-xs font-bold text-yellow-800">내부 메모 (고객에게 보이지 않음)</span>
          </div>
          <p className="text-sm text-yellow-900 leading-relaxed whitespace-pre-wrap">{msg.content}</p>
          <div className="text-right mt-1">
            <span className="text-[10px] text-yellow-600">{msg.sender} · {msg.time}</span>
          </div>
        </div>
      </div>
    );
  }

  const isStaff = msg.type === 'staff';

  return (
    <div className={`flex items-end gap-2 px-4 my-2 ${isStaff ? 'flex-row-reverse' : 'flex-row'}`}>
      {!isStaff && (
        <div className="w-7 h-7 rounded-full bg-[#E8F5E9] flex items-center justify-center text-xs font-bold text-[#2D6A4F] flex-shrink-0">
          {msg.sender[0]}
        </div>
      )}
      <div className={`max-w-[70%] ${isStaff ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
        {!isStaff && <span className="text-xs text-gray-400 px-1">{msg.sender}</span>}
        <div
          className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
            isStaff
              ? 'bg-[#2D6A4F] text-white rounded-br-sm'
              : 'bg-white border border-gray-200 text-[#1C2B1E] rounded-bl-sm'
          }`}
        >
          {msg.content}
          {msg.attachment && (
            <div className={`mt-2 flex items-center gap-1.5 text-xs ${isStaff ? 'text-white/70' : 'text-gray-500'}`}>
              <span>📎</span>
              <span className="underline">{msg.attachment}</span>
            </div>
          )}
        </div>
        <div className={`flex items-center gap-1 px-1 ${isStaff ? 'flex-row-reverse' : ''}`}>
          <span className="text-[10px] text-gray-400">{msg.time}</span>
          {isStaff && (
            <span className={`text-[10px] ${msg.read ? 'text-[#2D6A4F]' : 'text-gray-300'}`}>✓✓</span>
          )}
        </div>
      </div>
    </div>
  );
}

function TypingIndicator({ name }: { name: string }) {
  return (
    <div className="flex items-end gap-2 px-4 my-2">
      <div className="w-7 h-7 rounded-full bg-[#E8F5E9] flex items-center justify-center text-xs font-bold text-[#2D6A4F]">
        {name[0]}
      </div>
      <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
      <span className="text-xs text-gray-400">{name}님이 입력 중...</span>
    </div>
  );
}

export default function ChatWindow({ ticket, onAddMsg, onChangeStatus }: Props) {
  const [inputText, setInputText] = useState('');
  const [isMemo, setIsMemo] = useState(false);
  const [showTemplate, setShowTemplate] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [ticket.msgs, isTyping]);

  const handleSend = useCallback(() => {
    if (!inputText.trim()) return;

    const now = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    const sentMsg: Msg = {
      id: `msg-${Date.now()}`,
      type: isMemo ? 'memo' : 'staff',
      sender: '김민지',
      content: inputText.trim(),
      time: now,
      read: false,
    };
    onAddMsg(ticket.id, sentMsg);
    setInputText('');

    if (!isMemo) {
      // 즉시 타이핑 인디케이터 표시
      setIsTyping(true);
      // 1.5초 후 자동 답장
      setTimeout(() => {
        setIsTyping(false);
        const replyMsg: Msg = {
          id: `msg-${Date.now() + 1}`,
          type: 'customer',
          sender: ticket.client.contactName,
          content: '확인했습니다! 담당자가 검토 후 빠르게 연락드리겠습니다 🙏',
          time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
          read: false,
        };
        onAddMsg(ticket.id, replyMsg);
      }, 1500);
    }
  }, [inputText, isMemo, ticket, onAddMsg]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#F8FBF8]">
      {/* Chat header */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold flex-shrink-0"
              style={{ background: ticket.tierColor }}
            >
              {ticket.org[0]}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-[#1C2B1E] text-sm">{ticket.org}</span>
                <span>{ticket.tierIcon}</span>
                {ticket.priority === '긴급' && (
                  <span className="text-xs bg-red-100 text-red-700 font-bold px-1.5 py-0.5 rounded-full">🔴 긴급</span>
                )}
              </div>
              <div className="text-xs text-gray-400">{ticket.client.contactName}</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Assignee */}
            <select
              defaultValue={ticket.assignee}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/20 bg-white"
            >
              {ASSIGNEES.map((a) => <option key={a}>{a}</option>)}
            </select>

            {/* Status change */}
            <div className="relative">
              <button
                onClick={() => setShowStatusMenu(!showStatusMenu)}
                className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg flex items-center gap-1 ${STATUS_STYLE[ticket.status]}`}
              >
                {ticket.status} ▾
              </button>
              {showStatusMenu && (
                <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-30 overflow-hidden">
                  {STATUSES.map((s) => (
                    <button
                      key={s}
                      onClick={() => { onChangeStatus(ticket.id, s); setShowStatusMenu(false); }}
                      className={`block w-full text-left px-4 py-2 text-xs font-semibold hover:bg-gray-50 ${STATUS_STYLE[s]}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Info bar */}
        <div className="flex items-center gap-3 text-[10px] text-gray-400 flex-wrap">
          <span className={`px-1.5 py-0.5 rounded-md font-medium ${TYPE_STYLE[ticket.inquiryType]}`}>{ticket.inquiryType}</span>
          <span>{ticket.ticketNo}</span>
          <span>접수 {ticket.createdAt}</span>
          {ticket.deadline && <span className="text-red-500 font-bold">{ticket.deadline} 만료</span>}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-3" onClick={() => { setShowStatusMenu(false); setShowTemplate(false); }}>
        {ticket.msgs.map((msg) => (
          <MsgBubble key={msg.id} msg={msg} />
        ))}
        {isTyping && <TypingIndicator name={ticket.client.contactName} />}
        <div ref={bottomRef} />
      </div>

      {/* Memo toggle indicator */}
      {isMemo && (
        <div className="mx-4 mb-1 flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-xl px-3 py-1.5">
          <span className="text-xs">🔒</span>
          <span className="text-xs font-semibold text-yellow-800">내부 메모 모드 — 고객에게 보이지 않습니다</span>
          <button onClick={() => setIsMemo(false)} className="ml-auto text-yellow-600 text-xs hover:underline">해제</button>
        </div>
      )}

      {/* Input area */}
      <div className="bg-white border-t border-gray-100 p-3 flex-shrink-0">
        <div className={`flex items-end gap-2 border rounded-2xl px-3 py-2 transition-colors ${isMemo ? 'border-yellow-300 bg-yellow-50' : 'border-gray-200 bg-white focus-within:border-[#2D6A4F]/40 focus-within:ring-2 focus-within:ring-[#2D6A4F]/10'}`}>
          {/* Left icons */}
          <div className="flex items-center gap-1 pb-1">
            <button className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-[#2D6A4F] rounded-lg hover:bg-[#E8F5E9] transition-colors" title="파일 첨부">
              📎
            </button>
            <div className="relative">
              <button
                onClick={(e) => { e.stopPropagation(); setShowTemplate(!showTemplate); }}
                className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-[#2D6A4F] rounded-lg hover:bg-[#E8F5E9] transition-colors"
                title="빠른 답변"
              >
                📋
              </button>
              {showTemplate && (
                <QuickReply
                  onSelect={(text) => { setInputText(text); textareaRef.current?.focus(); }}
                  onClose={() => setShowTemplate(false)}
                />
              )}
            </div>
            <button
              onClick={() => setIsMemo(!isMemo)}
              className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors ${isMemo ? 'bg-yellow-100 text-yellow-700' : 'text-gray-400 hover:text-[#2D6A4F] hover:bg-[#E8F5E9]'}`}
              title="내부 메모 토글"
            >
              🔒
            </button>
          </div>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isMemo ? '내부 메모를 입력하세요...' : '메시지를 입력하세요... (Enter 전송 / Shift+Enter 줄바꿈)'}
            rows={2}
            className="flex-1 resize-none text-sm bg-transparent focus:outline-none text-[#1C2B1E] placeholder-gray-400 py-1 min-h-[40px] max-h-32"
          />

          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={!inputText.trim()}
            className="w-9 h-9 bg-[#2D6A4F] hover:bg-[#1B4332] disabled:bg-gray-200 text-white rounded-xl flex items-center justify-center transition-colors flex-shrink-0"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>

        <div className="flex items-center justify-center gap-3 mt-2">
          <span className="text-[10px] text-gray-400">💬 카카오 알림톡</span>
          <span className="text-[10px] text-gray-300">+</span>
          <span className="text-[10px] text-gray-400">📧 이메일 동시 발송</span>
        </div>
      </div>
    </div>
  );
}
