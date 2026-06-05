'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
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

interface DietStat {
  total: number
  configured: number
  allergyBranches: number
  allergyTotal: number
  slide1: number
  slide3: number
  unconfirmed: number
}

export default function AdminStatsPage() {
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [resolved, setResolved] = useState(0)
  const [statusData, setStatusData] = useState<{ name: string; value: number; color: string }[]>([])
  const [monthData, setMonthData] = useState<{ month: string; 문의수: number }[]>([])
  const [dietStat, setDietStat] = useState<DietStat | null>(null)

  const load = useCallback(async () => {
    const supabase = createClient()
    const [{ data }, { data: branches }] = await Promise.all([
      supabase.from('inquiries').select('status, created_at'),
      supabase.from('branches').select('meal_config, diet_type').eq('is_active', true),
    ])
    const inqs = data || []
    const branchList = branches || []

    setTotal(inqs.length)
    const resolvedCount = inqs.filter(i => i.status === 'resolved').length
    setResolved(resolvedCount)

    // 식단 통계
    let configured = 0, allergyBranches = 0, allergyTotal = 0, slide1 = 0, slide3 = 0, unconfirmed = 0
    for (const b of branchList) {
      const mc = b.meal_config as Record<string, unknown> | null
      if (!mc || !mc.간식) continue
      configured++
      const kids = (mc.알레르기아이 as unknown[]) || []
      if (kids.length > 0) { allergyBranches++; allergyTotal += kids.length }
      const s = (mc.pptx슬라이드 as number) || 1
      if (s === 3) slide3++; else slide1++
      const confirm = mc.식단확인 as Record<string, unknown> | undefined
      if (!confirm?.마지막확인) unconfirmed++
    }
    setDietStat({ total: branchList.length, configured, allergyBranches, allergyTotal, slide1, slide3, unconfirmed })

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
          <div className="flex items-center gap-1 text-xs text-gray-400 mb-0.5">
            <Link href="/board/admin" className="hover:text-[#2D6A4F] transition-colors">소통채널</Link>
            <span>›</span>
            <span>운영관리</span>
            <span>›</span>
            <span className="text-[#2D6A4F] font-medium">통계</span>
          </div>
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

        {/* 식단 프로파일 통계 */}
        {dietStat && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <h2 className="font-bold text-[#1C2B1E] mb-4 text-sm sm:text-base">식단 프로파일 현황</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { label: '프로파일 설정', value: `${dietStat.configured}/${dietStat.total}`, sub: '원', color: 'text-[#2D6A4F]' },
                { label: '미설정 원',    value: dietStat.total - dietStat.configured,        sub: '원', color: 'text-orange-600' },
                { label: '알레르기 아동', value: dietStat.allergyTotal,                       sub: '명', color: 'text-red-600' },
                { label: 'Slide 1 (간식)', value: dietStat.slide1,                           sub: '원', color: 'text-blue-600' },
                { label: 'Slide 3 (점심)', value: dietStat.slide3,                           sub: '원', color: 'text-gray-500' },
                { label: '식단표 미확인', value: dietStat.unconfirmed,                        sub: '원', color: 'text-yellow-600' },
              ].map(stat => (
                <div key={stat.label} className="bg-[#F8FDF8] rounded-xl p-3">
                  <p className={`text-xl font-bold ${stat.color}`}>{stat.value}<span className="text-xs font-normal text-gray-400 ml-0.5">{stat.sub}</span></p>
                  <p className="text-xs text-gray-500 mt-0.5">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

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
