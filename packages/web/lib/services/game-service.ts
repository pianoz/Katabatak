import type { SupabaseClient } from "@supabase/supabase-js"

export async function getDashboardGames(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase
    .from("games")
    .select("*")
    .eq("gm_id", userId)
    .order("created_at", { ascending: false })
  return data ?? []
}

export async function getGameInvites(supabase: SupabaseClient, userId: string) {
  const { data: inviteRows } = await supabase
    .from("game_members")
    .select("id, game_id, games(name, starting_level)")
    .eq("profile_id", userId)
    .eq("member_status", "invited")

  return (inviteRows ?? []).map((row) => {
    const game = row.games as unknown as { name: string; starting_level: number } | null
    return {
      id: row.id as string,
      game_id: row.game_id as string,
      game_name: game?.name ?? "Unknown Game",
      starting_level: game?.starting_level ?? 0,
    }
  })
}

export async function getGameWithMembers(supabase: SupabaseClient, gameId: string) {
  const [{ data: game }, { data: members }] = await Promise.all([
    supabase.from("games").select("*").eq("id", gameId).single(),
    supabase.from("game_members").select("profile_id, member_status, characters(*)").eq("game_id", gameId),
  ])
  return { game, members }
}

export async function archiveGame(supabase: SupabaseClient, gameId: string) {
  return supabase.from("games").update({ archived: true }).eq("id", gameId)
}

export async function deleteGame(supabase: SupabaseClient, gameId: string) {
  return supabase.from("games").delete().eq("id", gameId)
}

export async function getGameMemberProfileId(
  supabase: SupabaseClient,
  gameId: string,
  characterId: string
) {
  const { data } = await supabase
    .from("game_members")
    .select("profile_id")
    .eq("game_id", gameId)
    .eq("character_id", characterId)
    .single()
  return data?.profile_id
}

export async function getFriendProfiles(supabase: SupabaseClient, userId: string) {
  const { data: friendRows } = await (supabase as any)
    .from("friends")
    .select("friend_1, friend_2")
    .or(`friend_1.eq.${userId},friend_2.eq.${userId}`)
    .eq("status", "friend")

  const friendIds = (friendRows ?? []).map((row: { friend_1: string; friend_2: string }) =>
    row.friend_1 === userId ? row.friend_2 : row.friend_1
  )

  if (friendIds.length === 0) return []

  const { data } = await supabase
    .from("profiles")
    .select("id, username")
    .in("id", friendIds)
    .order("username")

  return (data ?? []).filter(
    (p): p is { id: string; username: string } => p.username !== null
  )
}

export async function getCharacterActiveGameId(supabase: SupabaseClient, characterId: string) {
  const { data } = await supabase
    .from("game_members")
    .select("game_id")
    .eq("character_id", characterId)
    .eq("member_status", "active")
    .single()
  return data?.game_id ?? null
}

export async function getGameAllyCharacters(
  supabase: SupabaseClient,
  gameId: string,
  excludeCharacterId: string
): Promise<{ id: string; name: string }[]> {
  const { data: members } = await supabase
    .from("game_members")
    .select("character_id, characters(id, name)")
    .eq("game_id", gameId)
    .eq("member_status", "active")
    .neq("character_id", excludeCharacterId)

  return (members ?? [])
    .filter((m) => m.character_id && m.characters)
    .map((m) => {
      const char = Array.isArray(m.characters) ? m.characters[0] : m.characters
      return char ? { id: char.id as string, name: char.name as string } : null
    })
    .filter((x): x is { id: string; name: string } => x !== null)
}
