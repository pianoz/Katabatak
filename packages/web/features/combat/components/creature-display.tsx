"use client"

import type { Tables } from "@/components/types/supabase"

type EncounterCreature = Tables<"encounter_creatures"> & { ascii_art?: string | null }

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
      <div className="flex justify-between">
        <span className="font-mono text-[8px] uppercase tracking-widest text-muted-foreground/60">{label}</span>
        <span className="font-mono text-[8px] text-muted-foreground/60">{current}/{max}</span>
      </div>
      <div className="h-1 bg-border/30 w-full">
        <div className="h-full transition-[width] duration-700 ease-out" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  )
}

const FALLEN_ART = "  ╳  \n  ╳  \n     "

interface CreatureDisplayProps {
  creature: EncounterCreature | null
  isActiveAttacker?: boolean
  isFlashing?: boolean
  isTargeted?: boolean
  onClick?: () => void
  damageAmount?: number | null
  blockAmount?: number | null
  damageKey?: number
}

export function CreatureDisplay({
  creature,
  isActiveAttacker,
  isFlashing,
  isTargeted,
  onClick,
  damageAmount,
  blockAmount,
  damageKey,
}: CreatureDisplayProps) {
  if (!creature) {
    return null
  }

  const defeated = !creature.is_alive
  const art = defeated ? FALLEN_ART : (creature.ascii_art ?? defaultArt(creature.name))
  const clickable = !defeated && onClick != null

  return (
    <div className="w-1/5 min-w-30 max-w-50 flex flex-col items-center">
      <div
        onClick={clickable ? onClick : undefined}
        className={[
          "w-full border p-3 flex flex-col gap-2 transition-all duration-200 relative",
          clickable ? "cursor-pointer" : "",
          defeated
            ? "border-border/20 opacity-30"
            : isFlashing
              ? "border-red-500/80 bg-red-900/40"
              : isTargeted
                ? "border-red-600/70 bg-red-950/15"
                : isActiveAttacker
                  ? "border-amber-600/60 bg-amber-950/10"
                  : "border-border/50",
        ].join(" ")}
        style={isTargeted && !defeated ? { boxShadow: "0 0 10px 2px rgba(220, 38, 38, 0.25)" } : undefined}
      >
        {/* ASCII art — fixed height, 6 lines */}
        <div
          className={[
            "font-mono text-[10px] whitespace-pre leading-[1.3] h-19.5 overflow-hidden select-none",
            defeated ? "text-muted-foreground/30" : "text-foreground/80",
          ].join(" ")}
        >
          {art}
        </div>

        {/* Name */}
        <div className="flex items-baseline gap-1.5">
          <span className="font-serif text-xs text-foreground truncate">{creature.name}</span>
          {creature.level != null && (
            <span className="font-mono text-[8px] uppercase tracking-widest text-muted-foreground/50 shrink-0">
              L{creature.level}
            </span>
          )}
        </div>

        {/* Stat bars */}
        {!defeated && (
          <div className="flex flex-col gap-1">
            {(creature.health_max ?? 0) > 0 && (
              <PoolBar
                label="HP"
                current={creature.current_health ?? 0}
                max={creature.health_max!}
                color="#ef4444"
              />
            )}
            {(creature.power_max ?? 0) > 0 && (
              <PoolBar
                label="PW"
                current={creature.current_power ?? 0}
                max={creature.power_max!}
                color="#3b82f6"
              />
            )}
            {(creature.will_max ?? 0) > 0 && (
              <PoolBar
                label="WL"
                current={creature.current_will ?? 0}
                max={creature.will_max!}
                color="#8b5cf6"
              />
            )}
          </div>
        )}

        {/* Damage + block overlay — fades up over 2s */}
        {damageAmount != null && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 pointer-events-none">
            <span
              key={damageKey}
              className="font-mono text-2xl font-bold text-red-400"
              style={{ animation: "damage-float 2s ease-out forwards" }}
            >
              {damageAmount === 0 ? "0" : `-${damageAmount}`}
            </span>
            {blockAmount != null && blockAmount > 0 && (
              <span
                key={`b-${damageKey}`}
                className="font-mono text-sm font-bold text-cyan-400"
                style={{ animation: "damage-float 2s ease-out forwards" }}
              >
                [{blockAmount} AC]
              </span>
            )}
          </div>
        )}
      </div>

      {/* Targeted label */}
      {isTargeted && !defeated && (
        <span
          className="font-mono text-[9px] uppercase tracking-widest text-red-500/90 mt-1 select-none"
          style={{ textShadow: "0 0 8px rgba(239, 68, 68, 0.7)" }}
        >
          targeted
        </span>
      )}
    </div>
  )
}

function defaultArt(name: string): string {
  const ch = name.charAt(0).toUpperCase()
  return [
    " ░▓░▓░",
    `  [${ch}] `,
    " ▓░░░▓",
    "  |_| ",
    " ░▓░▓░",
    "      ",
  ].join("\n")
}
