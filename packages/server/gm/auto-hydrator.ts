import { getFullCharacter } from '../services/character-service.js'
import type { InventoryItem } from '../services/character-service.js'
import { getGameWithMembers, getActiveEncounter } from '../services/game-service.js'
import { getSyngemGame } from '../services/syngem-game-service.js'
import { getNpcsForGame, getNpcsForCharacter, getNpcByWorldEntityId, computeNpcRoutineLocation } from '../services/world-service.js'
import type { NpcRow } from '../services/world-service.js'
import supabase from './tools/db.js'
import { synLog, synLogVerbose } from './logger.js'
import type {
  ContextBlock,
  LocationEntity,
  LocationEntityFull,
  EnrichedNpc,
  NpcPersonalityProfile,
  NpcData,
  ActiveQuestNote,
} from './types.js'
import type { GameWithMembers, EncounterWithCreatures } from '../services/game-service.js'
import type { SyngemGameRow } from '../services/syngem-game-service.js'
import type { FullCharacter } from '../services/character-service.js'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function poolText(current: number | null, max: number | null): string {
  if (current === null || max === null || max === 0) return 'Unknown'
  const ratio = current / max
  if (ratio <= 0.25) return 'Critical'
  if (ratio <= 0.5) return 'Low'
  if (ratio <= 0.75) return 'Moderate'
  return 'Full'
}

function dispositionLabel(disposition: number): EnrichedNpc['dispositionLabel'] {
  if (disposition <= -50) return 'hostile'
  if (disposition < 0) return 'wary'
  if (disposition < 50) return 'neutral'
  return 'friendly'
}

// ─── Module return types ──────────────────────────────────────────────────────

interface CharacterHydration {
  fullCharacter: FullCharacter
  healthText: string
  essenceText: string
  powerText: string
  willText: string
  physicalDescription: string | null
  backstory: string | null
  activeQuestNotes: ActiveQuestNote[]
}

interface InventoryHydration {
  trackedInventory: InventoryItem[]
  inventoryWeight: { current: number; max: number }
}

interface GameHydration {
  syngemGame: SyngemGameRow | null
  game: GameWithMembers | null
  encounterData: EncounterWithCreatures | null
}

interface LocationHydration {
  locationEntities: LocationEntity[]
  entitiesAtLocation: LocationEntityFull[]
  connectedLocations: Array<{ id: string; name: string; short_description: string }>
  improvisedEntities: LocationEntity[]
}

// ─── Location helpers (kept exported for lore-engine contextBlock formatter) ──

export async function resolveLocationEntities(
  characterId: string,
  locationPlaceId: string | null,
): Promise<LocationEntity[]> {
  if (!locationPlaceId) return []

  const chain: Array<{ id: string; name: string; parent_id: string | null; data: unknown }> = []

  let currentId: string | null = locationPlaceId
  while (currentId) {
    const { data } = await supabase
      .from('world_entities')
      .select('id, name, data, parent_id')
      .eq('id', currentId)
      .single()
    if (!data) break
    const row: { id: string; name: string; parent_id: string | null; data: unknown } = data
    chain.push(row)
    currentId = row.parent_id
  }

  if (!chain.length) return []

  const entityIds = chain.map((e) => e.id)
  const { data: mutations } = await supabase
    .from('character_entity_mutations')
    .select('entity_id, mutations')
    .eq('character_id', characterId)
    .in('entity_id', entityIds)

  const mutationMap = new Map(
    (mutations ?? []).map((m) => [m.entity_id, m.mutations as Record<string, unknown>]),
  )

  return chain.map((e) => {
    const override = mutationMap.get(e.id)
    const data = e.data as Record<string, unknown>
    const short_description =
      (override?.['short_description'] as string | undefined) ??
      (override?.['short_desc'] as string | undefined) ??
      (data?.['short_description'] as string | undefined) ??
      (data?.['short_desc'] as string | undefined) ??
      ''
    const long_description =
      (override?.['long_description'] as string | undefined) ??
      (override?.['long_desc'] as string | undefined) ??
      (data?.['long_description'] as string | undefined) ??
      (data?.['long_desc'] as string | undefined) ??
      ''
    return { id: e.id, name: e.name, short_description, long_description }
  })
}

async function resolveImprovisedEntities(
  characterId: string,
  locationPlaceId: string | null,
): Promise<LocationEntity[]> {
  if (!locationPlaceId) return []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from('improvised_entities')
    .select('id, name, data')
    .eq('character_id', characterId)
    .eq('parent_id', locationPlaceId)

  if (!data?.length) return []

  return (data as Array<{ id: string; name: string; data: unknown }>).map((e) => {
    const d = e.data as Record<string, unknown>
    return {
      id: e.id,
      name: e.name,
      short_description: (d?.['short_description'] as string | undefined) ?? '',
      long_description: (d?.['long_description'] as string | undefined) ?? '',
    }
  })
}

function enrichAndFilterNpcs(
  npcs: NpcRow[],
  characterId: string,
  characterLocation: string | null,
  gameTimeMinutes: number,
): EnrichedNpc[] {
  const enriched: EnrichedNpc[] = []

  for (const npc of npcs) {
    const isFollowing = npc.following_character_id === characterId
    const routineLocation = computeNpcRoutineLocation(npc, gameTimeMinutes)
    const expectedLocation = isFollowing ? characterLocation : (routineLocation ?? npc.current_location_id)
    const isVisible = isFollowing || expectedLocation === characterLocation
    if (!isVisible) continue

    if (!isFollowing && routineLocation && routineLocation !== npc.current_location_id) {
      supabase.from('npcs').update({ current_location_id: routineLocation }).eq('id', npc.id).then()
    }

    const profile = (npc.personality_profile ?? {}) as NpcPersonalityProfile
    const npcData = (npc.data ?? {}) as NpcData
    const disposition = npc.disposition_to_players ?? 0

    // data.long_description is preferred; fall back to personality_profile.personality
    const longDescription = npcData.long_description || profile.personality || null
    // data.short_description is preferred; fall back to small_summary column
    const shortDescription = npcData.short_description || npc.small_summary || null

    enriched.push({
      id: npc.id,
      name: npc.name,
      title: npc.title ?? null,
      faction: npc.faction ?? null,
      disposition,
      dispositionLabel: dispositionLabel(disposition),
      isFollowing,
      lastEncounterSummary: profile.memory?.last_encounter_summary ?? null,
      currentTask: profile.current_task ?? null,
      personality: isFollowing ? longDescription : null,
      smallSummary: isFollowing ? null : shortDescription,
      knowledge: (npc.buffer_count ?? 0) > 0 ? (npcData.knowledge ?? []) : [],
    })
  }

  return enriched
}

// ─── Module functions ─────────────────────────────────────────────────────────

/** Fetches character stats, pool texts, quest notes, and biographical fields. */
export async function hydrateCharacter(characterId: string): Promise<CharacterHydration | null> {
  const fullCharacter = await getFullCharacter(characterId)
  if (!fullCharacter) return null

  const { character } = fullCharacter

  const questObjectives = (character as Record<string, unknown>)['quest_objectives'] as
    | Array<{ id: string; status: string }>
    | null
    | undefined
  const activeQuestIds = (questObjectives ?? [])
    .filter((q) => q.status === 'active')
    .map((q) => q.id)

  const questTemplates = activeQuestIds.length
    ? await supabase
        .from('quest_templates')
        .select('id, description_gm')
        .in('id', activeQuestIds)
        .then(({ data }) => data ?? [])
    : []

  return {
    fullCharacter,
    healthText: poolText(character.current_health, character.health_max),
    essenceText: poolText(character.current_essence, character.essence_max),
    powerText: poolText(character.current_power, character.power_max),
    willText: poolText(character.current_will, character.will_max),
    physicalDescription: character.physical_description ?? null,
    backstory: character.backstory ?? null,
    activeQuestNotes: questTemplates.map((t) => ({ questId: t.id, gmNotes: t.description_gm })),
  }
}

/** Fetches only tracked (quest/special/equipped) inventory items and computes carry weight. */
export async function hydrateInventory(characterId: string): Promise<InventoryHydration> {
  const { data } = await supabase
    .from('character_inventory')
    .select('id, item_id, is_equipped, tracked, condition, quantity, items(name, type)')
    .eq('character_id', characterId)
    .or('tracked.eq.true,is_equipped.eq.true')

  const trackedInventory = (data ?? []) as unknown as InventoryItem[]
  const equippedCount = trackedInventory.filter((i) => i.is_equipped).length

  return { trackedInventory, inventoryWeight: { current: equippedCount, max: 0 } }
}

/** Fetches syngemGame, optionally the multiplayer game record and active encounter. */
export async function hydrateGame(
  characterId: string,
  gameId?: string,
): Promise<GameHydration> {
  const [syngemGame, game, encounterData] = await Promise.all([
    getSyngemGame(characterId),
    gameId ? getGameWithMembers(gameId) : Promise.resolve(null),
    gameId ? getActiveEncounter(gameId) : Promise.resolve(null),
  ])
  return { syngemGame, game, encounterData }
}

/** Fetches, filters, and tiers NPCs visible at the player's location. */
export async function hydrateNpcs(
  characterId: string,
  gameId: string | undefined,
  locationPlace: string | null,
  gameTimeMinutes: number,
): Promise<EnrichedNpc[]> {
  const [gameNpcs, companionNpcs] = await Promise.all([
    gameId ? getNpcsForGame(gameId) : Promise.resolve([]),
    getNpcsForCharacter(characterId),
  ])

  // Seed the map from known npcs table rows (these always win on dedup)
  const npcMap = new Map([...gameNpcs, ...companionNpcs].map((n) => [n.id, n]))

  // Also pull world_entity NPCs at the character's location and merge in any that
  // don't already have an npcs instance for this game
  if (locationPlace) {
    const { data: worldNpcs } = await supabase
      .from('world_entities')
      .select('id, name, data, parent_id')
      .eq('parent_id', locationPlace)
      .eq('type', 'npc')

    if (worldNpcs?.length) {
      const instanceChecks = worldNpcs.map((we) => getNpcByWorldEntityId(we.id, gameId))
      const instances = await Promise.all(instanceChecks)

      for (let i = 0; i < worldNpcs.length; i++) {
        const we = worldNpcs[i]
        const instance = instances[i]

        if (instance) {
          // Instance exists — use it (keyed by its UUID so no conflict with world_entity ID)
          if (!npcMap.has(instance.id)) npcMap.set(instance.id, instance)
        } else {
          // No instance yet — synthesize a minimal NpcRow-shaped object for display
          // (spawning only happens on actual interaction via updateNpcMutations)
          if (!npcMap.has(we.id)) {
            const weData = (we.data ?? {}) as Record<string, unknown>
            const virtualNpc: NpcRow = {
              id: we.id,
              name: we.name,
              title: null,
              faction: null,
              game_id: gameId ?? null,
              following_character_id: null,
              current_location_id: we.parent_id ?? 'none',
              disposition_to_players: 0,
              is_alive: true,
              last_seen_tick: null,
              small_summary: null,
              world_entity_id: we.id,
              data: we.data,
              // Build personality_profile so fallback logic in enrichAndFilterNpcs works
              // if data.long_description is missing
              personality_profile: {
                personality: (weData['long_description'] as string | undefined) ?? (weData['long_desc'] as string | undefined) ?? null,
              },
              attribute_modifiers: {},
              buffer_count: 0,
              character_id: null,
            }
            npcMap.set(we.id, virtualNpc)
          }
        }
      }
    }
  }

  return enrichAndFilterNpcs(Array.from(npcMap.values()), characterId, locationPlace, gameTimeMinutes)
}

/**
 * Fetches the location chain (place→region→nation), entities physically present at the
 * current place, connected locations (siblings in same region), and improvised entities.
 */
export async function hydrateLocation(
  characterId: string,
  locationPlaceId: string | null,
): Promise<LocationHydration> {
  if (!locationPlaceId) {
    return { locationEntities: [], entitiesAtLocation: [], connectedLocations: [], improvisedEntities: [] }
  }

  const [locationEntities, improvisedEntities] = await Promise.all([
    resolveLocationEntities(characterId, locationPlaceId),
    resolveImprovisedEntities(characterId, locationPlaceId),
  ])

  // locationEntities is place→region→nation; index 1 is the region
  const regionId = locationEntities[1]?.id ?? null

  const [rawEntitiesAt, rawConnected] = await Promise.all([
    supabase
      .from('world_entities')
      .select('id, name, type, data')
      .eq('parent_id', locationPlaceId),
    regionId
      ? supabase
          .from('world_entities')
          .select('id, name, data')
          .eq('parent_id', regionId)
          .in('type', ['place', 'location'])
          .neq('id', locationPlaceId)
      : Promise.resolve({ data: [] }),
  ])

  const entityAtIds = ((rawEntitiesAt.data ?? []) as Array<{ id: string }>).map((e) => e.id)
  const mutationMap = new Map<string, Record<string, unknown>>()
  if (entityAtIds.length) {
    const { data: mutRows } = await supabase
      .from('character_entity_mutations')
      .select('entity_id, mutations')
      .eq('character_id', characterId)
      .in('entity_id', entityAtIds)
    for (const m of mutRows ?? []) {
      if (m.entity_id) mutationMap.set(m.entity_id, m.mutations as Record<string, unknown>)
    }
  }

  const entitiesAtLocation: LocationEntityFull[] = (
    (rawEntitiesAt.data ?? []) as Array<{ id: string; name: string; type: string; data: unknown }>
  ).map((e) => {
    const override = mutationMap.get(e.id)
    const data = (e.data ?? {}) as Record<string, unknown>
    const short_description =
      (override?.['short_description'] as string | undefined) ??
      (override?.['short_desc'] as string | undefined) ??
      (data['short_description'] as string | undefined) ??
      (data['short_desc'] as string | undefined) ??
      ''
    const long_description =
      (override?.['long_description'] as string | undefined) ??
      (override?.['long_desc'] as string | undefined) ??
      (data['long_description'] as string | undefined) ??
      (data['long_desc'] as string | undefined) ??
      ''
    return { id: e.id, name: e.name, type: e.type, short_description, long_description, data }
  })

  const connectedLocations = (
    (rawConnected.data ?? []) as Array<{ id: string; name: string; data: unknown }>
  ).map((e) => {
    const data = (e.data ?? {}) as Record<string, unknown>
    return {
      id: e.id,
      name: e.name,
      short_description:
        (data['short_description'] as string | undefined) ??
        (data['short_desc'] as string | undefined) ??
        '',
    }
  })

  return { locationEntities, entitiesAtLocation, connectedLocations, improvisedEntities }
}

// ─── Formatter (used by lore-engine) ─────────────────────────────────────────

/**
 * Serializes a ContextBlock into a standardized plain-text prompt section.
 * Includes character stats, location chain with short descriptions, and game time.
 */
export function contextBlock(ctx: ContextBlock): string {
  const {
    character: { character },
    healthText,
    essenceText,
    powerText,
    willText,
    locationEntities,
    encounterData,
    syngemGame,
    physicalDescription,
  } = ctx

  const lines: string[] = [`Character: ${character.name} (Level ${character.level ?? '?'})`]

  if (physicalDescription) lines.push(`Description: ${physicalDescription}`)

  lines.push(
    `Health: ${character.current_health}/${character.health_max} (${healthText})`,
    `Essence: ${character.current_essence}/${character.essence_max} (${essenceText})`,
    `Power: ${character.current_power}/${character.power_max} (${powerText})`,
    `Will: ${character.current_will}/${character.will_max} (${willText})`,
  )

  if (locationEntities.length) {
    const chain = [...locationEntities].reverse()
    lines.push(`Location: ${chain.map((e) => e.name).join(' > ')}`)
    for (const entity of chain) {
      if (entity.short_description) lines.push(`  ${entity.name}: ${entity.short_description}`)
    }
  } else {
    lines.push('Location: Unknown')
  }

  if (syngemGame) {
    lines.push(`Game Time: Day ${syngemGame.game_date_days}, ${syngemGame.game_time_minutes} min`)
  }

  if (ctx.npcs.length) {
    lines.push(`Nearby: ${ctx.npcs.map((n) => n.name).join(', ')}`)
  }

  if (encounterData?.isInCombat) {
    const aliveCount = encounterData.creatures.filter((c) => c.is_alive).length
    lines.push(`IN COMBAT — ${aliveCount} enemies active`)
  }

  return lines.join('\n')
}

// ─── Composed hydrator ────────────────────────────────────────────────────────

/**
 * Builds a full ContextBlock for a player turn by composing the 5 module hydrators.
 * Returns null if the character cannot be found.
 */
export async function autoHydrate(
  characterId: string,
  gameId?: string,
  requestId?: string,
): Promise<ContextBlock | null> {
  synLog('HYDRATOR', `→ fetching context | char:${characterId}${gameId ? ` game:${gameId}` : ''}`, undefined, requestId)

  const [charData, gameData] = await Promise.all([
    hydrateCharacter(characterId),
    hydrateGame(characterId, gameId),
  ])

  if (!charData) return null

  const { fullCharacter, healthText, essenceText, powerText, willText, physicalDescription, backstory, activeQuestNotes } = charData
  const locationPlace = fullCharacter.character.location_place

  const [locationData, inventoryData, npcs] = await Promise.all([
    hydrateLocation(characterId, locationPlace),
    hydrateInventory(characterId),
    hydrateNpcs(characterId, gameId, locationPlace, gameData.syngemGame?.game_time_minutes ?? 720),
  ])

  const { locationEntities, entitiesAtLocation, connectedLocations, improvisedEntities } = locationData
  const { trackedInventory, inventoryWeight } = inventoryData

  // carrying_capacity lives on character; weight.max filled here
  inventoryWeight.max = fullCharacter.character.carrying_capacity ?? 0

  const locStr = locationPlace ?? 'unknown'
  synLog(
    'HYDRATOR',
    `✓ built | ${fullCharacter.character.name} | ${locStr} | ${locationEntities.length} loc entities, ${entitiesAtLocation.length} at-loc, ${connectedLocations.length} connected, ${npcs.length} NPCs visible${gameData.encounterData?.isInCombat ? ' | COMBAT' : ''}${gameData.syngemGame ? ` | day ${gameData.syngemGame.game_date_days}` : ''}`,
    undefined,
    requestId,
  )

  const contextPayload: ContextBlock = {
    character: fullCharacter,
    game: gameData.game,
    syngemGame: gameData.syngemGame,
    healthText,
    essenceText,
    powerText,
    willText,
    locationEntities,
    improvisedEntities,
    entitiesAtLocation,
    connectedLocations,
    encounterData: gameData.encounterData,
    npcs,
    trackedInventory,
    inventoryWeight,
    backstory,
    physicalDescription,
    activeQuestNotes,
  }

  synLogVerbose('HYDRATOR', '◉ full context payload', contextPayload, requestId)

  return contextPayload
}
