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

async function resolveLocationEntities(
  characterId: string,
  character: { location_place: string | null; location_immediate: string | null; location_region: string | null },
): Promise<LocationEntity[]> {
  // Build filter conditions from character's location fields
  const placeCtx = character.location_place
  const regionCtx = character.location_region
  const buildingId = character.location_immediate

  let entityIds: string[] = []

  // If we have a building ID, fetch it and its siblings at the same parent
  if (buildingId) {
    const { data: building } = await supabase
      .from('world_entities')
      .select('id, parent_id')
      .eq('id', buildingId)
      .single()

    if (building?.parent_id) {
      const { data: siblings } = await supabase
        .from('world_entities')
        .select('id')
        .eq('parent_id', building.parent_id)
        .in('type', ['location', 'place'])
      entityIds = (siblings ?? []).map((e) => e.id)
      if (!entityIds.includes(buildingId)) entityIds.push(buildingId)
    } else {
      entityIds = [buildingId]
    }
  } else if (placeCtx) {
    // Fall back to filtering by place_context
    const { data } = await supabase
      .from('world_entities')
      .select('id')
      .eq('place_context', placeCtx)
      .in('type', ['location', 'place'])
      .limit(10)
    entityIds = (data ?? []).map((e) => e.id)
  } else if (regionCtx) {
    const { data } = await supabase
      .from('world_entities')
      .select('id')
      .eq('region_context', regionCtx)
      .in('type', ['place', 'location'])
      .limit(5)
    entityIds = (data ?? []).map((e) => e.id)
  }

  if (!entityIds.length) return []

  // Fetch base entity data
  const { data: entities } = await supabase
    .from('world_entities')
    .select('id, name, data')
    .in('id', entityIds)

  if (!entities) return []

  // Fetch player mutations for overrides
  const { data: mutations } = await supabase
    .from('player_entity_mutations')
    .select('entity_id, mutations')
    .eq('player_id', characterId)
    .in('entity_id', entityIds)

  const mutationMap = new Map(
    (mutations ?? []).map((m) => [m.entity_id, m.mutations as Record<string, unknown>]),
  )

  return entities.map((e) => {
    const override = mutationMap.get(e.id)
    const data = e.data as Record<string, unknown>
    const short_description =
      (override?.['short_description'] as string | undefined) ??
      (data?.['short_description'] as string | undefined) ??
      ''
    return { id: e.id, name: e.name, short_description }
  })
}

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
    resolveLocationEntities(characterId, character),
    getSyngemGame(characterId),
  ])

  const locStr = [character.location_place, character.location_region].filter(Boolean).join(' > ') || 'unknown'
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
  }
}
