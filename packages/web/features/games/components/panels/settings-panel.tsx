"use client"

import type { Game } from "@/components/types/types"

const dangerBtnClass =
  "font-sans text-[0.65rem] tracking-widest uppercase bg-transparent border border-destructive/30 text-destructive px-3 py-1.5 cursor-pointer disabled:opacity-50"

interface SettingsPanelProps {
  game: Game
}

export function SettingsPanel({ game }: SettingsPanelProps) {
  return (
    <div className="flex-1 overflow-y-auto px-8 py-6">
      <div className="flex flex-col gap-6">
        <div>
          <div className="font-sans text-[0.6rem] tracking-[0.2em] uppercase text-muted-foreground mb-3">
            Session Info
          </div>
          <div className="bg-card border border-border overflow-hidden">
            {[
              ["Game ID", game.id || "—"],
              ["Session", game.session_number],
              ["Join Code", game.join_code || "—"],
            ].map(([label, val]) => (
              <div
                key={String(label)}
                className="flex justify-between px-4 py-2.5 border-b border-border/40 last:border-b-0"
              >
                <span className="font-sans text-[0.65rem] tracking-widest uppercase text-muted-foreground">
                  {label}
                </span>
                <span className="font-sans text-sm text-foreground/80">{val}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="font-sans text-[0.6rem] tracking-[0.2em] uppercase text-muted-foreground mb-3">
            Danger Zone
          </div>
          <div className="flex gap-2">
            <button
              className={dangerBtnClass}
              onClick={() => {
                // TODO: call updateGameStatus(game.id, "ended") with confirmation
              }}
            >
              End Game
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
