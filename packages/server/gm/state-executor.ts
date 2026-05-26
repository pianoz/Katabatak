import supabase from './tools/db.js'
import { updateCharacter } from '../services/character-service.js'
import type { Database, Json } from '@db-types'
import type { LedgerOutput } from './types.js'

const VALID_LOCATION_TYPES = new Set(['nation', 'region', 'place', 'location'])

async function moveCharacter(characterId: string, destinationEntityId: string): Promise<void> {
  const { data: entity } = await supabase
    .from('world_entities')
    .select('id, name, type, nation_context, region_context, place_context')
    .eq('id', destinationEntityId)
    .single()

  if (!entity || !VALID_LOCATION_TYPES.has(entity.type)) {
    console.warn(`[StateExecutor] move_character: entity ${destinationEntityId} is not a valid location type`)
    return
  }

  await updateCharacter(characterId, {
    current_location_building: entity.type === 'location' ? entity.id : undefined,
    current_location_polis: entity.place_context ?? (entity.type === 'place' ? entity.id : undefined),
    current_location_region: entity.region_context ?? (entity.type === 'region' ? entity.id : undefined),
    current_location_text: entity.name,
  })
}

async function updateEntity(entityId: string, mutations: Record<string, unknown>): Promise<void> {
  const { data: existing } = await supabase
    .from('world_entities')
    .select('data')
    .eq('id', entityId)
    .single()

  if (!existing) {
    console.warn(`[StateExecutor] update_entity: entity ${entityId} not found`)
    return
  }

  const merged = { ...(existing.data as Record<string, unknown>), ...mutations } as Json
  await supabase.from('world_entities').update({ data: merged }).eq('id', entityId)
}

async function createEntity(entity: Record<string, unknown>): Promise<void> {
  if (!entity['id'] || !entity['name'] || !entity['type']) {
    console.warn('[StateExecutor] create_entity: missing required fields (id, name, type)')
    return
  }
  await supabase.from('world_entities').upsert({
    id: entity['id'] as string,
    name: entity['name'] as string,
    type: entity['type'] as Database['public']['Enums']['entity_type'],
    data: ((entity['data'] ?? {}) as unknown as Json),
  })
}

async function deleteEntity(
  characterId: string,
  entityId: string,
  replacementDescription: string,
): Promise<void> {
  await supabase.from('player_entity_mutations').upsert(
    {
      player_id: characterId,
      entity_id: entityId,
      mutations: { hidden: true, short_description: replacementDescription },
    },
    { onConflict: 'player_id,entity_id' },
  )
}

export async function executeStateChanges(
  characterId: string,
  outputs: LedgerOutput[],
): Promise<void> {
  for (const output of outputs) {
    try {
      switch (output.action) {
        case 'move_character':
          await moveCharacter(characterId, output.destination_entity_id)
          break
        case 'update_entity':
          await updateEntity(output.entity_id, output.mutations)
          break
        case 'create_entity':
          await createEntity(output.entity)
          break
        case 'delete_entity':
          await deleteEntity(characterId, output.entity_id, output.replacement_description)
          break
      }
    } catch (err) {
      console.error(`[StateExecutor] Failed to execute ${output.action}:`, err)
    }
  }
}
