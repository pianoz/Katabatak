import supabase from '../gm/tools/db.js'
import type { Database } from '@db-types'

export type WorldLoreRow = Database['public']['Tables']['world_lore']['Row']
export type CampaignFactRow = Database['public']['Tables']['campaign_facts']['Row']
export type NpcRow = Database['public']['Tables']['npcs']['Row']

export type WorldLoreSearchResult = Database['public']['Functions']['search_world_lore']['Returns'][number]

export async function searchWorldLore(query: string): Promise<WorldLoreSearchResult[]> {
  const { data, error } = await supabase.rpc('search_world_lore', { search_query: query })
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
