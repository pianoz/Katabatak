import Link from "next/link"
import { LogOut } from "lucide-react" // Assuming you are using lucide-react for the icon
import { Button } from "@/components/ui/button" // Adjust path to your UI components
import { SettingsModal } from "./settings-modal" // Adjust path to your modal

interface HeaderProps {
  characterPage?: boolean;
  userId?: string;
  username?: string;
  fullName?: string;
  handleSignOut?: () => void;
}

export function Header({ 
  characterPage = false, 
  userId, 
  username, 
  fullName, 
  handleSignOut 
}: HeaderProps) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-sm border-b border-border/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 md:py-4 flex items-center justify-between">
        
        {/* Logo / Brand Link */}
        <Link 
          href={characterPage ? "/dashboard" : "/"} 
          className="font-serif text-xl md:text-2xl tracking-wide text-foreground hover:text-foreground/80 transition-colors shrink-0"
        >
          KatabataK
        </Link>

        {/* Conditional Rendering based on characterPage */}
        {characterPage ? (
          <div className="flex items-center gap-2 md:gap-4">
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
          <nav>
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