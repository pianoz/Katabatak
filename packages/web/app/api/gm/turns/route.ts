import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = req.nextUrl
  const characterId = searchParams.get('characterId')
  if (!characterId) {
    return NextResponse.json({ error: 'characterId is required' }, { status: 400 })
  }

  const rawLimit = searchParams.get('limit')
  const limit = Math.min(rawLimit ? parseInt(rawLimit, 10) : 3, 3)

  // Verify character belongs to the authenticated user
  const { data: character } = await supabase
    .from('characters')
    .select('id')
    .eq('id', characterId)
    .eq('user_id', user.id)
    .single()

  if (!character) {
    return NextResponse.json({ error: 'Character not found' }, { status: 404 })
  }

  const [turnsResult, gameResult] = await Promise.all([
    supabase
      .from('conversation_turns')
      .select('role, content')
      .eq('character_id', characterId)
      .order('turn_number', { ascending: false })
      .limit(limit),
    supabase
      .from('syngem_game')
      .select('game_time_minutes, game_date_days')
      .eq('character_id', characterId)
      .maybeSingle(),
  ])

  if (turnsResult.error) {
    return NextResponse.json({ error: 'Failed to fetch turns' }, { status: 500 })
  }

  // Reverse to chronological order
  const turns = (turnsResult.data ?? []).reverse()
  return NextResponse.json({
    turns,
    game_time_minutes: gameResult.data?.game_time_minutes ?? null,
    game_date_days: gameResult.data?.game_date_days ?? null,
  })
}
