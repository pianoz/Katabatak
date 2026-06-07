"use client"

import { useState } from "react"
import { Character } from "@/components/types/types"
import { createClient } from "@/lib/supabase/client"
import { useCharacterStore } from "@/features/characters/hooks/use-character-store"
import { logRollEvent } from "@/lib/services/roll-service"

type PoolName = "Essence" | "Power" | "Will"

const POOL_COLOR: Record<PoolName, string> = {
  Essence: "text-cyan-400",
  Power:   "text-muted-foreground",
  Will:    "text-muted-foreground",
}

const POOLS: PoolName[] = ["Essence", "Power", "Will"]

interface RollEntry {
  pool: PoolName
  die: number
  base: number
  sacrifice: number
  total: number
}

interface PendingRoll {
  pool: PoolName
  die: number
  base: number
}

interface PoolRollModalProps {
  pending: PendingRoll
  currentPool: number
  onAccept: (sacrifice: number) => void
  onCancel: () => void
}

function PoolRollModal({ pending, currentPool, onAccept, onCancel }: PoolRollModalProps) {
  const [sacrifice, setSacrifice] = useState(0)
  const total = pending.die + pending.base + sacrifice
  const localAvail = currentPool - sacrifice
  const poolColor = POOL_COLOR[pending.pool]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="w-96 border border-border bg-background">
        <div className="px-4 py-3 border-b border-border bg-secondary/10">
          <p className="text-[10px] uppercase tracking-[0.25em] font-bold text-muted-foreground">Pool Check</p>
          <p className={`font-serif text-lg ${poolColor}`}>{pending.pool}</p>
        </div>

        {/* Formula */}
        <div className="px-6 py-6 border-b border-border flex items-end justify-center gap-3">
          <div className="flex flex-col items-center gap-1.5">
            <p className="text-[8px] uppercase tracking-widest text-muted-foreground/40">Roll</p>
            <span className="text-2xl tabular-nums text-foreground">{pending.die}</span>
          </div>

          <span className="text-muted-foreground/30 text-lg mb-0.5">+</span>

          <div className="flex flex-col items-center gap-1.5">
            <p className="text-[8px] uppercase tracking-widest text-muted-foreground/40">Base</p>
            <span className="text-2xl tabular-nums text-muted-foreground">{pending.base}</span>
          </div>

          <span className="text-muted-foreground/30 text-lg mb-0.5">+</span>

          <div className="flex flex-col items-center gap-1.5">
            <p className="text-[8px] uppercase tracking-widest text-muted-foreground/40">Sacrifice</p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSacrifice(s => Math.max(0, s - 1))}
                disabled={sacrifice === 0}
                className="w-7 h-7 border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground/30 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
              >
                <span className="text-base leading-none select-none">−</span>
              </button>
              <span className={`text-6xl leading-none w-12 text-center tabular-nums ${sacrifice > 0 ? "text-cyan-400" : "text-foreground border-b-2 border-foreground/20"}`}>
                {sacrifice}
              </span>
              <button
                onClick={() => setSacrifice(s => Math.min(currentPool, s + 1))}
                disabled={localAvail <= 0}
                className="w-7 h-7 border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground/30 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
              >
                <span className="text-base leading-none select-none">+</span>
              </button>
            </div>
          </div>

          <span className="text-muted-foreground/30 text-lg mb-0.5">=</span>

          <div className="flex flex-col items-center gap-1.5">
            <p className="text-[8px] uppercase tracking-widest text-muted-foreground/40">Total</p>
            <span className="text-2xl tabular-nums text-foreground">{total}</span>
          </div>
        </div>

        {/* Pool availability */}
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <span className={`font-serif text-sm ${poolColor}`}>{pending.pool}</span>
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl tabular-nums transition-colors ${sacrifice > 0 ? poolColor : "text-foreground"}`}>
              {localAvail}
            </span>
            <span className="text-[9px] uppercase tracking-widest text-muted-foreground/40">avail</span>
          </div>
        </div>

        <div className="flex">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-3 text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground hover:bg-secondary/20 border-r border-border transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onAccept(sacrifice)}
            className="flex-1 px-4 py-3 text-[10px] uppercase tracking-widest text-foreground bg-secondary/10 hover:bg-secondary/30 transition-colors"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  )
}

interface PoolCheckPanelProps {
  character: Character
}

export function PoolCheckPanel({ character }: PoolCheckPanelProps) {
  const [history, setHistory] = useState<RollEntry[]>([])
  const [pending, setPending] = useState<PendingRoll | null>(null)

  const baseFor: Record<PoolName, number> = {
    Essence: Math.floor((character.essence_max ?? 0) / 2),
    Power:   Math.floor((character.power_max   ?? 0) / 2),
    Will:    Math.floor((character.will_max    ?? 0) / 2),
  }

  const currentFor: Record<PoolName, number> = {
    Essence: character.current_essence ?? 0,
    Power:   character.current_power   ?? 0,
    Will:    character.current_will    ?? 0,
  }

  const handleRoll = (pool: PoolName) => {
    const die = Math.floor(Math.random() * 20) + 1
    setPending({ pool, die, base: baseFor[pool] })
  }

  const handleAccept = async (sacrifice: number) => {
    if (!pending) return
    const total = pending.die + pending.base + sacrifice

    setHistory(prev => [{
      pool: pending.pool,
      die: pending.die,
      base: pending.base,
      sacrifice,
      total,
    }, ...prev].slice(0, 20))

    if (sacrifice > 0) {
      const storePool = pending.pool.toLowerCase() as "essence" | "power" | "will"
      const newVal = currentFor[pending.pool] - sacrifice
      useCharacterStore.getState().updatePool(storePool, newVal)
    }

    const supabase = createClient()
    await logRollEvent(supabase, {
      character_id: character.id,
      type: "check",
      base_roll: pending.die,
      modifier: pending.base + sacrifice,
      total,
      context: { pool: pending.pool, sacrifice },
    })

    setPending(null)
  }

  return (
    <>
      {pending && (
        <PoolRollModal
          pending={pending}
          currentPool={currentFor[pending.pool]}
          onAccept={handleAccept}
          onCancel={() => setPending(null)}
        />
      )}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-0 border border-border">
        {POOLS.map(pool => (
          <div key={pool} className="border-r border-border last:border-r-0 border-b md:border-b-0">
            <div className="px-3 py-2 border-b border-border bg-secondary/10">
              <p className={`text-[10px] uppercase tracking-[0.25em] font-bold ${POOL_COLOR[pool]}`}>
                {pool}
              </p>
              <p className="text-[9px] text-muted-foreground/50 uppercase tracking-widest">
                base +{baseFor[pool]}
              </p>
            </div>
            <div className="p-2">
              <button
                onClick={() => handleRoll(pool)}
                className={`w-full py-3 border font-serif tracking-[0.3em] uppercase text-sm transition-all ${
                  pool === "Essence"
                    ? "border-cyan-500/40 text-cyan-100 hover:bg-cyan-950/20 hover:border-cyan-500/70 hover:shadow-[0_0_12px_rgba(34,211,238,0.12)]"
                    : "border-border/60 text-muted-foreground hover:text-foreground hover:border-foreground/30 hover:bg-secondary/30"
                }`}
              >
                Roll
              </button>
            </div>
          </div>
        ))}

        {/* Roll log — 5th column */}
        <div className="border-l border-border bg-background/50 backdrop-blur-sm col-span-2 md:col-span-1">
          <div className="px-3 py-2 border-b border-border bg-secondary/20">
            <p className="text-[11px] uppercase tracking-[0.2em] font-extrabold text-foreground">
              Roll Log
            </p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mt-0.5">
              d20 + base + sac
            </p>
          </div>
          <div className="p-2 space-y-1.5 overflow-y-auto max-h-32">
            {history.length === 0 ? (
              <p className="text-xs text-muted-foreground/60 italic font-serif px-1 py-1">
                No rolls yet.
              </p>
            ) : (
              history.map((entry, i) => (
                <div
                  key={i}
                  className={`flex items-center justify-between px-2 py-1.5 rounded-sm transition-colors ${
                    i === 0
                      ? "border border-border bg-secondary/40 shadow-sm"
                      : "opacity-80 hover:opacity-100"
                  }`}
                >
                  <div>
                    <span className={`text-[11px] font-semibold uppercase tracking-wide block leading-tight ${POOL_COLOR[entry.pool]}`}>
                      {entry.pool}
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-normal">
                      {entry.die}+{entry.base}{entry.sacrifice > 0 ? `+${entry.sacrifice}` : ""}
                    </span>
                  </div>
                  <span className="font-serif text-base font-bold text-foreground">
                    {entry.total}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  )
}
