'use client'

import Link from 'next/link'

export default function LoginSelectPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#F0F7F0] to-white flex flex-col items-center justify-center px-4 py-12">
      {/* 배경 장식 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
        <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-[#2D6A4F]/8" />
        <div className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-[#52B788]/10" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* 로고 */}
        <div className="text-center mb-10">
          <Link href="/" className="inline-block">
            <div className="w-16 h-16 bg-gradient-to-br from-[#2D6A4F] to-[#52B788] rounded-2xl flex items-center justify-center text-white font-bold text-2xl shadow-lg shadow-green-900/20 mx-auto">
              K
            </div>
          </Link>
          <h1 className="mt-4 text-2xl font-bold text-[#1C2B1E]">키즈밀</h1>
          <p className="mt-1.5 text-gray-500 text-sm">어떤 분이세요?</p>
        </div>

        {/* 카드 영역 */}
        <div className="space-y-4">
          {/* 학부모 카드 */}
          <div className="bg-white rounded-3xl border border-[#D1EAD8] p-6 shadow-sm">
            <div className="flex items-start gap-4 mb-5">
              <div className="w-12 h-12 rounded-2xl bg-[#E8F5E9] flex items-center justify-center text-2xl flex-shrink-0">
                👨‍👩‍👧
              </div>
              <div>
                <h2 className="font-bold text-[#1C2B1E] text-base">학부모님</h2>
                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                  아이 급식사진 · 식단표 · 레시피
                </p>
              </div>
            </div>
            <div className="flex gap-2.5">
              <Link
                href="/parent/login"
                className="flex-1 bg-[#2D6A4F] hover:bg-[#1B4332] text-white font-semibold py-3 rounded-xl text-sm text-center transition-colors"
              >
                로그인
              </Link>
              <Link
                href="/parent/register"
                className="flex-1 bg-[#E8F5E9] hover:bg-[#D1EAD8] text-[#2D6A4F] font-semibold py-3 rounded-xl text-sm text-center transition-colors"
              >
                회원가입
              </Link>
            </div>
          </div>

          {/* 원 담당자 카드 */}
          <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm">
            <div className="flex items-start gap-4 mb-5">
              <div className="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center text-2xl flex-shrink-0">
                🏫
              </div>
              <div>
                <h2 className="font-bold text-[#1C2B1E] text-base">원 담당자</h2>
                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                  1:1 소통채널 · 문의 · 관리
                </p>
              </div>
            </div>
            <Link
              href="/board/login"
              className="block w-full bg-[#F97316] hover:bg-[#EA6C0A] text-white font-semibold py-3 rounded-xl text-sm text-center transition-colors"
            >
              로그인
            </Link>
            <p className="text-center text-xs text-gray-400 mt-3">
              초대 링크로만 가입이 가능합니다
            </p>
          </div>
        </div>

        <div className="mt-6 text-center">
          <Link href="/" className="text-xs text-gray-400 hover:text-[#2D6A4F] transition-colors">
            ← 홈으로 돌아가기
          </Link>
        </div>
      </div>
    </div>
  )
}
