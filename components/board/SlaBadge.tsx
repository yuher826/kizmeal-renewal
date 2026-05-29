'use client'

import { getSlaIcon, getSlaRemaining, getSlaStatus, getSlaBadgeColor } from '@/lib/sla'
import type { Inquiry, SlaRule } from '@/lib/types'

interface Props {
  inquiry: Inquiry
  rule?: SlaRule
  showLabel?: boolean
}

export default function SlaBadge({ inquiry, rule, showLabel = true }: Props) {
  const status = getSlaStatus(inquiry, rule)
  const remaining = getSlaRemaining(inquiry, rule)
  const color = getSlaBadgeColor(status)
  const icon = getSlaIcon(status)

  if (!rule) return null

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${color}`}>
      <span>{icon}</span>
      {showLabel && <span>{remaining}</span>}
    </span>
  )
}
