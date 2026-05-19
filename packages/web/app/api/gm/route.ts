import { NextRequest, NextResponse } from 'next/server'

const GM_SERVER = process.env.GM_SERVER_URL ?? 'http://localhost:3001'

export async function POST(req: NextRequest) {
  const body = await req.json()

  let serverRes: Response
  try {
    serverRes = await fetch(`${GM_SERVER}/gm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    return NextResponse.json({ error: 'GM server unreachable' }, { status: 503 })
  }

  const data = await serverRes.json()
  return NextResponse.json(data, { status: serverRes.status })
}
