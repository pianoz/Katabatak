import type { SupabaseClient } from "@supabase/supabase-js"

/** Returns the full profile row for the given user, or null if not found. */
export async function getProfile(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase.from("profiles").select("*").eq("id", userId).single()
  return data
}

/** Applies partial updates to a user's profile row. */
export async function updateProfile(supabase: SupabaseClient, userId: string, updates: Record<string, unknown>) {
  return supabase.from("profiles").update(updates).eq("id", userId)
}

/**
 * Searches profiles by username (case-insensitive partial match), excluding the given user.
 * Capped at 20 results — used for friend-search and invite flows.
 */
export async function searchProfiles(
  supabase: SupabaseClient,
  query: string,
  excludeId: string
) {
  const { data } = await supabase
    .from("profiles")
    .select("id, username, full_name")
    .ilike("username", `%${query}%`)
    .neq("id", excludeId)
    .limit(20)
  return data ?? []
}
