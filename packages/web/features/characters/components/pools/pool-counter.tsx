"use client"

import { Minus, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"

interface PoolCounterProps {
  label: string
  value: number
  max: number
  onIncrement: () => void
  onDecrement: () => void
  disabled?: boolean
  loading?: boolean
}

export function PoolCounter({ label, value, max, onIncrement, onDecrement, disabled, loading }: PoolCounterProps) {
  return (
    <div className="border border-border bg-card p-4 text-center">
      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">
        {label}
      </p>
      <div className="flex items-center justify-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={onDecrement}
          disabled={disabled || loading || value <= 0}
          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
        >
          <Minus className="w-4 h-4" />
        </Button>
        <span className={`font-serif text-4xl md:text-5xl text-foreground min-w-[3ch] ${loading ? "opacity-50" : ""}`}>
          {value}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={onIncrement}
          disabled={disabled || loading || value >= max}
          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}
