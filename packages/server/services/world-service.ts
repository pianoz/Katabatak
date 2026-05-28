import supabase from '../gm/tools/db.js'
import type { Database } from '@db-types'

export type WorldEntityRow = Database['public']['Tables']['world_entities']['Row']
export type PlayerEntityMutationRow = Database['public']['Tables']['player_entity_mutations']['Row']
// Mirrors the entity_type DB enum — update here if the enum changes, then regenerate DB types.
export type EntityType = 'nation' | 'region' | 'place' | 'location' | 'npc' | 'item'
export type CampaignFactRow = Database['public']['Tables']['campaign_facts']['Row']
export type NpcRow = Database['public']['Tables']['npcs']['Row']

function pickRandom<T>(arr: T[], n: number): T[] {
  return [...arr].sort(() => Math.random() - 0.5).slice(0, n)
}

function formatEntity(e: { name: string; data: unknown }): string {
  const data = e.data as Record<string, unknown>
  const desc = (
    (data?.['long_description'] as string | undefined) ??
    (data?.['long_desc'] as string | undefined) ??
    (data?.['short_description'] as string | undefined) ??
    e.name
  )
  return `${e.name}: ${desc}`
}

/**
 * Two-phase keyword search for 'info' actions.
 * Phase 1: global entities (parent_id IS NULL) → first match.
 * Phase 2: hierarchical search from player's location up to nation → up to 3 matches.
 * Returns formatted long_description blocks or a fallback string.
 */
export async function searchLoreInHierarchy(keyword: string, locationId: string): Promise<string> {
  // Phase 1: global entities (no parent) — run in parallel with phase 2 level 1
  const [globalRes, level1Res] = await Promise.all([
    supabase
      .from('world_entities')
      .select('name, data')
      .is('parent_id', null)
      .textSearch('search_vector', keyword, { type: 'websearch' })
      .limit(5),
    supabase
      .from('world_entities')
      .select('name, data')
      .or(`parent_id.eq.${locationId},id.eq.${locationId}`)
      .textSearch('search_vector', keyword, { type: 'websearch' }),
  ])

  const globalResult = globalRes.data?.length ? formatEntity(globalRes.data[0]) : null

  let localResult: string | null = null

  if (level1Res.data?.length) {
    localResult = pickRandom(level1Res.data, 3).map(formatEntity).join('\n\n')
  } else {
    // Fetch region (parent of location)
    const { data: locationRow } = await supabase
      .from('world_entities')
      .select('parent_id')
      .eq('id', locationId)
      .single()
    const regionId = locationRow?.parent_id

    if (regionId) {
      const { data: level2 } = await supabase
        .from('world_entities')
        .select('name, data')
        .eq('parent_id', regionId)
        .textSearch('search_vector', keyword, { type: 'websearch' })

      if (level2?.length) {
        localResult = pickRandom(level2, 3).map(formatEntity).join('\n\n')
      } else {
        // Fetch nation (parent of region)
        const { data: regionRow } = await supabase
          .from('world_entities')
          .select('parent_id')
          .eq('id', regionId)
          .single()
        const nationId = regionRow?.parent_id

        if (nationId) {
          const { data: level3 } = await supabase
            .from('world_entities')
            .select('name, data')
            .eq('parent_id', nationId)
            .textSearch('search_vector', keyword, { type: 'websearch' })

          if (level3?.length) {
            localResult = pickRandom(level3, 3).map(formatEntity).join('\n\n')
          }
        }
      }
    }
  }

  if (!globalResult && !localResult) return 'What the player asked about is unknown'
  return [globalResult, localResult].filter(Boolean).join('\n\n')
}

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
