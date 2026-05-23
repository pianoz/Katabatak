import type { SupabaseClient } from "@supabase/supabase-js"
import type { Effect } from "@/lib/effect-engine"
import { parseEffects } from "@/lib/schemas/skill-effect"

export interface ItemWithEffects {
  effects: Effect[]
  [key: string]: unknown
}

function withEffects<T extends Record<string, unknown>>(row: T): T & { effects: Effect[] } {
  return { ...row, effects: parseEffects(row['effects'] ?? []) }
}

export async function getAllItems(supabase: SupabaseClient) {
  const { data } = await supabase.from("items").select("*").order("name")
  return (data ?? []).map(withEffects)
}

export async function getCatalogItems(supabase: SupabaseClient, type?: string) {
  let query = supabase.from("items").select("*").order("name")
  if (type && type !== "all") query = query.eq("type", type)
  const { data } = await query
  return (data ?? []).map(withEffects)
}

export async function updateItem(supabase: SupabaseClient, itemId: string, updates: Record<string, unknown>) {
  return supabase.from("items").update(updates).eq("id", itemId).select().single()
}

export async function addItemsToInventory(
  supabase: SupabaseClient,
  rows: { character_id: string; item_id: string; condition?: number | null; quantity?: number }[]
) {
  return supabase.from("character_inventory").insert(rows)
}

export async function createItem(supabase: SupabaseClient, item: Record<string, unknown>) {
  return supabase.from("items").insert(item).select().single()
}

export async function deleteItems(supabase: SupabaseClient, ids: string[]) {
  return supabase.from("items").delete().in("id", ids)
}

export async function addItemToInventory(
  supabase: SupabaseClient,
  characterId: string,
  itemId: string,
  quantity: number,
  condition?: number | null
) {
  return supabase.from("character_inventory").insert({
    character_id: characterId,
    item_id: itemId,
    quantity,
    condition: condition ?? null,
  })
}

export async function updateInventoryItem(
  supabase: SupabaseClient,
  inventoryId: string,
  updates: { condition?: number | null; quantity?: number }
) {
  return supabase.from("character_inventory").update(updates).eq("id", inventoryId)
}

export async function removeInventoryItem(supabase: SupabaseClient, inventoryId: string) {
  return supabase.from("character_inventory").delete().eq("id", inventoryId)
}

export async function getItemById(supabase: SupabaseClient, itemId: string) {
  const { data } = await supabase.from("items").select("*").eq("id", itemId).single()
  return data ? withEffects(data) : null
}
