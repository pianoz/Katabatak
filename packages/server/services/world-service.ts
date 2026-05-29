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

/** Searches a single keyword in global entities and the location hierarchy. */
async function searchKeyword(keyword: string, locationId: string): Promise<string | null> {
  if (!keyword?.trim()) return null
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
      .eq('parent_id', locationId)
      .textSearch('search_vector', keyword, { type: 'websearch' }),
  ])

  const globalResult = globalRes.data?.length ? formatEntity(globalRes.data[0]) : null

  let localResult: string | null = null

  if (level1Res.data?.length) {
    localResult = pickRandom(level1Res.data, 3).map(formatEntity).join('\n\n')
  } else {
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

  const combined = [globalResult, localResult].filter(Boolean)
  return combined.length ? combined.join('\n\n') : null
}

/**
 * Gathers lore context for 'info' actions.
 * Always fetches the location entity directly by ID (no text search — immune to key-format issues).
 * Optionally searches for additional human-readable keywords within the location hierarchy.
 */
export async function gatherInfoLore(locationId: string, keywords: string[]): Promise<string> {
  const [locationRes, ...keywordResults] = await Promise.all([
    supabase.from('world_entities').select('name, data').eq('id', locationId).single(),
    ...keywords.map((kw) => searchKeyword(kw, locationId)),
  ])

  const locationResult = locationRes.data ? formatEntity(locationRes.data) : null
  const parts = [locationResult, ...keywordResults].filter(Boolean)

  return parts.length ? parts.join('\n\n') : 'What the player asked about is unknown'
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
