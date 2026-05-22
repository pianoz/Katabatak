"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { getFriendProfiles } from "@/lib/services/game-service"
import { invitePlayer } from "@/lib/services/invite-service"

const ghostBtnClass =
  "font-sans text-[0.65rem] tracking-widest uppercase bg-transparent border border-border text-muted-foreground px-3 py-1.5 cursor-pointer"

const dangerBtnClass =
  "font-sans text-[0.65rem] tracking-widest uppercase bg-transparent border border-destructive/30 text-destructive px-3 py-1.5 cursor-pointer disabled:opacity-50"

interface InvitePanelProps {
  gameId: string
  memberProfileIds: Set<string>
  onInvited: (profileId: string) => void
  onKickOpen: () => void
}

export function InvitePanel({ gameId, memberProfileIds, onInvited, onKickOpen }: InvitePanelProps) {
  const [profiles, setProfiles] = useState<{ id: string; username: string }[]>([])
  const [selectedId, setSelectedId] = useState("")
  const [inviting, setInviting] = useState(false)

  useEffect(() => {
    async function fetchFriendProfiles() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const data = await getFriendProfiles(supabase, user.id)
      setProfiles(data)
    }
    fetchFriendProfiles()
  }, [])

  const available = profiles.filter((p) => !memberProfileIds.has(p.id))

  const handleInvite = async () => {
    if (!selectedId) return
    setInviting(true)
    const supabase = createClient()
    await invitePlayer(supabase, gameId, selectedId)
    onInvited(selectedId)
    setSelectedId("")
    setInviting(false)
  }

  return (
    <div className="w-52 shrink-0 border-r border-border p-6 overflow-y-auto flex flex-col gap-3">
      <div className="font-sans text-[0.6rem] tracking-[0.2em] uppercase text-muted-foreground mb-3">
        Invite Players
      </div>
      <select
        value={selectedId}
        onChange={(e) => setSelectedId(e.target.value)}
        className="bg-background border border-border text-foreground font-sans text-xs px-3 py-2 w-full"
      >
        <option value="">Select a player…</option>
        {available.map((p) => (
          <option key={p.id} value={p.id}>{p.username}</option>
        ))}
      </select>
      <button
        onClick={handleInvite}
        disabled={!selectedId || inviting}
        className={ghostBtnClass + " disabled:opacity-40 w-full"}
      >
        {inviting ? "Inviting…" : "Invite"}
      </button>
      <hr className="border-border/30" />
      <button onClick={onKickOpen} className={dangerBtnClass + " w-full"}>
        Kick Player
      </button>
    </div>
  )
}
