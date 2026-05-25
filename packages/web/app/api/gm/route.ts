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

  const body = await req.json() as {
    message?: string
    conversationHistory?: unknown[]
    characterId?: string
    gameId?: string
  }

  let serverRes: Response
  try {
    serverRes = await fetch(`${GM_SERVER}/gm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(GM_API_KEY ? { Authorization: `Bearer ${GM_API_KEY}` } : {}),
      },
      // Send only what the server needs — never the full characterContext
      body: JSON.stringify({
        message: body.message,
        conversationHistory: body.conversationHistory,
        characterId: body.characterId,
        gameId: body.gameId,
      }),
    })
  } catch {
    return NextResponse.json({ error: 'GM server unreachable' }, { status: 503 })
  }

  const data = await serverRes.json()
  return NextResponse.json(data, { status: serverRes.status })
}
