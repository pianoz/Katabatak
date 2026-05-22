"use client"

import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import type { Character } from "@/components/types/types"

interface BarProps {
  label: string
  current: number | null
  max: number | null
  color: string
}

function VerticalBar({ label, current, max, color }: BarProps) {
  const pct =
    (max ?? 0) > 0 ? Math.max(0, Math.min(100, ((current ?? 0) / (max ?? 1)) * 100)) : 0

  return (
    <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
      <span className="font-sans text-[0.5rem] tracking-widest uppercase text-muted-foreground/60">
        {label}
      </span>
      <div className="relative flex-1 w-full bg-muted/20 border border-border/40 overflow-hidden">
        <div
          className="absolute bottom-0 left-0 right-0 transition-all duration-300"
          style={{ height: `${pct}%`, background: color }}
        />
      </div>
      <span className="font-sans text-[0.48rem] text-muted-foreground tabular-nums">
        {current ?? 0}/{max ?? 0}
      </span>
    </div>
  )
}

interface CharacterCardProps {
  character: Character
}

export function CharacterCard({ character }: CharacterCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: character.id,
  })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        zIndex: isDragging ? 10 : undefined,
      }}
      {...attributes}
      {...listeners}
      className="border border-border bg-card p-3 w-56 shrink-0 flex flex-col gap-3 cursor-grab active:cursor-grabbing select-none"
    >
      {/* Pool bars */}
      <div className="flex gap-1.5 h-48">
        <VerticalBar
          label="ES"
          current={character.current_essence}
          max={character.essence_max}
          color="#3b82f6"
        />
        <VerticalBar
          label="PW"
          current={character.current_power}
          max={character.power_max}
          color="#9b3535"
        />
        <VerticalBar
          label="WP"
          current={character.current_will}
          max={character.will_max}
          color="#9b3535"
        />
        <VerticalBar
          label="HP"
          current={character.current_health}
          max={character.health_max}
          color="#9b3535"
        />
      </div>

      {/* Name */}
      <div className="border-t border-border/40 pt-2 font-serif text-base text-foreground leading-tight">
        {character.name}
      </div>

      {/* Stats */}
      <div className="flex gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="font-sans text-[0.48rem] tracking-widest uppercase text-muted-foreground/60">
            Level
          </span>
          <span className="font-sans text-sm text-foreground">{character.level ?? 0}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="font-sans text-[0.48rem] tracking-widest uppercase text-muted-foreground/60">
            Speed
          </span>
          <span className="font-sans text-sm text-foreground">{character.speed ?? 0}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="font-sans text-[0.48rem] tracking-widest uppercase text-muted-foreground/60">
            Denarius
          </span>
          <span className="font-sans text-sm text-foreground">{character.denarius ?? 0}</span>
        </div>
      </div>
    </div>
  )
}
