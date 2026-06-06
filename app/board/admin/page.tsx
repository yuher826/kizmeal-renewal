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
  const [stats, setStats] = useState({ today: 0, pending: 0, inProgress: 0, todayResolved: 0 })
  const [avgResponse, setAvgResponse] = useState<string>('—')
  const [monthTotal, setMonthTotal] = useState(0)
  const [catData, setCatData] = useState<{ name: string; value: number; color: string }[]>([])
  const [dayData, setDayData] = useState<{ day: string; 문의수: number; fill: string }[]>([])
  const [expiryList, setExpiryList] = useState<{
    id: string; org: string; expires: string; days: number; mealCount: number; brand: string
  }[]>([])
  const [publicInquiryCount, setPublicInquiryCount] = useState(0)
  const [allergyCount, setAllergyCount] = useState(0)
  const [complaintCount, setComplaintCount] = useState(0)
  const [parentInqCount, setParentInqCount] = useState(0)

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

    // 오늘 처리 필요 위젯 카운트
    const [complaintRes, allergyRes, parentInqRes] = await Promise.all([
      supabase.from('inquiries').select('*', { count: 'exact', head: true })
        .eq('category', 'COMPLAINT').in('status', ['pending', 'in_progress']),
      supabase.from('parent_inquiries').select('*', { count: 'exact', head: true })
        .eq('category', 'ALLERGY').in('status', ['pending', 'in_progress']),
      supabase.from('parent_inquiries').select('*', { count: 'exact', head: true })
        .eq('status', 'pending'),
    ])
    setComplaintCount(complaintRes.count || 0)
    setAllergyCount(allergyRes.error ? 0 : (allergyRes.count || 0))
    setParentInqCount(parentInqRes.error ? 0 : (parentInqRes.count || 0))

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

    // Public inquiry unanswered count
    try {
      const piRes = await fetch('/api/public-inquiry/admin?status=pending')
      if (piRes.ok) {
        const piData = await piRes.json()
        setPublicInquiryCount(piData.count || 0)
      }
    } catch { /* non-critical */ }

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
      <header className="bg-white border-b border-gray-100 px-6 py-4 hidden sm:flex items-center justify-between sticky top-0 z-10">
        <Link href="/board/admin" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <div className="w-8 h-8 bg-gradient-to-br from-[#2D6A4F] to-[#52B788] rounded-xl flex items-center justify-center text-white font-bold">K</div>
          <div>
            <h1 className="font-bold text-[#1C2B1E] text-sm">소통채널 관리자</h1>
            <p className="text-gray-400 text-xs">{adminName || '관리자'} · 대시보드</p>
          </div>
        </Link>
        <div className="hidden sm:flex items-center gap-3">
          <button onClick={handleLogout} className="text-xs text-gray-400 hover:text-gray-600">로그아웃</button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* 관리자 인사말 */}
        <div>
          <h2 className="text-2xl font-bold text-[#1C2B1E]">
            {loading ? '관리자님, 안녕하세요 👋' : `${adminName || '관리자'}님, 안녕하세요 👋`}
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">키즈밀 소통&운영 관리시스템</p>
        </div>

        {/* 오늘 처리 필요 위젯 */}
        {(() => {
          const rows = [
            { icon: '🚨', label: '알레르기 문의', count: allergyCount, href: '/board/admin/parent-inquiries', urgent: true },
            { icon: '😤', label: '컴플레인', count: complaintCount, href: '/board/admin/inquiries', urgent: true },
            { icon: '💚', label: '학부모 문의 미답변', count: parentInqCount, href: '/board/admin/parent-inquiries', urgent: false },
            { icon: '🟠', label: '운영 문의 미답변', count: stats.pending, href: '/board/admin/inquiries', urgent: false },
            { icon: '🔵', label: '서비스 문의 미답변', count: publicInquiryCount, href: '/board/admin/service-inquiries', urgent: false },
          ]
          const total = rows.reduce((s, r) => s + r.count, 0)
          return (
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h2 className="font-bold text-[#1C2B1E] mb-3 flex items-center gap-2">
                <span className="text-red-500">🔴</span> 오늘 처리 필요
              </h2>
              {loading ? (
                <div className="h-12 bg-gray-50 rounded-xl animate-pulse" />
              ) : total === 0 ? (
                <div className="bg-[#E8F5E9] rounded-xl px-4 py-5 text-center">
                  <p className="text-sm font-semibold text-[#2D6A4F]">✅ 모든 문의가 처리되었습니다</p>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {rows.map(r => (
                    <Link
                      key={r.label}
                      href={r.href}
                      className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-colors ${
                        r.count === 0
                          ? 'border-gray-100 bg-gray-50/50 opacity-60'
                          : r.urgent
                          ? 'border-red-200 bg-red-50 hover:bg-red-100/60'
                          : 'border-gray-100 hover:bg-[#F8FDF8]'
                      }`}
                    >
                      <span className="flex items-center gap-2 text-sm font-medium text-[#1C2B1E]">
                        <span>{r.icon}</span>{r.label}
                      </span>
                      <span className={`text-sm font-bold ${
                        r.count === 0 ? 'text-gray-300' : r.urgent ? 'text-red-600' : 'text-[#2D6A4F]'
                      }`}>
                        {r.count}건
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )
        })()}

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

        {/* General inquiry quick access */}
        <Link
          href="/board/admin/inquiries?tab=public"
          className="block bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md transition-shadow"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">💬</span>
              <div>
                <h3 className="font-bold text-[#1C2B1E]">일반 문의 관리</h3>
                <p className="text-xs text-gray-400 mt-0.5">홈페이지 비회원 문의</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!loading && publicInquiryCount > 0 && (
                <span className="bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                  미답변 {publicInquiryCount}건
                </span>
              )}
              <span className="text-gray-300 text-lg">→</span>
            </div>
          </div>
        </Link>

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
                60일 이내 만료 예정 고객사 없음
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-[#F8FDF8]">
                      {['고객사명', '브랜드', '만료일', 'D-Day', '식수', ''].map(h => (
                        <th key={h} className="text-left px-5 py-3 text-xs font-bold text-gray-400 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {expiryList.map(item => (
                      <tr key={item.id} className="hover:bg-[#F8FDF8] transition-colors">
                        <td className="px-5 py-4 text-sm font-semibold text-[#1C2B1E] whitespace-nowrap">{item.org}</td>
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
