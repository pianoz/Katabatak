"use client"

import { createClient } from "@/lib/supabase/client"
import type { Database } from "@/components/types/supabase"
import type { SupabaseClient } from "@supabase/supabase-js"

type OfferType = Database["public"]["Enums"]["offer_type"]

/** Returns all unresolved pending_offers rows for the given character. */
export async function getPendingOffersByCharacter(supabase: SupabaseClient, characterId: string) {
  const { data } = await supabase.from("pending_offers").select("*").eq("character_id", characterId)
  return data ?? []
}

/** Inserts a pending_offer row so the player can accept or decline it from the notification overlay. */
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

/**
 * Accepts or declines a pending offer. On accept, applies the reward to the character
 * (item, spell, currency, or skill points) and deletes the offer row.
 * Item peer-transfers call the `delete_giver_inventory_for_offer` RPC because direct RLS
 * blocks deletion of another user's inventory row.
 */
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
      // For peer transfers: delete the giver's inventory entry via SECURITY DEFINER
      // function (direct DELETE is blocked by RLS for rows owned by other users).
      if (offer.giver_inventory_id) {
        await supabase.rpc("delete_giver_inventory_for_offer", {
          p_offer_id: offerId,
          p_giver_inventory_id: offer.giver_inventory_id,
        })
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
