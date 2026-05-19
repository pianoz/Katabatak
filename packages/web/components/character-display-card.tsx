"use client"

import type { Character } from "@/components/types/types"

interface CharacterDisplayCardProps {
  character: Character
}

function pct(current: number | null, max: number | null) {
  return (max ?? 0) > 0 ? Math.round(((current ?? 0) / (max ?? 1)) * 100) : 0
}

const POOLS = [
  { label: "HP",  current: (c: Character) => c.current_health, max: (c: Character) => c.health_max,   color: "#e05555" },
  { label: "PWR", current: (c: Character) => c.current_power,  max: (c: Character) => c.power_max,    color: "#e07c35" },
  { label: "WIL", current: (c: Character) => c.current_will,   max: (c: Character) => c.will_max,     color: "#8b5cf6" },
  { label: "ESS", current: (c: Character) => c.current_essence,max: (c: Character) => c.essence_max,  color: "#22d3ee" },
] as const

export function CharacterDisplayCard({ character }: CharacterDisplayCardProps) {
  return (
    <div className="border border-border bg-card p-4 w-72 shrink-0 flex flex-col gap-3">
      <div>
        <div className="font-serif text-base text-foreground">{character.name}</div>
        {character.background_primary && (
          <div className="font-sans text-[0.6rem] tracking-widest uppercase text-muted-foreground mt-0.5">
            {character.background_primary}
          </div>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        {POOLS.map(({ label, current, max, color }) => {
          const cur = current(character)
          const mx = max(character)
          return (
            <div key={label} className="flex items-center gap-2">
              <span className="font-sans text-[0.55rem] tracking-widest uppercase text-muted-foreground/60 w-7 shrink-0">
                {label}
              </span>
              <div className="flex-1 h-0.75 bg-muted overflow-hidden">
                <div style={{ width: `${pct(cur, mx)}%`, background: color }} className="h-full" />
              </div>
              <span className="font-sans text-[0.6rem] text-muted-foreground w-10 text-right shrink-0">
                {cur ?? 0}/{mx ?? 0}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
