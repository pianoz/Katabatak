"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import type { Tables } from "@/components/types/supabase"

type EncounterCreature = Tables<"encounter_creatures">

interface CombatLogEntry {
  id: string
  timestamp: string
  creatureName: string
  action: "attack" | "strong_attack" | "defend"
  detail: string
}

const ghostBtnClass =
  "font-sans text-[0.6rem] tracking-widest uppercase bg-transparent border border-border text-muted-foreground px-2 py-1 cursor-pointer disabled:opacity-30"

const attackBtnClass =
  "font-sans text-[0.6rem] tracking-widest uppercase bg-transparent border border-red-800/50 text-red-400 px-3 py-1.5 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed hover:enabled:bg-red-950/20"

const strongBtnClass =
  "font-sans text-[0.6rem] tracking-widest uppercase bg-transparent border border-amber-600/50 text-amber-400 px-3 py-1.5 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed hover:enabled:bg-amber-950/20"

const defendBtnClass =
  "font-sans text-[0.6rem] tracking-widest uppercase bg-transparent border border-cyan-800/50 text-cyan-400 px-3 py-1.5 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed hover:enabled:bg-cyan-950/20"

const dangerBtnClass =
  "font-sans text-[0.6rem] tracking-widest uppercase bg-transparent border border-destructive/30 text-destructive px-2 py-1 cursor-pointer hover:bg-destructive/10"

const ACTION_LABELS: Record<CombatLogEntry["action"], string> = {
  attack: "Attacks",
  strong_attack: "Strong Attack",
  defend: "Defends",
}

const ACTION_COLORS: Record<CombatLogEntry["action"], string> = {
  attack: "text-red-400",
  strong_attack: "text-amber-400",
  defend: "text-cyan-400",
}

function rollDie(sides: number): number {
  return Math.floor(Math.random() * sides) + 1
}

function nowTimestamp(): string {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
}

function isMagical(c: EncounterCreature): boolean {
  return (c.essence_max ?? 0) > 0
}

function resolvePool(
  c: EncounterCreature,
  primary: "current_power" | "current_will",
  cost: number,
): "power" | "will" | "essence" | null {
  if ((c[primary] ?? 0) >= cost) return primary === "current_power" ? "power" : "will"
  if (isMagical(c) && (c.current_essence ?? 0) >= cost) return "essence"
  return null
}

function canAttack(c: EncounterCreature): boolean {
  return resolvePool(c, "current_power", c.attack_cost ?? 1) !== null
}

function canDefend(c: EncounterCreature): boolean {
  return resolvePool(c, "current_will", c.attack_cost ?? 1) !== null
}

interface PoolBarProps {
  label: string
  current: number
  max: number
  color: string
}

function PoolBar({ label, current, max, color }: PoolBarProps) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex justify-between items-baseline">
        <span className="text-[9px] uppercase tracking-widest text-muted-foreground/70">{label}</span>
        <span className="text-[9px] font-mono text-muted-foreground">{current}/{max}</span>
      </div>
      <div className="h-1.5 bg-border/40 w-full">
        <div className="h-full transition-all duration-150" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  )
}

interface CombatPanelProps {
  gameId: string
  refreshKey: number
}

export function CombatPanel({ gameId, refreshKey }: CombatPanelProps) {
  const [creatures, setCreatures] = useState<EncounterCreature[]>([])
  const [loading, setLoading] = useState(true)
  const logKey = `combat-log-${gameId}`

  const [log, setLog] = useState<CombatLogEntry[]>(() => {
    if (typeof window === "undefined") return []
    try {
      const stored = localStorage.getItem(logKey)
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  })

  useEffect(() => {
    setLoading(true)
    createClient()
      .from("encounter_creatures")
      .select("*")
      .eq("game_id", gameId)
      .order("created_at")
      .then(({ data }) => {
        if (data) setCreatures(data as EncounterCreature[])
        setLoading(false)
      })
  }, [gameId, refreshKey])

  useEffect(() => {
    localStorage.setItem(logKey, JSON.stringify(log.slice(-100)))
  }, [log, logKey])

  function addLog(creatureName: string, action: CombatLogEntry["action"], detail: string) {
    setLog((prev) => [
      ...prev,
      { id: crypto.randomUUID(), timestamp: nowTimestamp(), creatureName, action, detail },
    ])
  }

  async function spendPool(id: string, pool: "power" | "will" | "essence", cost: number) {
    const field = `current_${pool}` as "current_power" | "current_will" | "current_essence"
    const creature = creatures.find((c) => c.id === id)
    if (!creature) return
    const newVal = Math.max(0, (creature[field] ?? 0) - cost)
    setCreatures((prev) => prev.map((c) => (c.id === id ? { ...c, [field]: newVal } : c)))
    await createClient().from("encounter_creatures").update({ [field]: newVal } as { current_power?: number | null }).eq("id", id)
  }

  async function handleHpChange(id: string, delta: number) {
    const creature = creatures.find((c) => c.id === id)
    if (!creature) return
    const newHp = Math.max(0, Math.min(creature.health_max ?? 0, (creature.current_health ?? 0) + delta))
    const isAlive = newHp > 0
    await createClient()
      .from("encounter_creatures")
      .update({ current_health: newHp, is_alive: isAlive })
      .eq("id", id)
    setCreatures((prev) =>
      prev.map((c) => (c.id === id ? { ...c, current_health: newHp, is_alive: isAlive } : c))
    )
  }

  // New function to clear a defeated creature
  async function handleRemove(id: string) {
    setCreatures((prev) => prev.filter((c) => c.id !== id))
    await createClient()
      .from("encounter_creatures")
      .delete()
      .eq("id", id)
  }

  async function handleAttack(creature: EncounterCreature, isStrong: boolean) {
    const cost = creature.attack_cost ?? 1
    const pool = resolvePool(creature, "current_power", cost)
    if (!pool) return

    const sides = isStrong
      ? (creature.strong_attack ?? creature.attack_damage ?? 6)
      : (creature.attack_damage ?? 6)
    const roll = rollDie(sides)

    await spendPool(creature.id, pool, cost)
    addLog(
      creature.name,
      isStrong ? "strong_attack" : "attack",
      `1d${sides} = ${roll}  [${cost} ${pool} spent]`,
    )
  }

  async function handleDefend(creature: EncounterCreature) {
    const cost = creature.attack_cost ?? 1
    const pool = resolvePool(creature, "current_will", cost)
    if (!pool) return

    await spendPool(creature.id, pool, cost)
    addLog(creature.name, "defend", `AC ${creature.defence ?? 0}  [${cost} ${pool} spent]`)
  }

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Creature list */}
      <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-3">
        <div className="font-sans text-[0.6rem] tracking-[0.2em] uppercase text-muted-foreground mb-1">
          Active Encounter
        </div>

        {loading ? (
          <p className="font-sans text-xs text-muted-foreground uppercase tracking-widest text-center py-8">
            Loading…
          </p>
        ) : creatures.length === 0 ? (
          <p className="font-serif text-sm text-muted-foreground/40 italic text-center py-8">
            No creatures in the encounter. Add them from the Creatures Tab.
          </p>
        ) : (
          creatures.map((c) => {
            const cost = c.attack_cost ?? 1
            const magical = isMagical(c)
            const attackable = c.is_alive && canAttack(c)
            const defendable = c.is_alive && canDefend(c)

            return (
              <div
                key={c.id}
                className={`border border-border bg-card p-4 flex flex-col gap-3 transition-opacity ${!c.is_alive ? "opacity-60" : ""}`}
              >
                {/* Name & Status */}
                <div className="flex items-baseline gap-2">
                  <span className="font-serif text-base text-foreground">{c.name}</span>
                  {c.level != null && (
                    <span className="text-[9px] uppercase tracking-widest text-muted-foreground/60">
                      Lvl {c.level}
                    </span>
                  )}
                  {magical && (
                    <span className="text-[9px] uppercase tracking-widest text-cyan-500/60">
                      Magical
                    </span>
                  )}
                  
                  {/* Defeated Status and Clear Button */}
                  {!c.is_alive && (
                    <div className="ml-auto flex items-center gap-3">
                      <span className="text-[9px] uppercase tracking-widest text-destructive/70">
                        Defeated
                      </span>
                      <button
                        onClick={() => handleRemove(c.id)}
                        className={dangerBtnClass}
                        title="Remove from encounter"
                      >
                        Clear
                      </button>
                    </div>
                  )}
                </div>

                {/* HP bar + controls */}
                {c.health_max != null && c.health_max > 0 && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleHpChange(c.id, -1)}
                      disabled={!c.is_alive}
                      className={ghostBtnClass}
                    >
                      −
                    </button>
                    <div className="flex-1 flex flex-col gap-0.5">
                      <div className="flex justify-between">
                        <span className="text-[9px] uppercase tracking-widest text-muted-foreground/70">HP</span>
                        <span className="text-[9px] font-mono text-muted-foreground">
                          {c.current_health}/{c.health_max}
                        </span>
                      </div>
                      <div className="h-1.5 bg-border/40 w-full">
                        <div
                          className="h-full transition-all duration-150"
                          style={{
                            width: `${Math.max(0, Math.min(100, ((c.current_health ?? 0) / c.health_max) * 100))}%`,
                            backgroundColor: c.is_alive ? "#ef4444" : "#555",
                          }}
                        />
                      </div>
                    </div>
                    <button
                      onClick={() => handleHpChange(c.id, +1)}
                      disabled={!c.is_alive && c.current_health === 0} // Allow reviving if they were cleared
                      className={ghostBtnClass}
                    >
                      +
                    </button>
                  </div>
                )}

                {/* Pool bars */}
                <div className="flex flex-col gap-1.5">
                  {(c.power_max ?? 0) > 0 && (
                    <PoolBar label="Power" current={c.current_power ?? 0} max={c.power_max!} color="#3b82f6" />
                  )}
                  {(c.will_max ?? 0) > 0 && (
                    <PoolBar label="Will" current={c.current_will ?? 0} max={c.will_max!} color="#8b5cf6" />
                  )}
                  {magical && (
                    <PoolBar label="Essence" current={c.current_essence ?? 0} max={c.essence_max!} color="#06b6d4" />
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex gap-3 flex-wrap border-t border-border/40 pt-3">
                  {c.attack_damage != null && (
                    <div className="flex flex-col items-center gap-1">
                      <button
                        onClick={() => handleAttack(c, false)}
                        disabled={!attackable}
                        className={attackBtnClass}
                      >
                        Attack
                      </button>
                      <span className="text-[9px] font-mono text-muted-foreground/50">
                        1d{c.attack_damage} · {cost}P
                      </span>
                    </div>
                  )}

                  {c.strong_attack != null && (
                    <div className="flex flex-col items-center gap-1">
                      <button
                        onClick={() => handleAttack(c, true)}
                        disabled={!attackable}
                        className={strongBtnClass}
                      >
                        Strong Attack
                      </button>
                      <span className="text-[9px] font-mono text-muted-foreground/50">
                        1d{c.strong_attack} · {cost}P
                      </span>
                    </div>
                  )}

                  {c.defence != null && (
                    <div className="flex flex-col items-center gap-1">
                      <button
                        onClick={() => handleDefend(c)}
                        disabled={!defendable}
                        className={defendBtnClass}
                      >
                        Defend
                      </button>
                      <span className="text-[9px] font-mono text-muted-foreground/50">
                        AC {c.defence} · {cost}W
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Combat log */}
      <div className="w-72 shrink-0 border-l border-border flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Combat Log</span>
          <button onClick={() => setLog([])} className={dangerBtnClass}>
            Clear
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
          {log.length === 0 ? (
            <p className="font-serif text-xs text-muted-foreground/30 italic text-center py-4">
              No actions yet.
            </p>
          ) : (
            [...log].reverse().map((entry) => (
              <div key={entry.id} className="border border-border/20 px-3 py-2 flex flex-col gap-0.5">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[9px] font-mono text-muted-foreground/40 shrink-0">
                    {entry.timestamp}
                  </span>
                  <span className={`text-[9px] uppercase tracking-widest font-sans ${ACTION_COLORS[entry.action]}`}>
                    {ACTION_LABELS[entry.action]}
                  </span>
                </div>
                <span className="font-serif text-xs text-foreground/80">{entry.creatureName}</span>
                <span className="font-mono text-[10px] text-muted-foreground">{entry.detail}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}