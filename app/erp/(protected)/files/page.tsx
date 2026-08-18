'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'

/**
 * ERP 파일보관함 관리 (2026-08-18 권팀장 요청 2번)
 *
 * 고객사 포털의 "파일보관함"에 노출될 파일을 올리고 관리한다.
 * 식단표는 식단 자동화 파이프라인이 담당하므로 여기서 다루지 않는다.
 *
 * ★배포 범위 3단계:
 *   - 전체(all)    : 모든 원
 *   - 그룹(group)  : 같은 diet_type 원만. CK 건강정보지 ↔ 위탁 건강정보지가
 *                    다르다는 운영 현실을 반영(유대표 확인)
 *   - 원별(branch) : 지정한 원 하나만. 임시원(크레오)처럼 그룹에 안 묶인
 *                    곳에 개별 전달할 때도 이 방식을 쓴다
 */

type Category = 'health_info' | 'handout' | 'photo' | 'etc'
type Scope = 'all' | 'group' | 'branch'

type FileRow = {
  id: string
  category: Category
  title: string
  file_url: string
  year: number
  month: number
  scope: Scope
  scope_diet_type: string | null
  scope_branch_id: string | null
  created_at: string
}

type BranchOption = { id: string; name: string }

const CATEGORY_LABELS: Record<Category, string> = {
  health_info: '건강정보지',
  handout:     '유인물',
  photo:       '식단사진',
  etc:         '기타',
}

const BUCKET = 'kizmeal-files'

export default function ErpFileArchivePage() {
  const [rows, setRows]         = useState<FileRow[]>([])
  const [branches, setBranches] = useState<BranchOption[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [toast, setToast]       = useState('')

  const now = new Date()
  const [category, setCategory]   = useState<Category>('health_info')
  const [title, setTitle]         = useState('')
  const [year, setYear]           = useState(now.getFullYear())
  const [month, setMonth]         = useState(now.getMonth() + 1)
  const [scope, setScope]         = useState<Scope>('all')
  const [scopeDietType, setScopeDietType] = useState('ck')
  const [scopeBranchId, setScopeBranchId] = useState('')
  const [file, setFile]           = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    const supabase = createClient()
    const [fileRes, branchRes] = await Promise.all([
      supabase
        .from('file_archive')
        .select('id, category, title, file_url, year, month, scope, scope_diet_type, scope_branch_id, created_at')
        .order('year',  { ascending: false })
        .order('month', { ascending: false })
        .order('created_at', { ascending: false }),
      supabase
        .from('branch_profiles')
        .select('id, branch_full_name, sort_order')
        .order('sort_order', { ascending: true }),
    ])

    if (fileRes.data) setRows(fileRes.data as FileRow[])
    if (branchRes.data) {
      setBranches(
        (branchRes.data as { id: string; branch_full_name: string | null }[])
          .map(b => ({ id: b.id, name: b.branch_full_name || '(이름 없음)' })),
      )
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

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
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('로그인이 필요합니다.')

      // 스토리지 키에 한글이 들어가면 Supabase가 InvalidKey를 반환하므로
      // 경로는 ASCII만 사용하고, 원래 파일명은 title 컬럼에 보존한다.
      const ext = (file.name.split('.').pop() || 'bin').toLowerCase()
      const safeExt = ext.replace(/[^a-z0-9]/g, '') || 'bin'
      const path = `archive/${year}/${String(month).padStart(2, '0')}/${crypto.randomUUID()}.${safeExt}`

      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { upsert: false, contentType: file.type || undefined })
      if (upErr) throw upErr

      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path)

      const { data: adminRow } = await supabase
        .from('admins').select('id').eq('auth_id', user.id).maybeSingle()

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
        uploaded_by: adminRow?.id ?? null,
      })
      if (insErr) throw insErr

      setTitle('')
      setFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      setToast('업로드되었습니다.')
      setTimeout(() => setToast(''), 2500)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : '업로드에 실패했습니다.')
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(row: FileRow) {
    if (!confirm(`'${row.title}' 파일을 삭제할까요?\n고객사 화면에서도 즉시 사라집니다.`)) return
    const supabase = createClient()
    const { error: delErr } = await supabase.from('file_archive').delete().eq('id', row.id)
    if (delErr) { setError(delErr.message); return }
    setToast('삭제되었습니다.')
    setTimeout(() => setToast(''), 2500)
    await load()
  }

  const branchNameById = useMemo(() => {
    const map: Record<string, string> = {}
    branches.forEach(b => { map[b.id] = b.name })
    return map
  }, [branches])

  function scopeText(row: FileRow): string {
    if (row.scope === 'all') return '전체 원'
    if (row.scope === 'group') {
      return row.scope_diet_type === 'consignment' ? '위탁 소속' : 'CK 소속'
    }
    return branchNameById[row.scope_branch_id ?? ''] || '특정 원'
  }

  return (
    <main className="min-h-screen bg-[#F6FAF6] px-4 sm:px-6 py-6 sm:py-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">파일보관함</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          고객사 포털 파일보관함에 노출될 파일을 관리합니다 (식단표는 식단 자동화에서 처리)
        </p>
      </div>

      {toast && (
        <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-lg px-4 py-3">
          {toast}
        </div>
      )}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {/* 업로드 폼 */}
      <form onSubmit={handleUpload} className="bg-white rounded-xl border border-slate-200 p-5 mb-6 space-y-4">
        <h2 className="font-semibold text-slate-800">새 파일 올리기</h2>

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

        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
        >
          {uploading ? '업로드 중…' : '업로드'}
        </button>
      </form>

      {/* 목록 */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="px-5 py-10 text-center text-sm text-slate-400">불러오는 중…</div>
        ) : rows.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-slate-400">등록된 파일이 없습니다.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">종류</th>
                  <th className="text-left px-4 py-3 font-medium">파일명</th>
                  <th className="text-left px-4 py-3 font-medium whitespace-nowrap">자료 연·월</th>
                  <th className="text-left px-4 py-3 font-medium whitespace-nowrap">배포 대상</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                      {CATEGORY_LABELS[row.category]}
                    </td>
                    <td className="px-4 py-3">
                      <a
                        href={row.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-emerald-700 hover:underline font-medium"
                      >
                        {row.title}
                      </a>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-500">
                      {row.year}년 {row.month}월
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-full">
                        {scopeText(row)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleDelete(row)}
                        className="text-xs text-red-600 hover:text-red-700 hover:underline"
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  )
}
