import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { DashboardContent } from "@/components/dashboard-content"
import { fetchIncomingFriendRequests, fetchFriends } from "@/lib/friend-logic"

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/")
  }

  // Fetch user profile to check if they're a dev
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single()

  // Get game IDs where user is an active member (player)
  const { data: memberRows } = await supabase
    .from("game_members")
    .select("game_id")
    .eq("profile_id", user.id)
    .eq("member_status", "active")

  const memberGameIds = (memberRows ?? []).map(r => r.game_id as string)

  // Fetch games where user is GM
  const { data: gmGames } = await supabase
    .from("games")
    .select("*")
    .eq("gm_id", user.id)
    .order("created_at", { ascending: false })

  // Fetch games where user is an active member (excluding games already fetched as GM)
  const gmGameIds = new Set((gmGames ?? []).map(g => g.id))
  const memberOnlyIds = memberGameIds.filter(id => !gmGameIds.has(id))

  let memberGames: typeof gmGames = []
  if (memberOnlyIds.length > 0) {
    const { data } = await supabase
      .from("games")
      .select("*")
      .in("id", memberOnlyIds)
      .order("created_at", { ascending: false })
    memberGames = data ?? []
  }

  const games = [...(gmGames ?? []), ...(memberGames ?? [])]

  // Fetch user's characters
  const { data: characters } = await supabase
    .from("characters")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  // Fetch pending game invites for this user
  const { data: inviteRows } = await supabase
    .from("game_members")
    .select("id, game_id, games(name, starting_level)")
    .eq("profile_id", user.id)
    .eq("member_status", "invited")

  const invites = (inviteRows ?? []).map((row) => ({
    id: row.id as string,
    game_id: row.game_id as string,
    game_name: (row.games as { name: string; starting_level: number } | null)?.name ?? "Unknown Game",
    starting_level: (row.games as { name: string; starting_level: number } | null)?.starting_level ?? 0,
  }))

  // Fetch pending friend requests and confirmed friends
  const [friendRequests, friends] = await Promise.all([
    fetchIncomingFriendRequests(supabase, user.id),
    fetchFriends(supabase, user.id),
  ])

  const isDev = profile?.is_dev ?? false

  return (
    <DashboardContent
      games={games ?? []}
      characters={characters ?? []}
      invites={invites}
      isDev={isDev}
      userId={user.id}
      username={profile?.username ?? "Unknown Traveler"}
      fullName={profile?.full_name ?? "New Legend"}
      friendRequests={friendRequests}
      friends={friends}
    />
  )
}