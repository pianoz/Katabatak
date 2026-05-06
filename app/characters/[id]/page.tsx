import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { CharacterDashboard } from "@/components/character-dashboard"

interface CharacterPageProps {
  params: Promise<{ id: string }>
}

export default async function CharacterPage({ params }: CharacterPageProps) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/")
  }

  // Fetch character data
  const { data: character, error: characterError } = await supabase
    .from("characters")
    .select("*")
    .eq("id", id)
    .single()

  if (characterError || !character) {
    redirect("/dashboard")
  }

  // Fetch character's items
  const { data: items } = await supabase
    .from("game_items")
    .select("*")
    .eq("character_id", id)
    .order("name")

  return (
    <CharacterDashboard 
      character={character} 
      items={items || []} 
      isOwner={character.user_id === user.id}
    />
  )
}
