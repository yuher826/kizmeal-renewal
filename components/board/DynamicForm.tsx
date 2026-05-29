'use client'

import type { FormFieldDefinition, InquiryCategory } from '@/lib/types'

// Fallback fields if DB not populated
const FALLBACK_FIELDS: Record<string, FormFieldDefinition[]> = {
  MEAL_COUNT: [
    { id: '1', category: 'MEAL_COUNT', field_key: 'current_count', field_label: '현재 식수', field_type: 'number', is_required: true, sort_order: 1 },
    { id: '2', category: 'MEAL_COUNT', field_key: 'new_count', field_label: '변경 식수', field_type: 'number', is_required: true, sort_order: 2 },
    { id: '3', category: 'MEAL_COUNT', field_key: 'change_date', field_label: '변경 희망일', field_type: 'date', is_required: true, sort_order: 3 },
  ],
  ALLERGY: [
    { id: '4', category: 'ALLERGY', field_key: 'child_name', field_label: '원아 이름', field_type: 'text', is_required: true, sort_order: 1 },
    { id: '5', category: 'ALLERGY', field_key: 'allergens', field_label: '알레르기 항목', field_type: 'checkbox', options: ['달걀', '우유', '견과류', '밀', '새우', '게', '복숭아', '기타'], is_required: true, sort_order: 2 },
    { id: '6', category: 'ALLERGY', field_key: 'start_date', field_label: '적용 시작일', field_type: 'date', is_required: true, sort_order: 3 },
  ],
  DELIVERY: [
    { id: '7', category: 'DELIVERY', field_key: 'item_name', field_label: '품목', field_type: 'text', is_required: true, sort_order: 1 },
    { id: '8', category: 'DELIVERY', field_key: 'quantity', field_label: '수량', field_type: 'number', is_required: true, sort_order: 2 },
    { id: '9', category: 'DELIVERY', field_key: 'desired_date', field_label: '희망 수령일', field_type: 'date', is_required: true, sort_order: 3 },
  ],
  SCHEDULE: [
    { id: '10', category: 'SCHEDULE', field_key: 'start_date', field_label: '휴원 시작일', field_type: 'date', is_required: true, sort_order: 1 },
    { id: '11', category: 'SCHEDULE', field_key: 'end_date', field_label: '휴원 종료일', field_type: 'date', is_required: true, sort_order: 2 },
    { id: '12', category: 'SCHEDULE', field_key: 'reason', field_label: '사유', field_type: 'text', is_required: false, sort_order: 3 },
  ],
}

interface Props {
  category: InquiryCategory
  fields?: FormFieldDefinition[]
  values: Record<string, unknown>
  onChange: (key: string, value: unknown) => void
}

export default function DynamicForm({ category, fields, values, onChange }: Props) {
  const fieldList = fields?.length ? fields : (FALLBACK_FIELDS[category] || [])
  if (!fieldList.length) return null

  return (
    <div className="space-y-4">
      <div className="border-t border-gray-100 pt-4">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">카테고리 상세 정보</p>
        <div className="space-y-3">
          {fieldList.map((field) => (
            <div key={field.id}>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                {field.field_label}
                {field.is_required && <span className="text-red-500 ml-1">*</span>}
              </label>

              {field.field_type === 'text' && (
                <input
                  type="text"
                  value={(values[field.field_key] as string) || ''}
                  onChange={e => onChange(field.field_key, e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F] focus:border-transparent"
                />
              )}

              {field.field_type === 'number' && (
                <input
                  type="number"
                  value={(values[field.field_key] as string) || ''}
                  onChange={e => onChange(field.field_key, e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F] focus:border-transparent"
                />
              )}

              {field.field_type === 'date' && (
                <input
                  type="date"
                  value={(values[field.field_key] as string) || ''}
                  onChange={e => onChange(field.field_key, e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F] focus:border-transparent"
                />
              )}

              {field.field_type === 'textarea' && (
                <textarea
                  value={(values[field.field_key] as string) || ''}
                  onChange={e => onChange(field.field_key, e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F] focus:border-transparent resize-none"
                />
              )}

              {field.field_type === 'select' && field.options && (
                <select
                  value={(values[field.field_key] as string) || ''}
                  onChange={e => onChange(field.field_key, e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]"
                >
                  <option value="">선택하세요</option>
                  {field.options.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              )}

              {field.field_type === 'checkbox' && field.options && (
                <div className="flex flex-wrap gap-2">
                  {field.options.map(opt => {
                    const selected = ((values[field.field_key] as string[]) || []).includes(opt)
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => {
                          const current = (values[field.field_key] as string[]) || []
                          const next = selected
                            ? current.filter(v => v !== opt)
                            : [...current, opt]
                          onChange(field.field_key, next)
                        }}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                          selected
                            ? 'bg-[#2D6A4F] border-[#2D6A4F] text-white'
                            : 'bg-white border-gray-200 text-gray-600 hover:border-[#52B788]'
                        }`}
                      >
                        {opt}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
