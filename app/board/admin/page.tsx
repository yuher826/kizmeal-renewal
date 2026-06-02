'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { CATEGORY_LABELS, type InquiryCategory } from '@/lib/types'
import {
  PieChart, Pie, Cell, Tooltip as PieTooltip, Legend as PieLegend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as BarTooltip,
  ResponsiveContainer,
} from 'recharts'
import StatsCard from '@/components/board/StatsCard'

const PIE_COLORS = ['#2D6A4F', '#52B788', '#F4A261', '#B7E4C7', '#74C69D', '#40916C', '#D8F3DC', '#95D5B2']
const DAY_KO = ['일', '월', '화', '수', '목', '금', '토']

function CustomBarShape(props: Record<string, unknown>) {
  const { x, y, width, height, fill } = props as { x: number; y: number; width: number; height: number; fill: string }
  return <rect x={x} y={y} width={width} height={height} fill={fill} rx={6} ry={6} />
}

function BarTopLabel(props: { x?: number; y?: number; width?: number; value?: number }) {
  const { x = 0, y = 0, width = 0, value } = props
  if (!value) return null
  return (
    <text x={x + width / 2} y={y - 4} fill="#6B7280" textAnchor="middle" fontSize={11} fontWeight="600">
      {value}
    </text>
  )
}

export default function AdminDashboard() {
  const [adminName, setAdminName] = useState('')
  const [loading, setLoading] = useState(true)
  const [pendingParents, setPendingParents] = useState(0)
  const [stats, setStats] = useState({ today: 0, pending: 0, inProgress: 0, todayResolved: 0 })
  const [avgResponse, setAvgResponse] = useState<string>('—')
  const [monthTotal, setMonthTotal] = useState(0)
  const [catData, setCatData] = useState<{ name: string; value: number; color: string }[]>([])
  const [dayData, setDayData] = useState<{ day: string; 문의수: number; fill: string }[]>([])
  const [expiryList, setExpiryList] = useState<{
    id: string; org: string; expires: string; days: number; mealCount: number; brand: string
  }[]>([])

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: a } = await supabase.from('admins').select('name').eq('auth_id', user.id).maybeSingle()
      if (a) setAdminName(a.name)
    }

    const now = new Date()
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0)
    const sevenAgo = new Date(now); sevenAgo.setDate(now.getDate() - 6); sevenAgo.setHours(0, 0, 0, 0)
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const in60Days = new Date(now.getTime() + 60 * 86400000).toISOString().slice(0, 10)
    const today = now.toISOString().slice(0, 10)

    const { count: parentPendingCount } = await supabase
      .from('parents')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending')
    setPendingParents(parentPendingCount || 0)

    const [recent, allPending, allInProgress, expiryRes] = await Promise.all([
      supabase
        .from('inquiries')
        .select('id, status, category, created_at, first_response_at')
        .gte('created_at', sevenAgo.toISOString()),
      supabase.from('inquiries').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('inquiries').select('*', { count: 'exact', head: true }).eq('status', 'in_progress'),
      supabase
        .from('branches')
        .select('id, name, meal_count, contract_end, brands(name)')
        .not('contract_end', 'is', null)
        .gte('contract_end', today)
        .lte('contract_end', in60Days)
        .order('contract_end', { ascending: true })
        .limit(10),
    ])

    const inqs = recent.data || []

    // Today
    const todayInqs = inqs.filter(i => new Date(i.created_at) >= todayStart)
    const todayResolved = inqs.filter(i => i.status === 'resolved' && new Date(i.created_at) >= todayStart)

    // Month
    const monthInqs = inqs.filter(i => new Date(i.created_at) >= monthStart)
    setMonthTotal(monthInqs.length)

    // Avg response (hours)
    const withResp = inqs.filter(i => i.first_response_at)
    if (withResp.length > 0) {
      const avg = withResp.reduce((s, i) =>
        s + (new Date(i.first_response_at!).getTime() - new Date(i.created_at).getTime()) / 3600000, 0
      ) / withResp.length
      setAvgResponse(avg < 1 ? `${Math.round(avg * 60)}분` : `${avg.toFixed(1)}시간`)
    }

    setStats({
      today: todayInqs.length,
      pending: allPending.count || 0,
      inProgress: allInProgress.count || 0,
      todayResolved: todayResolved.length,
    })

    // Category pie
    const catMap: Record<string, number> = {}
    monthInqs.forEach(i => { catMap[i.category] = (catMap[i.category] || 0) + 1 })
    setCatData(
      Object.entries(catMap)
        .sort((a, b) => b[1] - a[1])
        .map(([cat, n], idx) => ({
          name: CATEGORY_LABELS[cat as InquiryCategory] || cat,
          value: n,
          color: PIE_COLORS[idx % PIE_COLORS.length],
        }))
    )

    // Last 7 days bar
    const dayMap: Record<string, number> = {}
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i)
      dayMap[d.toISOString().slice(0, 10)] = 0
    }
    inqs.forEach(i => {
      const k = i.created_at.slice(0, 10)
      if (k in dayMap) dayMap[k]++
    })
    const maxCount = Math.max(...Object.values(dayMap), 1)
    setDayData(
      Object.entries(dayMap).map(([dt, n]) => ({
        day: DAY_KO[new Date(dt).getDay()],
        문의수: n,
        fill: n === maxCount && n > 0 ? '#2D6A4F' : '#52B788',
      }))
    )

    // Expiry
    if (expiryRes.data) {
      setExpiryList(expiryRes.data.map(b => ({
        id: b.id,
        org: b.name,
        expires: b.contract_end!,
        days: Math.ceil((new Date(b.contract_end!).getTime() - now.getTime()) / 86400000),
        mealCount: b.meal_count || 0,
        brand: (b.brands as unknown as { name: string } | null)?.name || '',
      })))
    }

    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function handleLogout() {
    const s = createClient()
    await s.auth.signOut()
    window.location.href = '/board/login'
  }

  return (
    <div className="min-h-screen bg-[#F0F4F0] font-sans">
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <Link href="/board/admin" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <div className="w-8 h-8 bg-gradient-to-br from-[#2D6A4F] to-[#52B788] rounded-xl flex items-center justify-center text-white font-bold">K</div>
          <div>
            <h1 className="font-bold text-[#1C2B1E] text-sm">소통채널 관리자</h1>
            <p className="text-gray-400 text-xs">{adminName || '관리자'} · 대시보드</p>
          </div>
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/board/admin/inquiries" className="text-sm text-[#2D6A4F] font-medium hover:underline">문의 관리</Link>
          <Link href="/board/admin/branches" className="text-sm text-[#2D6A4F] font-medium hover:underline">가맹점 관리</Link>
          <Link href="/board/admin/parents" className="relative text-sm text-[#2D6A4F] font-medium hover:underline inline-flex items-center gap-1.5">
            학부모 승인
            {pendingParents > 0 && (
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold">
                {pendingParents > 99 ? '99+' : pendingParents}
              </span>
            )}
          </Link>
          <button onClick={handleLogout} className="text-xs text-gray-400 hover:text-gray-600">로그아웃</button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 h-28 animate-pulse" />
            ))
          ) : (
            <>
              <Link href="/board/admin/inquiries" className="block">
                <StatsCard icon="📬" label="오늘 신규 문의" value={`${stats.today}건`}
                  sub={stats.today > 0 ? '빠른 응답이 필요합니다' : '오늘은 조용합니다'} />
              </Link>
              <Link href="/board/admin/inquiries" className="block">
                <StatsCard icon="⚡" label="미처리 건수" value={`${stats.pending}건`}
                  sub="즉시 처리 필요" highlight={stats.pending > 0} />
              </Link>
              <Link href="/board/admin/inquiries" className="block">
                <StatsCard icon="⏱️" label="평균 응답 시간" value={avgResponse}
                  sub="최근 7일 평균" />
              </Link>
              <Link href="/board/admin/inquiries" className="block">
                <StatsCard icon="✅" label="오늘 처리 완료" value={`${stats.todayResolved}건`}
                  sub={`이번 달 총 ${monthTotal}건`} />
              </Link>
            </>
          )}
        </div>

        {/* Charts */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Donut */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-bold text-[#1C2B1E]">문의 유형별 비율</h2>
                <p className="text-gray-400 text-xs mt-0.5">이번 달 누계 · 총 {monthTotal}건</p>
              </div>
              <span className="text-xs bg-[#E8F5E9] text-[#2D6A4F] font-semibold px-2.5 py-1 rounded-full">
                {new Date().getMonth() + 1}월
              </span>
            </div>
            {loading ? (
              <div className="h-60 bg-gray-50 rounded-xl animate-pulse" />
            ) : catData.length === 0 ? (
              <div className="h-60 flex items-center justify-center text-gray-400 text-sm">
                이번 달 문의 없음
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={catData} cx="50%" cy="50%" innerRadius={60} outerRadius={95}
                    paddingAngle={3} dataKey="value" labelLine={false}>
                    {catData.map((e, i) => <Cell key={i} fill={e.color} stroke="none" />)}
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

          {/* Bar */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-bold text-[#1C2B1E]">최근 7일 문의 추이</h2>
                <p className="text-gray-400 text-xs mt-0.5">일별 접수 현황</p>
              </div>
            </div>
            {loading ? (
              <div className="h-60 bg-gray-50 rounded-xl animate-pulse" />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={dayData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#9CA3AF', fontWeight: 600 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#D1D5DB' }} axisLine={false} tickLine={false} />
                  <BarTooltip
                    cursor={{ fill: '#F8FDF8' }}
                    contentStyle={{ borderRadius: '12px', border: '1px solid #E8F5E9', fontSize: '12px' }}
                    formatter={(v) => [`${v}건`, '문의수']}
                  />
                  <Bar dataKey="문의수" radius={[6, 6, 0, 0]} shape={<CustomBarShape />}
                    label={<BarTopLabel />} maxBarSize={48} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Contract expiry */}
        {(loading || expiryList.length > 0) && (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="font-bold text-[#1C2B1E]">계약 만료 임박</h2>
                <p className="text-gray-400 text-xs mt-0.5">60일 이내 만료 예정</p>
              </div>
              {!loading && (
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                  expiryList.filter(e => e.days <= 30).length > 0
                    ? 'bg-red-100 text-red-700'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {expiryList.filter(e => e.days <= 30).length}건 긴급
                </span>
              )}
            </div>
            {loading ? (
              <div className="p-6 space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-10 bg-gray-50 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : expiryList.length === 0 ? (
              <div className="px-6 py-8 text-center text-gray-400 text-sm">
                60일 이내 만료 예정 가맹점 없음
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-[#F8FDF8]">
                      {['기관명', '브랜드', '만료일', 'D-Day', '식수', ''].map(h => (
                        <th key={h} className="text-left px-5 py-3 text-xs font-bold text-gray-400">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {expiryList.map(item => (
                      <tr key={item.id} className="hover:bg-[#F8FDF8] transition-colors">
                        <td className="px-5 py-4 text-sm font-semibold text-[#1C2B1E]">{item.org}</td>
                        <td className="px-5 py-4 text-sm text-gray-500">{item.brand}</td>
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
                          <Link
                            href={`/board/admin/branches?highlight=${item.id}`}
                            className="text-xs bg-[#2D6A4F] hover:bg-[#1B4332] text-white font-medium px-3 py-1.5 rounded-lg transition-colors"
                          >
                            상세 보기
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Today summary */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h2 className="font-bold text-[#1C2B1E] mb-4">오늘의 처리 현황</h2>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: '신규 접수', value: loading ? '—' : stats.today, color: 'bg-yellow-100 text-yellow-800' },
              { label: '처리 완료', value: loading ? '—' : stats.todayResolved, color: 'bg-green-100 text-green-800' },
              { label: '처리 중', value: loading ? '—' : stats.inProgress, color: 'bg-blue-100 text-blue-800' },
            ].map(item => (
              <div key={item.label} className="text-center">
                <div className={`text-2xl font-bold rounded-xl py-3 mb-2 ${item.color}`}>{item.value}</div>
                <div className="text-xs text-gray-400">{item.label}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex justify-end">
            <Link
              href="/board/admin/inquiries"
              className="text-sm text-[#2D6A4F] font-medium hover:underline flex items-center gap-1"
            >
              전체 문의 보기 →
            </Link>
          </div>
        </div>

      </div>
    </div>
  )
}
