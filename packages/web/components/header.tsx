"use client"

import { useState } from "react"
import Link from "next/link"
import { LogOut, MoreHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { SettingsModal } from "./settings-modal"
import { InviteNotification, GameInvite } from "./invite-notification"
import { CharacterForSelect } from "@/features/characters/components/character-select-modal"
import { FriendRequest } from "@/lib/services/friend-service"

interface HeaderProps {
  characterPage?: boolean;
  userId?: string;
  username?: string;
  fullName?: string;
  handleSignOut?: () => void;
  invites?: GameInvite[];
  characters?: CharacterForSelect[];
  friendRequests?: FriendRequest[];
}

export function Header({
  characterPage = false,
  userId,
  username,
  fullName,
  handleSignOut,
  invites = [],
  characters = [],
  friendRequests = [],
}: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <header className="fixed inset-x-0 top-0 z-50 w-full bg-background/80 backdrop-blur-sm border-b border-border/50">
      <div className="w-full px-4 sm:px-6 lg:px-8 py-3 md:py-4 flex items-center justify-between">

        <link rel="icon" type="image/png" href="/katabatak-icon-small.png"/>
        <Link
          href={characterPage ? "/dashboard" : "/"}
          className="font-serif text-xl md:text-2xl tracking-wide text-foreground hover:text-foreground/80 transition-colors shrink-0"
        >
          KatabataK
        </Link>

        {characterPage ? (
          <div className="flex items-center shrink-0">
            {/* Desktop: full icon row */}
            <div className="hidden md:flex items-center gap-2 md:gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-widest text-muted-foreground">
                  Traveler: <span className="text-foreground">{username}</span>
                </span>
                <SettingsModal
                  userId={userId ?? ""}
                  initialProfile={{ username: username ?? "", fullName: fullName ?? "" }}
                />
              </div>
              <InviteNotification
                invites={invites}
                characters={characters}
                friendRequests={friendRequests}
                onFriendRequestResolved={() => {}}
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={handleSignOut}
                className="text-muted-foreground hover:text-foreground uppercase text-xs tracking-widest h-9 w-9 md:h-10 md:w-10"
                aria-label="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>

            {/* Mobile: ellipsis button */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Menu"
            >
              <MoreHorizontal className="w-5 h-5" />
            </button>

            {/* Mobile menu dialog */}
            <Dialog open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <DialogContent className="max-w-sm w-[calc(100vw-2rem)] bg-card border-border p-0">
                <DialogHeader className="px-5 pt-5 pb-3 border-b border-border">
                  <DialogTitle className="text-xs uppercase tracking-[0.3em] text-muted-foreground font-sans font-normal">
                    Menu
                  </DialogTitle>
                </DialogHeader>
                <div className="overflow-y-auto max-h-[70vh]">
                  <div className="px-5 py-3 border-b border-border">
                    <span className="text-xs uppercase tracking-widest text-muted-foreground">
                      Traveler: <span className="text-foreground">{username}</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-3 px-5 py-3 border-b border-border">
                    <SettingsModal
                      userId={userId ?? ""}
                      initialProfile={{ username: username ?? "", fullName: fullName ?? "" }}
                    />
                    <span className="text-xs uppercase tracking-widest text-muted-foreground">Settings</span>
                  </div>
                  <div className="flex items-center gap-3 px-5 py-3 border-b border-border">
                    <InviteNotification
                      invites={invites}
                      characters={characters}
                      friendRequests={friendRequests}
                      onFriendRequestResolved={() => {}}
                    />
                    <span className="text-xs uppercase tracking-widest text-muted-foreground">Notifications</span>
                  </div>
                  <button
                    onClick={handleSignOut}
                    className="flex items-center gap-3 w-full px-5 py-3 text-destructive/70 hover:text-destructive transition-colors"
                  >
                    <LogOut className="w-5 h-5" />
                    <span className="text-xs uppercase tracking-widest">Sign Out</span>
                  </button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        ) : (
          <nav className="shrink-0">
            <Link
              href="/about"
              className="text-xs md:text-sm uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
            >
              About
            </Link>
          </nav>
        )}
      </div>
    </header>
  )
}