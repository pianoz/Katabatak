"use client"

import { useState, use, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Header } from "@/components/header"
import { ItemTable } from "@/components/item-table"
import type { Item as InventoryItem, GameCharacter } from "@/components/item-table"
import { GrantItemToCharacterModal } from "@/components/grant-item-to-character-modal"
import { GrantRewardModal } from "@/components/grant-reward-modal"
import { SpellTable } from "@/components/spell-section"
import { CharacterCard } from "@/components/character-card"
import type { Game, Character, Spell, Item as CatalogItem } from "@/components/types/types"
import { CreateSpellModal } from '../../../components/create-spell-modal';
import { CreateItemModal } from "@/components/create-item-modal"
import { CreatureSection } from "@/components/creature-section"
import { EncounterPanel } from "@/components/encounter-panel"
import { CombatPanel } from "@/components/combat-panel"
import { InspectItemModal } from "@/components/inspect-item-modal"
import type { Tables } from "@/components/types/supabase"
import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core"
import { SortableContext, horizontalListSortingStrategy, arrayMove } from "@dnd-kit/sortable"

type Creature = Tables<"creatures">

// ─── Types ────────────────────────────────────────────────────────────────────

interface GameLog {
  id: string
  timestamp: string
  type: "system" | "combat" | "item" | "player"
  message: string
}

type ActivePanel = "characters" | "items" | "spells" | "creatures" | "combat" | "logs" | "settings"

// ─── Null placeholder ─────────────────────────────────────────────────────────
// TODO: replace with Supabase fetch in useEffect using params.id

const NULL_GAME: Game = {
  id: "",
  gm_id: "",
  name: "—",
  join_code: "",
  created_at: "",
  gm_profile_id: null,
  archived: false,
  session_number: 0,
  is_in_session: false,
  is_in_combat: false,
  current_turn_order: [],
  active_turn_index: 0,
  combat_log: [],
  is_private: false,
  starting_level: 0,
}

// ─── Shared classes ───────────────────────────────────────────────────────────

const ghostBtnClass =
  "font-sans text-[0.65rem] tracking-widest uppercase bg-transparent border border-border text-muted-foreground px-3 py-1.5 cursor-pointer"

const dangerBtnClass =
  "font-sans text-[0.65rem] tracking-widest uppercase bg-transparent border border-destructive/30 text-destructive px-3 py-1.5 cursor-pointer disabled:opacity-50"

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-sans text-[0.6rem] tracking-[0.2em] uppercase text-muted-foreground mb-3">
      {children}
    </div>
  )
}

function GameLogPanel({ logs }: { logs: GameLog[] }) {
  const iconMap: Record<GameLog["type"], string> = {
    system: "⚙",
    combat: "⚔",
    item: "◈",
    player: "◉",
  }
  if (logs.length === 0) {
    return (
      <p className="font-serif text-sm text-muted-foreground/40 italic">No log entries yet.</p>
    )
  }
  return (
    <div className="flex flex-col">
      {logs.map((log) => (
        <div key={log.id} className="flex gap-3 py-3 border-b border-border/30">
          <span className="font-sans text-[0.65rem] tracking-wide text-muted-foreground/40 shrink-0 pt-0.5">
            {log.timestamp}
          </span>
          <span className="text-muted-foreground/30 shrink-0 text-sm">{iconMap[log.type]}</span>
          <span className="font-serif text-sm text-muted-foreground">{log.message}</span>
        </div>
      ))}
    </div>
  )
}

function GameSettingsPanel({ game }: { game: Game }) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <SectionLabel>Session Info</SectionLabel>
        <div className="bg-card border border-border overflow-hidden">
          {[
            ["Game ID", game.id || "—"],
            ["Session", game.session_number],
            ["Join Code", game.join_code || "—"],
          ].map(([label, val]) => (
            <div
              key={String(label)}
              className="flex justify-between px-4 py-2.5 border-b border-border/40 last:border-b-0"
            >
              <span className="font-sans text-[0.65rem] tracking-widest uppercase text-muted-foreground">
                {label}
              </span>
              <span className="font-sans text-sm text-foreground/80">{val}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <SectionLabel>Danger Zone</SectionLabel>
        <div className="flex gap-2">
          <button
            className={dangerBtnClass}
            onClick={() => {
              // TODO: call updateGameStatus(game.id, "ended") with confirmation
            }}
          >
            End Game
          </button>
        </div>
      </div>
    </div>
  )
}

function KickPlayerModal({
  gameId,
  characters,
  onClose,
  onKicked,
}: {
  gameId: string
  characters: Character[]
  onClose: () => void
  onKicked: (characterId: string) => void
}) {
  const [selectedId, setSelectedId] = useState("")
  const [kicking, setKicking] = useState(false)

  const handleKick = async () => {
    if (!selectedId) return
    setKicking(true)
    const supabase = createClient()
    await supabase.from("characters").update({ in_game: false }).eq("id", selectedId)
    await supabase.from("game_members").update({ character_id: null }).eq("game_id", gameId).eq("character_id", selectedId)
    onKicked(selectedId)
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

type RollEntry = { die: number; count: number; rolls: number[]; sum: number }

function DicePanel() {
  const [diceCount, setDiceCount] = useState(1)
  const [history, setHistory] = useState<RollEntry[]>([])

  const DICE = [2, 4, 6, 8, 10, 12, 20, 100]

  function roll(sides: number) {
    const rolls = Array.from({ length: diceCount }, () => Math.floor(Math.random() * sides) + 1)
    const sum = rolls.reduce((a, b) => a + b, 0)
    setHistory((prev) => [{ die: sides, count: diceCount, rolls, sum }, ...prev].slice(0, 5))
  }

  return (
    <div className="w-90 shrink-0 border-l border-border p-5 overflow-y-auto flex flex-col gap-4">
      <SectionLabel>Dice Roller</SectionLabel>
      <div className="flex gap-4">
        <div className="flex flex-col gap-2 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-sans text-[0.55rem] tracking-widest uppercase text-muted-foreground/60 shrink-0">
              Count
            </span>
            <select
              value={diceCount}
              onChange={(e) => setDiceCount(Math.min(50, Math.max(1, Number(e.target.value))))}
              className="bg-background border border-border text-foreground font-sans text-xs px-2 py-1 flex-1"
            >
              {Array.from({ length: 50 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {DICE.map((d) => (
              <button key={d} onClick={() => roll(d)} className={ghostBtnClass}>
                d{d}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2 w-36 shrink-0">
          <span className="font-sans text-[0.55rem] tracking-widest uppercase text-muted-foreground/60">
            History
          </span>
          {history.length === 0 ? (
            <p className="font-serif text-xs text-muted-foreground/30 italic">No rolls yet.</p>
          ) : (
            history.map((entry, i) => (
              <div key={i} className="border border-border/30 px-2 py-1.5 flex flex-col gap-0.5">
                <span className="font-sans text-[0.55rem] tracking-widest uppercase text-muted-foreground/50">
                  {entry.count}d{entry.die}
                </span>
                {entry.count > 10 ? (
                  <span className="font-serif text-sm text-foreground">Sum: {entry.sum}</span>
                ) : (
                  <>
                    <span className="font-sans text-xs text-muted-foreground tabular-nums">
                      {entry.rolls.join(", ")}
                    </span>
                    {entry.count > 1 && (
                      <span className="font-sans text-[0.6rem] text-muted-foreground/60">
                        = {entry.sum}
                      </span>
                    )}
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

function InvitePanel({
  gameId,
  memberProfileIds,
  onInvited,
  onKickOpen,
}: {
  gameId: string
  memberProfileIds: Set<string>
  onInvited: (profileId: string) => void
  onKickOpen: () => void
}) {
  const [profiles, setProfiles] = useState<{ id: string; username: string }[]>([])
  const [selectedId, setSelectedId] = useState("")
  const [inviting, setInviting] = useState(false)

  useEffect(() => {
    createClient().from("profiles").select("id, username").order("username")
      .then(({ data }) => { if (data) setProfiles(data.filter((p): p is { id: string; username: string } => p.username !== null)) })
  }, [])

  const available = profiles.filter((p) => !memberProfileIds.has(p.id))

  const handleInvite = async () => {
    if (!selectedId) return
    setInviting(true)
    await createClient().from("game_members").insert({
      game_id: gameId,
      profile_id: selectedId,
      character_id: null,
      role: "player",
      member_status: "invited",
    })
    onInvited(selectedId)
    setSelectedId("")
    setInviting(false)
  }

  return (
    <div className="w-52 shrink-0 border-r border-border p-6 overflow-y-auto flex flex-col gap-3">
      <SectionLabel>Invite Players</SectionLabel>
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function GameDashboardPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const router = useRouter()
  const { id: gameId } = use(params) // TODO: use to fetch game, characters, items, logs from Supabase

  const [game, setGame] = useState<Game>(NULL_GAME)
  const [characters, setCharacters] = useState<Character[]>([])
  const [characterOrder, setCharacterOrder] = useState<string[]>([])
  const [memberProfileIds, setMemberProfileIds] = useState<Set<string>>(new Set())
  const [items, setItems] = useState<InventoryItem[]>([])
  const [catalogSpells, setCatalogSpells] = useState<Spell[]>([])
  const [logs] = useState<GameLog[]>([])
  const [isGM, setIsGM] = useState(false)

  const [activePanel, setActivePanel] = useState<ActivePanel>("characters")

  useEffect(() => {
    const stored = localStorage.getItem(`game-tab-${gameId}`) as ActivePanel | null
    if (stored) setActivePanel(stored)
  }, [gameId])
  const [archiveConfirm, setArchiveConfirm] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const [createItemOpen, setCreateItemOpen] = useState(false)
  const [createSpellOpen, setCreateSpellOpen] = useState(false)
  const [inspectedItem, setInspectedItem] = useState<InventoryItem | null>(null)
  const [grantItemTarget, setGrantItemTarget] = useState<{ item: InventoryItem; gameCharacters: GameCharacter[] } | null>(null)
  const [grantRewardOpen, setGrantRewardOpen] = useState(false)
  const [kickOpen, setKickOpen] = useState(false)
  const [encounterRefreshKey, setEncounterRefreshKey] = useState(0)

  useEffect(() => {
    const supabase = createClient()
    async function fetchGameData() {
      const { data: { user } } = await supabase.auth.getUser()

      const { data: gameData } = await supabase
        .from("games")
        .select("*")
        .eq("id", gameId)
        .single()

      if (gameData) {
        setGame(gameData as Game)
        if (user) setIsGM(user.id === gameData.gm_id)
      }

      const { data: members } = await supabase
        .from("game_members")
        .select("profile_id, characters(*)")
        .eq("game_id", gameId)

      if (members) {
        setMemberProfileIds(new Set(members.map((m: any) => m.profile_id).filter(Boolean)))
        const chars = members.map((m: any) => m.characters).filter(Boolean)
        setCharacters(chars as Character[])
      }
    }
    fetchGameData()
  }, [gameId])

  useEffect(() => {
    setCharacterOrder(characters.map((c) => c.id))
  }, [characters])

  useEffect(() => {
    localStorage.setItem(`game-tab-${gameId}`, activePanel)
  }, [activePanel, gameId])

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setCharacterOrder((prev) => {
      const from = prev.indexOf(String(active.id))
      const to = prev.indexOf(String(over.id))
      return arrayMove(prev, from, to)
    })
  }

  useEffect(() => {
    if (!isGM) return
    const supabase = createClient()
    supabase.from("items").select("*").order("name").then(({ data }) => {
      if (data) setItems(data as unknown as InventoryItem[])
    })
    supabase.from("spells").select("*").order("name").then(({ data }) => {
      if (data) setCatalogSpells(data as Spell[])
    })
  }, [isGM])

  async function handleCreateItem(item: Omit<CatalogItem, "id">) {
    const supabase = createClient()
    const { data } = await supabase.from("items").insert(item).select().single()
    if (data) setItems(prev => [...prev, data as unknown as InventoryItem])
  }

  async function handleCreateSpell(spell: Omit<Spell, "id">) {
    const supabase = createClient()
    const { data } = await supabase.from("spells").insert(spell).select().single()
    if (data) setCatalogSpells(prev => [...prev, data as Spell])
  }

  async function handleAddToEncounter(selectedCreatures: Creature[]) {
    const supabase = createClient()
    const rows = selectedCreatures.map(c => ({
      game_id: gameId,
      creature_id: c.id,
      name: c.name,
      level: c.level,
      attack_damage: c.attack_damage,
      attack_cost: c.attack_cost,
      defence: c.defence,
      strong_attack: c.strong_attack,
      health_max: c.health_max,
      current_health: c.health_max ?? 0,
      power_max: c.power_max,
      current_power: c.power_max ?? 0,
      will_max: c.will_max,
      current_will: c.will_max ?? 0,
      essence_max: c.essence_max,
      current_essence: c.essence_max ?? 0,
      is_alive: true,
    }))
    await supabase.from("encounter_creatures").insert(rows)
    setEncounterRefreshKey(k => k + 1)
  }

  function grantToCharacterModal(item: InventoryItem, gameCharacters: GameCharacter[]) {
    setGrantItemTarget({ item, gameCharacters })
  }

  function handleItemGranted(itemId: string, newCharacterId: string) {
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, character_id: newCharacterId } : i))
  }

  const handleArchive = async () => {
    setArchiving(true)
    const supabase = createClient()
    await supabase.from("games").update({ archived: true }).eq("id", game.id)
    setArchiving(false)
    router.push("/dashboard")
  }

  const navItems: { key: ActivePanel; label: string }[] = [
    { key: "characters", label: "Characters" },
    { key: "items", label: "Items" },
    { key: "spells", label: "Spells" },
    ...(isGM ? [{ key: "creatures" as ActivePanel, label: "Creatures" }] : []),
    ...(isGM ? [{ key: "combat" as ActivePanel, label: "Combat" }] : []),
    { key: "logs", label: "Log" },
    { key: "settings", label: "Settings" },
  ]

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Header characterPage />

      {/* Game sub-header */}
      <div className="mt-14 md:mt-16 shrink-0 flex items-center justify-between px-8 py-4 border-b border-border">
        <div className="flex items-center gap-4">
          <h1 className="font-serif text-xl font-normal">{game.name}</h1>
          {game.is_in_session && (
            <span className="font-sans text-[0.55rem] tracking-widest uppercase text-green-500 border border-green-500/40 px-2 py-0.5">
              Active
            </span>
          )}
        </div>

        {isGM && (
          <div className="flex items-center gap-2">
            {archiveConfirm ? (
              <>
                <span className="font-sans text-[0.62rem] tracking-widest uppercase text-muted-foreground">
                  Confirm archive?
                </span>
                <button
                  onClick={handleArchive}
                  disabled={archiving}
                  className={dangerBtnClass}
                >
                  {archiving ? "Archiving…" : "Yes, Archive"}
                </button>
                <button onClick={() => setArchiveConfirm(false)} className={ghostBtnClass}>
                  Cancel
                </button>
              </>
            ) : (
              <button onClick={() => setArchiveConfirm(true)} className={ghostBtnClass}>
                Archive
              </button>
            )}
          </div>
        )}
      </div>

      {/* Nav tabs */}
      <div className="flex border-b border-border shrink-0">
        {navItems.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActivePanel(key)}
            style={{
              borderBottom:
                activePanel === key
                  ? "1px solid oklch(0.65 0.005 90 / 0.5)"
                  : "1px solid transparent",
              marginBottom: -1,
            }}
            className={`font-sans text-[0.65rem] tracking-widest uppercase px-6 py-3 bg-transparent border-t-0 border-l-0 border-r-0 cursor-pointer transition-colors ${
              activePanel === key ? "text-foreground" : "text-muted-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">

        {/* Characters panel */}
        {activePanel === "characters" && (
          <div className="flex-1 flex overflow-hidden">
            <InvitePanel
              gameId={gameId}
              memberProfileIds={memberProfileIds}
              onInvited={(id) => setMemberProfileIds((prev) => new Set([...prev, id]))}
              onKickOpen={() => setKickOpen(true)}
            />
            <div className="flex-1 p-8 overflow-y-auto">
              {isGM && (
                <div className="flex justify-end mb-4">
                  <button className={ghostBtnClass} onClick={() => setGrantRewardOpen(true)}>
                    Grant Rewards
                  </button>
                </div>
              )}
              {characters.length === 0 ? (
                <p className="font-serif text-sm text-muted-foreground/40 italic text-center">
                  No characters have joined this game yet.
                </p>
              ) : (
                <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={characterOrder} strategy={horizontalListSortingStrategy}>
                    <div className="flex flex-wrap justify-center gap-4">
                      {characterOrder
                        .map((id) => characters.find((c) => c.id === id))
                        .filter(Boolean)
                        .map((character) => (
                          <CharacterCard key={character!.id} character={character!} />
                        ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </div>
            {isGM && <DicePanel />}
          </div>
        )}

        {/* Items panel */}
        {activePanel === "items" && (
          <div className="flex-1 overflow-y-auto px-8 py-6">
            <div className="flex items-center justify-between mb-4">
              <SectionLabel>Items</SectionLabel>
              {isGM && (
                <button className={ghostBtnClass} onClick={() => setCreateItemOpen(true)}>
                  Create Item
                </button>
              )}
            </div>
            <ItemTable
              items={items}
              columns={["name", "type", "short_description", "subtype", "consumable"]}
              emptyMessage="No items in this game yet."
              isGM={isGM}
              gameCharacters={characters.map(c => ({ id: c.id, name: c.name }))}
              onInspect={setInspectedItem}
              onGrantToCharacter={grantToCharacterModal}
            />
          </div>
        )}

        {/* Spells panel */}
        {activePanel === "spells" && (
          <div className="flex-1 overflow-y-auto px-8 py-6">
            <div className="flex items-center justify-between mb-4">
              <SectionLabel>Spells</SectionLabel>
              {isGM && (
                <button className={ghostBtnClass} onClick={() => setCreateSpellOpen(true)}>
                  Create Spell
                </button>
              )}
            </div>
            <SpellTable
              spells={catalogSpells}
              inventory={[]}
              characterId=""
              isOwner={false}
              character={{
                current_power: 0,
                current_will: 0,
                current_essence: 0,
                current_health: 0,
              }}
              updatePool={async () => {}}
              is_gm={isGM}
              gameId={gameId}
              gameCharacters={characters.map(c => ({ id: c.id, name: c.name }))}
            />
          </div>
        )}

        {/* Creatures panel — GM only */}
        {activePanel === "creatures" && isGM && (
          <div className="flex-1 flex overflow-hidden">
            <div className="flex-1 overflow-y-auto px-8 py-6">
              <SectionLabel>Creatures</SectionLabel>
              <CreatureSection onAddToEncounter={handleAddToEncounter} />
            </div>
            <EncounterPanel gameId={gameId} refreshKey={encounterRefreshKey} />
          </div>
        )}

        {/* Combat panel — GM only */}
        {activePanel === "combat" && isGM && (
          <CombatPanel gameId={gameId} refreshKey={encounterRefreshKey} />
        )}

        {/* Log panel */}
        {activePanel === "logs" && (
          <div className="flex-1 overflow-y-auto px-8 py-6">
            <SectionLabel>Game Log</SectionLabel>
            <GameLogPanel logs={logs} />
          </div>
        )}

        {/* Settings panel */}
        {activePanel === "settings" && (
          <div className="flex-1 overflow-y-auto px-8 py-6">
            <GameSettingsPanel game={game} />
          </div>
        )}
      </div>

      <InspectItemModal
        item={inspectedItem}
        onClose={() => setInspectedItem(null)}
      />
      <CreateItemModal
        isOpen={createItemOpen}
        onClose={() => setCreateItemOpen(false)}
        onSubmit={handleCreateItem}
      />
      <CreateSpellModal
        isOpen={createSpellOpen}
        onClose={() => setCreateSpellOpen(false)}
        onSubmit={handleCreateSpell}
      />
      {grantItemTarget && (
        <GrantItemToCharacterModal
          item={grantItemTarget.item}
          gameCharacters={grantItemTarget.gameCharacters}
          gameId={gameId}
          onClose={() => setGrantItemTarget(null)}
          onGranted={handleItemGranted}
        />
      )}
      {grantRewardOpen && (
        <GrantRewardModal
          gameCharacters={characters.map(c => ({ id: c.id, name: c.name }))}
          gameId={gameId}
          onClose={() => setGrantRewardOpen(false)}
        />
      )}
      {kickOpen && isGM && (
        <KickPlayerModal
          gameId={gameId}
          characters={characters}
          onClose={() => setKickOpen(false)}
          onKicked={(characterId) => {
            setCharacters((prev) => prev.filter((c) => c.id !== characterId))
            setCharacterOrder((prev) => prev.filter((id) => id !== characterId))
          }}
        />
      )}
    </div>
  )
}
