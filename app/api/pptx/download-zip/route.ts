import { NextRequest, NextResponse } from 'next/server'
import JSZip from 'jszip'

export const maxDuration = 60

type FileEntry = {
  branch_name: string
  pptx_url?: string
  pdf_url?: string
  jpg_url?: string
}

export async function POST(req: NextRequest) {
  let body: { files: FileEntry[]; year: number; month: number }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '요청 형식 오류' }, { status: 400 })
  }

  const { files, year, month } = body
  if (!files?.length || !year || !month) {
    return NextResponse.json({ error: 'files, year, month 필드가 필요합니다.' }, { status: 400 })
  }

  const zip = new JSZip()

  // 파일 병렬 다운로드 후 ZIP에 추가
  await Promise.all(
    files.map(async (entry) => {
      const name = entry.branch_name

      if (entry.pptx_url) {
        try {
          const buf = await fetch(entry.pptx_url).then(r => r.arrayBuffer())
          zip.file(`${name}.pptx`, buf)
        } catch { /* 개별 파일 실패 무시 */ }
      }

      if (entry.pdf_url) {
        try {
          const buf = await fetch(entry.pdf_url).then(r => r.arrayBuffer())
          zip.file(`${name}.pdf`, buf)
        } catch { /* 개별 파일 실패 무시 */ }
      }

      if (entry.jpg_url) {
        try {
          const buf = await fetch(entry.jpg_url).then(r => r.arrayBuffer())
          zip.file(`${name}.jpg`, buf)
        } catch { /* 개별 파일 실패 무시 */ }
      }
    }),
  )

  const content = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })

  const filename = encodeURIComponent(`키즈밀_식단표_${year}_${month}월.zip`)

  return new NextResponse(content, {
    headers: {
      'Content-Type':        'application/zip',
      'Content-Disposition': `attachment; filename*=UTF-8''${filename}`,
    },
  })
}
