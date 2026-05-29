"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { LogOut, Plus, Sparkles, Swords, Users } from "lucide-react"
import { DevToolsSection } from "@/features/devtools/components/devtools-section"
import { createClient } from "@/lib/supabase/client"
import { archiveGame, deleteGame } from "@/lib/services/game-service"
import { deleteCharacter } from "@/lib/services/character-service"
import { Switch } from "@/components/ui/switch"
import { SettingsModal } from "@/components/settings-modal"
import { InviteNotification, GameInvite } from "@/components/invite-notification"
import { CharacterForSelect } from "@/features/characters/components/character-select-modal"
import { FriendsModal } from "@/components/friends-modal"
import { FriendRequest, Friend } from "@/lib/services/friend-service"

interface Game {
  id: string
  name: string
  description?: string
  gm_id?: string
  created_at: string | null
  archived?: boolean
}

interface Character {
  id: string
  name: string
  class?: string
  class_archetype?: string | null
  level?: number | null
  game_id?: string
  user_id: string | null
  created_at: string | null
  syngem_game?: boolean | null
}

interface DashboardContentProps {
  games: Game[]
  characters: Character[]
  invites: GameInvite[]
  isDev: boolean
  userId: string
  username: string
  fullName: string
  tokenBudget?: number | null
  friendRequests: FriendRequest[]
  friends: Friend[]
}

export function DashboardContent({ games, characters, invites, isDev, userId, username, fullName, tokenBudget = null, friendRequests: initialFriendRequests, friends: initialFriends }: DashboardContentProps) {
  const charactersForSelect: CharacterForSelect[] = characters.map((c) => ({
    id: c.id,
    name: c.name,
    level: c.level ?? 1,
    class_archetype: c.class_archetype ?? c.class ?? null,
  }))
  const router = useRouter()
  const [topTab, setTopTab] = useState("irl")
  const [activeTab, setActiveTab] = useState("games")
  const [friendsOpen, setFriendsOpen] = useState(false)
  const [devModeEnabled, setDevModeEnabled] = useState(false)
  type LogLevel = 'verbose' | 'errors+' | 'errors' | 'silent'
  const LOG_LEVELS: LogLevel[] = ['verbose', 'errors+', 'errors', 'silent']
  const [logLevel, setLogLevelState] = useState<LogLevel>('verbose')

  const irlCharacters = characters.filter((c) => !c.syngem_game)
  const syngemCharacters = characters.filter((c) => c.syngem_game)

  const syncLogLevel = async (level: LogLevel) => {
    try {
      await fetch('/api/dev/log-level', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level }),
      })
    } catch { /* non-critical */ }
  }

  useEffect(() => {
    setDevModeEnabled(localStorage.getItem('devModeEnabled') === 'true')
    const stored = localStorage.getItem('synLogLevel') as LogLevel | null
    if (stored && (['verbose', 'errors+', 'errors', 'silent'] as string[]).includes(stored)) {
      setLogLevelState(stored)
      void syncLogLevel(stored)
    }
  }, [])

  const toggleDevMode = (val: boolean) => {
    localStorage.setItem('devModeEnabled', String(val))
    setDevModeEnabled(val)
  }

  const handleLogLevelChange = (level: LogLevel) => {
    localStorage.setItem('synLogLevel', level)
    setLogLevelState(level)
    void syncLogLevel(level)
  }
  const [friends, setFriends] = useState<Friend[]>(initialFriends)
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>(initialFriendRequests)

  const handleFriendRequestResolved = (requestId: string) => {
    setFriendRequests((prev) => prev.filter((r) => r.id !== requestId))
  }

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
              <SettingsModal
                userId={userId}
                initialProfile={{ username, fullName}}
                tokenBudget={tokenBudget}
              />
            </div>

            <InviteNotification
              invites={invites}
              characters={charactersForSelect}
              friendRequests={friendRequests}
              onFriendRequestResolved={handleFriendRequestResolved}
            />

            <button
              onClick={() => setFriendsOpen(true)}
              className="p-2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Friends"
            >
              <Users className="w-5 h-5" />
            </button>

            {isDev && (
              <div className="flex items-center gap-2">
                <Switch
                  checked={devModeEnabled}
                  onCheckedChange={toggleDevMode}
                  id="dev-mode-toggle"
                />
                <label
                  htmlFor="dev-mode-toggle"
                  className="text-xs uppercase tracking-widest text-muted-foreground cursor-pointer select-none"
                >
                  Dev
                </label>
              </div>
            )}

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

      {friendsOpen && (
        <FriendsModal
          currentUserId={userId}
          initialFriends={friends}
          onClose={() => setFriendsOpen(false)}
        />
      )}

      <main className="px-6 md:px-12 lg:px-20 py-8">
        {/* Top-level IRL / SYNGEM tabs */}
        <Tabs value={topTab} onValueChange={setTopTab}>
          <TabsList className="bg-secondary mb-8">
            <TabsTrigger
              value="irl"
              className="uppercase tracking-widest text-xs data-[state=active]:bg-card px-6"
            >
              <Swords className="w-3.5 h-3.5 mr-2" />
              IRL
            </TabsTrigger>
            <TabsTrigger
              value="syngem"
              className="uppercase tracking-widest text-xs data-[state=active]:bg-card px-6"
            >
              <Sparkles className="w-3.5 h-3.5 mr-2" />
              Syngem
            </TabsTrigger>
          </TabsList>

          {/* ── IRL tab ──────────────────────────────────────────────── */}
          <TabsContent value="irl">
            {/* Mobile nested tabs */}
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
                  <CharactersList characters={irlCharacters} />
                </TabsContent>
              </Tabs>
            </div>

            {/* Desktop side-by-side */}
            <div className="hidden md:grid md:grid-cols-2 gap-8 lg:gap-12">
              <GamesList games={games} userId={userId} />
              <CharactersList characters={irlCharacters} />
            </div>
          </TabsContent>

          {/* ── SYNGEM tab ───────────────────────────────────────────── */}
          <TabsContent value="syngem">
            <SyngemSection characters={syngemCharacters} />
          </TabsContent>
        </Tabs>

        {devModeEnabled && <DevToolsSection />}
        {devModeEnabled && (
          <div className="mt-4 border border-border bg-card px-5 py-4 flex items-center gap-6 flex-wrap">
            <span className="text-xs uppercase tracking-[0.3em] text-muted-foreground shrink-0">
              Log Level
            </span>
            {LOG_LEVELS.map((level) => (
              <label key={level} className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="radio"
                  name="synLogLevel"
                  value={level}
                  checked={logLevel === level}
                  onChange={() => handleLogLevelChange(level)}
                  className="sr-only"
                />
                <span className={`text-xs uppercase tracking-widest px-3 py-1 border transition-colors ${
                  logLevel === level
                    ? 'border-cyan-400 text-cyan-400'
                    : 'border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground'
                }`}>
                  {level}
                </span>
              </label>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

// ─── SYNGEM Section ───────────────────────────────────────────────────────────

function SyngemSection({ characters }: { characters: Character[] }) {
  return (
    <div className="space-y-8">
      {/* New Game CTA */}
      <div className="border border-cyan-900/40 bg-card p-10 text-center">
        <Sparkles className="w-8 h-8 text-cyan-500/60 mx-auto mb-4" />
        <p className="font-serif text-xl text-foreground/80 mb-2">
          The Chronicle Awaits
        </p>
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground mb-6">
          Begin a new AI-guided campaign
        </p>
        <Link href="/syngem/intro">
          <Button className="bg-cyan-950/60 text-cyan-300 border border-cyan-800/60 hover:bg-cyan-900/60 hover:border-cyan-600 uppercase tracking-widest text-xs px-8">
            <Sparkles className="w-3.5 h-3.5 mr-2" />
            New Game
          </Button>
        </Link>
      </div>

      {/* Resume section */}
      {characters.length > 0 && (
        <section>
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-sm uppercase tracking-[0.3em] text-muted-foreground">
              Chronicles
            </h2>
          </div>
          <div className="space-y-3">
            {characters.map((character) => (
              <Link
                key={character.id}
                href={`/characters/${character.id}`}
                className="block border border-border bg-card p-4 hover:border-cyan-900/60 transition-colors group"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-serif text-lg text-foreground group-hover:text-foreground/80">
                    {character.name}
                  </h3>
                  <span className="text-[10px] uppercase tracking-[0.3em] text-cyan-600/60">
                    Resume
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

// ─── Games List ───────────────────────────────────────────────────────────────

function GamesList({ games, userId }: { games: Game[], userId: string }) {
  const router = useRouter()
  const [showArchived, setShowArchived] = useState(false)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null)
  const [archiving, setArchiving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const displayed = games.filter((g) => showArchived ? g.archived : !g.archived)

  const handleArchive = async (gameId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setArchiving(true)
    await archiveGame(createClient(), gameId)
    setArchiving(false)
    setConfirmingId(null)
    router.refresh()
  }

  const handleDelete = async (gameId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setDeleting(true)
    const { error } = await deleteGame(createClient(), gameId)
    setDeleting(false)
    if (error) {
      console.error("Delete failed:", error.message)
      return
    }
    setConfirmingDeleteId(null)
    router.refresh()
  }

  const hasArchived = games.some((g) => g.archived)

  return (
    <section>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Swords className="w-5 h-5 text-muted-foreground" />
          <h2 className="text-sm uppercase tracking-[0.3em] text-muted-foreground">
            Games
          </h2>
          {hasArchived && (
            <button
              onClick={() => setShowArchived(!showArchived)}
              className={`font-sans text-[0.6rem] tracking-widest uppercase border px-2 py-0.5 transition-colors ${
                showArchived
                  ? "border-foreground/30 text-foreground"
                  : "border-border text-muted-foreground"
              }`}
            >
              {showArchived ? "Hide Archived" : "Show Archived"}
            </button>
          )}
        </div>
        <Link href="/game/new">
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
        {displayed.length === 0 ? (
          <div className="border border-border bg-card p-8 text-center">
            <p className="text-muted-foreground text-sm italic font-serif">
              {showArchived
                ? "No archived games."
                : "No adventures await. Create your first game to begin."}
            </p>
          </div>
        ) : (
          displayed.map((game) => (
            <div
              key={game.id}
              onClick={() => router.push(`/game/${game.id}`)}
              className="border border-border bg-card p-4 hover:border-foreground/30 transition-colors group cursor-pointer"
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
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  {game.gm_id === userId && (
                    <span className="text-xs uppercase tracking-widest text-muted-foreground bg-secondary px-2 py-1">
                      DM
                    </span>
                  )}
                  {!game.archived && game.gm_id === userId && (
                    confirmingId === game.id ? (
                      <>
                        <span className="font-sans text-[0.62rem] tracking-widest uppercase text-muted-foreground">
                          Archive?
                        </span>
                        <button
                          onClick={(e) => handleArchive(game.id, e)}
                          disabled={archiving}
                          className="font-sans text-[0.65rem] tracking-widest uppercase bg-transparent border border-destructive/30 text-destructive px-3 py-1.5 cursor-pointer disabled:opacity-50"
                        >
                          {archiving ? "…" : "Yes"}
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setConfirmingId(null) }}
                          className="font-sans text-[0.65rem] tracking-widest uppercase bg-transparent border border-border text-muted-foreground px-3 py-1.5 cursor-pointer"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); setConfirmingId(game.id) }}
                        className="font-sans text-[0.65rem] tracking-widest uppercase bg-transparent border border-border text-muted-foreground px-3 py-1.5 cursor-pointer"
                      >
                        Archive
                      </button>
                    )
                  )}
                  {game.archived && game.gm_id === userId && (
                    confirmingDeleteId === game.id ? (
                      <>
                        <span className="font-sans text-[0.62rem] tracking-widest uppercase text-destructive">
                          Delete forever?
                        </span>
                        <button
                          onClick={(e) => handleDelete(game.id, e)}
                          disabled={deleting}
                          className="font-sans text-[0.65rem] tracking-widest uppercase bg-transparent border border-destructive text-destructive px-3 py-1.5 cursor-pointer disabled:opacity-50"
                        >
                          {deleting ? "…" : "Delete"}
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setConfirmingDeleteId(null) }}
                          className="font-sans text-[0.65rem] tracking-widest uppercase bg-transparent border border-border text-muted-foreground px-3 py-1.5 cursor-pointer"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); setConfirmingDeleteId(game.id) }}
                        className="font-sans text-[0.65rem] tracking-widest uppercase bg-transparent border border-destructive/40 text-destructive/70 px-3 py-1.5 cursor-pointer"
                      >
                        Delete
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  )
}

// ─── Characters List ──────────────────────────────────────────────────────────

function CharactersList({ characters }: { characters: Character[] }) {
  const router = useRouter()
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async (characterId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setDeleting(true)
    const { error } = await deleteCharacter(createClient(), characterId)
    setDeleting(false)
    if (error) {
      console.error("Delete failed:", error.message)
      return
    }
    setConfirmingId(null)
    router.refresh()
  }

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
            <div
              key={character.id}
              onClick={() => router.push(`/characters/${character.id}`)}
              className="border border-border bg-card p-4 hover:border-foreground/30 transition-colors group cursor-pointer"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-serif text-lg text-foreground group-hover:text-foreground/80">
                    {character.name}
                  </h3>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  {confirmingId === character.id ? (
                    <>
                      <span className="font-sans text-[0.62rem] tracking-widest uppercase text-destructive">
                        Delete forever?
                      </span>
                      <button
                        onClick={(e) => handleDelete(character.id, e)}
                        disabled={deleting}
                        className="font-sans text-[0.65rem] tracking-widest uppercase bg-transparent border border-destructive text-destructive px-3 py-1.5 cursor-pointer disabled:opacity-50"
                      >
                        {deleting ? "…" : "Delete"}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setConfirmingId(null) }}
                        className="font-sans text-[0.65rem] tracking-widest uppercase bg-transparent border border-border text-muted-foreground px-3 py-1.5 cursor-pointer"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirmingId(character.id) }}
                      className="font-sans text-[0.65rem] tracking-widest uppercase bg-transparent border border-destructive/40 text-destructive/70 px-3 py-1.5 cursor-pointer"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  )
}
