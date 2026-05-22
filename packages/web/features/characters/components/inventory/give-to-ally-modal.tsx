"use client"

import { useState, useEffect } from "react"
import { X, Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { stagePendingOffer } from "@/lib/services/pending-offer-service"
import { getCharacterActiveGameId, getGameAllyCharacters } from "@/lib/services/game-service"

interface GiveItem {
  id: string          // character_inventory.id (this is what gets deleted on accept)
  base_id?: string    // items.id (source_id for the offer)
  name: string
  condition?: number | null
}

interface GiveToAllyModalProps {
  item: GiveItem
  characterId: string
  onClose: () => void
  onGiven: () => void
}

export function GiveToAllyModal({ item, characterId, onClose, onGiven }: GiveToAllyModalProps) {
  const [allies, setAllies] = useState<{ id: string; name: string }[]>([])
  const [gameId, setGameId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [giving, setGiving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()

      const gameId = await getCharacterActiveGameId(supabase, characterId)

      if (!gameId) {
        setError("This character is not in an active game.")
        setLoading(false)
        return
      }

      setGameId(gameId)

      const allyList = await getGameAllyCharacters(supabase, gameId, characterId)

      setAllies(allyList)
      setLoading(false)
    }

    load()
  }, [characterId])

  const handleGive = async () => {
    if (!selectedId || !gameId) return
    setGiving(true)
    setError(null)
    try {
      await stagePendingOffer(
        gameId,
        selectedId,
        "item",
        item.base_id ?? item.id,
        1,
        item.condition ?? null,
        item.id,
      )
      onGiven()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send offer")
      setGiving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60">
      <div className="bg-card border border-yellow-900/50 w-full max-w-md mx-4 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-yellow-900/50">
          <div>
            <h2 className="text-xs uppercase tracking-widest text-yellow-500">Give to Ally</h2>
            <p className="font-serif text-base text-foreground mt-0.5">{item.name}</p>
            {item.condition != null && (
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">
                Condition: {item.condition}%
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-4 space-y-2">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <p className="text-center text-sm text-red-400 italic font-serif py-8">{error}</p>
          ) : allies.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground italic font-serif py-8">
              No allies in this game.
            </p>
          ) : (
            allies.map((ally) => {
              const checked = selectedId === ally.id
              return (
                <button
                  key={ally.id}
                  onClick={() => setSelectedId(ally.id)}
                  disabled={giving}
                  className={`w-full text-left border bg-background transition-colors p-4 flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed ${
                    checked
                      ? "border-yellow-600 bg-yellow-950/20"
                      : "border-border hover:border-yellow-800 hover:bg-yellow-950/10"
                  }`}
                >
                  <span className={`w-4 h-4 shrink-0 border flex items-center justify-center text-[10px] ${
                    checked ? "border-yellow-500 bg-yellow-900/40 text-yellow-400" : "border-border"
                  }`}>
                    {checked && "✓"}
                  </span>
                  <p className="font-serif text-lg text-foreground">{ally.name}</p>
                </button>
              )
            })
          )}
        </div>

        {!loading && !error && allies.length > 0 && (
          <div className="p-4 border-t border-border flex items-center justify-end gap-4">
            {error && <p className="text-xs text-red-400 flex-1">{error}</p>}
            {giving ? (
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            ) : (
              <button
                onClick={handleGive}
                disabled={!selectedId}
                className="text-[0.65rem] uppercase tracking-widest border border-yellow-700 text-yellow-500 px-4 py-2 hover:bg-yellow-950/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Give Item
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
