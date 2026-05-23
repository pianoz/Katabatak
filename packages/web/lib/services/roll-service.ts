import type { SupabaseClient } from "@supabase/supabase-js"

export type RollType = "attack" | "defence" | "check"

export interface RollEvent {
  character_id: string
  type: RollType
  base_roll: number
  /** Net modifier applied after the skill engine pass (base stat + sacrifice). */
  modifier: number
  total: number
  /** Extra context for the AI GM: skill name, pool, sacrifice amount, etc. */
  context?: Record<string, unknown>
}

/**
 * Persists a resolved roll event to Supabase.
 * Logs the error and returns silently on failure — a logging fault must not interrupt play.
 */
export async function logRollEvent(supabase: SupabaseClient, event: RollEvent): Promise<void> {
  const { error } = await supabase.from("roll_events").insert({
    character_id: event.character_id,
    type: event.type,
    base_roll: event.base_roll,
    modifier: event.modifier,
    total: event.total,
    context: event.context ?? {},
  })
  if (error) {
    console.error("[roll-service] Failed to persist roll event:", error.message)
  }
}

/** Reads recent roll events for a character, newest first. */
export async function getRollHistory(
  supabase: SupabaseClient,
  characterId: string,
  limit = 50
): Promise<RollEvent[]> {
  const { data } = await supabase
    .from("roll_events")
    .select("*")
    .eq("character_id", characterId)
    .order("rolled_at", { ascending: false })
    .limit(limit)
  return (data ?? []) as RollEvent[]
}
