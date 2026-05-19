"use client"

import { Plus, Users, X } from "lucide-react"

export interface CharacterForSelect {
  id: string
  name: string
  level: number
  class_archetype?: string | null
}

interface CharacterSelectModalProps {
  characters: CharacterForSelect[]
  onSelect: (characterId: string) => void
  onClose: () => void
  onCreateNew?: () => void
}

export function CharacterSelectModal({ characters, onSelect, onClose, onCreateNew }: CharacterSelectModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-card border border-border w-full max-w-md mx-4 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <Users className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm uppercase tracking-widest text-foreground">
              Choose Your Character
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-4 space-y-2">
          {characters.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground italic font-serif py-8">
              No characters available.
            </p>
          ) : (
            characters.map((character) => (
              <button
                key={character.id}
                onClick={() => onSelect(character.id)}
                className="w-full text-left border border-border bg-background hover:border-foreground/30 hover:bg-card/80 transition-colors p-4 group"
              >
                <p className="font-serif text-lg text-foreground group-hover:text-foreground/80">
                  {character.name}
                </p>
                <p className="text-xs text-muted-foreground uppercase tracking-widest mt-1">
                  {character.class_archetype
                    ? `Level ${character.level} — ${character.class_archetype}`
                    : `Level ${character.level}`}
                </p>
              </button>
            ))
          )}
        </div>

        {onCreateNew && (
          <div className="p-4 border-t border-border">
            <button
              onClick={onCreateNew}
              className="w-full flex items-center justify-center gap-2 border border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground transition-colors p-3 text-xs uppercase tracking-widest"
            >
              <Plus className="w-3.5 h-3.5" />
              Create New Character
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
