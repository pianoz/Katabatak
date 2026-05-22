"use client"

import { ItemTable } from "@/features/characters/components/inventory/item-table"
import type { Item, GameCharacter } from "@/features/characters/components/inventory/item-table"

const ghostBtnClass =
  "font-sans text-[0.65rem] tracking-widest uppercase bg-transparent border border-border text-muted-foreground px-3 py-1.5 cursor-pointer"

interface ItemsPanelProps {
  isGM: boolean
  items: Item[]
  gameCharacters: GameCharacter[]
  onCreateItem: () => void
  onInspect: (item: Item) => void
  onGrantToCharacter: (item: Item, gameCharacters: GameCharacter[]) => void
}

export function ItemsPanel({
  isGM,
  items,
  gameCharacters,
  onCreateItem,
  onInspect,
  onGrantToCharacter,
}: ItemsPanelProps) {
  return (
    <div className="flex-1 overflow-y-auto px-8 py-6">
      <div className="flex items-center justify-between mb-4">
        <div className="font-sans text-[0.6rem] tracking-[0.2em] uppercase text-muted-foreground mb-3">
          Items
        </div>
        {isGM && (
          <button className={ghostBtnClass} onClick={onCreateItem}>
            Create Item
          </button>
        )}
      </div>
      <ItemTable
        items={items}
        columns={["name", "type", "short_description", "subtype", "consumable"]}
        emptyMessage="No items in this game yet."
        isGM={isGM}
        gameCharacters={gameCharacters}
        onInspect={onInspect}
        onGrantToCharacter={onGrantToCharacter}
      />
    </div>
  )
}
