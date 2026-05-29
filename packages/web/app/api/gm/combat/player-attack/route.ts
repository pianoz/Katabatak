import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const GM_SERVER = process.env.GM_SERVER_URL ?? 'http://localhost:3001'
const GM_API_KEY = process.env.GM_API_KEY

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!GM_API_KEY) return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })

  const body = await req.json() as {
    gameId?: string
    characterId?: string
    weaponInventoryId?: string
    attackType?: string
    targetCreatureId?: string
  }
  try {
    const res = await fetch(`${GM_SERVER}/gm/combat/player-attack`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GM_API_KEY}` },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch {
    return NextResponse.json({ error: 'GM server unreachable' }, { status: 503 })
  }
}
