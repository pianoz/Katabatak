import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { SyngemIntro } from "@/components/syngem-intro"

export default async function SyngemIntroPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/")

  return <SyngemIntro userId={user.id} />
}
