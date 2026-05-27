import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const GM_SERVER = process.env.GM_SERVER_URL ?? 'http://localhost:3001'

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

  const { enabled } = await req.json() as { enabled?: boolean }
  if (typeof enabled !== 'boolean') {
    return NextResponse.json({ error: 'enabled (boolean) is required' }, { status: 400 })
  }

  try {
    const res = await fetch(`${GM_SERVER}/dev/neuter-ledger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    })
    const data = await res.json() as Record<string, unknown>
    return NextResponse.json(data, { status: res.status })
  } catch {
    return NextResponse.json({ error: 'GM server unreachable' }, { status: 503 })
  }
}
