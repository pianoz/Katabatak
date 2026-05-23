import type { SupabaseClient } from "@supabase/supabase-js"

export interface MemberRow {
  profile_id: string
  member_status: string
}

/** Returns true if the profile can receive a new invite (not currently active or pending). */
export function canInviteProfile(profileId: string, members: MemberRow[]): boolean {
  const existing = members.find((m) => m.profile_id === profileId)
  if (!existing) return true
  return existing.member_status !== "active" && existing.member_status !== "invited"
}

/**
 * Upserts a game invite row. Uses ON CONFLICT on (game_id, profile_id) so that
 * re-inviting a declined or kicked player resets their status to 'invited'.
 */
export async function invitePlayer(
  supabase: SupabaseClient,
  gameId: string,
  profileId: string
) {
  return supabase.from("game_members").upsert(
    {
      game_id: gameId,
      profile_id: profileId,
      character_id: null,
      role: "player",
      member_status: "invited",
    },
    { onConflict: "game_id,profile_id" }
  )
}

/** Accepts an invite: links the character and marks membership active. */
export async function acceptInvite(
  supabase: SupabaseClient,
  inviteId: string,
  characterId: string,
  currentSkillPoints: number,
  startingLevel: number
) {
  return Promise.all([
    supabase
      .from("game_members")
      .update({ character_id: characterId, member_status: "active" })
      .eq("id", inviteId),
    supabase
      .from("characters")
      .update({ in_game: true, unused_skill_points: currentSkillPoints + startingLevel })
      .eq("id", characterId),
  ])
}

/**
 * Declines an invite by deleting the row entirely.
 */
export async function declineInvite(supabase: SupabaseClient, inviteId: string) {
  return supabase.from("game_members").delete().eq("id", inviteId)
}

/**
 * Kicks a player: deletes their game_members row and marks their character not in game.
 */
export async function kickPlayer(supabase: SupabaseClient, gameId: string, characterId: string) {
  // Update character first so the GM→character relationship still exists in game_members
  // when the RLS USING check runs, then remove the membership.
  await supabase.from("characters").update({ in_game: false }).eq("id", characterId)
  return supabase
    .from("game_members")
    .delete()
    .eq("game_id", gameId)
    .eq("character_id", characterId)
}
