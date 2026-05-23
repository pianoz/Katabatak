import type { SupabaseClient } from "@supabase/supabase-js"
import type { Effect } from "@/lib/effect-engine"
import { parseEffects } from "@/lib/schemas/skill-effect"

export interface SpellWithEffects {
  effects: Effect[]
  [key: string]: unknown
}

function withEffects<T extends Record<string, unknown>>(row: T): T & { effects: Effect[] } {
  return { ...row, effects: parseEffects(row['effects'] ?? []) }
}

export async function getAllSpells(supabase: SupabaseClient) {
  const { data } = await supabase.from("spells").select("*").order("name")
  return (data ?? []).map(withEffects)
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

export async function updateSpell(supabase: SupabaseClient, id: number, spell: Record<string, unknown>) {
  return supabase.from("spells").update(spell).eq("id", id)
}

export async function deleteSpell(supabase: SupabaseClient, id: number) {
  return supabase.from("spells").delete().eq("id", id)
}

export async function getSpellsCatalog(supabase: SupabaseClient) {
  const { data } = await supabase.from("spells").select("id, name").order("name")
  return (data ?? []) as { id: number; name: string }[]
}
