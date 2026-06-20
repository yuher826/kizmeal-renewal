import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import PasswordChangeCard from './PasswordChangeCard'

const ROLE_LABEL: Record<string, string> = {
  super_admin:              '슈퍼관리자',
  manager:                  '매니저',
  director:                 '이사',
  nutritionist_ck:          '영양사 (직영)',
  nutritionist_consignment: '영양사 (위탁)',
  admin:                    '관리자',
}

export const metadata = { title: '마이페이지 | 키즈밀 ERP' }

export default async function MyPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/erp/login')

  const { data: adminData } = await supabase
    .from('admins')
    .select('id, name, email, role')
    .eq('auth_id', user.id)
    .maybeSingle()

  if (!adminData) redirect('/erp/login')

  return (
    <div className="max-w-xl mx-auto space-y-6">
      {/* 내 정보 카드 */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-base font-semibold text-slate-800 mb-4">내 정보</h2>
        <div className="space-y-4">
          <div>
            <p className="text-xs text-slate-400 mb-1">이름</p>
            <p className="text-sm font-medium text-slate-800">{adminData.name}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-1">이메일</p>
            <p className="text-sm text-slate-700">{adminData.email}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-1">역할</p>
            <p className="text-sm text-slate-700">
              {ROLE_LABEL[adminData.role] ?? adminData.role}
            </p>
          </div>
        </div>
      </div>

      {/* 비밀번호 변경 카드 */}
      <PasswordChangeCard email={adminData.email} />
    </div>
  )
}
