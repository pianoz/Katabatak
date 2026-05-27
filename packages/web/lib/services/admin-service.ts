import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Toggles the `is_dev` flag on a user profile via the `set_user_dev_status` RPC.
 * Requires the caller to have admin/service-role privileges; enforced server-side.
 */
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
