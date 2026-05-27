import { getFullCharacter } from '../services/character-service.js'
import { getGameWithMembers, getActiveEncounter } from '../services/game-service.js'
import { getSyngemGame } from '../services/syngem-game-service.js'
import { getNpcsForGame } from '../services/world-service.js'
import supabase from './tools/db.js'
import { synLog } from './logger.js'
import type { ContextBlock, LocationEntity } from './types.js'

function poolText(current: number | null, max: number | null): string {
  if (current === null || max === null || max === 0) return 'Unknown'
  const ratio = current / max
  if (ratio <= 0.25) return 'Critical'
  if (ratio <= 0.5) return 'Low'
  if (ratio <= 0.75) return 'Moderate'
  return 'Full'
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
      (data?.['short_description'] as string | undefined) ??
      ''
    const long_description =
      (override?.['long_description'] as string | undefined) ??
      (data?.['long_description'] as string | undefined) ??
      ''
    return { id: e.id, name: e.name, short_description, long_description }
  })
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

  const [game, encounterData, npcs, locationEntities, syngemGame] = await Promise.all([
    gameId ? getGameWithMembers(gameId) : Promise.resolve(null),
    gameId ? getActiveEncounter(gameId) : Promise.resolve(null),
    gameId ? getNpcsForGame(gameId) : Promise.resolve([]),
    resolveLocationEntities(characterId, character.location_place),
    getSyngemGame(characterId),
  ])

  const locStr = character.location_place ?? 'unknown'
  synLog('HYDRATOR', `✓ built | ${character.name} | ${locStr} | ${locationEntities.length} entities, ${npcs.length} NPCs${encounterData?.isInCombat ? ' | COMBAT' : ''}${syngemGame ? ` | day ${syngemGame.game_date_days}` : ''}`)

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
    encounterData,
    npcs,
    inventoryWeight: {
      current: equippedWeight,
      max: character.carrying_capacity ?? 0,
    },
    backstory: character.backstory ?? null,
    physicalDescription: character.physical_description ?? null,
  }
}
