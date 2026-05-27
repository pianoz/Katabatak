import { NextRequest, NextResponse } from 'next/server'

const GM_SERVER = process.env.GM_SERVER_URL ?? 'http://localhost:3001'

const VALID_LEVELS = ['verbose', 'errors+', 'errors', 'silent']

export async function POST(req: NextRequest) {
  const body = await req.json() as { level?: string }
  if (!body.level || !VALID_LEVELS.includes(body.level)) {
    return NextResponse.json({ error: 'invalid level' }, { status: 400 })
  }
  try {
    const res = await fetch(`${GM_SERVER}/dev/log-level`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ level: body.level }),
    })
    const data = await res.json() as Record<string, unknown>
    return NextResponse.json(data, { status: res.status })
  } catch {
    return NextResponse.json({ error: 'GM server unreachable' }, { status: 503 })
  }
}
