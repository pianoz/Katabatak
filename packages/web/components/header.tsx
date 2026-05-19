import Link from "next/link"
import { LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SettingsModal } from "./settings-modal"
import { InviteNotification, GameInvite } from "./invite-notification"
import { CharacterForSelect } from "./character-select-modal"

interface HeaderProps {
  characterPage?: boolean;
  userId?: string;
  username?: string;
  fullName?: string;
  handleSignOut?: () => void;
  invites?: GameInvite[];
  characters?: CharacterForSelect[];
}

export function Header({
  characterPage = false,
  userId,
  username,
  fullName,
  handleSignOut,
  invites = [],
  characters = [],
}: HeaderProps) {
  return (
    <header className="fixed inset-x-0 top-0 z-50 w-full bg-background/80 backdrop-blur-sm border-b border-border/50">
      <div className="w-full px-4 sm:px-6 lg:px-8 py-3 md:py-4 flex items-center justify-between">

        {/* Logo / Brand Link */}
        <Link
          href={characterPage ? "/dashboard" : "/"}
          className="font-serif text-xl md:text-2xl tracking-wide text-foreground hover:text-foreground/80 transition-colors shrink-0"
        >
          KatabataK
        </Link>

        {/* Conditional Rendering based on characterPage */}
        {characterPage ? (
          <div className="flex items-center gap-2 md:gap-4 shrink-0">
            <div className="flex items-center gap-2">
              {/* Hidden on mobile, shows on desktop */}
              <span className="text-xs uppercase tracking-widest text-muted-foreground hidden md:block">
                Traveler: <span className="text-foreground">{username}</span>
              </span>

              {/* Settings Trigger */}
              <SettingsModal
                userId={userId ?? ""}
                initialProfile={{ username: username ?? "", fullName: fullName ?? "" }}
              />
            </div>

            <InviteNotification invites={invites} characters={characters} />

            {/* Logout Button */}
            <Button
              variant="ghost"
              size="icon" // Use icon size on mobile to save space, standard on desktop via padding if needed
              onClick={handleSignOut}
              className="text-muted-foreground hover:text-foreground uppercase text-xs tracking-widest h-9 w-9 md:h-10 md:w-10"
              aria-label="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          /* Default Navigation Layout */
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