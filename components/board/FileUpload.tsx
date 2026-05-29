'use client'

import { useState, useRef, useCallback } from 'react'

interface Props {
  files: File[]
  onFilesChange: (files: File[]) => void
  maxFiles?: number
  maxSizeMB?: number
  accept?: string
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]

function getFileIcon(type: string) {
  if (type.includes('image')) return '🖼️'
  if (type.includes('pdf')) return '📄'
  if (type.includes('spreadsheet') || type.includes('excel')) return '📊'
  if (type.includes('word') || type.includes('document')) return '📝'
  return '📎'
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

export default function FileUpload({ files, onFilesChange, maxFiles = 5, maxSizeMB = 10 }: Props) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const addFiles = useCallback((newFiles: File[]) => {
    const valid = newFiles.filter(f => {
      if (!ALLOWED_TYPES.includes(f.type)) return false
      if (f.size > maxSizeMB * 1024 * 1024) return false
      return true
    })
    const combined = [...files, ...valid].slice(0, maxFiles)
    onFilesChange(combined)
  }, [files, maxFiles, maxSizeMB, onFilesChange])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    addFiles(Array.from(e.dataTransfer.files))
  }, [addFiles])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(Array.from(e.target.files))
    e.target.value = ''
  }, [addFiles])

  const removeFile = (index: number) => {
    onFilesChange(files.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-2">
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl px-4 py-6 text-center cursor-pointer transition-colors ${
          dragging ? 'border-[#2D6A4F] bg-[#F0FAF4]' : 'border-gray-200 hover:border-[#52B788]'
        }`}
      >
        <p className="text-2xl mb-1">📎</p>
        <p className="text-sm text-gray-500">클릭하거나 파일을 드래그하세요</p>
        <p className="text-xs text-gray-400 mt-1">
          최대 {maxFiles}개 · {maxSizeMB}MB 이하 · JPG, PNG, PDF, XLSX, DOCX
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".jpg,.jpeg,.png,.pdf,.xlsx,.xls,.docx,.doc"
          onChange={handleChange}
          className="hidden"
        />
      </div>

      {files.length > 0 && (
        <ul className="space-y-1">
          {files.map((file, i) => (
            <li key={i} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 text-sm">
              <span>{getFileIcon(file.type)}</span>
              <span className="flex-1 truncate text-gray-700">{file.name}</span>
              <span className="text-gray-400 text-xs">{formatSize(file.size)}</span>
              <button
                type="button"
                onClick={() => removeFile(i)}
                className="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
                aria-label="파일 제거"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
