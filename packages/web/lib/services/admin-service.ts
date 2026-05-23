import type { SupabaseClient } from "@supabase/supabase-js"

export async function setUserDevStatus(
  supabase: SupabaseClient,
  targetUserId: string,
  isDev: boolean
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.rpc("set_user_dev_status", {
    target_user_id: targetUserId,
    dev_status: isDev,
  })
  return { success: !error, error: error?.message }
}
