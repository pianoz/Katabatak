"use client"

import { useState, useEffect } from "react"
import { Timer } from "lucide-react"

interface BurndownTimerProps {
  /** Display label for the timer (e.g. "Rage", "Invisibility"). */
  label: string
  /** Total duration in seconds. */
  durationSeconds: number
  /** ISO timestamp when the effect started. */
  startedAt: string
  /** Called when the timer reaches zero. */
  onExpire?: () => void
}

/** Formats remaining seconds as MM:SS. */
function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  const m = Math.floor(s / 60)
  const rem = s % 60
  return `${String(m).padStart(2, "0")}:${String(rem).padStart(2, "0")}`
}

export function BurndownTimer({ label, durationSeconds, startedAt, onExpire }: BurndownTimerProps) {
  const [remaining, setRemaining] = useState<number>(() => {
    const elapsed = (Date.now() - new Date(startedAt).getTime()) / 1000
    return Math.max(0, durationSeconds - elapsed)
  })

  useEffect(() => {
    if (remaining <= 0) {
      onExpire?.()
      return
    }
    const id = setInterval(() => {
      const elapsed = (Date.now() - new Date(startedAt).getTime()) / 1000
      const next = Math.max(0, durationSeconds - elapsed)
      setRemaining(next)
      if (next <= 0) {
        clearInterval(id)
        onExpire?.()
      }
    }, 1000)
    return () => clearInterval(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startedAt, durationSeconds])

  const pct = durationSeconds > 0 ? remaining / durationSeconds : 0
  const expired = remaining <= 0

  const barColor = pct > 0.5
    ? "bg-cyan-500"
    : pct > 0.2
    ? "bg-amber-500"
    : "bg-red-500"

  return (
    <div className={`border px-4 py-3 flex items-center gap-4 ${expired ? "border-border/30 opacity-40" : "border-cyan-900/60"}`}>
      <Timer className={`w-4 h-4 shrink-0 ${expired ? "text-muted-foreground/30" : "text-cyan-400"}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground truncate">{label}</span>
          <span className={`font-mono text-sm shrink-0 ml-2 ${expired ? "text-muted-foreground/40" : "text-foreground"}`}>
            {expired ? "Expired" : formatTime(remaining)}
          </span>
        </div>
        <div className="h-1 bg-secondary rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-1000 ${barColor}`}
            style={{ width: `${pct * 100}%` }}
          />
        </div>
      </div>
    </div>
  )
}
