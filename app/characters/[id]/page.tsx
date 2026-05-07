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
  // 1. Fetch the bridge table entries
  const { data: inventoryData, error: inventoryError } = await supabase
    .from("character_inventory")
    .select("item_id")
    .eq("character_id", id);

  if (inventoryError) throw inventoryError;

  // 2. Extract the IDs into a flat array: [1, 2, 3]
  const itemIds = inventoryData?.map(row => row.item_id) || [];

  // 3. Fetch the actual item details using the 'in' filter
  const { data: items, error: itemsError } = await supabase
    .from("items")
    .select("*")
    .in("id", itemIds) // 'id' should be the primary key column in your 'items' table
    .order("name");

    if (itemsError) throw itemsError;

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
