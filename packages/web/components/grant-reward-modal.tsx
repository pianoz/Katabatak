"use client"

import { useState } from "react"
import { X, Loader2 } from "lucide-react"
import type { GameCharacter } from "@/components/item-table"
import { stagePendingOffer } from "@/lib/pending-offers"

type RewardType = "denarius" | "skill_point"

interface GrantRewardModalProps {
  gameCharacters: GameCharacter[]
  gameId: string
  onClose: () => void
}

const typeConfig: Record<RewardType, {
  label: string
  activeCls: string
  borderCls: string
  titleCls: string
  checkedRowCls: string
  hoverRowCls: string
  checkCls: string
  btnCls: string
}> = {
  denarius: {
    label: "Denarius",
    activeCls: "border-yellow-500 text-yellow-400 bg-yellow-950/20",
    borderCls: "border-yellow-900/50",
    titleCls: "text-yellow-400",
    checkedRowCls: "border-yellow-600 bg-yellow-950/20",
    hoverRowCls: "hover:border-yellow-800 hover:bg-yellow-950/10",
    checkCls: "border-yellow-500 bg-yellow-900/40 text-yellow-400",
    btnCls: "border-yellow-700 text-yellow-400 hover:bg-yellow-900/30",
  },
  skill_point: {
    label: "Skill Points",
    activeCls: "border-purple-500 text-purple-400 bg-purple-950/20",
    borderCls: "border-purple-900/50",
    titleCls: "text-purple-400",
    checkedRowCls: "border-purple-600 bg-purple-950/20",
    hoverRowCls: "hover:border-purple-800 hover:bg-purple-950/10",
    checkCls: "border-purple-500 bg-purple-900/40 text-purple-400",
    btnCls: "border-purple-700 text-purple-400 hover:bg-purple-900/30",
  },
}

export function GrantRewardModal({ gameCharacters, gameId, onClose }: GrantRewardModalProps) {
  const [rewardType, setRewardType] = useState<RewardType>("denarius")
  const [quantity, setQuantity] = useState(1)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [granting, setGranting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cfg = typeConfig[rewardType]

  function toggle(id: string) {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const handleGrant = async () => {
    if (selectedIds.length === 0 || quantity < 1) return
    setGranting(true)
    setError(null)
    try {
      for (const characterId of selectedIds) {
        await stagePendingOffer(gameId, characterId, rewardType, null, quantity)
      }
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to stage offer")
      setGranting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className={`bg-card border ${cfg.borderCls} w-full max-w-md mx-4 max-h-[80vh] flex flex-col`}>
        <div className={`flex items-center justify-between px-6 py-4 border-b ${cfg.borderCls}`}>
          <div>
            <h2 className={`text-xs uppercase tracking-widest ${cfg.titleCls}`}>Grant Reward</h2>
            <p className="font-serif text-base text-foreground mt-0.5">{quantity} {cfg.label}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-4 border-b border-border space-y-4">
          <div>
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground block mb-2">Type</label>
            <div className="flex gap-2">
              {(Object.keys(typeConfig) as RewardType[]).map(type => (
                <button
                  key={type}
                  onClick={() => setRewardType(type)}
                  className={`flex-1 text-[0.65rem] uppercase tracking-widest border py-2 transition-colors ${
                    rewardType === type ? typeConfig[type].activeCls : "border-border text-muted-foreground hover:border-foreground/40"
                  }`}
                >
                  {typeConfig[type].label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground block mb-2">Amount</label>
            <input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
              className="w-full bg-background border border-border text-foreground font-serif text-sm px-3 py-2 focus:outline-none focus:border-foreground/30"
            />
          </div>
        </div>

        <div className="overflow-y-auto flex-1 p-4 space-y-2">
          {gameCharacters.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground italic font-serif py-8">No characters in this game.</p>
          ) : (
            gameCharacters.map((character) => {
              const checked = selectedIds.includes(character.id)
              return (
                <button
                  key={character.id}
                  onClick={() => toggle(character.id)}
                  disabled={granting}
                  className={`w-full text-left border bg-background transition-colors p-4 flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed ${
                    checked ? cfg.checkedRowCls : `border-border ${cfg.hoverRowCls}`
                  }`}
                >
                  <span className={`w-4 h-4 shrink-0 border flex items-center justify-center text-[10px] ${
                    checked ? cfg.checkCls : "border-border"
                  }`}>
                    {checked && "✓"}
                  </span>
                  <p className="font-serif text-lg text-foreground">{character.name}</p>
                </button>
              )
            })
          )}
        </div>

        {gameCharacters.length > 0 && (
          <div className="p-4 border-t border-border flex items-center justify-between gap-4">
            {error && <p className="text-xs text-red-400 flex-1">{error}</p>}
            {granting ? (
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground ml-auto" />
            ) : (
              <button
                onClick={handleGrant}
                disabled={selectedIds.length === 0}
                className={`ml-auto text-[0.65rem] uppercase tracking-widest border px-4 py-2 disabled:opacity-40 disabled:cursor-not-allowed transition-colors ${cfg.btnCls}`}
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
