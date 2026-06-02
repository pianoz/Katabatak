import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { CharacterDashboard } from "@/features/characters/components/character-dashboard"
import { getProfile } from "@/lib/services/profile-service"
import { getFullCharacter } from "@/lib/services/character-service"

interface CharacterPageProps {
  params: Promise<{ id: string }>
}

export default async function CharacterPage({ params }: CharacterPageProps) {
  const { id: characterId } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/")
  }

  const [profile, characterData] = await Promise.all([
    getProfile(supabase, user.id),
    getFullCharacter(supabase, characterId),
  ])

  if (!characterData) {
    redirect("/dashboard")
  }

  const { character, flattenedItems, spells, activeSkills, actionSkills, level } = characterData

  const isSyngemCharacter = character.syngem_game === true

  let showWelcomePopup = false
  if (isSyngemCharacter) {
    const { count } = await supabase
      .from("characters")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("syngem_game", true)
    showWelcomePopup = count === 1
  }

  return (
    <CharacterDashboard
      character={character}
      items={flattenedItems as Parameters<typeof CharacterDashboard>[0]["items"]}
      spells={spells}
      isOwner={character.user_id === user.id}
      activeSkills={activeSkills}
      isDev={profile?.is_dev ?? false}
      level={level}
      actionSkills={actionSkills}
      variant={isSyngemCharacter ? "syngem" : "irl"}
      showWelcomePopup={showWelcomePopup}
    />
  )
}
