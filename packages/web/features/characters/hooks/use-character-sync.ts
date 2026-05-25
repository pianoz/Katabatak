"use client"

import { useEffect, useRef, useState } from "react"
import { useCharacterStore, type LiveSheet } from "@/features/characters/hooks/use-character-store"
import { useToast } from "@/hooks/use-toast"
import { createClient } from "@/lib/supabase/client"
import { updateCharacter } from "@/lib/services/character-service"

const DEBOUNCE_MS = 1500

export function useCharacterSync() {
  const isDirty = useCharacterStore((s) => s.isDirty)
  const markSaved = useCharacterStore((s) => s.markSaved)
  const { toast } = useToast()

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isSavingRef = useRef(false)
  const [isSyncing, setIsSyncing] = useState(false)

  // Refs keep the async save function from capturing stale callbacks
  const markSavedRef = useRef(markSaved)
  markSavedRef.current = markSaved
  const toastRef = useRef(toast)
  toastRef.current = toast

  const saveNow = useRef(async () => {
    if (isSavingRef.current) {
      // A save is already in flight; reschedule so this write isn't lost
      timerRef.current = setTimeout(() => void saveNow.current(), DEBOUNCE_MS)
      return
    }

    const state = useCharacterStore.getState()
    if (!state.isDirty || !state.characterId) return

    // Snapshot the exact values being written so we can correctly reconcile
    // isDirty after the async write completes
    const snapshot: LiveSheet = {
      health: state.health,
      essence: state.essence,
      power: state.power,
      will: state.will,
      speed: state.speed,
      denarius: state.denarius,
      unused_skill_points: state.unused_skill_points,
      inventory: state.inventory,
    }

    isSavingRef.current = true
    setIsSyncing(true)
    const supabase = createClient()

    const { error } = await updateCharacter(supabase, state.characterId, {
      current_health: snapshot.health.current,
      health_max: snapshot.health.max,
      current_essence: snapshot.essence.current,
      essence_max: snapshot.essence.max,
      current_power: snapshot.power.current,
      power_max: snapshot.power.max,
      current_will: snapshot.will.current,
      will_max: snapshot.will.max,
      speed: snapshot.speed,
      denarius: snapshot.denarius,
      unused_skill_points: snapshot.unused_skill_points,
    })

    if (error) {
      toastRef.current({
        title: "Could not save your character",
        description: "Changes may be lost if you leave. Check your connection.",
        variant: "destructive",
      })
      isSavingRef.current = false
      setIsSyncing(false)
      return
    }

    await Promise.all(
      snapshot.inventory.map((item) =>
        supabase
          .from("character_inventory")
          .update({ is_equipped: item.is_equipped })
          .eq("id", item.inventory_id)
      )
    )

    markSavedRef.current(snapshot)
    isSavingRef.current = false
    setIsSyncing(false)
  })

  // Debounce: wait for 1.5s of inactivity after the last change before writing
  useEffect(() => {
    if (!isDirty) return
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => void saveNow.current(), DEBOUNCE_MS)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [isDirty])

  // Best-effort flush on page close / navigation away
  useEffect(() => {
    const flush = () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      void saveNow.current()
    }
    window.addEventListener("beforeunload", flush)
    return () => window.removeEventListener("beforeunload", flush)
  }, [])

  return { isSyncing }
}
