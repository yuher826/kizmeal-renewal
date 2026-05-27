'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email || !password) {
      setError('이메일과 비밀번호를 입력해주세요.');
      return;
    }
    setLoading(true);
    await new Promise((r) => setTimeout(r, 600));
    router.push('/board');
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16 bg-gradient-to-br from-[#E8F5E9] to-white">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-[#2D6A4F]/10" />
        <div className="absolute -bottom-32 -left-32 w-80 h-80 rounded-full bg-[#52B788]/15" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8 sm:p-10">
          <div className="text-center mb-8">
            <Link href="/" className="inline-flex items-center justify-center w-14 h-14 bg-[#2D6A4F] rounded-2xl mb-4 shadow-lg shadow-green-900/20">
              <span className="text-white font-bold text-2xl font-serif">K</span>
            </Link>
            <h1 className="font-serif font-bold text-xl text-[#1B4332] mb-1">
              키즈밀에 오신 것을 환영합니다
            </h1>
            <p className="text-gray-500 text-sm">학부모 · 고객사 · 관리자 통합 로그인</p>
          </div>

          <div className="h-px bg-[#E8F5E9] mb-6" />

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">이메일</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@email.com"
                className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F] focus:border-[#2D6A4F] transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">비밀번호</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F] focus:border-[#2D6A4F] transition-all"
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
              className="w-full bg-[#2D6A4F] hover:bg-[#1B4332] disabled:bg-gray-300 text-white py-3 rounded-xl font-semibold transition"
            >
              {loading ? '로그인 중…' : '로그인'}
            </button>
          </form>

          <p className="text-xs text-gray-400 text-center mt-4">
            데모용 — 이메일·비밀번호 입력 후 로그인
          </p>

          <div className="mt-6 text-center text-sm">
            <p className="text-gray-500">
              계정이 없으신가요?{' '}
              <Link href="/contact" className="text-[#2D6A4F] font-semibold hover:underline">
                담당자에게 문의하기
              </Link>
            </p>
          </div>
        </div>

        <div className="text-center mt-6">
          <Link href="/" className="text-[#2D6A4F]/70 text-sm hover:text-[#2D6A4F] transition-colors">
            ← 홈으로
          </Link>
        </div>
      </div>
    </div>
  );
}
