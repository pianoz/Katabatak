import type { SupabaseClient } from "@supabase/supabase-js"
import type { Tables } from "@/components/types/supabase"

type Creature = Tables<"creatures">

/** Returns all encounter creature instances for the given game session. */
export async function getEncounterCreatures(supabase: SupabaseClient, gameId: string) {
  const { data } = await supabase.from("encounter_creatures").select("*").eq("game_id", gameId)
  return data ?? []
}

/**
 * Adds creature templates to the active encounter by copying their stat block into encounter_creatures rows.
 * Pools are initialized to their max values.
 */
export async function addCreaturesToEncounter(supabase: SupabaseClient, gameId: string, creatures: Creature[]) {
  const rows = creatures.map((c) => ({
    game_id: gameId,
    creature_id: c.id,
    name: c.name,
    level: c.level,
    attack_damage: c.attack_damage,
    attack_cost: c.attack_cost,
    defence: c.defence,
    strong_attack: c.strong_attack,
    strong_cost: c.strong_cost,
    strong_defence: c.strong_defence,
    health_max: c.health_max,
    current_health: c.health_max ?? 0,
    power_max: c.power_max,
    current_power: c.power_max ?? 0,
    will_max: c.will_max,
    current_will: c.will_max ?? 0,
    essence_max: c.essence_max,
    current_essence: c.essence_max ?? 0,
    is_alive: true,
  }))
  return supabase.from("encounter_creatures").insert(rows)
}

/** Applies partial updates to an encounter_creatures row (e.g., current_health, is_alive). */
export async function updateEncounterCreature(
  supabase: SupabaseClient,
  creatureId: string,
  updates: Record<string, unknown>
) {
  return supabase.from("encounter_creatures").update(updates).eq("id", creatureId)
}

export async function removeEncounterCreature(supabase: SupabaseClient, creatureId: string) {
  return supabase.from("encounter_creatures").delete().eq("id", creatureId)
}

/** Creates a creature template, automatically stamping the current user as `created_by`. */
export async function createCreature(supabase: SupabaseClient, payload: Record<string, unknown>) {
  const { data: { user } } = await supabase.auth.getUser()
  return supabase.from("creatures").insert({ ...payload, created_by: user?.id }).select().single()
}

export async function getCreatures(supabase: SupabaseClient) {
  const { data } = await supabase.from("creatures").select("*").order("name")
  return data ?? []
}
