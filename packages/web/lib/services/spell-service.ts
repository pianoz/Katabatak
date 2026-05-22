import type { SupabaseClient } from "@supabase/supabase-js"

export async function getAllSpells(supabase: SupabaseClient) {
  const { data } = await supabase.from("spells").select("*").order("name")
  return data ?? []
}

export async function createSpell(supabase: SupabaseClient, spell: Record<string, unknown>) {
  return supabase.from("spells").insert(spell).select().single()
}

export async function addSpellToCharacter(supabase: SupabaseClient, characterId: string, spellId: number) {
  return supabase.from("character_spells").insert({ character_id: characterId, spell_id: spellId })
}

export async function removeCharacterSpell(supabase: SupabaseClient, characterId: string, spellId: number) {
  return supabase
    .from("character_spells")
    .delete()
    .eq("character_id", characterId)
    .eq("spell_id", spellId)
}

export async function getSpellById(supabase: SupabaseClient, spellId: number) {
  const { data } = await supabase.from("spells").select("name").eq("id", spellId).single()
  return data
}
