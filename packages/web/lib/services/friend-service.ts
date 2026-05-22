/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SupabaseClient } from "@supabase/supabase-js"

export interface FriendRequest {
  id: string
  friend_1: string
  requester_username: string | null
  requester_full_name: string | null
  requester_avatar_url: string | null
}

export interface Friend {
  id: string
  profile_id: string
  username: string | null
  full_name: string | null
  avatar_url: string | null
}

/**
 * Send a friend request from currentUserId to targetId.
 * Returns an error message string on failure, null on success.
 */
export async function sendFriendRequest(
  supabase: SupabaseClient,
  currentUserId: string,
  targetId: string
): Promise<string | null> {
  const { data: existing } = await (supabase as any)
    .from("friends")
    .select("id, status")
    .or(
      `and(friend_1.eq.${currentUserId},friend_2.eq.${targetId}),and(friend_1.eq.${targetId},friend_2.eq.${currentUserId})`
    )
    .maybeSingle()

  if (existing) {
    if (existing.status === "pending") return "A friend request is already pending."
    if (existing.status === "friend") return "You are already friends."
  }

  const { error } = await (supabase as any)
    .from("friends")
    .insert({ friend_1: currentUserId, friend_2: targetId, status: "pending" })

  return error ? error.message : null
}

/** Accept a friend request: sets status to 'friend'. */
export async function approveFriendRequest(supabase: SupabaseClient, requestId: string) {
  return (supabase as any).from("friends").update({ status: "friend" }).eq("id", requestId)
}

/** Decline a friend request or remove an existing friend: deletes the row. */
export async function removeFriendRow(supabase: SupabaseClient, rowId: string) {
  return (supabase as any).from("friends").delete().eq("id", rowId)
}

/**
 * Fetch pending friend requests sent TO currentUserId.
 */
export async function fetchIncomingFriendRequests(
  supabase: SupabaseClient,
  currentUserId: string
): Promise<FriendRequest[]> {
  const { data } = await (supabase as any)
    .from("friends")
    .select("id, friend_1, profiles!friends_friend_1_fkey(username, full_name, avatar_url)")
    .eq("friend_2", currentUserId)
    .eq("status", "pending")

  return (data ?? []).map((row: any) => ({
    id: row.id,
    friend_1: row.friend_1,
    requester_username: row.profiles?.username ?? null,
    requester_full_name: row.profiles?.full_name ?? null,
    requester_avatar_url: row.profiles?.avatar_url ?? null,
  }))
}

/**
 * Fetch all confirmed friends for currentUserId.
 */
export async function fetchFriends(
  supabase: SupabaseClient,
  currentUserId: string
): Promise<Friend[]> {
  const { data } = await (supabase as any)
    .from("friends")
    .select("id, friend_1, friend_2")
    .or(`friend_1.eq.${currentUserId},friend_2.eq.${currentUserId}`)
    .eq("status", "friend")

  if (!data || data.length === 0) return []

  const friendIds = data.map((row: any) =>
    row.friend_1 === currentUserId ? row.friend_2 : row.friend_1
  )

  const rowIdByFriendId = Object.fromEntries(
    data.map((row: any) => [
      row.friend_1 === currentUserId ? row.friend_2 : row.friend_1,
      row.id,
    ])
  )

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username, full_name, avatar_url")
    .in("id", friendIds)
    .order("username")

  return (profiles ?? []).map((p: any) => ({
    id: rowIdByFriendId[p.id],
    profile_id: p.id,
    username: p.username,
    full_name: p.full_name,
    avatar_url: p.avatar_url,
  }))
}
