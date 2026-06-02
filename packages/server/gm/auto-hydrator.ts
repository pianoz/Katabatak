import { getFullCharacter } from '../services/character-service.js'
import { getGameWithMembers, getActiveEncounter } from '../services/game-service.js'
import { getSyngemGame } from '../services/syngem-game-service.js'
import { getNpcsForGame, getNpcsForCharacter, computeNpcRoutineLocation } from '../services/world-service.js'
import type { NpcRow } from '../services/world-service.js'
import supabase from './tools/db.js'
import { synLog } from './logger.js'
import type { ContextBlock, LocationEntity, EnrichedNpc, NpcPersonalityProfile, ActiveQuestNote } from './types.js'

function poolText(current: number | null, max: number | null): string {
  if (current === null || max === null || max === 0) return 'Unknown'
  const ratio = current / max
  if (ratio <= 0.25) return 'Critical'
  if (ratio <= 0.5) return 'Low'
  if (ratio <= 0.75) return 'Moderate'
  return 'Full'
}

/** Fetches improvised entities the Architect created for this character at the given location. */
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

export async function resolveLocationEntities(
  characterId: string,
  locationPlaceId: string | null,
): Promise<LocationEntity[]> {
  if (!locationPlaceId) return []

  // Fetch the place entity then walk up parent_id to collect region and nation
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

  // Fetch player mutations for short_description overrides
  const entityIds = chain.map((e) => e.id)
  const { data: mutations } = await supabase
    .from('player_entity_mutations')
    .select('entity_id, mutations')
    .eq('player_id', characterId)
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

function dispositionLabel(disposition: number): EnrichedNpc['dispositionLabel'] {
  if (disposition <= -50) return 'hostile'
  if (disposition < 0) return 'wary'
  if (disposition < 50) return 'neutral'
  return 'friendly'
}

/**
 * Applies lazy routine placement and filters NPCs to those visible at the player's location.
 * Fire-and-forget DB writes update current_location_id when an NPC arrives at the player's spot.
 */
function enrichAndFilterNpcs(
  npcs: NpcRow[],
  characterId: string,
  characterLocation: string | null,
  gameTimeMinutes: number,
): EnrichedNpc[] {
  const enriched: EnrichedNpc[] = []

  for (const npc of npcs) {
    const isFollowing = npc.following_character_id === characterId

    // Compute where this NPC should be right now
    const routineLocation = computeNpcRoutineLocation(npc, gameTimeMinutes)
    const expectedLocation = isFollowing ? characterLocation : (routineLocation ?? npc.current_location_id)

    // Only show NPCs at the player's location or actively following
    const isVisible = isFollowing || expectedLocation === characterLocation
    if (!isVisible) continue

    // If the NPC's DB location differs from expected, silently update it (fire-and-forget)
    if (!isFollowing && routineLocation && routineLocation !== npc.current_location_id) {
      supabase.from('npcs').update({ current_location_id: routineLocation }).eq('id', npc.id).then()
    }

    const profile = (npc.personality_profile ?? {}) as NpcPersonalityProfile
    const disposition = npc.disposition_to_players ?? 0

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
      personality: isFollowing ? (profile.personality ?? null) : null,
      smallSummary: isFollowing ? null : (npc.small_summary ?? null),
    })
  }

  return enriched
}

/**
 * Builds a full ContextBlock for a player turn from parallel DB reads.
 * Returns null if the character cannot be found.
 */
export async function autoHydrate(
  characterId: string,
  gameId?: string,
): Promise<ContextBlock | null> {
  synLog('HYDRATOR', `→ fetching context | char:${characterId}${gameId ? ` game:${gameId}` : ''}`)

  const fullCharacter = await getFullCharacter(characterId)
  if (!fullCharacter) return null

  const { character } = fullCharacter

  // Fetch quest objectives to look up GM notes for active quests
  const questObjectives = (character as Record<string, unknown>)['quest_objectives'] as
    | Array<{ id: string; status: string }>
    | null
    | undefined
  const activeQuestIds = (questObjectives ?? [])
    .filter((q) => q.status === 'active')
    .map((q) => q.id)

  const [game, encounterData, gameNpcs, companionNpcs, locationEntities, improvisedEntities, syngemGame, questTemplates] =
    await Promise.all([
      gameId ? getGameWithMembers(gameId) : Promise.resolve(null),
      gameId ? getActiveEncounter(gameId) : Promise.resolve(null),
      gameId ? getNpcsForGame(gameId) : Promise.resolve([]),
      getNpcsForCharacter(characterId),
      resolveLocationEntities(characterId, character.location_place),
      resolveImprovisedEntities(characterId, character.location_place),
      getSyngemGame(characterId),
      activeQuestIds.length
        ? supabase
            .from('quest_templates')
            .select('id, description_gm')
            .in('id', activeQuestIds)
            .then(({ data }) => data ?? [])
        : Promise.resolve([]),
    ])

  const activeQuestNotes: ActiveQuestNote[] = questTemplates.map((t) => ({
    questId: t.id,
    gmNotes: t.description_gm,
  }))

  // Merge game NPCs and companion NPCs, deduplicating by id
  const npcMap = new Map([...gameNpcs, ...companionNpcs].map((n) => [n.id, n]))
  const allNpcs = Array.from(npcMap.values())

  const npcs = enrichAndFilterNpcs(
    allNpcs,
    characterId,
    character.location_place,
    syngemGame?.game_time_minutes ?? 720,
  )

  const locStr = character.location_place ?? 'unknown'
  synLog('HYDRATOR', `✓ built | ${character.name} | ${locStr} | ${locationEntities.length} entities, ${npcs.length}/${allNpcs.length} NPCs visible${encounterData?.isInCombat ? ' | COMBAT' : ''}${syngemGame ? ` | day ${syngemGame.game_date_days}` : ''}`)

  const equippedWeight = fullCharacter.inventory
    .filter((i) => i.is_equipped)
    .reduce((sum) => sum + 1, 0)

  return {
    character: fullCharacter,
    game,
    syngemGame,
    healthText: poolText(character.current_health, character.health_max),
    essenceText: poolText(character.current_essence, character.essence_max),
    powerText: poolText(character.current_power, character.power_max),
    willText: poolText(character.current_will, character.will_max),
    locationEntities,
    improvisedEntities,
    encounterData,
    npcs,
    inventoryWeight: {
      current: equippedWeight,
      max: character.carrying_capacity ?? 0,
    },
    backstory: character.backstory ?? null,
    physicalDescription: character.physical_description ?? null,
    activeQuestNotes,
  }
}
