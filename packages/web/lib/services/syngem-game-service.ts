import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/components/types/supabase'

export type SyngemGame = Database['public']['Tables']['syngem_game']['Row']

/**
 * Returns the syngem_game record for a character, or null if none exists.
 */
export async function getSyngemGame(
  supabase: SupabaseClient,
  characterId: string,
): Promise<SyngemGame | null> {
  const { data } = await supabase
    .from('syngem_game')
    .select('*')
    .eq('character_id', characterId)
    .single()
  return data ?? null
}

/**
 * Creates a new syngem_game for the given character and player.
 * Should be called once when starting an AI game session.
 */
export async function createSyngemGame(
  supabase: SupabaseClient,
  characterId: string,
  userId: string,
): Promise<SyngemGame | null> {
  const { data } = await supabase
    .from('syngem_game')
    .insert({ character_id: characterId, player_id: userId })
    .select()
    .single()
  return data ?? null
}
