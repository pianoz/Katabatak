import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { CharacterDashboard } from "@/components/character-dashboard"

interface CharacterPageProps {
  params: Promise<{ id: string }>
}

export default async function CharacterPage({ params }: CharacterPageProps) {
  const { id: characterId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/")
  }

  // 1. Fetch character data
  const { data: character, error: characterError } = await supabase
    .from("characters")
    .select("*")
    .eq("id", characterId)
    .single()

  if (characterError || !character) {
    redirect("/dashboard")
  }

  // 2. Fetch inventory items and join with base item stats
  // This gets the condition from the inventory row and the data from the items table
  const { data: inventoryData, error: inventoryError } = await supabase
    .from("character_inventory")
    .select(`
      *,
      items (*)
    `)
    .eq("character_id", characterId)

    if (inventoryError) throw inventoryError

  // 3. Flatten the inventory data
  // We transform { condition: 100, items: { name: 'Sword' } } -> { name: 'Sword', condition: 100 }
  const flattenedItems = inventoryData?.map((row) => {
  const itemDetails = Array.isArray(row.items) ? row.items[0] : row.items
  
    if (!itemDetails) return null

    return {
      ...itemDetails,     // This spreads all columns from the 'items' table
      id: row.id,         // CRITICAL: Overwrite the 'id' with the unique inventory row ID
      base_id: itemDetails.id, // Keep the original item ID under a different name if needed
      condition: row.condition,
    }
  }).filter(Boolean) || []

  // 4. Fetch Spells
  const { data: characterSpells } = await supabase
    .from("character_spells")
    .select("spell_id")
    .eq("character_id", characterId)
  
  const characterSpellIds = characterSpells?.map(s => s.spell_id) || []

  const { data: spells, error: spellsError } = await supabase
    .from("spells")
    .select("*")
    .in("id", characterSpellIds)
    .order("name")

  if (spellsError) throw spellsError

  return (
    <CharacterDashboard 
      character={character} 
      items={flattenedItems} 
      spells={spells || []}
      isOwner={character.user_id === user.id}
    />
  )
}
