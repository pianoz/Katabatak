"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface CharacterOption {
  id: string
  name: string
}

interface Props {
  characters: CharacterOption[]
  selectedId: string
  onSelect: (characterId: string) => void
  loading?: boolean
}

export function CharacterSelector({ characters, selectedId, onSelect, loading }: Props) {
  return (
    <div className="space-y-1.5">
      <label className="block font-sans text-[0.55rem] uppercase tracking-widest text-muted-foreground/60">
        Character
      </label>
      <Select value={selectedId} onValueChange={onSelect} disabled={loading}>
        <SelectTrigger className="w-full border-border bg-background text-xs">
          <SelectValue placeholder={loading ? "Loading…" : "Select character…"} />
        </SelectTrigger>
        <SelectContent>
          {characters.length === 0 ? (
            <div className="px-3 py-2 text-xs text-muted-foreground italic">
              No characters found
            </div>
          ) : (
            characters.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
      {selectedId && (
        <p className="font-sans text-[0.45rem] uppercase tracking-widest text-cyan-400/60">
          Context blocks will hydrate on character select
        </p>
      )}
    </div>
  )
}
