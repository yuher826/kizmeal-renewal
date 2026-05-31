import { NextRequest, NextResponse } from 'next/server'
import { sendNewApplicationAlert } from '@/lib/email'

const ADMIN_EMAIL = 'admin@kizmeal.com'

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    parentName: string
    childName: string
    branchName: string
  }

  try {
    await sendNewApplicationAlert(ADMIN_EMAIL, body.parentName, body.childName, body.branchName)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Email send failed' }, { status: 500 })
  }
}
