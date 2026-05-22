"use client"

import { useState } from "react"

const ghostBtnClass =
  "font-sans text-[0.65rem] tracking-widest uppercase bg-transparent border border-border text-muted-foreground px-3 py-1.5 cursor-pointer"

type RollEntry = { die: number; count: number; rolls: number[]; sum: number }

export function DicePanel() {
  const [diceCount, setDiceCount] = useState(1)
  const [history, setHistory] = useState<RollEntry[]>([])

  const DICE = [2, 4, 6, 8, 10, 12, 20, 100]

  function roll(sides: number) {
    const rolls = Array.from({ length: diceCount }, () => Math.floor(Math.random() * sides) + 1)
    const sum = rolls.reduce((a, b) => a + b, 0)
    setHistory((prev) => [{ die: sides, count: diceCount, rolls, sum }, ...prev].slice(0, 5))
  }

  return (
    <div className="w-90 shrink-0 border-l border-border p-5 overflow-y-auto flex flex-col gap-4">
      <div className="font-sans text-[0.6rem] tracking-[0.2em] uppercase text-muted-foreground mb-3">
        Dice Roller
      </div>
      <div className="flex gap-4">
        <div className="flex flex-col gap-2 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-sans text-[0.55rem] tracking-widest uppercase text-muted-foreground/60 shrink-0">
              Count
            </span>
            <select
              value={diceCount}
              onChange={(e) => setDiceCount(Math.min(50, Math.max(1, Number(e.target.value))))}
              className="bg-background border border-border text-foreground font-sans text-xs px-2 py-1 flex-1"
            >
              {Array.from({ length: 50 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {DICE.map((d) => (
              <button key={d} onClick={() => roll(d)} className={ghostBtnClass}>
                d{d}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2 w-36 shrink-0">
          <span className="font-sans text-[0.55rem] tracking-widest uppercase text-muted-foreground/60">
            History
          </span>
          {history.length === 0 ? (
            <p className="font-serif text-xs text-muted-foreground/30 italic">No rolls yet.</p>
          ) : (
            history.map((entry, i) => (
              <div key={i} className="border border-border/30 px-2 py-1.5 flex flex-col gap-0.5">
                <span className="font-sans text-[0.55rem] tracking-widest uppercase text-muted-foreground/50">
                  {entry.count}d{entry.die}
                </span>
                {entry.count > 10 ? (
                  <span className="font-serif text-sm text-foreground">Sum: {entry.sum}</span>
                ) : (
                  <>
                    <span className="font-sans text-xs text-muted-foreground tabular-nums">
                      {entry.rolls.join(", ")}
                    </span>
                    {entry.count > 1 && (
                      <span className="font-sans text-[0.6rem] text-muted-foreground/60">
                        = {entry.sum}
                      </span>
                    )}
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
