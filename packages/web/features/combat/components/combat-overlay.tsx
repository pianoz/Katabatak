"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { CreatureDisplay } from "./creature-display"
import { CombatLogPanel } from "./combat-log-panel"
import { PhaseAControls, PhaseBControls } from "./phase-controls"
import type { Tables } from "@/components/types/supabase"

type EncounterCreature = Tables<"encounter_creatures"> & { ascii_art?: string | null }

interface CharacterState {
  current_health: number | null
  health_max: number | null
  current_power: number | null
  power_max: number | null
  current_will: number | null
  will_max: number | null
  current_essence: number | null
  essence_max: number | null
  name: string
}

export interface WeaponOption {
  inventoryId: string
  name: string
  damage: string | null
  strongDamage: number | null
  cost: number | null
  strongCost: number | null
  costAttribute: string
  isEquipped: boolean
  condition: number | null
  shortDescription: string | null
  subtype: string | null
}

const UNARMED_SYNTHETIC: WeaponOption = {
  inventoryId: '__unarmed__',
  name: 'Unarmed Strike',
  damage: '1d2',
  strongDamage: null,
  cost: 0,
  strongCost: null,
  costAttribute: 'power',
  isEquipped: true,
  condition: null,
  shortDescription: 'Bare hands. Better than nothing.',
  subtype: 'melee',
}

interface CombatOverlayProps {
  gameId: string
  characterId: string
  onCombatEnd?: (outcome: "victory" | "defeat") => void
}

function PoolBar({ label, current, max, color }: { label: string; current: number; max: number; color: string }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0
  return (
    <div className="flex flex-col gap-0.5 min-w-[60px]">
      <div className="flex justify-between">
        <span className="font-mono text-[8px] uppercase tracking-widest text-muted-foreground/60">{label}</span>
        <span className="font-mono text-[8px] text-muted-foreground/60">{current}/{max}</span>
      </div>
      <div className="h-1.5 bg-border/30 w-full">
        <div className="h-full transition-all duration-300" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  )
}

export function CombatOverlay({ gameId, characterId, onCombatEnd }: CombatOverlayProps) {
  const supabase = createClient()

  const [creatures, setCreatures] = useState<EncounterCreature[]>([])
  const [character, setCharacter] = useState<CharacterState | null>(null)
  const [combatPhase, setCombatPhase] = useState<string | null>("player_attack")
  const [combatLog, setCombatLog] = useState<string[]>([])
  const [weapons, setWeapons] = useState<WeaponOption[]>([])
  const [normalDef, setNormalDef] = useState(0)
  const [strongDef, setStrongDef] = useState(0)
  const [selectedWeaponId, setSelectedWeaponId] = useState<string | null>(null)
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [round, setRound] = useState(1)
  const [flashCreatureId, setFlashCreatureId] = useState<string | null>(null)

  // ── Data loaders ────────────────────────────────────────────────────────────

  const loadCreatures = useCallback(async () => {
    const { data } = await supabase
      .from("encounter_creatures")
      .select("*, creatures!inner(ascii_art)")
      .eq("game_id", gameId)
      .order("created_at")
    if (data) {
      const merged = data.map(row => ({
        ...row,
        ascii_art: (row.creatures as unknown as { ascii_art: string | null })?.ascii_art ?? null,
      }))
      setCreatures(merged as EncounterCreature[])
      const firstAlive = merged.find(c => c.is_alive)
      if (firstAlive && !selectedTargetId) setSelectedTargetId(firstAlive.id)
    }
  }, [gameId, supabase, selectedTargetId])

  const loadCharacter = useCallback(async () => {
    const { data } = await supabase
      .from("characters")
      .select("current_health, health_max, current_power, power_max, current_will, will_max, current_essence, essence_max, name")
      .eq("id", characterId)
      .single()
    if (data) setCharacter(data as CharacterState)
  }, [characterId, supabase])

  const loadWeapons = useCallback(async () => {
    const { data } = await supabase
      .from("character_inventory")
      .select("id, is_equipped, condition, items!inner(name, damage, strong_damage, cost, strong_cost, cost_attribute_name, subtype, short_description, type)")
      .eq("character_id", characterId)
    if (data) {
      type InvRow = {
        id: string
        is_equipped: boolean | null
        condition: number | null
        items: {
          name: string
          damage: string | null
          strong_damage: number | null
          cost: number | null
          strong_cost: number | null
          cost_attribute_name: string | null
          subtype: string | null
          short_description: string | null
          type: string | null
        }
      }
      const w: WeaponOption[] = (data as unknown as InvRow[])
        .filter(row => row.items.type === "weapon")
        .map(row => ({
          inventoryId: row.id,
          name: row.items.name,
          damage: row.items.damage,
          strongDamage: row.items.strong_damage,
          cost: row.items.cost,
          strongCost: row.items.strong_cost,
          costAttribute: row.items.cost_attribute_name ?? "power",
          isEquipped: row.is_equipped ?? false,
          condition: row.condition,
          shortDescription: row.items.short_description,
          subtype: row.items.subtype,
        }))

      const result = w.length > 0 ? w : [UNARMED_SYNTHETIC]
      setWeapons(result)
      // Pre-select equipped weapon, or first weapon
      if (!selectedWeaponId || !result.find(x => x.inventoryId === selectedWeaponId)) {
        const equipped = result.find(x => x.isEquipped) ?? result[0]
        setSelectedWeaponId(equipped?.inventoryId ?? null)
      }
    }
  }, [characterId, supabase, selectedWeaponId])

  const loadDefence = useCallback(async () => {
    const { data } = await supabase
      .from("character_inventory")
      .select("items!inner(defence, strong_defence, subtype)")
      .eq("character_id", characterId)
      .eq("is_equipped", true)
    if (data) {
      type ArmourRow = { items: { defence: number | null; strong_defence: number | null; subtype: string | null } }
      const items = (data as unknown as ArmourRow[]).map(r => r.items)
      const base = items.reduce((s, i) => s + (i.defence ?? 0), 0)
      const shield = items
        .filter(i => i.subtype === "shield")
        .reduce((s, i) => s + ((i.strong_defence ?? i.defence) ?? 0), 0)
      setNormalDef(base)
      setStrongDef(base + shield)
    }
  }, [characterId, supabase])

  const loadGameState = useCallback(async () => {
    const { data } = await supabase
      .from("games")
      .select("combat_phase, combat_log")
      .eq("id", gameId)
      .single()
    if (data) {
      const gameRow = data as unknown as { combat_phase: string | null; combat_log: string[] | null }
      setCombatPhase(gameRow.combat_phase ?? null)
      setCombatLog((gameRow.combat_log ?? []) as string[])
    }
  }, [gameId, supabase])

  // ── Initial load ─────────────────────────────────────────────────────────────

  useEffect(() => {
    void Promise.all([loadCreatures(), loadCharacter(), loadWeapons(), loadDefence(), loadGameState()])
  }, [loadCreatures, loadCharacter, loadWeapons, loadDefence, loadGameState])

  // ── Realtime subscriptions ───────────────────────────────────────────────────

  useEffect(() => {
    const gameSub = supabase
      .channel(`combat-game-${gameId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "games", filter: `id=eq.${gameId}` }, (payload) => {
        const row = payload.new as { combat_phase: string | null; combat_log: string[] | null; is_in_combat: boolean | null }
        setCombatPhase(row.combat_phase ?? null)
        setCombatLog((row.combat_log ?? []) as string[])
        if (!row.is_in_combat) {
          const lastLine = row.combat_log?.at(-1) ?? ""
          onCombatEnd?.(lastLine.includes("DEFEAT") ? "defeat" : "victory")
        }
      })
      .subscribe()

    const charSub = supabase
      .channel(`combat-char-${characterId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "characters", filter: `id=eq.${characterId}` }, () => {
        void loadCharacter()
      })
      .subscribe()

    const creatureSub = supabase
      .channel(`combat-creatures-${gameId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "encounter_creatures", filter: `game_id=eq.${gameId}` }, () => {
        void loadCreatures()
      })
      .subscribe()

    return () => {
      void supabase.removeChannel(gameSub)
      void supabase.removeChannel(charSub)
      void supabase.removeChannel(creatureSub)
    }
  }, [gameId, characterId, supabase, loadCharacter, loadCreatures, onCombatEnd])

  // ── Actions ──────────────────────────────────────────────────────────────────

  async function handleAttack(attackType: "normal" | "strong") {
    if (!selectedWeaponId || !selectedTargetId || busy) return
    setBusy(true)
    try {
      const res = await fetch("/api/gm/combat/player-attack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId, characterId, weaponInventoryId: selectedWeaponId, attackType, targetCreatureId: selectedTargetId }),
      })
      const data = await res.json() as { ok?: boolean; combatPhase?: string | null; outcome?: string }
      if (data.ok) {
        setFlashCreatureId(selectedTargetId)
        setTimeout(() => setFlashCreatureId(null), 600)
        if (data.outcome === "victory") onCombatEnd?.("victory")
        else if (data.combatPhase) setCombatPhase(data.combatPhase)
        await Promise.all([loadCreatures(), loadCharacter(), loadWeapons(), loadGameState()])
      }
    } finally {
      setBusy(false)
    }
  }

  async function handleEquip(inventoryId: string) {
    if (busy) return
    setBusy(true)
    try {
      const res = await fetch("/api/gm/combat/player-equip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId, characterId, inventoryId }),
      })
      const data = await res.json() as { ok?: boolean; combatPhase?: string | null }
      if (data.ok) {
        if (data.combatPhase) setCombatPhase(data.combatPhase)
        await Promise.all([loadWeapons(), loadGameState()])
      }
    } finally {
      setBusy(false)
    }
  }

  async function handleDefend(defendType: "normal" | "strong") {
    if (busy) return
    setBusy(true)
    try {
      const res = await fetch("/api/gm/combat/player-defend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId, characterId, defendType }),
      })
      const data = await res.json() as { ok?: boolean; combatPhase?: string | null; outcome?: string }
      if (data.ok) {
        if (data.outcome === "defeat") onCombatEnd?.("defeat")
        else {
          setRound(r => r + 1)
          if (data.combatPhase) setCombatPhase(data.combatPhase)
          await Promise.all([loadCreatures(), loadCharacter(), loadGameState()])
          const { data: alive } = await supabase
            .from("encounter_creatures")
            .select("id")
            .eq("game_id", gameId)
            .eq("is_alive", true)
            .limit(1)
            .single()
          if (alive) setSelectedTargetId(alive.id)
        }
      }
    } finally {
      setBusy(false)
    }
  }

  // ── Derived state ─────────────────────────────────────────────────────────────

  const aliveCreatures = creatures.filter(c => c.is_alive)
  const phaseLabel = combatPhase === "player_attack" ? "YOUR ATTACK" : "INCOMING ATTACK"

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 bg-background/97 flex flex-col animate-in fade-in duration-300">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-6 py-3 border-b border-border/50">
        <div className="flex items-center gap-4">
          <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-muted-foreground/60">Combat</span>
          <span className="font-mono text-[9px] text-muted-foreground/40">Round {round}</span>
        </div>
        <span
          className={[
            "font-mono text-[9px] uppercase tracking-[0.25em]",
            combatPhase === "player_attack" ? "text-red-400/80" : "text-amber-400/80",
          ].join(" ")}
        >
          {phaseLabel}
        </span>
      </div>

      {/* Enemy row — centered */}
      <div className="shrink-0 flex justify-center border-b border-border/40">
        {creatures.map((creature) => (
          <CreatureDisplay
            key={creature.id}
            creature={creature}
            isActiveAttacker={combatPhase === "player_defend" && creature.is_alive === true}
            isFlashing={flashCreatureId === creature.id}
          />
        ))}
      </div>

      {/* Combat log */}
      <div className="flex-1 overflow-hidden border-b border-border/40">
        <CombatLogPanel entries={combatLog} />
      </div>

      {/* Player pools */}
      {character && (
        <div className="shrink-0 flex gap-4 px-6 py-3 border-b border-border/40 bg-card/30">
          <PoolBar label="HP" current={character.current_health ?? 0} max={character.health_max ?? 1} color="#ef4444" />
          <PoolBar label="PW" current={character.current_power ?? 0} max={character.power_max ?? 1} color="#3b82f6" />
          <PoolBar label="WL" current={character.current_will ?? 0} max={character.will_max ?? 1} color="#8b5cf6" />
          {(character.essence_max ?? 0) > 0 && (
            <PoolBar label="ES" current={character.current_essence ?? 0} max={character.essence_max ?? 1} color="#06b6d4" />
          )}
          <span className="font-serif text-sm text-foreground/70 ml-2 self-center">{character.name}</span>
        </div>
      )}

      {/* Phase controls */}
      <div className="shrink-0 bg-card/20">
        {combatPhase === "player_attack" ? (
          <PhaseAControls
            weapons={weapons}
            aliveCreatures={aliveCreatures}
            selectedWeaponId={selectedWeaponId}
            selectedTargetId={selectedTargetId ?? (aliveCreatures[0]?.id ?? null)}
            onSelectWeapon={setSelectedWeaponId}
            onSelectTarget={setSelectedTargetId}
            onAttack={handleAttack}
            onEquip={handleEquip}
            busy={busy}
          />
        ) : (
          <PhaseBControls
            attackerCount={aliveCreatures.length}
            normalDefence={normalDef}
            strongDefence={strongDef}
            currentWill={character?.current_will ?? 0}
            onDefend={handleDefend}
            busy={busy}
          />
        )}
      </div>
    </div>
  )
}
