import supabase from '../gm/tools/db.js'
import type { ConversationTurn } from '../gm/types.js'

/** Persist a single turn. Returns the assigned turn_number. */
export async function saveTurn(
  characterId: string,
  gameId: string | undefined,
  role: 'player' | 'assistant',
  content: string,
): Promise<{ turnNumber: number }> {
  const { data: latest } = await supabase
    .from('conversation_turns')
    .select('turn_number')
    .eq('character_id', characterId)
    .order('turn_number', { ascending: false })
    .limit(1)
    .single()

  const turnNumber = (latest?.turn_number ?? 0) + 1

  await supabase.from('conversation_turns').insert({
    character_id: characterId,
    game_id: gameId ?? null,
    role,
    content,
    turn_number: turnNumber,
  })

  return { turnNumber }
}

/** Fetch the N most recent turns in chronological order. */
export async function getRecentTurns(
  characterId: string,
  limit: number,
): Promise<ConversationTurn[]> {
  const { data } = await supabase
    .from('conversation_turns')
    .select('role, content')
    .eq('character_id', characterId)
    .order('turn_number', { ascending: false })
    .limit(limit)

  if (!data) return []
  return data.reverse().map((r) => ({ role: r.role as 'player' | 'assistant', content: r.content }))
}

/** Total number of stored turns for a character. */
export async function getTurnCount(characterId: string): Promise<number> {
  const { count } = await supabase
    .from('conversation_turns')
    .select('id', { count: 'exact', head: true })
    .eq('character_id', characterId)

  return count ?? 0
}
