import supabase from '../gm/tools/db.js'
import type { Database, Json } from '@db-types'
import type { NpcPersonalityProfile, NpcMemory, NpcMutations } from '../gm/types.js'

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

/** Maps game_time_minutes (0–1439) to a routine time slot. */
export function computeNpcTimeSlot(
  gameTimeMinutes: number,
): 'morning' | 'afternoon' | 'evening' | 'night' {
  if (gameTimeMinutes < 360) return 'night'
  if (gameTimeMinutes < 720) return 'morning'
  if (gameTimeMinutes < 1080) return 'afternoon'
  return 'evening'
}

/**
 * Returns the location_id where this NPC should be at the given game time.
 * Falls back to home_location_id if no routine slot is defined.
 * Returns null if neither routine nor home is configured.
 */
export function computeNpcRoutineLocation(npc: NpcRow, gameTimeMinutes: number): string | null {
  const profile = npc.personality_profile as NpcPersonalityProfile | null
  if (!profile) return null
  const routine = profile.routine
  if (routine) {
    const slot = computeNpcTimeSlot(gameTimeMinutes)
    return routine[slot] ?? profile.home_location_id ?? null
  }
  return profile.home_location_id ?? null
}

/**
 * Applies Ledger-produced NPC mutations to the DB.
 * Disposition is clamped to [-100, 100]. Known facts are capped at 8 (oldest drop off).
 */
export async function updateNpcMutations(npcId: string, mutations: NpcMutations): Promise<void> {
  const { data: npc } = await supabase.from('npcs').select('*').eq('id', npcId).single()
  if (!npc) return

  const updates: Record<string, unknown> = {}

  if (mutations.disposition_delta !== undefined) {
    updates['disposition_to_players'] = Math.max(
      -100,
      Math.min(100, (npc.disposition_to_players ?? 0) + mutations.disposition_delta),
    )
  }

  const needsProfileUpdate =
    mutations.memory_append !== undefined ||
    (mutations.known_facts_append?.length ?? 0) > 0 ||
    'current_task' in mutations

  if (needsProfileUpdate) {
    const profile: NpcPersonalityProfile = {
      ...((npc.personality_profile ?? {}) as NpcPersonalityProfile),
    }

    if (mutations.memory_append !== undefined || (mutations.known_facts_append?.length ?? 0) > 0) {
      const memory: NpcMemory = { ...(profile.memory ?? {}) }
      if (mutations.memory_append !== undefined) {
        memory.last_encounter_summary = mutations.memory_append
      }
      if (mutations.known_facts_append?.length) {
        memory.known_facts = [
          ...(memory.known_facts ?? []),
          ...mutations.known_facts_append,
        ].slice(-8)
      }
      profile.memory = memory
    }

    if ('current_task' in mutations) {
      profile.current_task = mutations.current_task
    }

    updates['personality_profile'] = profile as unknown as Json
  }

  if (mutations.current_location_id !== undefined) {
    updates['current_location_id'] = mutations.current_location_id
  }
  if (mutations.is_alive !== undefined) {
    updates['is_alive'] = mutations.is_alive
  }
  if ('following_character_id' in mutations) {
    updates['following_character_id'] = mutations.following_character_id
  }

  if (Object.keys(updates).length > 0) {
    await supabase.from('npcs').update(updates as Database['public']['Tables']['npcs']['Update']).eq('id', npcId)
  }
}
