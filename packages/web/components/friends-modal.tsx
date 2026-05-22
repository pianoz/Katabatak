"use client"

import { useState, useCallback } from "react"
import { X, UserPlus, UserMinus, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { sendFriendRequest, removeFriendRow, Friend } from "@/lib/services/friend-service"
import { searchProfiles } from "@/lib/services/profile-service"

interface SearchProfile {
  id: string
  username: string | null
  full_name: string | null
}

interface FriendsModalProps {
  currentUserId: string
  initialFriends: Friend[]
  onClose: () => void
}

export function FriendsModal({ currentUserId, initialFriends, onClose }: FriendsModalProps) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchProfile[]>([])
  const [searching, setSearching] = useState(false)
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set())
  const [friends, setFriends] = useState<Friend[]>(initialFriends)
  const [actionMsg, setActionMsg] = useState<string | null>(null)

  const handleSearch = useCallback(async () => {
    const q = query.trim()
    if (!q) return
    setSearching(true)
    const supabase = createClient()
    const data = await searchProfiles(supabase, q, currentUserId)
    setResults(data as SearchProfile[])
    setSearching(false)
  }, [query, currentUserId])

  const handleAddFriend = async (profile: SearchProfile) => {
    setPendingIds((prev) => new Set(prev).add(profile.id))
    const supabase = createClient()
    const err = await sendFriendRequest(supabase, currentUserId, profile.id)
    if (err) {
      setActionMsg(err)
      setPendingIds((prev) => { const s = new Set(prev); s.delete(profile.id); return s })
    } else {
      setActionMsg(`Friend request sent to ${profile.username ?? "user"}.`)
      // Keep the id in pendingIds so the button stays disabled
    }
  }

  const handleRemoveFriend = async (friend: Friend) => {
    const supabase = createClient()
    await removeFriendRow(supabase, friend.id)
    setFriends((prev) => prev.filter((f) => f.id !== friend.id))
  }

  const isFriend = (profileId: string) => friends.some((f) => f.profile_id === profileId)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-card border border-border w-full max-w-md mx-4 max-h-[80vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Friends</p>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-4 space-y-6">

          {/* Search */}
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Find a Traveler</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Search by username…"
                className="flex-1 bg-background border border-border text-foreground font-sans text-xs px-3 py-2 placeholder:text-muted-foreground outline-none"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={handleSearch}
                disabled={searching || !query.trim()}
                className="border-border uppercase tracking-widest text-xs h-9 px-3"
              >
                <Search className="w-3 h-3" />
              </Button>
            </div>

            {actionMsg && (
              <p className="text-[10px] tracking-wide text-muted-foreground italic">{actionMsg}</p>
            )}

            {results.length > 0 && (
              <div className="space-y-1 pt-1">
                {results.map((profile) => {
                  const alreadyFriend = isFriend(profile.id)
                  const requested = pendingIds.has(profile.id)
                  return (
                    <div
                      key={profile.id}
                      className="flex items-center justify-between px-3 py-2 border border-border/50 bg-background"
                    >
                      <div>
                        <p className="font-serif text-sm text-foreground">{profile.username ?? "—"}</p>
                        {profile.full_name && (
                          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{profile.full_name}</p>
                        )}
                      </div>
                      {alreadyFriend ? (
                        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Friends</span>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={requested}
                          onClick={() => handleAddFriend(profile)}
                          className="border-border uppercase tracking-widest text-xs h-7 px-2"
                        >
                          <UserPlus className="w-3 h-3 mr-1" />
                          {requested ? "Requested" : "Add Friend"}
                        </Button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Friends list */}
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Friends — {friends.length}
            </p>
            {friends.length === 0 ? (
              <p className="text-sm italic font-serif text-muted-foreground text-center py-4">
                No companions yet. Find a traveler above.
              </p>
            ) : (
              <div className="space-y-1">
                {friends.map((friend) => (
                  <div
                    key={friend.id}
                    className="flex items-center justify-between px-3 py-2 border border-border/50 bg-background"
                  >
                    <div>
                      <p className="font-serif text-sm text-foreground">{friend.username ?? "—"}</p>
                      {friend.full_name && (
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{friend.full_name}</p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRemoveFriend(friend)}
                      className="border-destructive/50 text-destructive/80 hover:border-destructive hover:text-destructive uppercase tracking-widest text-xs h-7 px-2"
                    >
                      <UserMinus className="w-3 h-3 mr-1" />
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
