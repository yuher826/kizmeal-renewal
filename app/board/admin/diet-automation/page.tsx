'use client'

import { useState } from 'react'
import Link from 'next/link'
import DietNotificationPanel from '@/components/board/DietNotificationPanel'

// ── 데모 데이터 (실제 Supabase 연동은 B-2 이후) ──────────────────
const DEMO_STATS = {
  totalBranches:      23,
  pendingInput:        8,
  pendingReview:       4,
  deployedThisMonth:  12,
}

const STATUS_COLUMNS = [
  { key: 'draft',                label: '작성 중',       color: '#9E9E9E', bg: '#F5F5F5',  count: 4 },
  { key: 'input_complete',       label: '입력 완료',     color: '#1976D2', bg: '#E3F2FD',  count: 6 },
  { key: 'reviewing',            label: '검토 중',       color: '#E65100', bg: '#FFF3E0',  count: 3 },
  { key: 'correction_requested', label: '수정 요청',     color: '#C62828', bg: '#FFEBEE',  count: 1 },
  { key: 'approved',             label: '승인 완료',     color: '#2E7D32', bg: '#E8F5E9',  count: 2 },
  { key: 'generating',           label: 'PPTX 생성 중', color: '#6A1B9A', bg: '#F3E5F5',  count: 0 },
  { key: 'generated',            label: '파일 준비 완료', color: '#00838F', bg: '#E0F7FA', count: 5 },
  { key: 'deployed',             label: '배포 완료',     color: '#2D6A4F', bg: '#F6FAF6',  count: 12 },
]

const STAT_CARDS = [
  {
    label:    '계약원 현황',
    value:    DEMO_STATS.totalBranches,
    unit:     '개',
    icon:     '🏫',
    subLabel: '활성 계약원',
    color:    '#2D6A4F',
    bg:       '#F6FAF6',
  },
  {
    label:    '이번달 입력 대기',
    value:    DEMO_STATS.pendingInput,
    unit:     '개',
    icon:     '📝',
    subLabel: '식단 미입력 원',
    color:    '#1565C0',
    bg:       '#E3F2FD',
  },
  {
    label:    '검토·승인 대기',
    value:    DEMO_STATS.pendingReview,
    unit:     '개',
    icon:     '👀',
    subLabel: '검토/수정 요청 합산',
    color:    '#E65100',
    bg:       '#FFF3E0',
  },
  {
    label:    '이번달 배포 완료',
    value:    DEMO_STATS.deployedThisMonth,
    unit:     '개',
    icon:     '🚀',
    subLabel: '이메일 발송 완료',
    color:    '#2D6A4F',
    bg:       '#E8F5E9',
  },
]

type HubTab = 'workflow' | 'notifications'

export default function DietAutomationPage() {
  const [tab, setTab] = useState<HubTab>('workflow')

  return (
    <main className="min-h-screen bg-[#F6FAF6] px-4 sm:px-6 py-6 sm:py-8">
      {/* ── 헤더 ────────────────────────────────────────────── */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-2xl">🍱</span>
          <h1 className="text-xl sm:text-2xl font-bold text-[#1C2B1E]">식단표 자동화</h1>
          <span className="ml-2 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-medium">
            데모
          </span>
        </div>
        <p className="text-sm text-gray-500 ml-9">
          입력 → 검토 → 승인 → PPTX 생성 → 배포 전 과정을 한 곳에서 관리합니다
        </p>
      </div>

      {/* ── 통계 카드 4개 ────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {STAT_CARDS.map(c => (
          <div
            key={c.label}
            className="rounded-2xl p-4 flex flex-col gap-1"
            style={{ background: c.bg }}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-gray-500">{c.label}</span>
              <span className="text-lg leading-none">{c.icon}</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold" style={{ color: c.color }}>
                {c.value}
              </span>
              <span className="text-sm font-medium" style={{ color: c.color }}>{c.unit}</span>
            </div>
            <span className="text-[11px] text-gray-400">{c.subLabel}</span>
          </div>
        ))}
      </div>

      {/* ── 탭 바 ──────────────────────────────────────────── */}
      <div className="flex gap-1 mb-4 bg-white rounded-2xl p-1 border border-gray-100 w-fit">
        {([
          { key: 'workflow',      label: '워크플로우', icon: '📋' },
          { key: 'notifications', label: '알림',       icon: '🔔' },
        ] as { key: HubTab; label: string; icon: string }[]).map(t => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              tab === t.key
                ? 'bg-[#2D6A4F] text-white shadow-sm'
                : 'text-gray-500 hover:text-[#2D6A4F] hover:bg-[#F6FAF6]'
            }`}
          >
            <span className="text-base leading-none">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── 탭 콘텐츠 ─────────────────────────────────────── */}
      {tab === 'workflow' && (
        <div>
          {/* 워크플로우 칸반 */}
          <div className="overflow-x-auto pb-4">
            <div className="flex gap-3 min-w-max">
              {STATUS_COLUMNS.map(col => (
                <div
                  key={col.key}
                  className="w-36 rounded-2xl border border-gray-100 bg-white overflow-hidden flex-shrink-0"
                >
                  {/* 컬럼 헤더 */}
                  <div
                    className="px-3 py-2.5 text-center"
                    style={{ background: col.bg }}
                  >
                    <p
                      className="text-xs font-bold leading-snug"
                      style={{ color: col.color }}
                    >
                      {col.label}
                    </p>
                    <p
                      className="text-2xl font-bold mt-1"
                      style={{ color: col.color }}
                    >
                      {col.count}
                    </p>
                    <p className="text-[10px] text-gray-400">개</p>
                  </div>

                  {/* 빈 상태 메시지 */}
                  <div className="px-3 py-4 text-center">
                    {col.count === 0 ? (
                      <p className="text-[11px] text-gray-300">없음</p>
                    ) : (
                      <p className="text-[11px] text-gray-400 leading-relaxed">
                        B-2 구현 후<br />원 목록 표시
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 하단 안내 */}
          <div className="mt-4 bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <p className="text-xs text-amber-700 font-medium mb-1">데모 모드</p>
            <p className="text-xs text-amber-600 leading-relaxed">
              현재 표시되는 숫자는 데모 데이터입니다. B-2 단계(식단 입력 웹폼)가 완성되면
              실제 Supabase 데이터와 연동됩니다.
            </p>
          </div>

          {/* 빠른 이동 */}
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/board/admin/diet"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-gray-200 text-sm font-medium text-gray-700 hover:border-[#2D6A4F] hover:text-[#2D6A4F] transition-colors"
            >
              <span>📋</span>
              구 식단 목록
            </Link>
            <Link
              href="/board/admin/branches"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-gray-200 text-sm font-medium text-gray-700 hover:border-[#2D6A4F] hover:text-[#2D6A4F] transition-colors"
            >
              <span>🏫</span>
              원 관리
            </Link>
          </div>
        </div>
      )}

      {tab === 'notifications' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-6">
          <h2 className="text-sm font-bold text-[#1C2B1E] mb-4">알림 센터</h2>
          <DietNotificationPanel notifications={[]} />
        </div>
      )}
    </main>
  )
}
