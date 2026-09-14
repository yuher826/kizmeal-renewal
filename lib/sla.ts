import type { Inquiry, SlaRule, SlaStatus } from './types'

export function getSlaStatus(inquiry: Inquiry, rule?: SlaRule): SlaStatus {
  // 규칙이 없으면 "괜찮다"가 아니라 "모른다" — ok로 합치면 규칙 없는
  // 카테고리가 항상 초록불로 보인다(2026-08-18 SCHEDULE_OPS가 이렇게 샜음).
  if (!rule || !inquiry.created_at) return 'unknown'
  if (inquiry.status === 'resolved' || inquiry.status === 'closed') return 'ok'

  const created = new Date(inquiry.created_at).getTime()
  const now = Date.now()
  const elapsedHours = (now - created) / (1000 * 60 * 60)

  if (elapsedHours >= rule.escalate_hours) return 'exceeded'
  if (elapsedHours >= rule.warning_hours) return 'warning'
  return 'ok'
}

export function getSlaRemaining(inquiry: Inquiry, rule?: SlaRule): string {
  if (!rule || !inquiry.created_at) return '미설정'
  if (inquiry.status === 'resolved' || inquiry.status === 'closed') return '완료'

  const created = new Date(inquiry.created_at).getTime()
  const now = Date.now()
  const elapsedHours = (now - created) / (1000 * 60 * 60)
  const remainingHours = rule.response_hours - elapsedHours

  if (remainingHours <= 0) {
    const overdueHours = Math.abs(remainingHours)
    if (overdueHours < 1) return `${Math.round(overdueHours * 60)}분 초과`
    return `${Math.floor(overdueHours)}시간 초과`
  }

  if (remainingHours < 1) return `${Math.round(remainingHours * 60)}분 남음`
  if (remainingHours < 24) return `${Math.floor(remainingHours)}시간 ${Math.round((remainingHours % 1) * 60)}분`
  return `${Math.floor(remainingHours / 24)}일 남음`
}

export function getSlaBadgeColor(status: SlaStatus): string {
  switch (status) {
    case 'ok': return 'bg-green-100 text-green-700'
    case 'warning': return 'bg-yellow-100 text-yellow-700'
    case 'exceeded': return 'bg-red-100 text-red-700'
    case 'unknown': return 'bg-gray-100 text-gray-500'
  }
}

export function getSlaIcon(status: SlaStatus): string {
  switch (status) {
    case 'ok': return '🟢'
    case 'warning': return '🟡'
    case 'exceeded': return '🔴'
    case 'unknown': return '⚪'
  }
}

export function getSlaDeadline(inquiry: Inquiry, rule?: SlaRule): Date | null {
  if (!rule || !inquiry.created_at) return null
  const created = new Date(inquiry.created_at)
  return new Date(created.getTime() + rule.response_hours * 60 * 60 * 1000)
}

export function formatSlaDeadline(deadline: Date | null): string {
  if (!deadline) return '—'
  return deadline.toLocaleString('ko-KR', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
