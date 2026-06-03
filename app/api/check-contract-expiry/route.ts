import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  try {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const today = new Date()
    const todayStr = today.toISOString().slice(0, 10)

    const in7 = new Date(today.getTime() + 7 * 86400000).toISOString().slice(0, 10)
    const in30 = new Date(today.getTime() + 30 * 86400000).toISOString().slice(0, 10)
    const in60 = new Date(today.getTime() + 60 * 86400000).toISOString().slice(0, 10)

    const { data: branches, error } = await supabase
      .from('branches')
      .select('id, name, contract_end, status, is_active')
      .not('contract_end', 'is', null)
      .lte('contract_end', in60)
      .eq('is_active', true)

    if (error) {
      console.error('[check-contract-expiry]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const results = { expired: 0, d7: 0, d30: 0, d60: 0 }
    const notifications = []
    const toExpire = []

    for (const branch of branches || []) {
      const end = branch.contract_end as string
      if (end < todayStr) {
        // 이미 만료
        if (branch.status !== 'expired') {
          toExpire.push(branch.id)
        }
        results.expired++
      } else if (end <= in7) {
        results.d7++
        notifications.push({
          recipient_type: 'admin',
          type: 'contract_expiry',
          title: `계약 만료 7일 이내: ${branch.name}`,
          body: `만료일: ${end}`,
        })
      } else if (end <= in30) {
        results.d30++
        notifications.push({
          recipient_type: 'admin',
          type: 'contract_expiry',
          title: `계약 만료 30일 이내: ${branch.name}`,
          body: `만료일: ${end}`,
        })
      } else {
        results.d60++
      }
    }

    // 만료된 지점 상태 업데이트
    if (toExpire.length > 0) {
      await supabase
        .from('branches')
        .update({ status: 'expired' })
        .in('id', toExpire)
    }

    // 알림 삽입 (테이블이 없어도 무시)
    if (notifications.length > 0) {
      try {
        await supabase.from('notifications').insert(notifications)
      } catch { /* notifications 테이블 없으면 무시 */ }
    }

    return NextResponse.json({ success: true, ...results, processedAt: todayStr })
  } catch (e) {
    console.error('[check-contract-expiry] 예외:', e)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}
