import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { CharacterCreation } from "@/components/character-creation"

export default async function NewCharacterPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/")
  }

  return <CharacterCreation userId={user.id} />
}
