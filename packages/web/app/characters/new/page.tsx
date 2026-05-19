import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { CharacterCreation } from "@/components/character-creation"

interface PageProps {
  searchParams: Promise<{ inviteMemberId?: string; startingLevel?: string }>
}

export default async function NewCharacterPage({ searchParams }: PageProps) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/")
  }

  const params = await searchParams
  const inviteMemberId = params.inviteMemberId
  const startingLevel = params.startingLevel ? parseInt(params.startingLevel, 10) : undefined

  return (
    <CharacterCreation
      userId={user.id}
      inviteMemberId={inviteMemberId}
      startingLevel={startingLevel}
    />
  )
}
