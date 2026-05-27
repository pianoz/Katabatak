import type { SupabaseClient } from "@supabase/supabase-js"
import type { Effect } from "@/lib/effect-engine"
import type { ActionSkill } from "@/features/characters/components/actions/action-skill-modal"

type PoolKey = "current_essence" | "current_power" | "current_will" | "current_health"

const STARTING_ITEM_IDS = [
  "f761376b-f5aa-4834-abdb-1f7e0acc1c29",
  "8200bd07-931c-433f-a92e-69472d213350",
]

/**
 * Inserts a new character row and seeds it with the default starting inventory items.
 * Returns the new character's ID, or null on failure.
 */
export async function createCharacterWithItems(
  supabase: SupabaseClient,
  payload: Record<string, unknown>
): Promise<{ id: string } | null> {
  const { data, error } = await supabase.from("characters").insert(payload).select().single()
  if (error || !data) return null
  const charId = (data as { id: string }).id
  await supabase.from("character_inventory").insert(
    STARTING_ITEM_IDS.map((item_id) => ({ character_id: charId, item_id, condition: 100 }))
  )
  return { id: charId }
}

/** Sets the character_id on a game_members invite row and marks it active. */
export async function linkCharacterToInvite(
  supabase: SupabaseClient,
  inviteMemberId: string,
  characterId: string
) {
  return supabase
    .from("game_members")
    .update({ character_id: characterId, member_status: "active" })
    .eq("id", inviteMemberId)
}

/** Returns all characters owned by the user, ordered newest-first. */
export async function getUserCharacters(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase
    .from("characters")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
  return data ?? []
}

/**
 * Fetches a character with all related data (inventory, spells, skills, action skills) in parallel.
 * Flattens the inventory join into a single-object array and resolves spell details by ID.
 * Returns null if the character is not found.
 */
export async function getFullCharacter(supabase: SupabaseClient, characterId: string) {
  const [
    { data: character, error: characterError },
    { data: inventoryData, error: inventoryError },
    { data: characterSpells },
    { data: characterSkills },
    { data: characterActionSkills },
  ] = await Promise.all([
    supabase.from("characters").select("*").eq("id", characterId).single(),
    supabase.from("character_inventory").select("*, items(*)").eq("character_id", characterId),
    supabase.from("character_spells").select("spell_id").eq("character_id", characterId),
    supabase.from("character_skills").select("current_rank, skills(effects)").eq("character_id", characterId),
    supabase
      .from("character_action_skills")
      .select("action_skill_id, action_skills(*)")
      .eq("character_id", characterId),
  ])

  if (characterError || !character) return null
  if (inventoryError) throw inventoryError

  const flattenedItems = (inventoryData ?? [])
    .map((row) => {
      const itemDetails = Array.isArray(row.items) ? row.items[0] : row.items
      if (!itemDetails) return null
      return { ...itemDetails, id: row.id, base_id: itemDetails.id, condition: row.condition, is_equipped: (row.is_equipped as boolean) ?? false }
    })
    .filter(Boolean)

  const spellIds = (characterSpells ?? [])
    .map((s) => s.spell_id)
    .filter((id): id is number => id !== null)

  const spells =
    spellIds.length > 0
      ? ((await supabase.from("spells").select("*").in("id", spellIds).order("name")).data ?? [])
      : []

  const activeSkills: Array<{ effects: Effect[]; current_rank: number }> = []
  for (const cs of characterSkills ?? []) {
    const skill = Array.isArray(cs.skills) ? cs.skills[0] : cs.skills
    if (skill && Array.isArray(skill.effects)) {
      activeSkills.push({
        current_rank: cs.current_rank ?? 1,
        effects: skill.effects as unknown as Effect[],
      })
    }
  }

  const actionSkills: ActionSkill[] = (characterActionSkills ?? [])
    .map((row) => (Array.isArray(row.action_skills) ? row.action_skills[0] : row.action_skills))
    .filter((s): s is ActionSkill => s !== null && s !== undefined)

  return {
    character,
    flattenedItems,
    spells,
    activeSkills,
    actionSkills,
    level: characterSkills?.length ?? 0,
  }
}

/** Sets a single pool field (current_health, current_essence, etc.) to an absolute value. */
export async function updateCharacterPool(
  supabase: SupabaseClient,
  characterId: string,
  pool: PoolKey,
  newValue: number
) {
  return supabase
    .from("characters")
    .update({ [pool]: newValue } as Record<string, number>)
    .eq("id", characterId)
}

/** Sets the character's denarius (currency) to an absolute value. */
export async function updateCharacterMoney(
  supabase: SupabaseClient,
  characterId: string,
  newValue: number
) {
  return supabase.from("characters").update({ denarius: newValue }).eq("id", characterId)
}

export async function updateCharacterNotes(
  supabase: SupabaseClient,
  characterId: string,
  notes: string
) {
  return supabase.from("characters").update({ notes }).eq("id", characterId)
}

/** Fetches the latest character row from the DB. Useful for syncing after server-side mutations. */
export async function refreshCharacter(supabase: SupabaseClient, characterId: string) {
  const { data } = await supabase.from("characters").select("*").eq("id", characterId).single()
  return data
}

/** Sets a pool max (health_max, power_max, etc.) to an absolute value. */
export async function updateCharacterStat(
  supabase: SupabaseClient,
  characterId: string,
  stat: "health_max" | "power_max" | "will_max" | "essence_max",
  newValue: number
) {
  return supabase
    .from("characters")
    .update({ [stat]: newValue } as unknown as { health_max?: number })
    .eq("id", characterId)
}

export async function deleteCharacter(supabase: SupabaseClient, characterId: string) {
  return supabase.from("characters").delete().eq("id", characterId)
}

export async function updateCharacter(supabase: SupabaseClient, characterId: string, updates: Record<string, unknown>) {
  return supabase.from("characters").update(updates as never).eq("id", characterId)
}

export async function getAllCharacters(supabase: SupabaseClient) {
  const { data } = await supabase
    .from("characters")
    .select("id, name, level, class_archetype")
    .order("name")
  return data ?? []
}

export async function getCharacterSkillPoints(supabase: SupabaseClient, characterId: string) {
  const { data } = await supabase
    .from("characters")
    .select("unused_skill_points")
    .eq("id", characterId)
    .single()
  return data?.unused_skill_points ?? 0
}

/** Increments a pool max by 1. Fetches the current value first to compute the new one. */
export async function incrementCharacterStat(
  supabase: SupabaseClient,
  characterId: string,
  stat: "health_max" | "power_max" | "will_max" | "essence_max"
) {
  const { data, error: fetchError } = await supabase.from("characters").select(stat).eq("id", characterId).single()
  if (fetchError) return { error: fetchError }
  const current = ((data as Record<string, unknown>)?.[stat] as number) ?? 0
  return supabase.from("characters").update({ [stat]: current + 1 } as unknown as { health_max?: number }).eq("id", characterId)
}
