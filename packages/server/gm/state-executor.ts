import supabase from './tools/db.js'
import { updateCharacter } from '../services/character-service.js'
import { synLog, synLogVerbose } from './logger.js'
import type { Database, Json } from '@db-types'
import type { LedgerOutput } from './types.js'

const VALID_LOCATION_TYPES = new Set(['nation', 'region', 'place', 'location'])

async function moveCharacter(characterId: string, destinationEntityId: string): Promise<void> {
  const { data: entity } = await supabase
    .from('world_entities')
    .select('id, name, type, place_context')
    .eq('id', destinationEntityId)
    .single()

  if (!entity || !VALID_LOCATION_TYPES.has(entity.type)) {
    synLog('STATE-EXECUTOR', `⚠ move_character: entity ${destinationEntityId} is not a valid location type`)
    return
  }

  // Resolve to a place-level ID: sub-place locations use their place_context
  const locationPlace =
    entity.type === 'location' ? entity.place_context
    : entity.type === 'place' ? entity.id
    : null

  await updateCharacter(characterId, { location_place: locationPlace })
}

async function updateEntity(entityId: string, mutations: Record<string, unknown>): Promise<void> {
  const { data: existing } = await supabase
    .from('world_entities')
    .select('data')
    .eq('id', entityId)
    .single()

  if (!existing) {
    synLog('STATE-EXECUTOR', `⚠ update_entity: entity ${entityId} not found`)
    return
  }

  const merged = { ...(existing.data as Record<string, unknown>), ...mutations } as Json
  await supabase.from('world_entities').update({ data: merged }).eq('id', entityId)
}

async function createEntity(entity: Record<string, unknown>): Promise<void> {
  if (!entity['id'] || !entity['name'] || !entity['type']) {
    synLog('STATE-EXECUTOR', '⚠ create_entity: missing required fields (id, name, type)', entity)
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

/**
 * Applies a batch of Ledger-produced world-state changes to the database.
 * Errors on individual actions are caught and logged; execution continues for remaining actions.
 */
export async function executeStateChanges(
  characterId: string,
  outputs: LedgerOutput[],
): Promise<void> {
  for (const output of outputs) {
    try {
      synLogVerbose('STATE-EXECUTOR', '→ action:', output)
      switch (output.action) {
        case 'move_character':
          synLog('STATE-EXECUTOR', `→ move_character | dest:${output.destination_entity_id}`)
          await moveCharacter(characterId, output.destination_entity_id)
          break
        case 'update_entity':
          synLog('STATE-EXECUTOR', `→ update_entity | id:${output.entity_id} fields:[${Object.keys(output.mutations).join(',')}]`)
          await updateEntity(output.entity_id, output.mutations)
          break
        case 'create_entity':
          synLog('STATE-EXECUTOR', `→ create_entity | id:${output.entity['id']} name:"${output.entity['name']}"`)
          await createEntity(output.entity)
          break
        case 'delete_entity':
          synLog('STATE-EXECUTOR', `→ delete_entity | id:${output.entity_id}`)
          await deleteEntity(characterId, output.entity_id, output.replacement_description)
          break
      }
    } catch (err) {
      synLog('STATE-EXECUTOR', `✗ failed to execute ${output.action}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
}
