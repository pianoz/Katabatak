import supabase from '../gm/tools/db.js'
import type { Database } from '@db-types'

export type SyngemGameRow = Database['public']['Tables']['syngem_game']['Row']

const MINUTES_PER_DAY = 1440
const TIME_INCREMENT = 10
const LONG_REST_MINUTES = 480

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

async function advanceTime(characterId: string, deltaMinutes: number): Promise<void> {
  const game = await getSyngemGame(characterId)
  if (!game) return

  const totalMinutes = game.game_time_minutes + deltaMinutes
  const daysCrossed = Math.floor(totalMinutes / MINUTES_PER_DAY)

  await supabase
    .from('syngem_game')
    .update({
      game_time_minutes: totalMinutes % MINUTES_PER_DAY,
      game_date_days: game.game_date_days + daysCrossed,
      updated_at: new Date().toISOString(),
    })
    .eq('character_id', characterId)
}

/**
 * Advances in-game time by 10 minutes per conversation pair.
 * Rolls game_time_minutes over at midnight (1440) and increments game_date_days.
 */
export async function advanceGameTime(characterId: string): Promise<void> {
  await advanceTime(characterId, TIME_INCREMENT)
}

/** Advances in-game time by 8 hours for a long rest, handling midnight rollover. */
export async function advanceLongRestTime(characterId: string): Promise<void> {
  await advanceTime(characterId, LONG_REST_MINUTES)
}
