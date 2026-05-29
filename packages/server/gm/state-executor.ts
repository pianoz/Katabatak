import supabase from './tools/db.js'
import { updateCharacter, getCharacter } from '../services/character-service.js'
import { updateNpcMutations } from '../services/world-service.js'
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

async function applyLongRest(characterId: string): Promise<void> {
  const char = await getCharacter(characterId)
  if (!char) return

  const { data: skillRows } = await supabase
    .from('character_skills')
    .select('current_rank, skills!inner(effects)')
    .eq('character_id', characterId)

  const restMods: Record<string, { add: number; multiply: number }> = {}
  for (const row of skillRows ?? []) {
    const rank = (row as { current_rank: number | null }).current_rank ?? 1
    const effects = ((row as { skills: { effects: unknown } }).skills.effects) as Array<{
      type: string; target: string; math: string; Value: number
      per_rank_add: number | null; per_rank_multiply: number | null
    }>
    if (!Array.isArray(effects)) continue
    for (const e of effects) {
      if (e.type !== 'rest_modifier') continue
      if (!restMods[e.target]) restMods[e.target] = { add: 0, multiply: 1 }
      const mod = restMods[e.target]
      if (e.math === 'add') {
        mod.add += e.Value + (e.per_rank_add ?? 0) * (rank - 1)
      } else {
        mod.multiply *= e.Value + (e.per_rank_multiply ?? 0) * (rank - 1)
      }
    }
  }

  const BASE_REST = 7
  const calc = (current: number, max: number, pool: string) =>
    Math.min(max, (current + BASE_REST + (restMods[pool]?.add ?? 0)) * (restMods[pool]?.multiply ?? 1))

  await updateCharacter(characterId, {
    current_health:  calc(char.current_health  ?? 0, char.health_max  ?? 0, 'health'),
    current_essence: calc(char.current_essence ?? 0, char.essence_max ?? 0, 'essence'),
    current_power:   calc(char.current_power   ?? 0, char.power_max   ?? 0, 'power'),
    current_will:    calc(char.current_will    ?? 0, char.will_max    ?? 0, 'will'),
  })
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
        case 'update_npc':
          synLog('STATE-EXECUTOR', `→ update_npc | id:${output.npc_id} fields:[${Object.keys(output.mutations).join(',')}]`)
          await updateNpcMutations(output.npc_id, output.mutations)
          break
        case 'long_rest':
          synLog('STATE-EXECUTOR', '→ long_rest')
          await applyLongRest(characterId)
          break
      }
    } catch (err) {
      synLog('STATE-EXECUTOR', `✗ failed to execute ${output.action}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
}
