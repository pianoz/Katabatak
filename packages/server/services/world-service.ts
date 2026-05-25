import supabase from '../gm/tools/db.js'
import type { Database } from '@db-types'

export type WorldEntityRow = Database['public']['Tables']['world_entities']['Row']
export type PlayerEntityMutationRow = Database['public']['Tables']['player_entity_mutations']['Row']
// Mirrors the entity_type DB enum — update here if the enum changes, then regenerate DB types.
export type EntityType = 'nation' | 'region' | 'place' | 'location' | 'npc' | 'item'
export type CampaignFactRow = Database['public']['Tables']['campaign_facts']['Row']
export type NpcRow = Database['public']['Tables']['npcs']['Row']

/** Full-text search across world entities. Optionally narrow by entity type. */
export async function searchWorldEntities(
  query: string,
  filterType?: EntityType,
): Promise<WorldEntityRow[]> {
  const { data, error } = await supabase.rpc('search_world_entities', {
    search_query: query,
    filter_type: filterType ?? null,
  })
  if (error || !data) return []
  return data
}

export async function getCampaignFacts(gameId: string, gmOnly: boolean): Promise<CampaignFactRow[]> {
  let query = supabase.from('campaign_facts').select('*').eq('game_id', gameId)
  if (!gmOnly) {
    query = query.neq('visibility', 'gm_only')
  }
  const { data } = await query
  return data ?? []
}

export async function getNpc(npcId: string): Promise<NpcRow | null> {
  const { data } = await supabase.from('npcs').select('*').eq('id', npcId).single()
  return data ?? null
}

export async function getNpcsForGame(gameId: string): Promise<NpcRow[]> {
  const { data } = await supabase.from('npcs').select('*').eq('game_id', gameId)
  return data ?? []
}
