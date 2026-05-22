import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { DashboardContent } from "@/components/dashboard-content"
import { getProfile } from "@/lib/services/profile-service"
import { getDashboardGames, getGameInvites } from "@/lib/services/game-service"
import { getUserCharacters } from "@/lib/services/character-service"
import { fetchIncomingFriendRequests, fetchFriends } from "@/lib/services/friend-service"

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/")
  }

  const [profile, games, invites, characters, friendRequests, friends] = await Promise.all([
    getProfile(supabase, user.id),
    getDashboardGames(supabase, user.id),
    getGameInvites(supabase, user.id),
    getUserCharacters(supabase, user.id),
    fetchIncomingFriendRequests(supabase, user.id),
    fetchFriends(supabase, user.id),
  ])

  return (
    <DashboardContent
      games={games}
      characters={characters}
      invites={invites}
      isDev={profile?.is_dev ?? false}
      userId={user.id}
      username={profile?.username ?? "Unknown Traveler"}
      fullName={profile?.full_name ?? "New Legend"}
      friendRequests={friendRequests}
      friends={friends}
    />
  )
}
