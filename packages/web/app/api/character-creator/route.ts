import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const GM_SERVER = process.env.GM_SERVER_URL ?? 'http://localhost:3001'
const GM_API_KEY = process.env.GM_API_KEY

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!GM_API_KEY) {
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }

  const body = await req.json() as { questions?: unknown; answers?: unknown }

  if (Array.isArray(body.answers)) {
    const tooLong = (body.answers as unknown[]).some(
      (a) => typeof a === 'string' && a.length > 600,
    )
    if (tooLong) {
      return NextResponse.json(
        { error: 'Answer too long (max 500 characters)' },
        { status: 400 },
      )
    }
  }

  let serverRes: Response
  try {
    serverRes = await fetch(`${GM_SERVER}/character-creator`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GM_API_KEY}`,
      },
      body: JSON.stringify({ questions: body.questions, answers: body.answers }),
    })
  } catch {
    return NextResponse.json({ error: 'GM server unreachable' }, { status: 503 })
  }

  const data = await serverRes.json().catch(() => ({ error: 'Invalid response from character creator' }))
  return NextResponse.json(data, { status: serverRes.status })
}
