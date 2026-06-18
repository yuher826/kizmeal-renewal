import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const url = searchParams.get('url')
  const filename = searchParams.get('filename') || 'download.pptx'

  if (!url) return NextResponse.json({ error: 'URL 필요' }, { status: 400 })

  const response = await fetch(url)
  if (!response.ok) return NextResponse.json({ error: '파일 없음' }, { status: 404 })

  const buffer = await response.arrayBuffer()
  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  })
}
