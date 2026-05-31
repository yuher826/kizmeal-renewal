import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendApprovalEmail, sendRejectionEmail } from '@/lib/email'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const token = authHeader.slice(7)
  const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)

  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: adminRow } = await supabaseAdmin
    .from('admins')
    .select('id')
    .eq('auth_id', user.id)
    .maybeSingle()

  if (!adminRow) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json() as {
    type: 'approved' | 'rejected'
    parentEmail: string
    parentName: string
    childName: string
    reason?: string
  }

  try {
    if (body.type === 'approved') {
      await sendApprovalEmail(body.parentEmail, body.parentName, body.childName)
    } else {
      await sendRejectionEmail(body.parentEmail, body.parentName, body.reason)
    }
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Email send failed' }, { status: 500 })
  }
}
