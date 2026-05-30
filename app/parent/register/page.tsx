'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import type { Branch } from '@/lib/types'

interface ChildForm {
  name_ko: string
  name_en: string
  branch_id: string
}

const emptyChild = (): ChildForm => ({ name_ko: '', name_en: '', branch_id: '' })

export default function ParentRegisterPage() {
  const router = useRouter()
  const [branches, setBranches] = useState<Branch[]>([])
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [children, setChildren] = useState<ChildForm[]>([emptyChild()])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    createClient()
      .from('branches')
      .select('id, name')
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => { if (data) setBranches(data as Branch[]) })
  }, [])

  function updateChild(index: number, field: keyof ChildForm, value: string) {
    setChildren(prev => prev.map((c, i) => i === index ? { ...c, [field]: value } : c))
  }

  function addChild() {
    if (children.length < 5) setChildren(prev => [...prev, emptyChild()])
  }

  function removeChild(index: number) {
    if (children.length > 1) setChildren(prev => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password !== passwordConfirm) {
      setError('비밀번호가 일치하지 않습니다.')
      return
    }
    if (password.length < 8) {
      setError('비밀번호는 8자 이상이어야 합니다.')
      return
    }
    const validChildren = children.filter(c => c.name_ko.trim() && c.branch_id)
    if (validChildren.length === 0) {
      setError('원아 정보를 최소 1명 입력해주세요.')
      return
    }

    setLoading(true)
    const supabase = createClient()

    // Sign up
    const { data: authData, error: signUpError } = await supabase.auth.signUp({ email, password })
    if (signUpError || !authData.user) {
      setError(signUpError?.message || '회원가입에 실패했습니다.')
      setLoading(false)
      return
    }

    // Create parent record
    const { data: parentData, error: parentError } = await supabase
      .from('parents')
      .insert({ auth_id: authData.user.id, name, email, phone, status: 'pending' })
      .select('id')
      .single()

    if (parentError || !parentData) {
      setError('계정 생성 중 오류가 발생했습니다.')
      setLoading(false)
      return
    }

    // Create children
    const childRows = validChildren.map(c => ({
      parent_id: parentData.id,
      name_ko: c.name_ko.trim(),
      name_en: c.name_en.trim() || null,
      branch_id: c.branch_id,
    }))

    await supabase.from('children').insert(childRows)

    router.replace('/parent/pending')
  }

  return (
    <div className="min-h-screen bg-[#F6FAF6] px-4 py-8">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-gradient-to-br from-[#2D6A4F] to-[#52B788] rounded-2xl flex items-center justify-center text-white text-xl font-bold mx-auto mb-3 shadow-lg">
            K
          </div>
          <h1 className="text-xl font-bold text-[#1C2B1E]">학부모 회원가입</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl">{error}</div>
          )}

          {/* 보호자 정보 */}
          <div className="bg-white rounded-2xl p-5 space-y-4">
            <h2 className="font-bold text-[#1C2B1E] text-sm">보호자 정보</h2>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">이름 *</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="홍길동"
                required
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">이메일 *</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="example@email.com"
                required
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">휴대폰</label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="010-0000-0000"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">비밀번호 *</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="8자 이상"
                required
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">비밀번호 확인 *</label>
              <input
                type="password"
                value={passwordConfirm}
                onChange={e => setPasswordConfirm(e.target.value)}
                placeholder="비밀번호 재입력"
                required
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]"
              />
            </div>
          </div>

          {/* 원아 정보 */}
          <div className="bg-white rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-[#1C2B1E] text-sm">원아 정보 ({children.length}/5)</h2>
              {children.length < 5 && (
                <button
                  type="button"
                  onClick={addChild}
                  className="text-xs text-[#2D6A4F] font-semibold hover:underline"
                >
                  + 원아 추가
                </button>
              )}
            </div>
            {children.map((child, i) => (
              <div key={i} className="border border-gray-100 rounded-xl p-4 space-y-3 relative">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-gray-500">원아 {i + 1}</span>
                  {children.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeChild(i)}
                      className="text-xs text-red-400 hover:text-red-600"
                    >
                      삭제
                    </button>
                  )}
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">한국 이름 *</label>
                  <input
                    type="text"
                    value={child.name_ko}
                    onChange={e => updateChild(i, 'name_ko', e.target.value)}
                    placeholder="김아이"
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">영어 이름</label>
                  <input
                    type="text"
                    value={child.name_en}
                    onChange={e => updateChild(i, 'name_en', e.target.value)}
                    placeholder="Amy Kim"
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">원(가맹점) 선택 *</label>
                  <select
                    value={child.branch_id}
                    onChange={e => updateChild(i, 'branch_id', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F] bg-white"
                  >
                    <option value="">원을 선택해주세요</option>
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#2D6A4F] hover:bg-[#1B4332] disabled:bg-gray-300 text-white font-bold py-4 rounded-2xl text-sm transition-colors"
          >
            {loading ? '가입 중...' : '회원가입 신청'}
          </button>

          <p className="text-center text-xs text-gray-400">
            가입 신청 후 원장님 승인을 통해 서비스를 이용하실 수 있습니다.
          </p>

          <p className="text-center text-sm">
            이미 계정이 있으신가요?{' '}
            <Link href="/parent/login" className="text-[#2D6A4F] font-semibold hover:underline">
              로그인
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
