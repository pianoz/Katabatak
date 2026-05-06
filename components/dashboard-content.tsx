"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Plus, Swords, Users, Wrench } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { LogOut, Settings } from "lucide-react" // Add Settings to imports
import { SettingsModal } from "@/components/settings-modal"
import { profile } from "console"

interface Game {
  id: string
  name: string
  description?: string
  dm_id?: string
  created_at: string
}

interface Character {
  id: string
  name: string
  class?: string
  level?: number
  game_id?: string
  user_id: string
  created_at: string
}

interface DashboardContentProps {
  games: Game[]
  characters: Character[]
  isDev: boolean
  userId: string
  username: string
  fullName: string
}

export function DashboardContent({games, characters, isDev, userId, username, fullName}: DashboardContentProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState("games")

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/")
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="px-6 md:px-12 lg:px-20 py-4 flex items-center justify-between">
          <Link href="/dashboard" className="font-serif text-2xl tracking-wide text-foreground">
            KatabataK
          </Link>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-widest text-muted-foreground hidden md:block">
                Traveler: <span className="text-foreground">{username}</span>
              </span>
              {/* This is where the Modal will be triggered */}
              <SettingsModal 
                userId={userId} 
                initialProfile={{ username, fullName}} 
              />
            </div>

            <Button 
              variant="ghost" 
              onClick={handleSignOut}
              className="text-muted-foreground hover:text-foreground uppercase text-xs tracking-widest"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="px-6 md:px-12 lg:px-20 py-8">
        {/* Mobile Tabs */}
        <div className="md:hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full bg-secondary mb-6">
              <TabsTrigger 
                value="games" 
                className="flex-1 uppercase tracking-widest text-xs data-[state=active]:bg-card"
              >
                <Swords className="w-4 h-4 mr-2" />
                Games
              </TabsTrigger>
              <TabsTrigger 
                value="characters" 
                className="flex-1 uppercase tracking-widest text-xs data-[state=active]:bg-card"
              >
                <Users className="w-4 h-4 mr-2" />
                Characters
              </TabsTrigger>
            </TabsList>

            <TabsContent value="games">
              <GamesList games={games} userId={userId} />
            </TabsContent>

            <TabsContent value="characters">
              <CharactersList characters={characters} />
            </TabsContent>
          </Tabs>
        </div>

        {/* Desktop Side-by-Side */}
        <div className="hidden md:grid md:grid-cols-2 gap-8 lg:gap-12">
          <GamesList games={games} userId={userId} />
          <CharactersList characters={characters} />
        </div>

        {/* Dev Tools Section */}
        {isDev && (
          <div className="mt-16 pt-8 border-t border-border">
            <div className="flex items-center gap-3 mb-6">
              <Wrench className="w-5 h-5 text-muted-foreground" />
              <h2 className="text-sm uppercase tracking-[0.3em] text-muted-foreground">
                Dev Tools
              </h2>
            </div>
            <div className="flex flex-wrap gap-4">
              <Link href="/dev/skill-tree">
                <Button 
                  variant="outline" 
                  className="border-border text-foreground hover:bg-card uppercase tracking-widest text-xs"
                >
                  Modify Skill Tree
                </Button>
              </Link>
              <Link href="/dev/items">
                <Button 
                  variant="outline" 
                  className="border-border text-foreground hover:bg-card uppercase tracking-widest text-xs"
                >
                  Modify Items
                </Button>
              </Link>
              <Link href="/dev/users">
                <Button 
                  variant="outline" 
                  className="border-border text-foreground hover:bg-card uppercase tracking-widest text-xs"
                >
                  Modify Users
                </Button>
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

function GamesList({ games, userId }: { games: Game[], userId: string }) {
  return (
    <section>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Swords className="w-5 h-5 text-muted-foreground" />
          <h2 className="text-sm uppercase tracking-[0.3em] text-muted-foreground">
            Games
          </h2>
        </div>
        <Link href="/games/new">
          <Button 
            size="sm" 
            className="bg-foreground text-background hover:bg-foreground/90 uppercase tracking-widest text-xs"
          >
            <Plus className="w-4 h-4 mr-1" />
            New Game
          </Button>
        </Link>
      </div>

      <div className="space-y-3">
        {games.length === 0 ? (
          <div className="border border-border bg-card p-8 text-center">
            <p className="text-muted-foreground text-sm italic font-serif">
              No adventures await. Create your first game to begin.
            </p>
          </div>
        ) : (
          games.map((game) => (
            <Link 
              key={game.id} 
              href={`/games/${game.id}`}
              className="block border border-border bg-card p-4 hover:border-foreground/30 transition-colors group"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-serif text-lg text-foreground group-hover:text-foreground/80">
                    {game.name}
                  </h3>
                  {game.description && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                      {game.description}
                    </p>
                  )}
                </div>
                {game.dm_id === userId && (
                  <span className="text-xs uppercase tracking-widest text-muted-foreground bg-secondary px-2 py-1">
                    DM
                  </span>
                )}
              </div>
            </Link>
          ))
        )}
      </div>
    </section>
  )
}

function CharactersList({ characters }: { characters: Character[] }) {
  return (
    <section>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Users className="w-5 h-5 text-muted-foreground" />
          <h2 className="text-sm uppercase tracking-[0.3em] text-muted-foreground">
            Characters
          </h2>
        </div>
        <Link href="/characters/new">
          <Button 
            size="sm" 
            className="bg-foreground text-background hover:bg-foreground/90 uppercase tracking-widest text-xs"
          >
            <Plus className="w-4 h-4 mr-1" />
            New Character
          </Button>
        </Link>
      </div>

      <div className="space-y-3">
        {characters.length === 0 ? (
          <div className="border border-border bg-card p-8 text-center">
            <p className="text-muted-foreground text-sm italic font-serif">
              No souls to guide. Create your first character to begin.
            </p>
          </div>
        ) : (
          characters.map((character) => (
            <Link 
              key={character.id} 
              href={`/characters/${character.id}`}
              className="block border border-border bg-card p-4 hover:border-foreground/30 transition-colors group"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-serif text-lg text-foreground group-hover:text-foreground/80">
                    {character.name}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {character.class && character.level 
                      ? `Level ${character.level} ${character.class}`
                      : character.class || "Unclassed"
                    }
                  </p>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </section>
  )
}
