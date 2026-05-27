import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const GM_SERVER = process.env.GM_SERVER_URL ?? 'http://localhost:3001'
const GM_API_KEY = process.env.GM_API_KEY

const VALID_LEVELS = ['verbose', 'errors+', 'errors', 'silent']

export async function POST(req: NextRequest) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_dev')
    .eq('id', user.id)
    .single()

  if (!profile?.is_dev) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!GM_API_KEY) {
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }

  const body = await req.json() as { level?: string }
  if (!body.level || !VALID_LEVELS.includes(body.level)) {
    return NextResponse.json({ error: 'invalid level' }, { status: 400 })
  }

  try {
    const res = await fetch(`${GM_SERVER}/dev/log-level`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GM_API_KEY}`,
      },
      body: JSON.stringify({ level: body.level }),
    })
    const data = await res.json() as Record<string, unknown>
    return NextResponse.json(data, { status: res.status })
  } catch {
    return NextResponse.json({ error: 'GM server unreachable' }, { status: 503 })
  }
}
