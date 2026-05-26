import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const GM_SERVER = process.env.GM_SERVER_URL ?? 'http://localhost:3001'
const GM_API_KEY = process.env.GM_API_KEY

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  let serverRes: Response
  try {
    serverRes = await fetch(`${GM_SERVER}/gm/hydrate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(GM_API_KEY ? { Authorization: `Bearer ${GM_API_KEY}` } : {}),
      },
      body: JSON.stringify(body),
    })
  } catch {
    return NextResponse.json({ error: 'GM server unreachable' }, { status: 503 })
  }

  const contentType = serverRes.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) {
    return NextResponse.json(
      { error: `GM server error (${serverRes.status}) — restart the server if you just added new routes` },
      { status: serverRes.status },
    )
  }
  const data = await serverRes.json()
  return NextResponse.json(data, { status: serverRes.status })
}
