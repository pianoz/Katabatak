import type { SupabaseClient } from "@supabase/supabase-js"
import type { Json } from "@/components/types/supabase"
import type { Effect } from "@/lib/effect-engine"
import { parseEffects } from "@/lib/schemas/skill-effect"

/** Skill definition with parsed effects, used across the skill tree and character sheet. */
export interface Skill {
  id: string
  name: string
  skill_text?: string | null
  unlock_hint?: string | null
  unlock_key?: string | null
  is_passive?: boolean | null
  max_rank?: number | null
  min_level?: number | null
  in_development?: boolean | null
  effects: Effect[]
}

/** Directed prerequisite edge between two skills in the skill tree. */
export interface SkillEdge {
  id: string
  parent_skill_id: string | null
  child_skill_id: string | null
  edge_type?: string | null
}

/** Fetches all skill definitions and tree edges in parallel, with effects parsed. */
export async function fetchSkillTree(supabase: SupabaseClient): Promise<{ skills: Skill[]; edges: SkillEdge[] }> {
  const [skillsRes, edgesRes] = await Promise.all([
    supabase.from("skills").select("*").order("name"),
    supabase.from("skill_edges").select("*"),
  ])
  const skills: Skill[] = (skillsRes.data ?? []).map((row) => {
    const effects = parseEffects(row.effects ?? [])
    return { ...(row as Omit<Skill, "effects">), effects }
  })
  return { skills, edges: (edgesRes.data ?? []) as SkillEdge[] }
}

/** Returns the skill_id and current_rank for all skills unlocked by a character. */
export async function fetchCharacterSkillData(supabase: SupabaseClient, characterId: string) {
  const { data } = await supabase
    .from("character_skills")
    .select("skill_id, current_rank")
    .eq("character_id", characterId)
  return data ?? []
}

/**
 * Atomically applies a batch of edge upserts and deletes via the `save_skill_edges_delta` RPC.
 * Prefer this over individual inserts/deletes to keep the tree consistent.
 */
export async function saveSkillEdgesDelta(
  supabase: SupabaseClient,
  upsertEdges: { parent_skill_id: string; child_skill_id: string; edge_type?: string }[],
  deleteEdgeIds: string[]
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.rpc("save_skill_edges_delta", {
    p_delete_ids: deleteEdgeIds,
    p_upsert_edges: upsertEdges,
  })
  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function addSkill(
  supabase: SupabaseClient,
  skill: {
    name: string
    skill_text?: string | null
    unlock_hint?: string | null
    unlock_key?: string | null
    is_passive?: boolean | null
    in_development?: boolean
    max_rank?: number | null
    min_level?: number
    effects?: Effect[] | null
  }
) {
  return supabase
    .from("skills")
    .insert({
      name: skill.name,
      skill_text: skill.skill_text || null,
      unlock_hint: skill.unlock_hint || null,
      unlock_key: skill.unlock_key || null,
      is_passive: skill.is_passive || null,
      in_development: skill.in_development ?? false,
      max_rank: skill.max_rank || null,
      min_level: skill.min_level ?? 0,
      effects: (skill.effects ?? null) as Json | null,
    })
    .select()
    .single()
}

export async function updateSkill(
  supabase: SupabaseClient,
  skillId: string,
  skill: {
    name: string
    skill_text?: string | null
    unlock_hint?: string | null
    unlock_key?: string | null
    is_passive?: boolean | null
    in_development?: boolean | null
    max_rank?: number | null
    min_level?: number | null
    effects?: Effect[] | null
  }
) {
  return supabase
    .from("skills")
    .update({
      name: skill.name,
      skill_text: skill.skill_text || null,
      unlock_hint: skill.unlock_hint || null,
      unlock_key: skill.unlock_key || null,
      is_passive: skill.is_passive ?? null,
      in_development: skill.in_development ?? false,
      max_rank: skill.max_rank ?? null,
      min_level: skill.min_level ?? 0,
      effects: (skill.effects ?? null) as Json | null,
    })
    .eq("id", skillId)
}

/** Deletes a skill and all its connected edges before removing the skill row itself. */
export async function deleteSkill(supabase: SupabaseClient, skillId: string) {
  await supabase
    .from("skill_edges")
    .delete()
    .or(`parent_skill_id.eq.${skillId},child_skill_id.eq.${skillId}`)
  return supabase.from("skills").delete().eq("id", skillId)
}

export async function addSkillEdge(
  supabase: SupabaseClient,
  parentId: string,
  childId: string,
  edgeType: string
) {
  return supabase.from("skill_edges").insert({ parent_skill_id: parentId, child_skill_id: childId, edge_type: edgeType })
}

export async function deleteSkillEdge(supabase: SupabaseClient, parentId: string, childId: string) {
  return supabase.from("skill_edges").delete().eq("parent_skill_id", parentId).eq("child_skill_id", childId)
}

export async function batchSetDev(supabase: SupabaseClient, ids: string[], inDev: boolean) {
  return supabase.from("skills").update({ in_development: inDev }).in("id", ids)
}

export async function batchDeleteSkills(supabase: SupabaseClient, ids: string[]) {
  for (const id of ids) {
    await supabase
      .from("skill_edges")
      .delete()
      .or(`parent_skill_id.eq.${id},child_skill_id.eq.${id}`)
  }
  return supabase.from("skills").delete().in("id", ids)
}

export async function unlockSkill(
  supabase: SupabaseClient,
  characterId: string,
  skillId: string,
  initialRank = 1
) {
  return supabase
    .from("character_skills")
    .insert({ character_id: characterId, skill_id: skillId, current_rank: initialRank })
}

export async function updateSkillRank(
  supabase: SupabaseClient,
  characterId: string,
  skillId: string,
  newRank: number
) {
  return supabase
    .from("character_skills")
    .update({ current_rank: newRank })
    .eq("character_id", characterId)
    .eq("skill_id", skillId)
}

export async function removeCharacterSkill(
  supabase: SupabaseClient,
  characterId: string,
  skillId: string
) {
  return supabase
    .from("character_skills")
    .delete()
    .eq("character_id", characterId)
    .eq("skill_id", skillId)
}

export async function updateCharacterSkillPoints(
  supabase: SupabaseClient,
  characterId: string,
  newPoints: number
) {
  return supabase.from("characters").update({ unused_skill_points: newPoints }).eq("id", characterId)
}

/** Returns a minimal id/name list for all skills — used to populate select dropdowns. */
export async function getSkillsCatalog(supabase: SupabaseClient) {
  const { data } = await supabase.from("skills").select("id, name").order("name")
  return data ?? []
}

export async function addSpellsToCharacter(
  supabase: SupabaseClient,
  rows: { character_id: string; spell_id: number }[]
) {
  return supabase.from("character_spells").insert(rows)
}
