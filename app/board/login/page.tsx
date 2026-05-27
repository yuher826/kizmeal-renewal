'use client';

// TODO: Supabase 연결 — replace with Supabase Auth
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function BoardLogin() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // TODO: Supabase 연결 — replace with real auth
    await new Promise((r) => setTimeout(r, 800));

    if (email && password) {
      router.push('/board');
    } else {
      setError('이메일과 비밀번호를 입력해주세요.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{
      background: 'linear-gradient(135deg, #E8F5E9 0%, #C8E6C9 40%, #A5D6A7 100%)',
    }}>
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-[#2D6A4F]/10" />
        <div className="absolute -bottom-32 -left-32 w-80 h-80 rounded-full bg-[#52B788]/15" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Card */}
        <div className="bg-white rounded-3xl shadow-2xl shadow-green-900/20 p-8">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-[#2D6A4F] rounded-2xl mb-4 shadow-lg shadow-green-900/20">
              <span className="text-white font-bold text-2xl font-serif">K</span>
            </div>
            <h1 className="font-serif font-bold text-xl text-[#1C2B1E] mb-1">고객 전용 소통 채널</h1>
            <p className="text-gray-400 text-sm">담당자와 직접 소통하세요</p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">이메일</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@email.com"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30 focus:border-[#2D6A4F] transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">비밀번호</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30 focus:border-[#2D6A4F] transition-all"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#2D6A4F] hover:bg-[#1B4332] disabled:bg-gray-200 text-white font-semibold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" strokeOpacity="0.3" />
                    <path strokeLinecap="round" d="M12 2a10 10 0 0110 10" />
                  </svg>
                  로그인 중...
                </>
              ) : '로그인'}
            </button>
          </form>

          {/* Help text */}
          <div className="mt-6 text-center">
            <p className="text-gray-400 text-sm">
              계정이 없으신가요?{' '}
              <a href="/#contact" className="text-[#2D6A4F] font-semibold hover:underline">
                담당자에게 문의하기
              </a>
            </p>
          </div>

          {/* Demo hint */}
          <div className="mt-4 bg-[#F8FDF8] border border-[#E8F5E9] rounded-xl px-4 py-3 text-center">
            <p className="text-xs text-[#2D6A4F] font-medium">데모용 — 이메일·비밀번호 입력 후 로그인</p>
          </div>
        </div>

        <div className="text-center mt-6">
          <a href="/" className="text-[#2D6A4F]/70 text-sm hover:text-[#2D6A4F] transition-colors">
            ← 키즈밀 홈으로
          </a>
        </div>
      </div>
    </div>
  );
}
