'use client';

// TODO: Supabase 연결 — replace with real analytics queries

import {
  PieChart, Pie, Cell, Tooltip as PieTooltip, Legend as PieLegend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as BarTooltip,
  ResponsiveContainer,
} from 'recharts';
import StatsCard from '@/components/board/StatsCard';

// ── Chart data ────────────────────────────────────────────────────
const DONUT_DATA = [
  { name: '식단변경', value: 40, color: '#2D6A4F' },
  { name: '납품문의', value: 30, color: '#52B788' },
  { name: '위생민원', value: 15, color: '#F4A261' },
  { name: '계약관련', value: 15, color: '#B7E4C7' },
];

const BAR_DATA = [
  { day: '월', 문의수: 15 },
  { day: '화', 문의수: 23 },
  { day: '수', 문의수: 18 },
  { day: '목', 문의수: 31 },
  { day: '금', 문의수: 12 },
];

// ── Expiry list ───────────────────────────────────────────────────
const EXPIRY_LIST = [
  { org: '하늘초등학교', tier: '👑', expires: '2025.06.11', days: 15, mealCount: 320, manager: '김민지' },
  { org: '미래유치원',   tier: '⭐', expires: '2025.06.25', days: 29, mealCount: 75,  manager: '이수현' },
  { org: '행복어린이집', tier: '🌱', expires: '2025.07.10', days: 44, mealCount: 42,  manager: '박지원' },
  { org: '사랑유치원',   tier: '⭐', expires: '2025.08.31', days: 96, mealCount: 62,  manager: '이수현' },
  { org: '별빛어린이집', tier: '⭐', expires: '2025.08.31', days: 96, mealCount: 55,  manager: '이수현' },
];

// ── Custom pie label ──────────────────────────────────────────────
function PieLabel({ cx, cy }: { cx?: number; cy?: number }) {
  return (
    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle">
      <tspan x={cx} dy="-8" fontSize={11} fill="#9CA3AF">총 문의</tspan>
      <tspan x={cx} dy="22" fontSize={20} fontWeight="700" fill="#1C2B1E">99건</tspan>
      <tspan x={cx} dy="18" fontSize={10} fill="#D1D5DB">이번 달</tspan>
    </text>
  );
}

// ── Custom bar label ──────────────────────────────────────────────
function BarTopLabel(props: { x?: number; y?: number; width?: number; value?: number }) {
  const { x = 0, y = 0, width = 0, value } = props;
  return (
    <text x={x + width / 2} y={y - 4} fill="#6B7280" textAnchor="middle" fontSize={11} fontWeight="600">
      {value}
    </text>
  );
}

// ── Custom bar fill by value ──────────────────────────────────────
const MAX_VAL = Math.max(...BAR_DATA.map((d) => d['문의수']));

function CustomBar(props: Record<string, unknown>) {
  const { x, y, width, height, value } = props as {
    x: number; y: number; width: number; height: number; value: number;
  };
  const isMax = value === MAX_VAL;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={isMax ? '#2D6A4F' : '#52B788'}
        rx={6}
        ry={6}
      />
    </g>
  );
}

export default function AdminDashboard() {
  return (
    <div className="min-h-screen bg-[#F0F4F0] font-sans">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#2D6A4F] rounded-xl flex items-center justify-center text-white font-bold font-serif">K</div>
          <div>
            <h1 className="font-bold text-[#1C2B1E] text-sm">소통채널 관리자 대시보드</h1>
            <p className="text-gray-400 text-xs">2025년 5월 현황</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <a href="/board" className="text-sm text-[#2D6A4F] font-medium hover:underline">소통 채널로</a>
          <a href="/" className="text-sm text-gray-400 hover:text-gray-600">홈</a>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* Stats cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard icon="📬" label="오늘 신규 문의" value="2건" sub="어제 대비 +1건" trend="+1" />
          <StatsCard icon="⚡" label="미처리 건수" value="3건" sub="즉시 처리 필요" highlight />
          <StatsCard icon="⏱️" label="평균 응답 시간" value="12분" sub="업계 평균 35분" trend="우수" />
          <StatsCard icon="⭐" label="이번 달 만족도" value="4.8점" sub="5점 만점 기준" trend="▲0.1" />
        </div>

        {/* Charts */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Donut chart */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-bold text-[#1C2B1E]">문의 유형별 비율</h2>
                <p className="text-gray-400 text-xs mt-0.5">이번 달 누계 · 총 99건</p>
              </div>
              <span className="text-xs bg-[#E8F5E9] text-[#2D6A4F] font-semibold px-2.5 py-1 rounded-full">5월</span>
            </div>
            {/* TODO: Supabase 연결 — replace DONUT_DATA with real query */}
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={DONUT_DATA}
                  cx="50%"
                  cy="50%"
                  innerRadius={68}
                  outerRadius={100}
                  paddingAngle={3}
                  dataKey="value"
                  labelLine={false}
                  label={<PieLabel />}
                >
                  {DONUT_DATA.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                  ))}
                </Pie>
                <PieTooltip
                  formatter={(v: unknown) => [`${v}%`, '비율']}
                  contentStyle={{ borderRadius: '12px', border: '1px solid #E8F5E9', fontSize: '12px' }}
                />
                <PieLegend
                  iconType="circle"
                  iconSize={8}
                  formatter={(value) => <span style={{ fontSize: '12px', color: '#374151' }}>{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Bar chart */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-bold text-[#1C2B1E]">주간 문의 추이</h2>
                <p className="text-gray-400 text-xs mt-0.5">이번 주 (5/26~5/30)</p>
              </div>
              <span className="text-xs bg-[#E8F5E9] text-[#2D6A4F] font-semibold px-2.5 py-1 rounded-full">이번 주</span>
            </div>
            {/* TODO: Supabase 연결 — replace BAR_DATA with real query */}
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={BAR_DATA} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#9CA3AF', fontWeight: 600 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#D1D5DB' }} axisLine={false} tickLine={false} />
                <BarTooltip
                  cursor={{ fill: '#F8FDF8' }}
                  contentStyle={{ borderRadius: '12px', border: '1px solid #E8F5E9', fontSize: '12px' }}
                  formatter={(v: unknown) => [`${v}건`, '문의수']}
                />
                <Bar dataKey="문의수" radius={[6, 6, 0, 0]} shape={<CustomBar />} label={<BarTopLabel />} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
            <div className="flex items-center justify-center gap-6 mt-1">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-[#2D6A4F]" />
                <span className="text-xs text-gray-400">최다 문의일</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-[#52B788]" />
                <span className="text-xs text-gray-400">일반</span>
              </div>
            </div>
          </div>
        </div>

        {/* Contract expiry table */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div>
              <h2 className="font-bold text-[#1C2B1E]">계약 만료 알림</h2>
              <p className="text-gray-400 text-xs mt-0.5">60일 이내 만료 예정 기관</p>
            </div>
            <span className="text-xs bg-red-100 text-red-700 font-semibold px-2.5 py-1 rounded-full">
              {EXPIRY_LIST.filter((e) => e.days <= 30).length}건 긴급
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[#F8FDF8]">
                  {['기관명', '만료일', 'D-Day', '급식인원', '담당자', '조치'].map((h) => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-bold text-gray-400 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {EXPIRY_LIST.map((item) => (
                  <tr key={item.org} className="hover:bg-[#F8FDF8] transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-[#1C2B1E]">{item.org}</span>
                        <span>{item.tier}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-600">{item.expires}</td>
                    <td className="px-5 py-4">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                        item.days <= 14 ? 'bg-red-100 text-red-700'
                        : item.days <= 30 ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-blue-50 text-blue-700'
                      }`}>
                        D-{item.days}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-600">{item.mealCount}명</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-[#E8F5E9] flex items-center justify-center text-xs font-bold text-[#2D6A4F]">
                          {item.manager[0]}
                        </div>
                        <span className="text-sm text-gray-600">{item.manager}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <button className="text-xs bg-[#2D6A4F] hover:bg-[#1B4332] text-white font-medium px-3 py-1.5 rounded-lg transition-colors">
                        미팅 예약
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Today summary */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h2 className="font-bold text-[#1C2B1E] mb-4">오늘의 처리 현황</h2>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: '신규 접수', value: 2, color: 'bg-yellow-100 text-yellow-800' },
              { label: '처리 완료', value: 5, color: 'bg-green-100 text-green-800' },
              { label: '평균 처리 시간', value: '18분', color: 'bg-blue-100 text-blue-800' },
            ].map((item) => (
              <div key={item.label} className="text-center">
                <div className={`text-2xl font-bold rounded-xl py-3 mb-2 ${item.color}`}>{item.value}</div>
                <div className="text-xs text-gray-400">{item.label}</div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
