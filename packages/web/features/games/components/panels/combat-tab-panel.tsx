"use client"

import { CombatPanel } from "@/features/games/components/combat-panel"

interface CombatTabPanelProps {
  gameId: string
  encounterRefreshKey: number
}

export function CombatTabPanel({ gameId, encounterRefreshKey }: CombatTabPanelProps) {
  return <CombatPanel gameId={gameId} refreshKey={encounterRefreshKey} />
}
