"use client"

import { useEffect, useRef } from "react"

interface CombatLogPanelProps {
  entries: string[]
}

function classifyLine(line: string): "flavor" | "roll" | "outcome" {
  if (line.startsWith("VICTORY") || line.startsWith("DEFEAT")) return "outcome"
  if (line.includes("roll=") || line.includes("→")) return "roll"
  return "flavor"
}

export function CombatLogPanel({ entries }: CombatLogPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [entries.length])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground/50 px-4 py-2 border-b border-border/40 shrink-0">
        Combat Log
      </div>
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-1 [&::-webkit-scrollbar]:w-[3px] [&::-webkit-scrollbar-thumb]:bg-zinc-700">
        {entries.length === 0 ? (
          <p className="font-mono text-[10px] text-muted-foreground/30 italic text-center py-6">
            — awaiting first action —
          </p>
        ) : (
          entries.map((line, i) => {
            const type = classifyLine(line)
            return (
              <div
                key={i}
                className={[
                  "font-mono text-[10px] leading-relaxed animate-in fade-in duration-500",
                  type === "flavor" && "text-muted-foreground/70 italic",
                  type === "roll" && "text-foreground/80",
                  type === "outcome" && "text-amber-400 uppercase tracking-widest",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {line}
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
