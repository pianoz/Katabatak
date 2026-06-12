import supabase from '../gm/tools/db.js'
import type { Database, Json } from '@db-types'
import type { NpcPersonalityProfile, NpcMemory, NpcMutations, NpcData, EnrichedNpc } from '../gm/types.js'

export type WorldEntityRow = Database['public']['Tables']['world_entities']['Row']
export type CharacterEntityMutationRow = Database['public']['Tables']['character_entity_mutations']['Row']
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

/** Fetches game-specific NPCs plus global world NPCs (game_id IS NULL, not following anyone). */
export async function getNpcsForGame(gameId: string): Promise<NpcRow[]> {
  const [{ data: gameNpcs }, { data: globalNpcs }] = await Promise.all([
    supabase.from('npcs').select('*').eq('game_id', gameId),
    supabase.from('npcs').select('*').is('game_id', null).is('following_character_id', null),
  ])
  return [...(gameNpcs ?? []), ...(globalNpcs ?? [])]
}

/** Fetches companion NPCs following a specific character (no game_id required). */
export async function getNpcsForCharacter(characterId: string): Promise<NpcRow[]> {
  const { data } = await supabase
    .from('npcs')
    .select('*')
    .eq('following_character_id', characterId)
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

/** Looks up an existing npcs instance for a given world_entity ID. */
export async function getNpcByWorldEntityId(
  worldEntityId: string,
  gameId?: string,
): Promise<NpcRow | null> {
  let query = supabase.from('npcs').select('*').eq('world_entity_id', worldEntityId)
  if (gameId) query = query.eq('game_id', gameId)
  const { data } = await query.limit(1).maybeSingle()
  return data ?? null
}

/**
 * Creates a new npcs instance from a world_entities base entity.
 * Copies name, data, and location so the instance starts as a faithful copy.
 */
export async function spawnNpcInstanceFromWorldEntity(
  worldEntityId: string,
  gameId?: string,
  characterId?: string,
): Promise<NpcRow | null> {
  const { data: entity } = await supabase
    .from('world_entities')
    .select('id, name, data, parent_id')
    .eq('id', worldEntityId)
    .eq('type', 'npc')
    .single()

  if (!entity) return null

  const entityData = (entity.data ?? {}) as Record<string, unknown>
  const npcData: NpcData = {
    short_description: (entityData['short_description'] as string | undefined) ?? (entityData['short_desc'] as string | undefined) ?? '',
    long_description: (entityData['long_description'] as string | undefined) ?? (entityData['long_desc'] as string | undefined) ?? '',
    knowledge: (entityData['knowledge'] as string[] | undefined) ?? [],
  }

  const { data: inserted } = await supabase
    .from('npcs')
    .insert({
      name: entity.name,
      world_entity_id: entity.id,
      game_id: gameId ?? null,
      character_id: characterId ?? null,
      current_location_id: entity.parent_id ?? 'none',
      data: npcData as unknown as Json,
      personality_profile: {} as unknown as Json,
      attribute_modifiers: {} as unknown as Json,
      disposition_to_players: 0,
      is_alive: true,
    } as unknown as Database['public']['Tables']['npcs']['Insert'])
    .select('*')
    .single()

  return inserted ?? null
}

/**
 * Applies Ledger-produced NPC mutations to the DB.
 * Disposition is clamped to [-100, 100]. Known facts are capped at 8 (oldest drop off).
 * If npcId is a world_entity string ID (not found in npcs table), spawns an instance first.
 */
export async function updateNpcMutations(
  npcId: string,
  mutations: NpcMutations,
  gameId?: string,
  characterId?: string,
): Promise<void> {
  let { data: npc } = await supabase.from('npcs').select('*').eq('id', npcId).single()

  // If not found by UUID, try treating npcId as a world_entity ID and spawn an instance
  if (!npc) {
    const existing = await getNpcByWorldEntityId(npcId, gameId)
    if (existing) {
      npc = existing
      npcId = existing.id
    } else {
      const spawned = await spawnNpcInstanceFromWorldEntity(npcId, gameId, characterId)
      if (!spawned) return
      npc = spawned
      npcId = spawned.id
    }
  }

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

  if (mutations.knowledge_append?.length) {
    const existingData = (npc.data ?? {}) as NpcData
    updates['data'] = {
      ...existingData,
      knowledge: [...(existingData.knowledge ?? []), ...mutations.knowledge_append],
    } as unknown as Json
  }

  if (Object.keys(updates).length > 0) {
    await supabase.from('npcs').update(updates as Database['public']['Tables']['npcs']['Update']).eq('id', npcId)
  }
}

// ─── Conversation buffer management ─────────────────────────────────────────

/**
 * Decrements buffer_count by 1 for all buffered NPC instances in this character's context.
 * Runs at the start of each turn before hydration so the correct tier is computed this turn.
 * Scoped to game-owned instances (game_id match) and companion NPCs (following_character_id match).
 */
export async function decrementNpcBuffers(gameId?: string, characterId?: string): Promise<void> {
  if (!gameId && !characterId) return

  let query = supabase.from('npcs').select('id, buffer_count').gt('buffer_count', 0)
  if (gameId && characterId) {
    query = query.or(`game_id.eq.${gameId},following_character_id.eq.${characterId}`)
  } else if (gameId) {
    query = query.eq('game_id', gameId)
  } else {
    query = query.eq('following_character_id', characterId!)
  }

  const { data } = await query
  if (!data?.length) return

  await Promise.all(
    data.map((n) =>
      supabase
        .from('npcs')
        .update({ buffer_count: (n.buffer_count as number) - 1 } as Database['public']['Tables']['npcs']['Update'])
        .eq('id', n.id as string),
    ),
  )
}

/**
 * Resolves natural-language NPC referents emitted by the lore engine, finds or spawns
 * their npcs instance rows, and sets buffer_count = 5 on each matched instance.
 * Fails closed: unresolvable referents produce no DB writes.
 * Returns the IDs of npcs instances that were buffered.
 */
export async function applyParticipantBuffers(
  referents: string[],
  candidates: EnrichedNpc[],
  gameId?: string,
): Promise<string[]> {
  if (!referents.length || !candidates.length) return []

  const bufferedIds: string[] = []

  for (const referent of referents) {
    // Tokenize: lowercase, drop stop-words (≤ 3 chars)
    const tokens = referent
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3)

    if (!tokens.length) continue

    // Score each candidate against searchable text
    const scored = candidates.map((npc) => {
      const searchable = [npc.name, npc.title, npc.faction, npc.smallSummary]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      const score = tokens.filter((t) => searchable.includes(t)).length
      return { npc, score }
    })

    const top = scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score)
    if (!top.length) continue // fail closed

    // Buffer the top scorer; if tied at top and ≤ 2 tied, buffer all tied
    const topScore = top[0].score
    const winners = top.filter((s) => s.score === topScore).slice(0, 2)

    for (const { npc } of winners) {
      // Find or spawn the npcs instance for this NPC
      let instanceId: string | null = null

      // Try treating npc.id as a real npcs UUID first
      const { data: byId } = await supabase.from('npcs').select('id').eq('id', npc.id).maybeSingle()
      if (byId) {
        instanceId = byId.id as string
      } else {
        // Virtual NPC: npc.id is a world_entity_id — look up or spawn an instance
        const existing = await getNpcByWorldEntityId(npc.id, gameId)
        if (existing) {
          instanceId = existing.id
        } else {
          const spawned = await spawnNpcInstanceFromWorldEntity(npc.id, gameId, characterId)
          instanceId = spawned?.id ?? null
        }
      }

      if (!instanceId) continue

      await supabase
        .from('npcs')
        .update({ buffer_count: 5 } as Database['public']['Tables']['npcs']['Update'])
        .eq('id', instanceId)

      bufferedIds.push(instanceId)
    }
  }

  return bufferedIds
}

/**
 * Zeros buffer_count on all NPC instances in this character's context.
 * Called when the character moves to a new location so knowledge evicts immediately.
 */
export async function clearNpcBuffers(gameId?: string, characterId?: string): Promise<void> {
  if (!gameId && !characterId) return

  let query = supabase
    .from('npcs')
    .update({ buffer_count: 0 } as Database['public']['Tables']['npcs']['Update'])

  if (gameId && characterId) {
    query = query.or(`game_id.eq.${gameId},following_character_id.eq.${characterId}`)
  } else if (gameId) {
    query = query.eq('game_id', gameId)
  } else {
    query = query.eq('following_character_id', characterId!)
  }

  await query
}
