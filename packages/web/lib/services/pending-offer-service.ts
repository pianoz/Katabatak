"use client"

import { createClient } from "@/lib/supabase/client"
import type { Database } from "@/components/types/supabase"
import type { SupabaseClient } from "@supabase/supabase-js"

type OfferType = Database["public"]["Enums"]["offer_type"]

export async function getPendingOffersByCharacter(supabase: SupabaseClient, characterId: string) {
  const { data } = await supabase.from("pending_offers").select("*").eq("character_id", characterId)
  return data ?? []
}

export async function stagePendingOffer(
  gameId: string,
  characterId: string,
  type: OfferType,
  sourceId: string | null,
  quantity: number,
  condition?: number | null,
  giverInventoryId?: string | null
): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from("pending_offers").insert({
    game_id: gameId,
    character_id: characterId,
    type,
    source_id: sourceId,
    quantity,
    condition: condition ?? null,
    giver_inventory_id: giverInventoryId ?? null,
  })
  if (error) throw new Error(error.message)
}

export async function resolvePendingOffer(offerId: string, accept: boolean): Promise<void> {
  const supabase = createClient()

  if (!accept) {
    const { error } = await supabase.from("pending_offers").delete().eq("id", offerId)
    if (error) throw new Error(error.message)
    return
  }

  const { data: offer, error: fetchError } = await supabase
    .from("pending_offers")
    .select("*")
    .eq("id", offerId)
    .single()

  if (fetchError || !offer) throw new Error(fetchError?.message ?? "Offer not found")

  switch (offer.type) {
    case "item":
      if (!offer.source_id) throw new Error("Item offer missing source_id")
      await supabase.from("character_inventory").insert({
        character_id: offer.character_id,
        item_id: offer.source_id,
        quantity: offer.quantity ?? 1,
        condition: offer.condition ?? null,
      })
      // For peer transfers: delete the giver's inventory entry before removing the
      // offer row (the RLS policy on character_inventory checks pending_offers).
      if (offer.giver_inventory_id) {
        await supabase.from("character_inventory").delete().eq("id", offer.giver_inventory_id)
      }
      break

    case "spell":
      if (!offer.source_id) throw new Error("Spell offer missing source_id")
      await supabase.from("character_spells").insert({
        character_id: offer.character_id,
        spell_id: Number(offer.source_id),
      })
      break

    case "denarius": {
      const { data: char, error: charErr } = await supabase
        .from("characters")
        .select("denarius")
        .eq("id", offer.character_id)
        .single()
      if (charErr) throw new Error(charErr.message)
      await supabase
        .from("characters")
        .update({ denarius: (char?.denarius ?? 0) + (offer.quantity ?? 0) })
        .eq("id", offer.character_id)
      break
    }

    case "skill_point": {
      const { data: char, error: charErr } = await supabase
        .from("characters")
        .select("unused_skill_points")
        .eq("id", offer.character_id)
        .single()
      if (charErr) throw new Error(charErr.message)
      await supabase
        .from("characters")
        .update({
          unused_skill_points: (char?.unused_skill_points ?? 0) + (offer.quantity ?? 0),
        })
        .eq("id", offer.character_id)
      break
    }
  }

  await supabase.from("pending_offers").delete().eq("id", offerId)
}
