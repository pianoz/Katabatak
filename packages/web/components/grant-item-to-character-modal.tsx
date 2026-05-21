"use client"

import { useState } from "react"
import { X, Loader2 } from "lucide-react"
import type { Item } from "@/components/item-table"
import type { GameCharacter } from "@/components/item-table"
import { stagePendingOffer } from "@/lib/pending-offers"

interface GrantItemToCharacterModalProps {
  item: Item
  gameCharacters: GameCharacter[]
  gameId: string
  onClose: () => void
  onGranted: (itemId: string, newCharacterId: string) => void
}

export function GrantItemToCharacterModal({
  item,
  gameCharacters,
  gameId,
  onClose,
  onGranted,
}: GrantItemToCharacterModalProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [granting, setGranting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggle(id: string) {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const handleGrant = async () => {
    if (selectedIds.length === 0) return
    setGranting(true)
    setError(null)
    try {
      for (const characterId of selectedIds) {
        await stagePendingOffer(gameId, characterId, "item", item.id, 1, item.condition ?? null)
        onGranted(item.id, characterId)
      }
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to stage offer")
      setGranting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-card border border-amber-900/50 w-full max-w-md mx-4 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-amber-900/50">
          <div>
            <h2 className="text-xs uppercase tracking-widest text-amber-400">Stage Item Offer</h2>
            <p className="font-serif text-base text-foreground mt-0.5">{item.name}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">
              Condition: {item.condition}%
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-4 space-y-2">
          {gameCharacters.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground italic font-serif py-8">
              No characters in this game.
            </p>
          ) : (
            gameCharacters.map((character) => {
              const checked = selectedIds.includes(character.id)
              return (
                <button
                  key={character.id}
                  onClick={() => toggle(character.id)}
                  disabled={granting}
                  className={`w-full text-left border bg-background transition-colors p-4 flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed ${
                    checked
                      ? "border-amber-600 bg-amber-950/20"
                      : "border-border hover:border-amber-800 hover:bg-amber-950/10"
                  }`}
                >
                  <span className={`w-4 h-4 shrink-0 border flex items-center justify-center text-[10px] ${
                    checked ? "border-amber-500 bg-amber-900/40 text-amber-400" : "border-border"
                  }`}>
                    {checked && "✓"}
                  </span>
                  <p className="font-serif text-lg text-foreground">{character.name}</p>
                </button>
              )
            })
          )}
        </div>

        {gameCharacters.length > 0 && (
          <div className="p-4 border-t border-border flex items-center justify-between gap-4">
            {error && <p className="text-xs text-red-400 flex-1">{error}</p>}
            {granting ? (
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground ml-auto" />
            ) : (
              <button
                onClick={handleGrant}
                disabled={selectedIds.length === 0}
                className="ml-auto text-[0.65rem] uppercase tracking-widest border border-amber-700 text-amber-400 px-4 py-2 hover:bg-amber-900/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Grant to {selectedIds.length} Player{selectedIds.length !== 1 ? "s" : ""}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
