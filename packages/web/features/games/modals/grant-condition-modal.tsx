"use client"

import { useState } from "react"
import { X } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { updateCharacter } from "@/lib/services/character-service"
import type { GameCharacter } from "@/features/characters/components/inventory/item-table"
import {
  CONDITION_CONFIG,
  CHARACTER_CONDITIONS,
  type CharacterCondition,
} from "@/components/condition-badge"

interface GrantConditionModalProps {
  gameCharacters: GameCharacter[]
  onClose: () => void
}

export function GrantConditionModal({ gameCharacters, onClose }: GrantConditionModalProps) {
  const [selectedCharId, setSelectedCharId] = useState<string | null>(null)
  const [selectedCondition, setSelectedCondition] = useState<CharacterCondition | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleApply = async () => {
    if (!selectedCharId) return
    setSaving(true)
    setError(null)
    const supabase = createClient()
    const { error: err } = await updateCharacter(supabase, selectedCharId, { condition: selectedCondition })
    if (err) {
      setError("Failed to apply condition")
      setSaving(false)
    } else {
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-card border border-border w-full max-w-md mx-4 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-xs uppercase tracking-widest text-muted-foreground">Apply Condition</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Condition picker */}
        <div className="px-6 py-4 border-b border-border space-y-3">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Condition</p>
          <div className="grid grid-cols-5 gap-2">
            {CHARACTER_CONDITIONS.map((cond) => {
              const { Icon, color, border, bg } = CONDITION_CONFIG[cond]
              const active = selectedCondition === cond
              return (
                <button
                  key={cond}
                  onClick={() => setSelectedCondition(active ? null : cond)}
                  className={`flex flex-col items-center gap-1.5 py-3 px-1 border transition-colors ${
                    active ? `${border} ${bg} ${color}` : "border-border text-muted-foreground hover:border-foreground/30"
                  }`}
                >
                  <Icon className={`w-4 h-4 ${active ? color : ""}`} />
                  <span className="text-[0.48rem] uppercase tracking-widest leading-none text-center">{cond}</span>
                </button>
              )
            })}
          </div>
          <button
            onClick={() => setSelectedCondition(null)}
            className={`w-full text-[0.6rem] uppercase tracking-widest border py-2 transition-colors ${
              selectedCondition === null
                ? "border-foreground/40 text-foreground bg-secondary/20"
                : "border-border text-muted-foreground hover:border-foreground/20"
            }`}
          >
            Clear Condition
          </button>
        </div>

        {/* Character list */}
        <div className="overflow-y-auto flex-1 p-4 space-y-2">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Character</p>
          {gameCharacters.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground italic font-serif py-4">
              No characters in this game.
            </p>
          ) : (
            gameCharacters.map((c) => {
              const checked = selectedCharId === c.id
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedCharId(checked ? null : c.id)}
                  className={`w-full text-left border p-3 flex items-center gap-3 transition-colors ${
                    checked
                      ? "border-foreground/40 bg-secondary/20"
                      : "border-border hover:border-foreground/20"
                  }`}
                >
                  <span
                    className={`w-4 h-4 shrink-0 border flex items-center justify-center text-[10px] ${
                      checked ? "border-foreground/40 bg-secondary/30" : "border-border"
                    }`}
                  >
                    {checked && "✓"}
                  </span>
                  <span className="font-serif text-lg text-foreground">{c.name}</span>
                </button>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border flex items-center justify-between gap-4">
          {error && <p className="text-xs text-red-400 flex-1">{error}</p>}
          <button
            onClick={handleApply}
            disabled={saving || !selectedCharId}
            className="ml-auto text-[0.65rem] uppercase tracking-widest border border-border text-muted-foreground px-4 py-2 hover:border-foreground/40 hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {saving
              ? "Applying…"
              : selectedCondition
              ? `Apply ${selectedCondition}`
              : "Clear Condition"}
          </button>
        </div>
      </div>
    </div>
  )
}
