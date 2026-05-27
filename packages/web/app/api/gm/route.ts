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

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_dev')
    .eq('id', user.id)
    .single()

  if (!profile?.is_dev) {
    return NextResponse.json({ error: 'Access restricted to approved users.' }, { status: 403 })
  }

  const body = await req.json() as {
    message?: string
    characterId?: string
    gameId?: string
    checkResolution?: { choice: 'spend' | 'roll'; pool: string; roll_result?: number }
  }

  if (!GM_API_KEY) {
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }

  let serverRes: Response
  try {
    serverRes = await fetch(`${GM_SERVER}/gm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GM_API_KEY}`,
      },
      body: JSON.stringify({
        message: body.message,
        characterId: body.characterId,
        userId: user.id,
        gameId: body.gameId,
        checkResolution: body.checkResolution,
      }),
    })
  } catch {
    return NextResponse.json({ error: 'GM server unreachable' }, { status: 503 })
  }

  if (!serverRes.ok) {
    const errBody = await serverRes.json().catch(() => ({ error: 'GM server error' }))
    return NextResponse.json(errBody, { status: serverRes.status })
  }

  const contentType = serverRes.headers.get('content-type') ?? ''

  // check_required returns plain JSON — pass through directly
  if (!contentType.includes('text/event-stream')) {
    const data = await serverRes.json()
    return NextResponse.json(data, { status: serverRes.status })
  }

  // SSE stream — proxy chunks through to the client
  const { readable, writable } = new TransformStream()
  const writer = writable.getWriter()

  serverRes.body
    ?.pipeTo(
      new WritableStream({
        write(chunk) {
          writer.write(chunk)
        },
        close() {
          writer.close()
        },
        abort(err) {
          writer.abort(err)
        },
      }),
    )
    .catch(() => writer.close())

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
