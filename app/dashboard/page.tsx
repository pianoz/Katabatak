import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { DashboardContent } from "@/components/dashboard-content"

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

  // Fetch games - both as player and as DM
  const { data: games } = await supabase
    .from("games")
    .select("*")
    .order("created_at", { ascending: false })

  // Fetch user's characters
  const { data: characters } = await supabase
    .from("characters")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  const isDev = profile?.is_dev ?? false

  return (
    <DashboardContent 
      games={games ?? []} 
      characters={characters ?? []} 
      isDev={isDev}
      userId={user.id}
      username={profile?.username ?? "Unknown Traveler"}
      fullName={profile?.full_name ?? "New Legend"}
    />
  )
}