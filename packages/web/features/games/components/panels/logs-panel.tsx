"use client"

interface GameLog {
  id: string
  timestamp: string
  type: "system" | "combat" | "item" | "player"
  message: string
}

interface LogsPanelProps {
  logs: GameLog[]
}

const iconMap: Record<GameLog["type"], string> = {
  system: "⚙",
  combat: "⚔",
  item: "◈",
  player: "◉",
}

export function LogsPanel({ logs }: LogsPanelProps) {
  return (
    <div className="flex-1 overflow-y-auto px-8 py-6">
      <div className="font-sans text-[0.6rem] tracking-[0.2em] uppercase text-muted-foreground mb-3">
        Game Log
      </div>
      {logs.length === 0 ? (
        <p className="font-serif text-sm text-muted-foreground/40 italic">No log entries yet.</p>
      ) : (
        <div className="flex flex-col">
          {logs.map((log) => (
            <div key={log.id} className="flex gap-3 py-3 border-b border-border/30">
              <span className="font-sans text-[0.65rem] tracking-wide text-muted-foreground/40 shrink-0 pt-0.5">
                {log.timestamp}
              </span>
              <span className="text-muted-foreground/30 shrink-0 text-sm">{iconMap[log.type]}</span>
              <span className="font-serif text-sm text-muted-foreground">{log.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
