import supabase from '../gm/tools/db.js'
import type { Database } from '@db-types'

export type SyngemGameRow = Database['public']['Tables']['syngem_game']['Row']

const MINUTES_PER_DAY = 1440
const TIME_INCREMENT = 10

export async function getSyngemGame(characterId: string): Promise<SyngemGameRow | null> {
  const { data, error } = await supabase
    .from('syngem_game')
    .select('*')
    .eq('character_id', characterId)
    .single()
  if (error || !data) return null
  return data
}

export async function createSyngemGame(
  characterId: string,
  playerId: string,
): Promise<SyngemGameRow | null> {
  const { data, error } = await supabase
    .from('syngem_game')
    .insert({ character_id: characterId, player_id: playerId })
    .select()
    .single()
  if (error || !data) return null
  return data
}

export async function updateSyngemSummary(
  characterId: string,
  summary: string,
): Promise<void> {
  await supabase
    .from('syngem_game')
    .update({ summary, updated_at: new Date().toISOString() })
    .eq('character_id', characterId)
}

/**
 * Advances in-game time by 10 minutes per conversation pair.
 * Rolls game_time_minutes over at midnight (1440) and increments game_date_days.
 */
export async function advanceGameTime(characterId: string): Promise<void> {
  const game = await getSyngemGame(characterId)
  if (!game) return

  const newMinutes = game.game_time_minutes + TIME_INCREMENT
  const dayRollover = newMinutes >= MINUTES_PER_DAY

  await supabase
    .from('syngem_game')
    .update({
      game_time_minutes: newMinutes % MINUTES_PER_DAY,
      game_date_days: dayRollover ? game.game_date_days + 1 : game.game_date_days,
      updated_at: new Date().toISOString(),
    })
    .eq('character_id', characterId)
}
