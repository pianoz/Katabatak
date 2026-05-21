"use client"

import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { approveFriendRequest, removeFriendRow, FriendRequest } from "@/lib/friend-logic"

interface FriendRequestModalProps {
  request: FriendRequest
  onClose: () => void
  onApprove: (requestId: string) => void
  onDecline: (requestId: string) => void
}

export function FriendRequestModal({ request, onClose, onApprove, onDecline }: FriendRequestModalProps) {
  const handleApprove = async () => {
    const supabase = createClient()
    await approveFriendRequest(supabase, request.id)
    onApprove(request.id)
  }

  const handleDecline = async () => {
    const supabase = createClient()
    await removeFriendRow(supabase, request.id)
    onDecline(request.id)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-card border border-border w-full max-w-sm mx-4 flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Friend Request</p>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-8 flex flex-col items-center gap-2 text-center">
          {request.requester_avatar_url && (
            <img
              src={request.requester_avatar_url}
              alt={request.requester_username ?? "traveler"}
              className="w-16 h-16 border border-border"
            />
          )}
          <p className="font-serif text-xl text-foreground mt-2">
            {request.requester_username ?? "Unknown Traveler"}
          </p>
          {request.requester_full_name && (
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
              {request.requester_full_name}
            </p>
          )}
          <p className="text-sm font-serif text-muted-foreground italic mt-4">
            This traveler wishes to join your companions.
          </p>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex gap-2">
          <Button
            variant="outline"
            onClick={handleDecline}
            className="flex-1 border-destructive/50 text-destructive/80 hover:border-destructive hover:text-destructive uppercase tracking-widest text-xs"
          >
            Decline
          </Button>
          <Button
            onClick={handleApprove}
            className="flex-1 bg-foreground text-background hover:bg-foreground/90 uppercase tracking-widest text-xs"
          >
            Approve
          </Button>
        </div>
      </div>
    </div>
  )
}
