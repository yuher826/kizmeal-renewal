'use client'

import { useState } from 'react'

const FAQS = [
  {
    q: '계약은 어떻게 진행되나요?',
    a: '본사 운영개발팀에서 직접 연락드려 간단한 상담 후 계약서를 작성합니다. 계약 후 3일 이내 시스템 세팅이 완료됩니다.',
  },
  {
    q: '식단표는 어떻게 받을 수 있나요?',
    a: '매월 학부모 포털과 이메일을 통해 자동 배포됩니다. 월초에 다음 달 식단표를 별도 요청 없이 받아보실 수 있습니다.',
  },
  {
    q: '배송 시간은 언제인가요?',
    a: '새벽 3시부터 식재료 입고를 시작해 오전 10시 30분 이전에 모든 배송을 완료합니다. 18대 냉장 차량으로 신선도를 유지합니다.',
  },
  {
    q: '식재료는 어떻게 관리되나요?',
    a: '모든 식재료는 친환경 인증 제품을 우선 사용하며, 냉장 차량 18대로 신선도를 유지해 배송합니다. 원산지 이력 추적이 가능한 식재료만 사용합니다.',
  },
]

export default function FaqClient() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <div className="space-y-3">
      {FAQS.map((faq, i) => {
        const isOpen = openIndex === i
        return (
          <div
            key={i}
            className={`border rounded-xl overflow-hidden transition-colors duration-200 ${
              isOpen ? 'border-[#2D6A4F]' : 'border-gray-100'
            }`}
          >
            <button
              type="button"
              className="w-full flex items-center justify-between p-5 text-left bg-white hover:bg-[#F8FDF8] transition-colors"
              onClick={() => setOpenIndex(openIndex === i ? null : i)}
            >
              <span className="font-semibold text-[#0D2016] text-sm sm:text-base pr-4">{faq.q}</span>
              <span
                className={`text-[#2D6A4F] transition-transform duration-300 flex-shrink-0 ${
                  isOpen ? 'rotate-180' : ''
                }`}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </span>
            </button>
            <div
              style={{
                maxHeight: isOpen ? '300px' : '0',
                overflow: 'hidden',
                transition: 'max-height 0.4s ease',
              }}
            >
              <div className="px-5 pb-5 text-gray-500 text-sm leading-relaxed border-t border-gray-50 pt-4">
                {faq.a}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
