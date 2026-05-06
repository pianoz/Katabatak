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
    // Fetch IDs of skills this character has unlocked
  const { data: unlockedSkills } = await supabase
    .from("character_skills")
    .select("skill_id")
    .eq("character_id", id)
    // Transform [{skill_id: '123'}, {skill_id: '456'}] into ['123', '456']
    const unlockedIds = unlockedSkills?.map(s => s.skill_id) || []

  return (
    <CharacterDashboard 
      character={character} 
      items={items || []} 
      isOwner={character.user_id === user.id}
    />
  )
}
