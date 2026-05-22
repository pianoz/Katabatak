"use client"

import { CreatureSection } from "@/features/games/components/creature-section"
import { EncounterPanel } from "@/features/games/components/encounter-panel"
import type { Tables } from "@/components/types/supabase"

type Creature = Tables<"creatures">

interface CreaturesPanelProps {
  gameId: string
  encounterRefreshKey: number
  onAddToEncounter: (creatures: Creature[]) => void
}

export function CreaturesPanel({ gameId, encounterRefreshKey, onAddToEncounter }: CreaturesPanelProps) {
  return (
    <div className="flex-1 flex overflow-hidden">
      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="font-sans text-[0.6rem] tracking-[0.2em] uppercase text-muted-foreground mb-3">
          Creatures
        </div>
        <CreatureSection onAddToEncounter={onAddToEncounter} />
      </div>
      <EncounterPanel gameId={gameId} refreshKey={encounterRefreshKey} />
    </div>
  )
}
