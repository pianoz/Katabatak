"use client"

import { useState } from "react"
import { X, Loader2 } from "lucide-react"
import type { GameCharacter } from "@/features/characters/components/inventory/item-table"
import type { Spell } from "@/components/types/types"
import { stagePendingOffer } from "@/lib/services/pending-offer-service"

interface GrantSpellToCharacterModalProps {
  spells: Spell[]
  gameCharacters: GameCharacter[]
  gameId: string
  onClose: () => void
}

export function GrantSpellToCharacterModal({
  spells,
  gameCharacters,
  gameId,
  onClose,
}: GrantSpellToCharacterModalProps) {
  const [selectedSpellId, setSelectedSpellId] = useState<number>(spells[0]?.id ?? 0)
  const [granting, setGranting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedSpell = spells.find(s => s.id === selectedSpellId)

  const handleGrant = async (characterId: string) => {
    if (!selectedSpellId) return
    setGranting(true)
    setError(null)
    try {
      await stagePendingOffer(gameId, characterId, "spell", String(selectedSpellId), 1)
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
            <h2 className="text-xs uppercase tracking-widest text-cyan-400">Grant Spell</h2>
            <p className="font-serif text-base text-foreground mt-0.5">
              {selectedSpell?.name ?? "Select a spell"}
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-4 border-b border-border">
          <label className="text-[10px] uppercase tracking-widest text-muted-foreground block mb-2">Spell</label>
          <select
            value={selectedSpellId}
            onChange={(e) => setSelectedSpellId(Number(e.target.value))}
            className="w-full bg-background border border-border text-foreground font-serif text-sm px-3 py-2 focus:outline-none focus:border-foreground/30"
          >
            {spells.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        <div className="overflow-y-auto flex-1 p-4 space-y-2">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3">Select Character</p>
          {gameCharacters.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground italic font-serif py-8">No characters in this game.</p>
          ) : (
            gameCharacters.map((character) => (
              <button
                key={character.id}
                onClick={() => handleGrant(character.id)}
                disabled={granting || !selectedSpellId}
                className="w-full text-left border border-border bg-background hover:border-cyan-800 hover:bg-cyan-950/20 transition-colors p-4 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <p className="font-serif text-lg text-foreground">{character.name}</p>
              </button>
            ))
          )}
          {granting && <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>}
          {error && <p className="text-xs text-red-400 text-center">{error}</p>}
        </div>
      </div>
    </div>
  )
}
