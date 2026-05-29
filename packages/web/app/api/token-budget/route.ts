import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PUT(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as { budget?: number | null }

  // null clears the cap; numbers must be >= 1000 to prevent accidental self-lockout
  let sanitized: number | null
  if (body.budget === null || body.budget === undefined) {
    sanitized = null
  } else if (typeof body.budget === 'number' && body.budget >= 1000) {
    sanitized = Math.floor(body.budget)
  } else {
    return NextResponse.json(
      { error: 'Budget must be null (unlimited) or an integer >= 1000' },
      { status: 400 },
    )
  }

  const { error } = await supabase
    .from('profiles')
    .update({ token_budget: sanitized })
    .eq('id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, budget: sanitized })
}
