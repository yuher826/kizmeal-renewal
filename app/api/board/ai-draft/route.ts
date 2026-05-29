import { NextRequest, NextResponse } from 'next/server'
import { generateReplyDraft } from '@/lib/claude'
import { createClient } from '@/lib/supabase-server'
import type { InquiryCategory } from '@/lib/types'

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: adminData } = await supabase
    .from('admins')
    .select('id')
    .eq('auth_id', user.id)
    .maybeSingle()

  if (!adminData) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 503 })
  }

  try {
    const body = await request.json()
    const { category, content, branchName } = body as {
      category: InquiryCategory
      content: string
      branchName?: string
    }

    if (!category || !content) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const draft = await generateReplyDraft(category, content, branchName)
    return NextResponse.json({ draft })
  } catch (error) {
    console.error('AI draft error:', error)
    return NextResponse.json({ error: 'AI draft generation failed' }, { status: 500 })
  }
}
