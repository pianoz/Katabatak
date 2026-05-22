"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { getGameMemberProfileId } from "@/lib/services/game-service"
import { kickPlayer } from "@/lib/services/invite-service"
import type { Character } from "@/components/types/types"

const ghostBtnClass =
  "font-sans text-[0.65rem] tracking-widest uppercase bg-transparent border border-border text-muted-foreground px-3 py-1.5 cursor-pointer"

const dangerBtnClass =
  "font-sans text-[0.65rem] tracking-widest uppercase bg-transparent border border-destructive/30 text-destructive px-3 py-1.5 cursor-pointer disabled:opacity-50"

interface KickPlayerModalProps {
  gameId: string
  characters: Character[]
  onClose: () => void
  onKicked: (characterId: string, profileId: string) => void
}

export function KickPlayerModal({ gameId, characters, onClose, onKicked }: KickPlayerModalProps) {
  const [selectedId, setSelectedId] = useState("")
  const [kicking, setKicking] = useState(false)

  const handleKick = async () => {
    if (!selectedId) return
    setKicking(true)
    const supabase = createClient()
    const profileId = await getGameMemberProfileId(supabase, gameId, selectedId)
    await kickPlayer(supabase, gameId, selectedId)
    onKicked(selectedId, profileId ?? "")
    setKicking(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-card border border-border p-6 w-72 flex flex-col gap-4">
        <div className="font-sans text-[0.6rem] tracking-[0.2em] uppercase text-muted-foreground">
          Kick Player
        </div>
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="bg-background border border-border text-foreground font-sans text-xs px-3 py-2 w-full"
        >
          <option value="">Select a character…</option>
          {characters.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <div className="flex gap-2">
          <button
            onClick={handleKick}
            disabled={!selectedId || kicking}
            className={dangerBtnClass + " disabled:opacity-40 flex-1"}
          >
            {kicking ? "Kicking…" : "Kick"}
          </button>
          <button onClick={onClose} className={ghostBtnClass}>Cancel</button>
        </div>
      </div>
    </div>
  )
}
