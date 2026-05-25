import { NextResponse } from 'next/server'

const GM_SERVER = process.env.GM_SERVER_URL ?? 'http://localhost:3001'

export async function GET() {
  try {
    const res = await fetch(`${GM_SERVER}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(2000),
    })
    if (res.ok) return NextResponse.json({ status: 'online' })
    return NextResponse.json({ status: 'error' })
  } catch {
    return NextResponse.json({ status: 'offline' })
  }
}
