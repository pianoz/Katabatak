import supabase from '../gm/tools/db.js'
import type { Json } from '@db-types'
import { synLog } from '../gm/logger.js'

interface QuestItemGrant {
  item_id: string
  quantity: number
  condition: number
}

interface NpcTemplate {
  name: string
  title: string | null
  faction: string | null
  disposition_to_players: number
  personality_profile: unknown
}

interface QuestStartGrants {
  items?: QuestItemGrant[]
  npcs?: NpcTemplate[]
}

interface QuestCompletionGrants {
  skill_points?: number
  denarius?: number
  items?: QuestItemGrant[]
}

export interface QuestObjective {
  id: string
  title: string
  status: string
  description: string
  current_stage?: string
  grants_applied?: string[]
}

/** Loads a quest template from DB. Returns null if not found. */
async function getQuestTemplate(questId: string) {
  const { data } = await supabase
    .from('quest_templates')
    .select('*')
    .eq('id', questId)
    .single()
  return data ?? null
}

/** Grants items to a character's inventory, handling quantity correctly. */
async function grantItemsToCharacter(characterId: string, items: QuestItemGrant[]): Promise<void> {
  if (!items.length) return
  const rows = items.map((item) => ({
    character_id: characterId,
    item_id: item.item_id,
    condition: item.condition,
    quantity: item.quantity,
    is_equipped: false,
  }))
  const { error } = await supabase.from('character_inventory').insert(rows)
  if (error) synLog('QUEST-ENGINE', `✗ item grant failed: ${error.message}`)
}

/**
 * Creates an NPC from a template, tied to the character as a follower.
 * game_id is nullable after the migration — companion NPCs live outside any game.
 */
async function createNpcFromTemplate(
  template: NpcTemplate,
  characterId: string,
  locationId: string | null,
): Promise<void> {
  const { error } = await supabase.from('npcs').insert({
    name: template.name,
    title: template.title,
    faction: template.faction,
    disposition_to_players: template.disposition_to_players,
    personality_profile: template.personality_profile as unknown as Json,
    following_character_id: characterId,
    current_location_id: locationId ?? 'loc_karkill',
    is_alive: true,
    game_id: null,
  })
  if (error) synLog('QUEST-ENGINE', `✗ NPC create failed (${template.name}): ${error.message}`)
}

/**
 * Applies quest start grants: items and companion NPCs.
 * Idempotent — checks grants_applied on the quest objective before firing.
 * Called during character creation for the initial quest.
 */
export async function applyQuestStartGrants(characterId: string, questId: string): Promise<void> {
  synLog('QUEST-ENGINE', `→ start grants | quest:${questId} char:${characterId.slice(-8)}`)

  const template = await getQuestTemplate(questId)
  if (!template) {
    synLog('QUEST-ENGINE', `✗ quest template not found: ${questId}`)
    return
  }

  // Check idempotency: has 'start' already been applied?
  const { data: charData } = await supabase
    .from('characters')
    .select('quest_objectives, location_place')
    .eq('id', characterId)
    .single()

  const objectives = (charData?.quest_objectives as QuestObjective[] | null) ?? []
  const quest = objectives.find((q) => q.id === questId)
  if (quest?.grants_applied?.includes('start')) {
    synLog('QUEST-ENGINE', `⚠ start grants already applied for ${questId}`)
    return
  }

  const startGrants = template.start_grants as QuestStartGrants | null
  const locationId = charData?.location_place ?? null

  await Promise.all([
    grantItemsToCharacter(characterId, startGrants?.items ?? []),
    ...(startGrants?.npcs ?? []).map((npc) =>
      createNpcFromTemplate(npc, characterId, locationId),
    ),
  ])

  // Mark start grants applied in quest_objectives
  const updatedObjectives = objectives.map((q) =>
    q.id === questId
      ? { ...q, grants_applied: [...(q.grants_applied ?? []), 'start'] }
      : q,
  )
  await supabase
    .from('characters')
    .update({ quest_objectives: updatedObjectives as unknown as Json })
    .eq('id', characterId)

  synLog('QUEST-ENGINE', `✓ start grants applied | quest:${questId} items:${startGrants?.items?.length ?? 0} npcs:${startGrants?.npcs?.length ?? 0}`)
}

/**
 * Applies quest completion grants: skill points, denarius, and bonus items.
 * Idempotent — checks grants_applied before firing.
 * Called by the handler after the Scribe marks a quest completed.
 */
export async function applyQuestCompletionGrants(characterId: string, questId: string): Promise<void> {
  synLog('QUEST-ENGINE', `→ completion grants | quest:${questId} char:${characterId.slice(-8)}`)

  const template = await getQuestTemplate(questId)
  if (!template) {
    synLog('QUEST-ENGINE', `✗ quest template not found: ${questId}`)
    return
  }

  const { data: charData } = await supabase
    .from('characters')
    .select('quest_objectives, denarius, unused_skill_points')
    .eq('id', characterId)
    .single()

  const objectives = (charData?.quest_objectives as QuestObjective[] | null) ?? []
  const quest = objectives.find((q) => q.id === questId)
  if (quest?.grants_applied?.includes('completion')) {
    synLog('QUEST-ENGINE', `⚠ completion grants already applied for ${questId}`)
    return
  }

  const grants = template.completion_grants as QuestCompletionGrants | null
  const skillPoints = grants?.skill_points ?? 0
  const denarius = grants?.denarius ?? 0
  const items = grants?.items ?? []

  const currentDenarius = charData?.denarius ?? 0
  const currentSkillPoints = charData?.unused_skill_points ?? 0

  await Promise.all([
    grantItemsToCharacter(characterId, items),
    supabase
      .from('characters')
      .update({
        denarius: currentDenarius + denarius,
        unused_skill_points: currentSkillPoints + skillPoints,
      })
      .eq('id', characterId),
  ])

  // Mark completion grants applied
  const updatedObjectives = objectives.map((q) =>
    q.id === questId
      ? { ...q, grants_applied: [...(q.grants_applied ?? []), 'completion'] }
      : q,
  )
  await supabase
    .from('characters')
    .update({ quest_objectives: updatedObjectives as unknown as Json })
    .eq('id', characterId)

  synLog('QUEST-ENGINE', `✓ completion grants applied | quest:${questId} sp:${skillPoints} dn:${denarius} items:${items.length}`)
}
