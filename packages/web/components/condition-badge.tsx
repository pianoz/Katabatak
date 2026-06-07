"use client"

import { Brain, Heart, Moon, Skull, X, ZapOff } from "lucide-react"
import type { ComponentType } from "react"

export type CharacterCondition = "Poisoned" | "Infirm" | "Unconscious" | "Exhausted" | "Insane"

export const CHARACTER_CONDITIONS: CharacterCondition[] = [
  "Poisoned",
  "Infirm",
  "Unconscious",
  "Exhausted",
  "Insane",
]

interface ConditionMeta {
  Icon: ComponentType<{ className?: string }>
  color: string
  border: string
  bg: string
}

export const CONDITION_CONFIG: Record<CharacterCondition, ConditionMeta> = {
  Poisoned:    { Icon: Skull,  color: "text-green-400",   border: "border-green-800",   bg: "bg-green-950/20" },
  Infirm:      { Icon: Heart,  color: "text-amber-500",   border: "border-amber-800",   bg: "bg-amber-950/20" },
  Unconscious: { Icon: Moon,   color: "text-violet-400",  border: "border-violet-800",  bg: "bg-violet-950/20" },
  Exhausted:   { Icon: ZapOff, color: "text-orange-400",  border: "border-orange-800",  bg: "bg-orange-950/20" },
  Insane:      { Icon: Brain,  color: "text-fuchsia-400", border: "border-fuchsia-800", bg: "bg-fuchsia-950/20" },
}

interface ConditionBadgeProps {
  condition: CharacterCondition
  onRemove?: () => void
}

export function ConditionBanner({ condition, onRemove }: ConditionBadgeProps) {
  const { Icon, color, border, bg } = CONDITION_CONFIG[condition]
  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 border ${border} ${bg} mb-4`}>
      <Icon className={`w-4 h-4 shrink-0 ${color}`} />
      <span className={`text-[10px] uppercase tracking-[0.3em] ${color} font-bold flex-1`}>{condition}</span>
      {onRemove && (
        <button
          onClick={onRemove}
          aria-label="Remove condition"
          className={`w-5 h-5 border ${border} ${bg} flex items-center justify-center ${color} hover:opacity-70 transition-opacity`}
        >
          <X className="w-2.5 h-2.5" />
        </button>
      )}
    </div>
  )
}

export function ConditionBadge({ condition, onRemove }: ConditionBadgeProps) {
  const { Icon, color, border, bg } = CONDITION_CONFIG[condition]

  return (
    <div className="fixed right-0 top-1/2 -translate-y-1/2 z-30">
      <div className={`relative flex flex-col items-center w-10 py-5 px-2 gap-4 border-l border-t border-b ${border} ${bg}`}>
        {onRemove && (
          <button
            onClick={onRemove}
            aria-label="Remove condition"
            className={`absolute -top-3 -left-3 w-5 h-5 border ${border} ${bg} flex items-center justify-center ${color} hover:opacity-70 transition-opacity`}
          >
            <X className="w-2.5 h-2.5" />
          </button>
        )}
        <Icon className={`w-4 h-4 shrink-0 ${color}`} />
        <span
          className={`font-sans text-[0.55rem] uppercase tracking-[0.2em] ${color} select-none`}
          style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}
        >
          {condition}
        </span>
      </div>
    </div>
  )
}
