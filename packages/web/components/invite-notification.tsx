"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { CharacterSelectModal, CharacterForSelect } from "@/features/characters/components/character-select-modal"
import { FriendRequestModal } from "./friend-request-modal"
import { acceptInvite, declineInvite } from "@/lib/services/invite-service"
import { FriendRequest } from "@/lib/services/friend-service"
import { getCharacterSkillPoints } from "@/lib/services/character-service"

export interface GameInvite {
  id: string
  game_id: string
  game_name: string
  starting_level: number
}

interface InviteNotificationProps {
  invites: GameInvite[]
  characters: CharacterForSelect[]
  friendRequests: FriendRequest[]
  onFriendRequestResolved: (requestId: string) => void
}

export function InviteNotification({
  invites: initialInvites,
  characters,
  friendRequests: initialFriendRequests,
  onFriendRequestResolved,
}: InviteNotificationProps) {
  const router = useRouter()
  const [invites, setInvites] = useState<GameInvite[]>(initialInvites)
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>(initialFriendRequests)
  const [open, setOpen] = useState(false)
  const [selectingForInvite, setSelectingForInvite] = useState<GameInvite | null>(null)
  const [viewingRequest, setViewingRequest] = useState<FriendRequest | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [open])

  const handleDeclineGameInvite = async (inviteId: string) => {
    await declineInvite(createClient(), inviteId)
    setInvites((prev) => prev.filter((i) => i.id !== inviteId))
  }

  const handleAcceptGameInvite = (invite: GameInvite) => {
    setOpen(false)
    setSelectingForInvite(invite)
  }

  const handleCharacterSelected = async (characterId: string) => {
    if (!selectingForInvite) return
    const supabase = createClient()
    const startingLevel = selectingForInvite.starting_level ?? 0
    const currentPoints = await getCharacterSkillPoints(supabase, characterId)
    await acceptInvite(supabase, selectingForInvite.id, characterId, currentPoints, startingLevel)
    setInvites((prev) => prev.filter((i) => i.id !== selectingForInvite.id))
    setSelectingForInvite(null)
  }

  const handleCreateNewCharacter = () => {
    if (!selectingForInvite) return
    setSelectingForInvite(null)
    router.push(
      `/characters/new?inviteMemberId=${selectingForInvite.id}&startingLevel=${selectingForInvite.starting_level}`
    )
  }

  const handleOpenFriendRequest = (request: FriendRequest) => {
    setOpen(false)
    setViewingRequest(request)
  }

  const handleFriendRequestApprove = (requestId: string) => {
    setFriendRequests((prev) => prev.filter((r) => r.id !== requestId))
    onFriendRequestResolved(requestId)
    setViewingRequest(null)
  }

  const handleFriendRequestDecline = (requestId: string) => {
    setFriendRequests((prev) => prev.filter((r) => r.id !== requestId))
    onFriendRequestResolved(requestId)
    setViewingRequest(null)
  }

  const totalCount = invites.length + friendRequests.length

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setOpen((o) => !o)}
          className="relative p-2 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Notifications"
        >
          <Mail className="w-5 h-5" />
          {totalCount > 0 && (
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
          )}
        </button>

        {open && (
          <div className="absolute right-0 top-full mt-2 w-80 bg-card border border-border shadow-lg z-50">
            {/* Friend requests section */}
            {friendRequests.length > 0 && (
              <>
                <div className="px-4 py-3 border-b border-border">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">
                    Friend Requests
                  </p>
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {friendRequests.map((req) => (
                    <div
                      key={req.id}
                      className="px-4 py-3 border-b border-border/50 last:border-0"
                    >
                      <p className="font-serif text-foreground mb-1">
                        {req.requester_username ?? "Unknown Traveler"}
                      </p>
                      <Button
                        size="sm"
                        className="w-full bg-foreground text-background hover:bg-foreground/90 uppercase tracking-widest text-xs h-7"
                        onClick={() => handleOpenFriendRequest(req)}
                      >
                        View Request
                      </Button>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Game invites section */}
            <div className="px-4 py-3 border-b border-border">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">
                Game Invites
              </p>
            </div>
            {invites.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground italic text-center font-serif">
                No pending invites.
              </p>
            ) : (
              <div className="max-h-72 overflow-y-auto">
                {invites.map((invite) => (
                  <div
                    key={invite.id}
                    className="px-4 py-3 border-b border-border/50 last:border-0"
                  >
                    <p className="font-serif text-foreground mb-1">{invite.game_name}</p>
                    {invite.starting_level > 0 && (
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
                        Starting Level {invite.starting_level} — {invite.starting_level} skill{" "}
                        {invite.starting_level === 1 ? "point" : "points"} on join
                      </p>
                    )}
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1 bg-foreground text-background hover:bg-foreground/90 uppercase tracking-widest text-xs h-7"
                        onClick={() => handleAcceptGameInvite(invite)}
                      >
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 border-border uppercase tracking-widest text-xs h-7"
                        onClick={() => handleDeclineGameInvite(invite.id)}
                      >
                        Decline
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

          </div>
        )}
      </div>

      {selectingForInvite && (
        <CharacterSelectModal
          characters={characters}
          onSelect={handleCharacterSelected}
          onClose={() => setSelectingForInvite(null)}
          onCreateNew={handleCreateNewCharacter}
        />
      )}

      {viewingRequest && (
        <FriendRequestModal
          request={viewingRequest}
          onClose={() => setViewingRequest(null)}
          onApprove={handleFriendRequestApprove}
          onDecline={handleFriendRequestDecline}
        />
      )}
    </>
  )
}
