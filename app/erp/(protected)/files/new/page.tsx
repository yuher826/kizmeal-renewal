'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { useErpUser } from '@/components/erp/ErpUserProvider'

/**
 * 파일보관함 — 새 파일 올리기 (2026-08-18)
 *
 * 목록(/erp/files)과 업로드를 분리했다. 고객사 공지(/erp/notices +
 * /erp/notices/new)와 같은 구조 — 업로드는 한 달에 몇 번뿐인데 목록은
 * 매번 보게 되므로, 자주 보는 쪽에 화면을 온전히 내준다.
 */

type Category = 'health_info' | 'handout' | 'photo' | 'etc'
type Scope = 'all' | 'group' | 'branch'
type BranchOption = { id: string; name: string }

const CATEGORY_LABELS: Record<Category, string> = {
  health_info: '건강정보지',
  handout:     '유인물',
  photo:       '식단사진',
  etc:         '기타',
}

const BUCKET = 'kizmeal-files'

export default function ErpFileArchiveNewPage() {
  const router = useRouter()
  const erpUser = useErpUser()
  const now = new Date()

  const [branches, setBranches] = useState<BranchOption[]>([])
  const [error, setError]       = useState('')

  const [category, setCategory]           = useState<Category>('health_info')
  const [title, setTitle]                 = useState('')
  const [year, setYear]                   = useState(now.getFullYear())
  const [month, setMonth]                 = useState(now.getMonth() + 1)
  const [scope, setScope]                 = useState<Scope>('all')
  const [scopeDietType, setScopeDietType] = useState('ck')
  const [scopeBranchId, setScopeBranchId] = useState('')
  const [file, setFile]                   = useState<File | null>(null)
  const [uploading, setUploading]         = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadBranches = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('branch_profiles')
      .select('id, branch_full_name, sort_order')
      .order('sort_order', { ascending: true })
    if (data) {
      setBranches(
        (data as { id: string; branch_full_name: string | null }[])
          .map(b => ({ id: b.id, name: b.branch_full_name || '(이름 없음)' })),
      )
    }
  }, [])

  useEffect(() => { loadBranches() }, [loadBranches])

  const canSubmit = !!file
    && title.trim().length > 0
    && (scope !== 'branch' || !!scopeBranchId)
    && !uploading

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit || !file) return
    setUploading(true)
    setError('')

    const supabase = createClient()
    try {
      // 스토리지 키에 한글이 들어가면 Supabase가 InvalidKey를 반환하므로
      // 경로는 ASCII만 쓰고, 원래 파일명은 title 컬럼에 보존한다.
      const ext = (file.name.split('.').pop() || 'bin').toLowerCase()
      const safeExt = ext.replace(/[^a-z0-9]/g, '') || 'bin'
      const path = `archive/${year}/${String(month).padStart(2, '0')}/${crypto.randomUUID()}.${safeExt}`

      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { upsert: false, contentType: file.type || undefined })
      if (upErr) throw upErr

      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path)

      const { error: insErr } = await supabase.from('file_archive').insert({
        category,
        title: title.trim(),
        file_url: urlData.publicUrl,
        file_size: file.size,
        year,
        month,
        scope,
        scope_diet_type: scope === 'group'  ? scopeDietType : null,
        scope_branch_id: scope === 'branch' ? scopeBranchId : null,
        uploaded_by: erpUser.id,
      })
      if (insErr) throw insErr

      router.push('/erp/files?uploaded=1')
    } catch (err) {
      setError(err instanceof Error ? err.message : '업로드에 실패했습니다.')
      setUploading(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#F6FAF6] px-4 sm:px-6 py-6 sm:py-8">
      <div className="mb-6">
        <Link
          href="/erp/files"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-2"
        >
          <ArrowLeft size={15} />
          파일보관함
        </Link>
        <h1 className="text-xl font-bold text-slate-900">새 파일 올리기</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          고객사 포털 파일보관함에 노출됩니다 (식단표는 식단 자동화에서 처리)
        </p>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <form onSubmit={handleUpload} className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 max-w-3xl">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">종류</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value as Category)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {(Object.keys(CATEGORY_LABELS) as Category[]).map(c => (
                <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              파일명 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="예: 2026년 8월 건강정보지"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <p className="text-xs text-slate-400 mt-1">고객사 목록에 이 이름으로 표시됩니다</p>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">자료 연·월</label>
            <div className="flex gap-2">
              <select
                value={year}
                onChange={e => setYear(Number(e.target.value))}
                className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i).map(y => (
                  <option key={y} value={y}>{y}년</option>
                ))}
              </select>
              <select
                value={month}
                onChange={e => setMonth(Number(e.target.value))}
                className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                  <option key={m} value={m}>{m}월</option>
                ))}
              </select>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              업로드일이 아니라 <b>자료 기준</b> 연·월입니다 (9월 자료를 8월에 미리 올리는 경우 9월 선택)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">배포 대상</label>
            <select
              value={scope}
              onChange={e => setScope(e.target.value as Scope)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">전체 원</option>
              <option value="group">소속별 (CK / 위탁)</option>
              <option value="branch">특정 원 하나</option>
            </select>

            {scope === 'group' && (
              <select
                value={scopeDietType}
                onChange={e => setScopeDietType(e.target.value)}
                className="mt-2 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="ck">CK 소속 원</option>
                <option value="consignment">위탁 소속 원</option>
              </select>
            )}

            {scope === 'branch' && (
              <select
                value={scopeBranchId}
                onChange={e => setScopeBranchId(e.target.value)}
                className="mt-2 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">원을 선택하세요</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            파일 <span className="text-red-500">*</span>
          </label>
          <input
            ref={fileInputRef}
            type="file"
            onChange={e => setFile(e.target.files?.[0] ?? null)}
            className="w-full text-sm text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
          />
        </div>

        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            disabled={!canSubmit}
            className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
          >
            {uploading ? '업로드 중…' : '업로드'}
          </button>
          <Link
            href="/erp/files"
            className="px-5 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
          >
            취소
          </Link>
        </div>
      </form>
    </main>
  )
}
