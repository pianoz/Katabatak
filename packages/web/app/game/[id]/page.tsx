"use client"

import { useState, use, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { getGameWithMembers, archiveGame } from "@/lib/services/game-service"
import { getAllItems, createItem as createItemSvc } from "@/lib/services/item-service"
import { getAllSpells, createSpell as createSpellSvc } from "@/lib/services/spell-service"
import { addCreaturesToEncounter } from "@/lib/services/encounter-service"
import { Header } from "@/components/header"
import type { Item as InventoryItem, GameCharacter } from "@/features/characters/components/inventory/item-table"
import { GrantItemToCharacterModal } from "@/features/games/modals/grant-item-to-character-modal"
import { GrantRewardModal } from "@/features/games/modals/grant-reward-modal"
import { GrantConditionModal } from "@/features/games/modals/grant-condition-modal"
import type { Game, Character, Spell, Item as CatalogItem } from "@/components/types/types"
import type { SpellE } from "@/features/characters/components/spells/spell-section"
import { CreateSpellModal } from "@/components/create-spell-modal"
import { CreateItemModal } from "@/components/create-item-modal"
import { InspectItemModal } from "@/features/characters/components/inventory/inspect-item-modal"
import { CharactersPanel } from "@/features/games/components/panels/characters-panel"
import { ItemsPanel } from "@/features/games/components/panels/items-panel"
import { SpellsPanel } from "@/features/games/components/panels/spells-panel"
import { CreaturesPanel } from "@/features/games/components/panels/creatures-panel"
import { CombatTabPanel } from "@/features/games/components/panels/combat-tab-panel"
import { LogsPanel } from "@/features/games/components/panels/logs-panel"
import { SettingsPanel } from "@/features/games/components/panels/settings-panel"
import { KickPlayerModal } from "@/features/games/components/kick-player-modal"
import { arrayMove } from "@dnd-kit/sortable"
import { type DragEndEvent } from "@dnd-kit/core"
import type { Tables } from "@/components/types/supabase"

type Creature = Tables<"creatures">

interface GameLog {
  id: string
  timestamp: string
  type: "system" | "combat" | "item" | "player"
  message: string
}

type ActivePanel = "characters" | "items" | "spells" | "creatures" | "combat" | "logs" | "settings"

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
  combat_phase: null,
  is_private: false,
  starting_level: 0,
}

const ghostBtnClass =
  "font-sans text-[0.65rem] tracking-widest uppercase bg-transparent border border-border text-muted-foreground px-3 py-1.5 cursor-pointer"

const dangerBtnClass =
  "font-sans text-[0.65rem] tracking-widest uppercase bg-transparent border border-destructive/30 text-destructive px-3 py-1.5 cursor-pointer disabled:opacity-50"

export default function GameDashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const { id: gameId } = use(params)

  const [game, setGame] = useState<Game>(NULL_GAME)
  const [characters, setCharacters] = useState<Character[]>([])
  const [characterOrder, setCharacterOrder] = useState<string[]>([])
  const [memberProfileIds, setMemberProfileIds] = useState<Set<string>>(new Set())
  const [items, setItems] = useState<InventoryItem[]>([])
  const [catalogSpells, setCatalogSpells] = useState<Spell[]>([])
  const [logs] = useState<GameLog[]>([])
  const [isGM, setIsGM] = useState(false)
  const [activePanel, setActivePanel] = useState<ActivePanel>("characters")
  const [archiveConfirm, setArchiveConfirm] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const [createItemOpen, setCreateItemOpen] = useState(false)
  const [createSpellOpen, setCreateSpellOpen] = useState(false)
  const [inspectedItem, setInspectedItem] = useState<InventoryItem | null>(null)
  const [grantItemTarget, setGrantItemTarget] = useState<{ item: InventoryItem; gameCharacters: GameCharacter[] } | null>(null)
  const [grantRewardOpen, setGrantRewardOpen] = useState(false)
  const [grantConditionOpen, setGrantConditionOpen] = useState(false)
  const [kickOpen, setKickOpen] = useState(false)
  const [encounterRefreshKey, setEncounterRefreshKey] = useState(0)

  useEffect(() => {
    const stored = localStorage.getItem(`game-tab-${gameId}`) as ActivePanel | null
    if (stored) setActivePanel(stored)
  }, [gameId])

  useEffect(() => {
    const supabase = createClient()
    async function fetchGameData() {
      const { data: { user } } = await supabase.auth.getUser()
      const { game: gameData, members } = await getGameWithMembers(supabase, gameId)
      if (gameData) {
        setGame(gameData as Game)
        if (user) setIsGM(user.id === gameData.gm_id)
      }
      if (members) {
        setMemberProfileIds(new Set(
          members
            .filter((m: any) => m.member_status === "active" || m.member_status === "invited")
            .map((m: any) => m.profile_id)
            .filter(Boolean)
        ))
        const chars = members.map((m: any) => m.characters).filter(Boolean)
        setCharacters(chars as Character[])
      }
    }
    fetchGameData()
  }, [gameId])

  useEffect(() => { setCharacterOrder(characters.map((c) => c.id)) }, [characters])
  useEffect(() => { localStorage.setItem(`game-tab-${gameId}`, activePanel) }, [activePanel, gameId])

  useEffect(() => {
    if (!isGM) return
    const supabase = createClient()
    getAllItems(supabase).then((data) => setItems(data as unknown as InventoryItem[]))
    getAllSpells(supabase).then((data) => setCatalogSpells(data as Spell[]))
  }, [isGM])

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setCharacterOrder((prev) => {
      const from = prev.indexOf(String(active.id))
      const to = prev.indexOf(String(over.id))
      return arrayMove(prev, from, to)
    })
  }

  async function handleCreateItem(item: Omit<CatalogItem, "id">) {
    const supabase = createClient()
    const { data } = await createItemSvc(supabase, item as Record<string, unknown>)
    if (data) setItems((prev) => [...prev, data as unknown as InventoryItem])
  }

  async function handleCreateSpell(spell: Omit<Spell, "id">) {
    const supabase = createClient()
    const { data } = await createSpellSvc(supabase, spell as Record<string, unknown>)
    if (data) setCatalogSpells((prev) => [...prev, data as Spell])
  }

  async function handleAddToEncounter(selectedCreatures: Creature[]) {
    const supabase = createClient()
    await addCreaturesToEncounter(supabase, gameId, selectedCreatures)
    setEncounterRefreshKey((k) => k + 1)
  }

  const handleArchive = async () => {
    setArchiving(true)
    const supabase = createClient()
    await archiveGame(supabase, game.id)
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

  const gameCharacters = characters.map(c => ({ id: c.id, name: c.name }))

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
                <button onClick={handleArchive} disabled={archiving} className={dangerBtnClass}>
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
              borderBottom: activePanel === key ? "1px solid oklch(0.65 0.005 90 / 0.5)" : "1px solid transparent",
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
        {activePanel === "characters" && (
          <CharactersPanel
            gameId={gameId}
            isGM={isGM}
            characters={characters}
            characterOrder={characterOrder}
            memberProfileIds={memberProfileIds}
            onDragEnd={handleDragEnd}
            onInvited={(id) => setMemberProfileIds((prev) => new Set([...prev, id]))}
            onKickOpen={() => setKickOpen(true)}
            onGrantRewardOpen={() => setGrantRewardOpen(true)}
            onGrantConditionOpen={() => setGrantConditionOpen(true)}
          />
        )}
        {activePanel === "items" && (
          <ItemsPanel
            isGM={isGM}
            items={items}
            gameCharacters={gameCharacters}
            onCreateItem={() => setCreateItemOpen(true)}
            onInspect={setInspectedItem}
            onGrantToCharacter={(item, chars) => setGrantItemTarget({ item, gameCharacters: chars })}
          />
        )}
        {activePanel === "spells" && (
          <SpellsPanel
            isGM={isGM}
            catalogSpells={catalogSpells as unknown as SpellE[]}
            gameId={gameId}
            gameCharacters={gameCharacters}
            onCreateSpell={() => setCreateSpellOpen(true)}
          />
        )}
        {activePanel === "creatures" && isGM && (
          <CreaturesPanel
            gameId={gameId}
            encounterRefreshKey={encounterRefreshKey}
            onAddToEncounter={handleAddToEncounter}
          />
        )}
        {activePanel === "combat" && isGM && (
          <CombatTabPanel gameId={gameId} encounterRefreshKey={encounterRefreshKey} />
        )}
        {activePanel === "logs" && <LogsPanel logs={logs} />}
        {activePanel === "settings" && <SettingsPanel game={game} />}
      </div>

      <InspectItemModal item={inspectedItem} onClose={() => setInspectedItem(null)} />
      <CreateItemModal isOpen={createItemOpen} onClose={() => setCreateItemOpen(false)} onSubmit={handleCreateItem} />
      <CreateSpellModal isOpen={createSpellOpen} onClose={() => setCreateSpellOpen(false)} onSubmit={handleCreateSpell} />
      {grantItemTarget && (
        <GrantItemToCharacterModal
          item={grantItemTarget.item}
          gameCharacters={grantItemTarget.gameCharacters}
          gameId={gameId}
          onClose={() => setGrantItemTarget(null)}
          onGranted={(itemId, charId) => setItems(prev => prev.map(i => i.id === itemId ? { ...i, character_id: charId } : i))}
        />
      )}
      {grantRewardOpen && (
        <GrantRewardModal
          gameCharacters={gameCharacters}
          gameId={gameId}
          onClose={() => setGrantRewardOpen(false)}
        />
      )}
      {grantConditionOpen && isGM && (
        <GrantConditionModal
          gameCharacters={gameCharacters}
          onClose={() => setGrantConditionOpen(false)}
        />
      )}
      {kickOpen && isGM && (
        <KickPlayerModal
          gameId={gameId}
          characters={characters}
          onClose={() => setKickOpen(false)}
          onKicked={(characterId, profileId) => {
            setCharacters((prev) => prev.filter((c) => c.id !== characterId))
            setCharacterOrder((prev) => prev.filter((id) => id !== characterId))
            if (profileId) {
              setMemberProfileIds((prev) => {
                const next = new Set(prev)
                next.delete(profileId)
                return next
              })
            }
          }}
        />
      )}
    </div>
  )
}
