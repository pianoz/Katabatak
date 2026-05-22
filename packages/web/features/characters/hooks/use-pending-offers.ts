"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { getPendingOffersByCharacter, resolvePendingOffer } from "@/lib/services/pending-offer-service"
import { getItemById } from "@/lib/services/item-service"
import { getSpellById } from "@/lib/services/spell-service"
import type { Tables } from "@/components/types/supabase"
import type { PendingOfferData } from "@/features/characters/components/offers/notification-overlay"

export function usePendingOffers(
  characterId: string,
  isOwner: boolean,
  onAccepted?: () => Promise<void>,
) {
  const [pendingOffers, setPendingOffers] = useState<PendingOfferData[]>([])
  const [activePendingOffer, setActivePendingOffer] = useState<PendingOfferData | null>(null)
  const [activeOfferItem, setActiveOfferItem] = useState<unknown>(null)
  const [bellOpen, setBellOpen] = useState(false)

  useEffect(() => {
    if (!isOwner) return

    const supabase = createClient()

    const resolveLabel = async (row: Tables<"pending_offers">): Promise<string> => {
      if (row.type === "item" && row.source_id) {
        const item = await getItemById(supabase, row.source_id)
        return (item as { name?: string } | null)?.name ?? "Unknown Item"
      } else if (row.type === "spell" && row.source_id) {
        const spell = await getSpellById(supabase, Number(row.source_id))
        return spell?.name ?? "Unknown Spell"
      } else if (row.type === "denarius") {
        return `${row.quantity ?? 0} Denarius`
      } else if (row.type === "skill_point") {
        const qty = row.quantity ?? 0
        return `${qty} Skill ${qty === 1 ? "Point" : "Points"}`
      }
      return ""
    }

    const loadOffers = async () => {
      const data = await getPendingOffersByCharacter(supabase, characterId)
      if (!data.length) return
      const resolved = await Promise.all(
        data.map(async (row) => ({
          id: row.id,
          type: row.type,
          label: await resolveLabel(row),
          quantity: row.quantity,
          source_id: row.source_id,
        } as PendingOfferData))
      )
      setPendingOffers(resolved)
    }

    loadOffers()

    const channel = supabase
      .channel(`pending_offers:${characterId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "pending_offers", filter: `character_id=eq.${characterId}` },
        async (payload) => {
          const row = payload.new as Tables<"pending_offers">
          const label = await resolveLabel(row)
          const newOffer: PendingOfferData = { id: row.id, type: row.type, label, quantity: row.quantity, source_id: row.source_id }
          setPendingOffers(prev => [...prev, newOffer])
          if (row.type === "item" && row.source_id) {
            const itemData = await getItemById(supabase, row.source_id)
            setActiveOfferItem(itemData ?? null)
          }
          setActivePendingOffer(newOffer)
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [characterId, isOwner])

  const openOfferPopup = async (offer: PendingOfferData) => {
    setBellOpen(false)
    if (offer.type === "item" && offer.source_id) {
      const data = await getItemById(createClient(), offer.source_id)
      setActiveOfferItem(data ?? null)
    }
    setActivePendingOffer(offer)
  }

  const handleOfferClose = () => {
    setActivePendingOffer(null)
    setActiveOfferItem(null)
  }

  const handleOfferAccept = async (offer?: PendingOfferData) => {
    const target = offer ?? activePendingOffer
    if (!target) return
    await resolvePendingOffer(target.id, true)
    setPendingOffers(prev => prev.filter(o => o.id !== target.id))
    if (activePendingOffer?.id === target.id) { setActivePendingOffer(null); setActiveOfferItem(null) }
    await onAccepted?.()
  }

  const handleOfferDecline = async (offer?: PendingOfferData) => {
    const target = offer ?? activePendingOffer
    if (!target) return
    await resolvePendingOffer(target.id, false)
    setPendingOffers(prev => prev.filter(o => o.id !== target.id))
    if (activePendingOffer?.id === target.id) { setActivePendingOffer(null); setActiveOfferItem(null) }
  }

  return {
    pendingOffers,
    activePendingOffer,
    activeOfferItem,
    bellOpen,
    setBellOpen,
    openOfferPopup,
    handleOfferClose,
    handleOfferAccept,
    handleOfferDecline,
  }
}
