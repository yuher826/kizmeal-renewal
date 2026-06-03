'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import {
  PieChart, Pie, Cell, Tooltip as PieTooltip, Legend as PieLegend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as BarTooltip,
  ResponsiveContainer,
} from 'recharts'

const STATUS_META: Record<string, { label: string; color: string }> = {
  pending: { label: '대기', color: '#F4A261' },
  in_progress: { label: '진행중', color: '#52B788' },
  resolved: { label: '완료', color: '#2D6A4F' },
}

export default function AdminStatsPage() {
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [resolved, setResolved] = useState(0)
  const [statusData, setStatusData] = useState<{ name: string; value: number; color: string }[]>([])
  const [monthData, setMonthData] = useState<{ month: string; 문의수: number }[]>([])

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase.from('inquiries').select('status, created_at')
    const inqs = data || []

    setTotal(inqs.length)
    const resolvedCount = inqs.filter(i => i.status === 'resolved').length
    setResolved(resolvedCount)

    // 상태별
    const statusMap: Record<string, number> = {}
    inqs.forEach(i => { statusMap[i.status] = (statusMap[i.status] || 0) + 1 })
    setStatusData(
      Object.entries(statusMap).map(([s, n]) => ({
        name: STATUS_META[s]?.label || s,
        value: n,
        color: STATUS_META[s]?.color || '#B7E4C7',
      }))
    )

    // 최근 6개월 추이
    const now = new Date()
    const buckets: { key: string; month: string; 문의수: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      buckets.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, month: `${d.getMonth() + 1}월`, 문의수: 0 })
    }
    inqs.forEach(i => {
      const k = i.created_at.slice(0, 7)
      const bucket = buckets.find(b => b.key === k)
      if (bucket) bucket.문의수++
    })
    setMonthData(buckets.map(({ month, 문의수 }) => ({ month, 문의수 })))

    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const resolveRate = total > 0 ? Math.round((resolved / total) * 100) : 0

  return (
    <div className="min-h-screen bg-[#F6FAF6] font-sans">
      <header className="bg-white border-b border-gray-100 px-4 sm:px-6 h-16 hidden sm:flex items-center sticky top-0 z-10">
        <div>
          <h1 className="font-bold text-[#1C2B1E] text-base">통계</h1>
          <p className="text-gray-400 text-xs">문의 현황 · 처리율 · 월별 추이</p>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* KPI */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: '전체 문의', value: loading ? '—' : `${total}건`, icon: '💬' },
            { label: '처리 완료', value: loading ? '—' : `${resolved}건`, icon: '✅' },
            { label: '처리율', value: loading ? '—' : `${resolveRate}%`, icon: '📈' },
          ].map(card => (
            <div key={card.label} className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className="text-xl mb-1">{card.icon}</div>
              <div className="text-2xl font-bold text-[#1C2B1E]">{card.value}</div>
              <div className="text-xs text-gray-400 mt-0.5">{card.label}</div>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* 상태별 도넛 */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <h2 className="font-bold text-[#1C2B1E] mb-4">문의 처리 현황</h2>
            {loading ? (
              <div className="h-60 bg-gray-50 rounded-xl animate-pulse" />
            ) : statusData.length === 0 ? (
              <div className="h-60 flex items-center justify-center text-gray-400 text-sm">데이터 없음</div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="50%" innerRadius={60} outerRadius={95}
                    paddingAngle={3} dataKey="value" labelLine={false}>
                    {statusData.map((e, i) => <Cell key={i} fill={e.color} stroke="none" />)}
                  </Pie>
                  <PieTooltip
                    formatter={(v, n) => [`${v}건`, String(n)]}
                    contentStyle={{ borderRadius: '12px', border: '1px solid #E8F5E9', fontSize: '12px' }}
                  />
                  <PieLegend iconType="circle" iconSize={8}
                    formatter={v => <span style={{ fontSize: '12px', color: '#374151' }}>{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* 월별 추이 */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <h2 className="font-bold text-[#1C2B1E] mb-4">최근 6개월 문의 추이</h2>
            {loading ? (
              <div className="h-60 bg-gray-50 rounded-xl animate-pulse" />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={monthData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#9CA3AF', fontWeight: 600 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#D1D5DB' }} axisLine={false} tickLine={false} />
                  <BarTooltip
                    cursor={{ fill: '#F8FDF8' }}
                    contentStyle={{ borderRadius: '12px', border: '1px solid #E8F5E9', fontSize: '12px' }}
                    formatter={(v) => [`${v}건`, '문의수']}
                  />
                  <Bar dataKey="문의수" radius={[6, 6, 0, 0]} fill="#52B788" maxBarSize={48} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
