import type { SupabaseClient } from "@supabase/supabase-js"

export async function getProfile(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase.from("profiles").select("*").eq("id", userId).single()
  return data
}

export async function updateProfile(supabase: SupabaseClient, userId: string, updates: Record<string, unknown>) {
  return supabase.from("profiles").update(updates).eq("id", userId)
}

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
