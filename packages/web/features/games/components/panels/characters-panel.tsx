"use client"

import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core"
import { SortableContext, horizontalListSortingStrategy } from "@dnd-kit/sortable"
import { CharacterCard } from "@/features/characters/components/character-card"
import { InvitePanel } from "@/features/games/components/invite-panel"
import { DicePanel } from "@/features/games/components/dice-panel"
import type { Character } from "@/components/types/types"

const ghostBtnClass =
  "font-sans text-[0.65rem] tracking-widest uppercase bg-transparent border border-border text-muted-foreground px-3 py-1.5 cursor-pointer"

interface CharactersPanelProps {
  gameId: string
  isGM: boolean
  characters: Character[]
  characterOrder: string[]
  memberProfileIds: Set<string>
  onDragEnd: (event: DragEndEvent) => void
  onInvited: (profileId: string) => void
  onKickOpen: () => void
  onGrantRewardOpen: () => void
  onGrantConditionOpen: () => void
}

export function CharactersPanel({
  gameId,
  isGM,
  characters,
  characterOrder,
  memberProfileIds,
  onDragEnd,
  onInvited,
  onKickOpen,
  onGrantRewardOpen,
  onGrantConditionOpen,
}: CharactersPanelProps) {
  return (
    <div className="flex-1 flex overflow-hidden">
      <InvitePanel
        gameId={gameId}
        memberProfileIds={memberProfileIds}
        onInvited={onInvited}
        onKickOpen={onKickOpen}
      />
      <div className="flex-1 p-8 overflow-y-auto">
        {isGM && (
          <div className="flex justify-end gap-2 mb-4">
            <button className={ghostBtnClass} onClick={onGrantConditionOpen}>
              Conditions
            </button>
            <button className={ghostBtnClass} onClick={onGrantRewardOpen}>
              Grant Rewards
            </button>
          </div>
        )}
        {characters.length === 0 ? (
          <p className="font-serif text-sm text-muted-foreground/40 italic text-center">
            No characters have joined this game yet.
          </p>
        ) : (
          <DndContext collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={characterOrder} strategy={horizontalListSortingStrategy}>
              <div className="flex flex-wrap justify-center gap-4">
                {characterOrder
                  .map((id) => characters.find((c) => c.id === id))
                  .filter(Boolean)
                  .map((character) => (
                    <CharacterCard key={character!.id} character={character!} />
                  ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>
      {isGM && <DicePanel />}
    </div>
  )
}
