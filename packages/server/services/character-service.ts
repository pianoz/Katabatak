import type { Database } from '@db-types'
import supabase from '../gm/tools/db.js'

export type CharacterRow = Database['public']['Tables']['characters']['Row']
type CharacterUpdate = Database['public']['Tables']['characters']['Update']

/** Inventory row joined with the item template's name and type. */
export interface InventoryItem {
  id: string
  item_id: string | null
  is_equipped: boolean | null
  tracked: boolean | null
  condition: number | null
  quantity: number | null
  items: { name: string; type: string | null } | null
}

/** Character skill join row with the skill name and current rank. */
export interface CharacterSkill {
  skill_id: string
  current_rank: number | null
  skills: { name: string } | null
}

/** Character spell join row with the spell name and damage value. */
export interface CharacterSpell {
  id: string
  spell_id: number | null
  spells: { name: string; damage: number | null } | null
}

/** Full character state including inventory, skills, spells, and action skill IDs. */
export interface FullCharacter {
  character: CharacterRow
  inventory: InventoryItem[]
  skills: CharacterSkill[]
  spells: CharacterSpell[]
  actionSkillIds: string[]
}

/** Returns the character row for the given ID, or null if not found. */
export async function getCharacter(id: string): Promise<CharacterRow | null> {
  const { data, error } = await supabase
    .from('characters')
    .select('*')
    .eq('id', id)
    .single()
  if (error) return null
  return data
}

/** Fetches a character with all associated inventory, skills, spells, and action skill IDs in parallel. */
export async function getFullCharacter(id: string): Promise<FullCharacter | null> {
  const [charResult, inventoryResult, skillsResult, spellsResult, actionSkillsResult] =
    await Promise.all([
      supabase.from('characters').select('*').eq('id', id).single(),
      supabase
        .from('character_inventory')
        .select('id, item_id, is_equipped, tracked, condition, quantity, items(name, type)')
        .eq('character_id', id),
      supabase
        .from('character_skills')
        .select('skill_id, current_rank, skills(name)')
        .eq('character_id', id),
      supabase
        .from('character_spells')
        .select('id, spell_id, spells(name, damage)')
        .eq('character_id', id),
      supabase.from('character_action_skills').select('action_skill_id').eq('character_id', id),
    ])

  if (charResult.error || !charResult.data) return null

  return {
    character: charResult.data,
    inventory: (inventoryResult.data ?? []) as unknown as InventoryItem[],
    skills: (skillsResult.data ?? []) as unknown as CharacterSkill[],
    spells: (spellsResult.data ?? []) as unknown as CharacterSpell[],
    actionSkillIds: (actionSkillsResult.data ?? []).map((r) => r.action_skill_id),
  }
}

/** Returns true if the character's user_id matches the given userId. Used for ownership checks before pipeline entry. */
export async function characterBelongsToUser(
  characterId: string,
  userId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('characters')
    .select('id')
    .eq('id', characterId)
    .eq('user_id', userId)
    .single()
  return !error && !!data
}

/** Applies partial updates to a character row. Returns the Supabase error message or null on success. */
export async function updateCharacter(
  id: string,
  updates: CharacterUpdate,
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('characters').update(updates).eq('id', id)
  return { error: error?.message ?? null }
}
