import type { SupabaseClient } from "@supabase/supabase-js"
import type { Json } from "@/components/types/supabase"
import type { Effect } from "@/lib/effect-engine"
import { parseEffects } from "@/lib/schemas/skill-effect"

/** Named contextual combat action with parsed effects and an optional cooldown. */
export interface ActiveSkill {
  id: string
  name: string
  description: string | null
  cooldown: number | null
  effects: Effect[]
}

function withEffects<T extends Record<string, unknown>>(row: T): T & { effects: Effect[] } {
  return { ...row, effects: parseEffects(row["effects"] ?? []) }
}

/** Returns all active skill definitions ordered by name, with effects parsed. */
export async function getAllActiveSkills(supabase: SupabaseClient) {
  const { data } = await supabase.from("active_skills").select("*").order("name")
  return (data ?? []).map(withEffects)
}

export async function getActiveSkillById(supabase: SupabaseClient, id: string) {
  const { data } = await supabase.from("active_skills").select("*").eq("id", id).single()
  return data ? withEffects(data as Record<string, unknown>) : null
}

export async function createActiveSkill(
  supabase: SupabaseClient,
  skill: { name: string; description?: string | null; cooldown?: number | null; effects?: Effect[] | null }
) {
  return supabase
    .from("active_skills")
    .insert({
      name: skill.name,
      description: skill.description ?? null,
      cooldown: skill.cooldown ?? null,
      effects: (skill.effects ?? []) as unknown as Json,
    })
    .select()
    .single()
}

export async function updateActiveSkill(
  supabase: SupabaseClient,
  id: string,
  skill: { name: string; description?: string | null; cooldown?: number | null; effects?: Effect[] | null }
) {
  return supabase
    .from("active_skills")
    .update({
      name: skill.name,
      description: skill.description ?? null,
      cooldown: skill.cooldown ?? null,
      effects: (skill.effects ?? []) as unknown as Json,
    })
    .eq("id", id)
}

export async function deleteActiveSkill(supabase: SupabaseClient, id: string) {
  return supabase.from("active_skills").delete().eq("id", id)
}

/** Returns a minimal id/name list for all active skills — used to populate select dropdowns. */
export async function getActiveSkillsCatalog(supabase: SupabaseClient) {
  const { data } = await supabase.from("active_skills").select("id, name").order("name")
  return (data ?? []) as { id: string; name: string }[]
}

export async function getCharacterActiveSkills(supabase: SupabaseClient, characterId: string) {
  const { data } = await supabase
    .from("character_active_skills")
    .select("active_skill_id, active_skills(*)")
    .eq("character_id", characterId)
  return (data ?? [])
    .map((row) => {
      const skill = Array.isArray(row.active_skills) ? row.active_skills[0] : row.active_skills
      return skill ? withEffects(skill as Record<string, unknown>) : null
    })
    .filter((s) => s !== null) as unknown as ActiveSkill[]
}

export async function addActiveSkillToCharacter(
  supabase: SupabaseClient,
  characterId: string,
  activeSkillId: string
) {
  return supabase
    .from("character_active_skills")
    .insert({ character_id: characterId, active_skill_id: activeSkillId })
}

export async function removeActiveSkillFromCharacter(
  supabase: SupabaseClient,
  characterId: string,
  activeSkillId: string
) {
  return supabase
    .from("character_active_skills")
    .delete()
    .eq("character_id", characterId)
    .eq("active_skill_id", activeSkillId)
}
