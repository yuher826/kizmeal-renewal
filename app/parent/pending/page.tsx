'use client'

import { createClient } from '@/lib/supabase'

export default function ParentPendingPage() {
  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/parent/login'
  }

  return (
    <div className="min-h-screen bg-[#F6FAF6] flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm text-center">
        <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center text-4xl mx-auto mb-6">
          ⏳
        </div>
        <h1 className="text-xl font-bold text-[#1C2B1E] mb-2">승인 대기 중</h1>
        <p className="text-sm text-gray-500 leading-relaxed mb-8">
          회원가입 신청이 완료되었습니다.<br />
          원장님의 승인 후 서비스를 이용하실 수 있습니다.<br />
          승인 완료 시 이메일로 안내해 드립니다.
        </p>

        <div className="bg-white rounded-2xl p-5 text-left space-y-3 mb-6">
          <p className="text-xs font-bold text-gray-500">승인 절차 안내</p>
          {[
            '회원가입 신청 완료 ✅',
            '원장님 검토 (1~3 영업일)',
            '승인 완료 후 이메일 발송',
            '서비스 이용 시작',
          ].map((step, i) => (
            <div key={i} className={`flex items-center gap-3 text-sm ${i === 0 ? 'text-[#2D6A4F] font-semibold' : 'text-gray-400'}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                i === 0 ? 'bg-[#2D6A4F] text-white' : 'bg-gray-100 text-gray-400'
              }`}>
                {i + 1}
              </div>
              {step}
            </div>
          ))}
        </div>

        <button
          onClick={handleLogout}
          className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
        >
          로그아웃
        </button>
      </div>
    </div>
  )
}
