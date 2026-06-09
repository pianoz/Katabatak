import supabase from './tools/db.js'
import { updateCharacter, getCharacter } from '../services/character-service.js'
import { advanceLongRestTime } from '../services/syngem-game-service.js'
import { updateNpcMutations } from '../services/world-service.js'
import { synLog, synLogVerbose } from './logger.js'
import type { Database, Json } from '@db-types'
import type { LedgerOutput, LocationContext } from './types.js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

const VALID_LOCATION_TYPES = new Set(['nation', 'region', 'place', 'location'])

async function moveCharacter(characterId: string, destinationEntityId: string, requestId?: string): Promise<void> {
  const { data: entity } = await supabase
    .from('world_entities')
    .select('id, name, type, place_context')
    .eq('id', destinationEntityId)
    .single()

  if (!entity || !VALID_LOCATION_TYPES.has(entity.type)) {
    synLog('STATE-EXECUTOR', `⚠ move_character: entity ${destinationEntityId} is not a valid location type`, undefined, requestId)
    return
  }

  // Resolve to a place-level ID: sub-place locations use their place_context
  const locationPlace =
    entity.type === 'location' ? entity.place_context
    : entity.type === 'place' ? entity.id
    : null

  await updateCharacter(characterId, { location_place: locationPlace })
}

async function updateEntity(entityId: string, mutations: Record<string, unknown>, requestId?: string): Promise<void> {
  const { data: existing } = await supabase
    .from('world_entities')
    .select('data')
    .eq('id', entityId)
    .single()

  if (!existing) {
    synLog('STATE-EXECUTOR', `⚠ update_entity: entity ${entityId} not found`, undefined, requestId)
    return
  }

  const merged = { ...(existing.data as Record<string, unknown>), ...mutations } as Json
  await supabase.from('world_entities').update({ data: merged }).eq('id', entityId)
}

/**
 * Creates a new entity. Dedup order:
 * 1. If the ID exists in world_entities → merge any new data (don't overwrite canonical entity).
 * 2. If the ID exists in improvised_entities for this character → merge data.
 * 3. Otherwise → insert into improvised_entities, backfilling location context from the character's position.
 */
async function createEntity(
  characterId: string,
  entity: Record<string, unknown>,
  locationContext?: LocationContext,
  requestId?: string,
): Promise<void> {
  const id = entity['id'] as string | undefined
  const name = entity['name'] as string | undefined
  const type = entity['type'] as string | undefined

  if (!id || !name || !type) {
    synLog('STATE-EXECUTOR', '⚠ create_entity: missing required fields (id, name, type)', entity, requestId)
    return
  }

  // 1. Check canonical world_entities
  const { data: worldEntity } = await supabase
    .from('world_entities')
    .select('id, data')
    .eq('id', id)
    .single()

  if (worldEntity) {
    if (entity['data']) {
      const merged = { ...(worldEntity.data as Record<string, unknown>), ...(entity['data'] as Record<string, unknown>) } as Json
      await supabase.from('world_entities').update({ data: merged }).eq('id', id)
      synLog('STATE-EXECUTOR', `→ create_entity: ${id} exists in world — merged data`, undefined, requestId)
    } else {
      synLog('STATE-EXECUTOR', `→ create_entity: ${id} already in world — no new data, skipping`, undefined, requestId)
    }
    return
  }

  // 2. Check improvised_entities for this character
  const { data: improvised } = await db
    .from('improvised_entities')
    .select('id, data')
    .eq('character_id', characterId)
    .eq('id', id)
    .single()

  if (improvised) {
    if (entity['data']) {
      const merged = { ...(improvised.data as Record<string, unknown>), ...(entity['data'] as Record<string, unknown>) } as Json
      await db
        .from('improvised_entities')
        .update({ data: merged })
        .eq('character_id', characterId)
        .eq('id', id)
      synLog('STATE-EXECUTOR', `→ create_entity: ${id} exists in improvised — merged data`, undefined, requestId)
    } else {
      synLog('STATE-EXECUTOR', `→ create_entity: ${id} already improvised for char — skipping`, undefined, requestId)
    }
    return
  }

  // 3. Insert new improvised entity, backfilling location context
  const parentId = (entity['parent_id'] as string | undefined) ?? locationContext?.locationPlaceId ?? null
  const nationContext = (entity['nation_context'] as string | undefined) ?? locationContext?.nationContext ?? null
  const regionContext = (entity['region_context'] as string | undefined) ?? locationContext?.regionContext ?? null
  const placeContext = (entity['place_context'] as string | undefined) ?? locationContext?.placeContext ?? null

  await db.from('improvised_entities').insert({
    id,
    character_id: characterId,
    name,
    type,
    parent_id: parentId,
    nation_context: nationContext,
    region_context: regionContext,
    place_context: placeContext,
    data: (entity['data'] ?? {}) as Json,
  })

  synLog('STATE-EXECUTOR', `✓ create_entity: inserted improvised "${name}" (${id}) parent:${parentId ?? 'none'}`, undefined, requestId)
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
 * Grants an item directly to the character's inventory.
 * Looks up an existing item template by name (case-insensitive) or creates one if absent.
 */
async function grantItem(
  characterId: string,
  itemName: string,
  itemType: string,
  description?: string,
  quantity?: number,
  requestId?: string,
): Promise<void> {
  const TRACKED_TYPES = new Set(['quest'])
  const TRACKED_RARITIES = new Set(['special', 'rare', 'epic', 'legendary'])

  // 1. Find existing item template by name
  const { data: existing } = await supabase
    .from('items')
    .select('id, rarity')
    .ilike('name', itemName)
    .limit(1)
    .maybeSingle()

  let itemId: string
  let shouldTrack = TRACKED_TYPES.has(itemType.toLowerCase())

  if (existing) {
    itemId = existing.id as string
    const rarity = (existing as { id: string; rarity: string | null }).rarity ?? ''
    if (TRACKED_RARITIES.has(rarity.toLowerCase())) shouldTrack = true
    synLog('STATE-EXECUTOR', `→ grant_item: found existing template "${itemName}" (${itemId})`, undefined, requestId)
  } else {
    // 2. Create a minimal item template
    const { data: created, error } = await supabase
      .from('items')
      .insert({
        name: itemName,
        type: itemType,
        short_description: description ?? null,
      } as unknown as Database['public']['Tables']['items']['Insert'])
      .select('id')
      .single()

    if (error || !created) {
      synLog('STATE-EXECUTOR', `⚠ grant_item: failed to create item template for "${itemName}": ${error?.message ?? 'unknown'}`, undefined, requestId)
      return
    }
    itemId = (created as { id: string }).id
    synLog('STATE-EXECUTOR', `✓ grant_item: created item template "${itemName}" (${itemId})`, undefined, requestId)
  }

  // 3. Add to character inventory
  const { error: invError } = await supabase
    .from('character_inventory')
    .insert({
      character_id: characterId,
      item_id: itemId,
      quantity: quantity ?? 1,
      condition: 100,
      is_equipped: false,
      tracked: shouldTrack,
    } as unknown as Database['public']['Tables']['character_inventory']['Insert'])

  if (invError) {
    synLog('STATE-EXECUTOR', `⚠ grant_item: failed to insert inventory row for "${itemName}": ${invError.message}`, undefined, requestId)
    return
  }

  synLog('STATE-EXECUTOR', `✓ grant_item: "${itemName}" added to inventory for char ${characterId.slice(-8)}`, undefined, requestId)
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

  if (char.condition === 'Exhausted') {
    await updateCharacter(characterId, { condition: null })
  }

  await advanceLongRestTime(characterId)
}

/**
 * Applies a batch of Ledger-produced world-state changes to the database.
 * Errors on individual actions are caught and logged; execution continues for remaining actions.
 */
export async function executeStateChanges(
  characterId: string,
  outputs: LedgerOutput[],
  locationContext?: LocationContext,
  requestId?: string,
): Promise<void> {
  for (const output of outputs) {
    try {
      synLogVerbose('STATE-EXECUTOR', '→ action:', output, requestId)
      switch (output.action) {
        case 'move_character':
          synLog('STATE-EXECUTOR', `→ move_character | dest:${output.destination_entity_id}`, undefined, requestId)
          await moveCharacter(characterId, output.destination_entity_id, requestId)
          break
        case 'update_entity':
          synLog('STATE-EXECUTOR', `→ update_entity | id:${output.entity_id} fields:[${Object.keys(output.mutations).join(',')}]`, undefined, requestId)
          await updateEntity(output.entity_id, output.mutations, requestId)
          break
        case 'create_entity':
          synLog('STATE-EXECUTOR', `→ create_entity | id:${output.entity['id']} name:"${output.entity['name']}"`, undefined, requestId)
          await createEntity(characterId, output.entity, locationContext, requestId)
          break
        case 'delete_entity':
          synLog('STATE-EXECUTOR', `→ delete_entity | id:${output.entity_id}`, undefined, requestId)
          await deleteEntity(characterId, output.entity_id, output.replacement_description)
          break
        case 'update_npc':
          synLog('STATE-EXECUTOR', `→ update_npc | id:${output.npc_id} fields:[${Object.keys(output.mutations).join(',')}]`, undefined, requestId)
          await updateNpcMutations(output.npc_id, output.mutations)
          break
        case 'long_rest':
          synLog('STATE-EXECUTOR', '→ long_rest', undefined, requestId)
          await applyLongRest(characterId)
          break
        case 'grant_item':
          synLog('STATE-EXECUTOR', `→ grant_item | name:"${output.item_name}" type:${output.item_type}`, undefined, requestId)
          await grantItem(characterId, output.item_name, output.item_type, output.description, output.quantity, requestId)
          break
      }
    } catch (err) {
      synLog('STATE-EXECUTOR', `✗ failed to execute ${output.action}: ${err instanceof Error ? err.message : String(err)}`, undefined, requestId)
    }
  }
}
