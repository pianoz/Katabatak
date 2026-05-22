"use client"

import { SpellTable } from "@/features/characters/components/spells/spell-section"
import type { Spell } from "@/components/types/types"

const ghostBtnClass =
  "font-sans text-[0.65rem] tracking-widest uppercase bg-transparent border border-border text-muted-foreground px-3 py-1.5 cursor-pointer"

interface SpellsPanelProps {
  isGM: boolean
  catalogSpells: Spell[]
  gameId: string
  gameCharacters: { id: string; name: string }[]
  onCreateSpell: () => void
}

export function SpellsPanel({ isGM, catalogSpells, gameId, gameCharacters, onCreateSpell }: SpellsPanelProps) {
  return (
    <div className="flex-1 overflow-y-auto px-8 py-6">
      <div className="flex items-center justify-between mb-4">
        <div className="font-sans text-[0.6rem] tracking-[0.2em] uppercase text-muted-foreground mb-3">
          Spells
        </div>
        {isGM && (
          <button className={ghostBtnClass} onClick={onCreateSpell}>
            Create Spell
          </button>
        )}
      </div>
      <SpellTable
        spells={catalogSpells}
        inventory={[]}
        characterId=""
        isOwner={false}
        character={{
          current_power: 0,
          current_will: 0,
          current_essence: 0,
          current_health: 0,
        }}
        updatePool={async () => {}}
        is_gm={isGM}
        gameId={gameId}
        gameCharacters={gameCharacters}
      />
    </div>
  )
}
