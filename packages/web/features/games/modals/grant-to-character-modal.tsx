"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { X, Loader2 } from "lucide-react"
import { stagePendingOffer } from "@/lib/services/pending-offer-service"
import { getAllCharacters } from "@/lib/services/character-service"

interface Character {
  id: string
  name: string
  level?: number | null
  class_archetype?: string | null
}

interface GrantToCharacterModalProps {
  spell: { id: number; name: string | null }
  gameId: string
  onClose: () => void
  /** When provided, skips the DB fetch and scopes to game players only. */
  gameCharacters?: { id: string; name: string }[]
}

export function GrantToCharacterModal({ spell, gameId, onClose, gameCharacters }: GrantToCharacterModalProps) {
  const [fetched, setFetched] = useState<Character[]>([])
  const [loading, setLoading] = useState(!gameCharacters)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [granting, setGranting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (gameCharacters) return
    getAllCharacters(createClient()).then((data) => {
      setFetched(data)
      setLoading(false)
    })
  }, [gameCharacters])

  const characters: Character[] = gameCharacters ?? fetched

  function toggle(id: string) {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const handleGrant = async () => {
    if (selectedIds.length === 0) return
    setGranting(true)
    setError(null)
    try {
      for (const characterId of selectedIds) {
        await stagePendingOffer(gameId, characterId, "spell", String(spell.id), 1)
      }
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to stage offer")
      setGranting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-card border border-cyan-900/50 w-full max-w-md mx-4 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-cyan-900/50">
          <div>
            <h2 className="text-xs uppercase tracking-widest text-cyan-400">Stage Spell Offer</h2>
            <p className="font-serif text-base text-foreground mt-0.5">{spell.name}</p>
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
          ) : characters.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground italic font-serif py-8">
              No characters found.
            </p>
          ) : (
            characters.map((character) => {
              const checked = selectedIds.includes(character.id)
              return (
                <button
                  key={character.id}
                  onClick={() => toggle(character.id)}
                  disabled={granting}
                  className={`w-full text-left border bg-background transition-colors p-4 flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed ${
                    checked
                      ? "border-cyan-600 bg-cyan-950/20"
                      : "border-border hover:border-cyan-800 hover:bg-cyan-950/10"
                  }`}
                >
                  <span className={`w-4 h-4 shrink-0 border flex items-center justify-center text-[10px] ${
                    checked ? "border-cyan-500 bg-cyan-900/40 text-cyan-400" : "border-border"
                  }`}>
                    {checked && "✓"}
                  </span>
                  <div>
                    <p className="font-serif text-lg text-foreground">{character.name}</p>
                    {(character.level != null || character.class_archetype) && (
                      <p className="text-xs text-muted-foreground uppercase tracking-widest mt-0.5">
                        {character.class_archetype
                          ? `Level ${character.level} — ${character.class_archetype}`
                          : `Level ${character.level}`}
                      </p>
                    )}
                  </div>
                </button>
              )
            })
          )}
          {error && <p className="text-xs text-red-400 text-center pt-2">{error}</p>}
        </div>

        {!loading && characters.length > 0 && (
          <div className="p-4 border-t border-border flex items-center justify-between gap-4">
            {granting ? (
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground ml-auto" />
            ) : (
              <button
                onClick={handleGrant}
                disabled={selectedIds.length === 0}
                className="ml-auto text-[0.65rem] uppercase tracking-widest border border-cyan-700 text-cyan-400 px-4 py-2 hover:bg-cyan-900/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
