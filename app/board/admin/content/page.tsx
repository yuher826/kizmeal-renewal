'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

type ContentType = 'health' | 'newmenu' | 'recipe' | 'ingredient'

const TAB_CONFIG: Record<ContentType, { label: string; icon: string }> = {
  health: { label: '건강정보지', icon: '📰' },
  newmenu: { label: '이달의 신메뉴', icon: '⭐' },
  recipe: { label: '생생현장레시피', icon: '👨‍🍳' },
  ingredient: { label: '식재료정보', icon: '🌿' },
}

const TABS: ContentType[] = ['health', 'newmenu', 'recipe', 'ingredient']

type ContentItem = {
  id: string
  title: string
  body: string | null
  date: string
  image_urls: string[] | null
  is_public: boolean
  is_active: boolean
}

const EMPTY_FORM = { title: '', body: '', date: '', isPublic: true }

export default function AdminContentPage() {
  const [tab, setTab] = useState<ContentType>('health')
  const [items, setItems] = useState<ContentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function load(type: ContentType) {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('contents')
      .select('id, title, body, date, image_urls, is_public, is_active')
      .eq('type', type)
      .is('branch_id', null)
      .order('date', { ascending: false })
    setItems((data as ContentItem[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { load(tab) }, [tab])

  function handleTabChange(t: ContentType) {
    setTab(t)
    setShowForm(false)
    setEditId(null)
    setForm(EMPTY_FORM)
    setImageFile(null)
    setImagePreview(null)
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    const reader = new FileReader()
    reader.onload = () => setImagePreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title || !form.date) return
    setSaving(true)
    const supabase = createClient()

    let imageUrls: string[] = []

    if (imageFile) {
      const ext = imageFile.name.split('.').pop()
      const path = `contents/${tab}/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('kizmeal-contents')
        .upload(path, imageFile, { upsert: true })
      if (!uploadError) {
        const { data: urlData } = supabase.storage
          .from('kizmeal-contents')
          .getPublicUrl(path)
        imageUrls = [urlData.publicUrl]
      }
    }

    if (editId) {
      const updateData: Record<string, unknown> = {
        title: form.title,
        body: form.body || null,
        date: form.date,
        is_public: form.isPublic,
      }
      if (imageUrls.length > 0) updateData.image_urls = imageUrls
      await supabase.from('contents').update(updateData).eq('id', editId)
    } else {
      await supabase.from('contents').insert({
        type: tab,
        title: form.title,
        body: form.body || null,
        date: form.date,
        image_urls: imageUrls.length > 0 ? imageUrls : null,
        is_public: form.isPublic,
        is_active: true,
        branch_id: null,
        month: form.date.slice(0, 7),
      })
    }

    setForm(EMPTY_FORM)
    setImageFile(null)
    setImagePreview(null)
    setShowForm(false)
    setEditId(null)
    setSaving(false)
    await load(tab)
  }

  function startEdit(item: ContentItem) {
    setEditId(item.id)
    setForm({
      title: item.title,
      body: item.body ?? '',
      date: item.date,
      isPublic: item.is_public,
    })
    setImagePreview(item.image_urls?.[0] ?? null)
    setImageFile(null)
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleDelete(id: string) {
    if (!confirm('정말 삭제하시겠습니까?')) return
    const supabase = createClient()
    await supabase.from('contents').delete().eq('id', id)
    await load(tab)
  }

  async function togglePublic(item: ContentItem) {
    const supabase = createClient()
    await supabase
      .from('contents')
      .update({ is_public: !item.is_public })
      .eq('id', item.id)
    await load(tab)
  }

  function formatDate(d: string) {
    const [y, m, day] = d.split('-')
    return `${y}.${m}.${day}`
  }

  return (
    <div className="min-h-screen bg-[#F0F4F0] font-sans">
      <header className="bg-white border-b border-gray-100 px-4 sm:px-6 py-4 hidden sm:flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-[#2D6A4F] to-[#52B788] rounded-xl flex items-center justify-center text-white font-bold text-sm">K</div>
          <div>
            <h1 className="font-bold text-[#1C2B1E] text-sm">콘텐츠 관리</h1>
            <p className="text-gray-400 text-xs">건강정보지 · 신메뉴 · 레시피 · 식재료</p>
          </div>
        </div>
        <Link href="/board/admin" className="text-sm text-[#2D6A4F] font-medium hover:underline">
          대시보드
        </Link>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* Tabs */}
        <div className="bg-white rounded-2xl border border-gray-100 p-1 flex gap-1 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => handleTabChange(t)}
              className={`flex-1 min-w-[110px] flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                tab === t
                  ? 'bg-[#2D6A4F] text-white'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <span>{TAB_CONFIG[t].icon}</span>
              <span className="hidden sm:inline">{TAB_CONFIG[t].label}</span>
              <span className="sm:hidden text-xs">{TAB_CONFIG[t].label}</span>
            </button>
          ))}
        </div>

        {/* Section header */}
        <div className="flex justify-between items-center">
          <h2 className="font-bold text-[#1C2B1E]">
            {TAB_CONFIG[tab].icon} {TAB_CONFIG[tab].label}
          </h2>
          <button
            onClick={() => {
              setEditId(null)
              setForm(EMPTY_FORM)
              setImageFile(null)
              setImagePreview(null)
              setShowForm((v) => !v)
            }}
            className="bg-[#2D6A4F] hover:bg-[#1B4332] text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
          >
            {showForm && !editId ? '닫기' : '+ 새 글 작성'}
          </button>
        </div>

        {/* Form */}
        {showForm && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <h3 className="font-bold text-[#1C2B1E] mb-5">{editId ? '글 수정' : '새 글 작성'}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">제목 *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  required
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]"
                  placeholder="제목을 입력하세요"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">이미지</label>
                <div
                  className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center cursor-pointer hover:border-[#2D6A4F] transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {imagePreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={imagePreview}
                      alt="미리보기"
                      className="max-h-40 mx-auto rounded-lg object-cover"
                    />
                  ) : (
                    <div className="text-gray-400 text-sm py-4">
                      <div className="text-2xl mb-2">📷</div>
                      <p>클릭하여 이미지 업로드</p>
                    </div>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">내용</label>
                <textarea
                  value={form.body}
                  onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                  rows={6}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F] resize-none"
                  placeholder="내용을 입력하세요"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">날짜 *</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                  required
                  className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]"
                />
              </div>

              <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-700">공개 여부</p>
                  <p className="text-xs text-gray-400">
                    {form.isPublic ? '전체공개 — 홈페이지에 표시됩니다' : '비공개'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, isPublic: !f.isPublic }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    form.isPublic ? 'bg-[#2D6A4F]' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      form.isPublic ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-[#2D6A4F] hover:bg-[#1B4332] disabled:bg-gray-300 text-white font-semibold px-6 py-2.5 rounded-xl transition-colors text-sm"
                >
                  {saving ? '저장 중...' : editId ? '수정 완료' : '발행'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false)
                    setEditId(null)
                    setForm(EMPTY_FORM)
                    setImagePreview(null)
                    setImageFile(null)
                  }}
                  className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2.5 rounded-xl hover:bg-gray-100 transition-colors"
                >
                  취소
                </button>
              </div>
            </form>
          </div>
        )}

        {/* List */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-16 bg-gray-50 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-400 text-sm">
              등록된 콘텐츠가 없습니다.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#F8FDF8]">
                    {['썸네일', '제목', '날짜', '공개 여부', '관리'].map((h) => (
                      <th key={h} className="text-left px-5 py-3 text-xs font-bold text-gray-400 whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {items.map((item) => (
                    <tr key={item.id} className="hover:bg-[#F8FDF8] transition-colors">
                      <td className="px-5 py-3">
                        {item.image_urls?.[0] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.image_urls[0]}
                            alt=""
                            className="w-16 h-10 object-cover rounded-lg"
                          />
                        ) : (
                          <div className="w-16 h-10 bg-[#E8F5E9] rounded-lg flex items-center justify-center text-lg">
                            {TAB_CONFIG[tab].icon}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <p className="text-sm font-medium text-[#1C2B1E] line-clamp-1 max-w-xs">
                          {item.title}
                        </p>
                      </td>
                      <td className="px-5 py-3 text-sm text-gray-500 whitespace-nowrap">
                        {formatDate(item.date)}
                      </td>
                      <td className="px-5 py-3">
                        {item.is_public ? (
                          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#E8F5E9] text-[#2D6A4F]">
                            전체공개
                          </span>
                        ) : (
                          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-500">
                            비공개
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => startEdit(item)}
                            className="text-xs text-[#2D6A4F] font-medium hover:underline"
                          >
                            수정
                          </button>
                          <button
                            onClick={() => togglePublic(item)}
                            className="text-xs text-blue-600 font-medium hover:underline"
                          >
                            {item.is_public ? '비공개로' : '공개로'}
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="text-xs text-red-500 font-medium hover:underline"
                          >
                            삭제
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="px-5 py-3 border-t border-gray-100">
            <p className="text-xs text-gray-400">총 {items.length}건</p>
          </div>
        </div>
      </div>
    </div>
  )
}
