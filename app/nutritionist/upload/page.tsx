'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

type ContentType = 'menu' | 'photo' | 'recipe' | 'notice'

const TYPE_LABELS: Record<ContentType, string> = {
  menu: '식단표',
  photo: '급식 사진',
  recipe: '레시피',
  notice: '공지사항',
}

export default function NutritionistUploadPage() {
  const router = useRouter()
  const [branchId, setBranchId] = useState<string | null>(null)
  const [type, setType] = useState<ContentType>('photo')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7))
  const [tags, setTags] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: member } = await supabase
        .from('branch_members')
        .select('branch_id')
        .eq('auth_id', user.id)
        .maybeSingle()

      if (member) setBranchId(member.branch_id)
    }
    load()
  }, [])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files || [])
    setFiles(selected)
    const urls = selected.map(f => URL.createObjectURL(f))
    setPreviews(urls)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!branchId) return
    setError('')
    setUploading(true)

    const supabase = createClient()
    const imageUrls: string[] = []

    // Upload images
    for (const file of files) {
      const ext = file.name.split('.').pop()
      const path = `${branchId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('kizmeal-contents')
        .upload(path, file, { contentType: file.type })

      if (uploadError) {
        setError(`파일 업로드 실패: ${uploadError.message}`)
        setUploading(false)
        return
      }

      const { data: urlData } = supabase.storage
        .from('kizmeal-contents')
        .getPublicUrl(path)
      imageUrls.push(urlData.publicUrl)
    }

    const { error: insertError } = await supabase.from('contents').insert({
      branch_id: branchId,
      type,
      title: title.trim(),
      body: body.trim() || null,
      date: (type === 'menu' || type === 'photo') ? date : null,
      month: type === 'menu' ? month : null,
      image_urls: imageUrls.length > 0 ? imageUrls : null,
      tags: tags.trim() ? tags.split(',').map(t => t.trim()).filter(Boolean) : null,
      published_at: new Date().toISOString(),
    })

    if (insertError) {
      setError(`저장 실패: ${insertError.message}`)
      setUploading(false)
      return
    }

    router.push('/nutritionist/dashboard')
  }

  return (
    <div className="min-h-screen bg-[#F6FAF6]">
      <header className="bg-white border-b border-gray-100 px-4 sm:px-6 py-4 flex items-center gap-3 sticky top-0 z-10">
        <Link href="/nutritionist/dashboard" className="text-gray-400 hover:text-gray-600">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5m7-7l-7 7 7 7" />
          </svg>
        </Link>
        <h1 className="font-bold text-[#1C2B1E]">컨텐츠 등록</h1>
      </header>

      <div className="max-w-lg mx-auto px-4 py-6">
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-5 space-y-5">
          {error && (
            <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl">{error}</div>
          )}

          {/* Type */}
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-2">컨텐츠 종류</label>
            <div className="grid grid-cols-4 gap-2">
              {(['photo', 'menu', 'recipe', 'notice'] as ContentType[]).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`py-2.5 rounded-xl text-xs font-semibold transition-colors ${
                    type === t
                      ? 'bg-[#2D6A4F] text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5">제목 *</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
              placeholder="제목을 입력하세요"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]"
            />
          </div>

          {/* Date / Month */}
          {(type === 'photo') && (
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1.5">날짜</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]"
              />
            </div>
          )}
          {type === 'menu' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5">날짜</label>
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5">월 (식단표 기준)</label>
                <input
                  type="month"
                  value={month}
                  onChange={e => setMonth(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]"
                />
              </div>
            </div>
          )}

          {/* Body */}
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5">내용</label>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={4}
              placeholder="내용을 입력하세요 (선택사항)"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F] resize-none"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5">태그 (쉼표로 구분)</label>
            <input
              type="text"
              value={tags}
              onChange={e => setTags(e.target.value)}
              placeholder="예: 한식, 채소, 단백질"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]"
            />
          </div>

          {/* Images */}
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5">사진 첨부</label>
            <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-[#2D6A4F] transition-colors">
              <span className="text-gray-400 text-sm">클릭하여 사진 선택</span>
              <span className="text-xs text-gray-300 mt-1">JPG, PNG, WEBP</span>
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
            {previews.length > 0 && (
              <div className="grid grid-cols-4 gap-2 mt-3">
                {previews.map((url, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={url} alt="" className="aspect-square object-cover rounded-lg" />
                ))}
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={uploading || !title.trim()}
            className="w-full bg-[#2D6A4F] hover:bg-[#1B4332] disabled:bg-gray-300 text-white font-bold py-4 rounded-2xl text-sm transition-colors"
          >
            {uploading ? '업로드 중...' : '등록하기'}
          </button>
        </form>
      </div>
    </div>
  )
}
