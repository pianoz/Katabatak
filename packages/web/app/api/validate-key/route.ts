import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as { apiKey?: string }
  const apiKey = body.apiKey?.trim()

  if (!apiKey?.startsWith('sk-ant-')) {
    return NextResponse.json({ valid: false, error: 'Key must start with sk-ant-' })
  }

  try {
    const anthropic = new Anthropic({ apiKey })
    await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1,
      messages: [{ role: 'user', content: 'ping' }],
    })
    return NextResponse.json({ valid: true })
  } catch (err) {
    const isAuthError = err instanceof Anthropic.AuthenticationError
    return NextResponse.json({
      valid: false,
      error: isAuthError ? 'Invalid API key' : 'Validation failed — check key and try again',
    })
  }
}
