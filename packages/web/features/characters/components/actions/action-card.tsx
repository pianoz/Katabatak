"use client"

import { Button } from "@/components/ui/button"
import { getConditionStyle } from "@/lib/utils"
import type { Effect } from "@/lib/effect-engine"

export interface ActionCardItem {
  id: string
  name: string
  hidden: boolean
  consumable: boolean
  damage?: number | null
  defence?: number | null
  strong_damage?: number | null
  strong_defence?: number | null
  cost?: number | null
  strong_cost?: number | null
  cost_attribute_name?: "power" | "will" | null
  condition?: number | null
  die_count?: number | null
  modifier?: number | null
  coefficient?: number | null
  short_description?: string | null
  effects?: Effect[]
}

interface ActionCardProps {
  label: string
  items: ActionCardItem[]
  selectedId: string
  onSelect: (id: string) => void
  /** isStrong=true when the player triggered the strong variant */
  onAction: (isStrong: boolean) => void
  /** When true the card displays flat defence instead of a dice roll */
  isFlat?: boolean
  /** Force show the strong variant even if the item lacks strong fields */
  showStrong?: boolean
}

function fmt(modifier?: number | null): string {
  if (!modifier) return ""
  return modifier > 0 ? `+${modifier}` : `${modifier}`
}

function fmtCoeff(coefficient?: number | null): string {
  if (!coefficient || coefficient === 1) return ""
  return ` x${coefficient}`
}

const POOL_SUFFIX: Record<string, string> = { power: 'P', will: 'W', health: 'H', essence: 'E' }

function resolveEffectStats(item: ActionCardItem, isStrong: boolean) {
  const eff = item.effects?.[isStrong ? 1 : 0]
  const addMod = eff?.actions?.find(a => a.math === 'add' && a.type === 'stat_modifier')?.Value
    ?? (isStrong ? null : item.modifier)
  const multCoeff = eff?.actions?.find(a => a.math === 'multiply' && a.type === 'stat_modifier')?.Value
    ?? (isStrong ? null : item.coefficient)
  const cost = eff?.cost?.value ?? (isStrong ? (item.strong_cost ?? item.cost) : item.cost)
  const costLabel = eff?.cost?.pool
    ? (POOL_SUFFIX[eff.cost.pool] ?? '')
    : (POOL_SUFFIX[item.cost_attribute_name ?? ''] ?? 'P')
  return { addMod, multCoeff, cost, costLabel }
}

function EffectCostBlock({
  item,
  isFlat,
  isStrong,
}: {
  item: ActionCardItem
  isFlat: boolean
  isStrong: boolean
}) {
  const dieFace = isStrong ? (item.strong_damage ?? item.damage) : item.damage
  const flatVal = isStrong ? (item.strong_defence ?? item.defence) : item.defence
  const { addMod, multCoeff, cost, costLabel } = resolveEffectStats(item, isStrong)

  const valueDisplay = isFlat
    ? `${flatVal ?? 0}${fmt(addMod)}${fmtCoeff(multCoeff)}`
    : `${item.die_count ?? 0}d${dieFace ?? 0}${fmt(addMod)}${fmtCoeff(multCoeff)}`

  const costDisplay = cost ? `${cost}${costLabel}` : "0"

  return (
    <div className="flex flex-col items-center">
      <div className="text-lg font-serif text-foreground leading-none">{valueDisplay}</div>
      <div className="w-12 h-px bg-border my-1" />
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">
        Cost: {costDisplay}
      </div>
    </div>
  )
}

export function ActionCard({
  label,
  items,
  selectedId,
  onSelect,
  onAction,
  isFlat = false,
  showStrong = false,
}: ActionCardProps) {
  const selectedItem = items.find((i) => i.id === selectedId)

  const hasStrong =
    showStrong ||
    (selectedItem?.effects?.length ?? 0) >= 2 ||
    (isFlat ? !!selectedItem?.strong_defence : !!selectedItem?.strong_damage)

  const getShortStats = (item: ActionCardItem): string => {
    const val = isFlat ? (item.defence ?? 0) : (item.damage ?? 0)
    return `${val}/${item.cost ?? 0}`
  }

  const selectEl = (
    <select
      value={selectedId}
      onChange={(e) => onSelect(e.target.value)}
      className="bg-secondary/40 text-[10px] uppercase tracking-wider text-foreground border border-border h-9 px-2 rounded-sm focus:ring-1 focus:ring-foreground/20 flex-1 cursor-pointer"
    >
      {items.length === 0 && <option>None</option>}
      {items.map((i) => (
        <option key={i.id} value={i.id} className="bg-card text-foreground">
          {i.name} ({getShortStats(i)})
        </option>
      ))}
    </select>
  )

  const conditionBubble = selectedItem ? (
    <div
      style={getConditionStyle(selectedItem.condition ?? 100)}
      className="w-8 h-8 rounded-md flex items-center justify-center shrink-0 opacity-75"
    >
      <span className="text-[10px] font-bold text-gray-400">{selectedItem.condition ?? 100}</span>
    </div>
  ) : null

  // ── Dual layout (strong variant exists) ────────────────────────────────────
  if (hasStrong) {
    return (
      <div className="border border-border bg-card p-3 flex flex-col gap-3">
        {/* Dropdown + mobile-only condition bubble */}
        <div className="flex items-center gap-2">
          {selectEl}
          <div className="sm:hidden">{conditionBubble}</div>
        </div>

        <div className="border-t border-border pt-3 flex flex-col sm:flex-row gap-4 items-stretch">
          {/* Weak option */}
          <div className="flex flex-col items-center gap-2 flex-1">
            <Button
              onClick={() => onAction(false)}
              disabled={!selectedItem}
              className="font-bold uppercase tracking-widest text-[10px] h-9 w-full"
            >
              {label}
            </Button>
            {selectedItem && (
              <EffectCostBlock item={selectedItem} isFlat={isFlat} isStrong={false} />
            )}
          </div>

          {/* Strong option */}
          <div className="flex flex-col items-center gap-2 flex-1">
            <Button
              onClick={() => onAction(true)}
              disabled={!selectedItem}
              variant="outline"
              className="font-bold uppercase tracking-widest text-[10px] h-9 w-full border-amber-600/60 text-amber-400 hover:bg-amber-950/30"
            >
              Strong {label}
            </Button>
            {selectedItem && (
              <EffectCostBlock item={selectedItem} isFlat={isFlat} isStrong={true} />
            )}
          </div>

          {/* Description + condition (desktop only) */}
          {selectedItem && (
            <div className="hidden sm:flex items-center gap-3 sm:max-w-[35%]">
              <p className="text-[10px] leading-tight text-muted-foreground italic line-clamp-3 flex-1">
                {selectedItem.short_description ?? "No description."}
              </p>
              {conditionBubble}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Single layout (no strong variant) ─────────────────────────────────────
  const singleStats = selectedItem ? resolveEffectStats(selectedItem, false) : null
  const damageDisplay = selectedItem
    ? isFlat
      ? `${selectedItem.defence ?? 0}${fmt(singleStats?.addMod)}${fmtCoeff(singleStats?.multCoeff)}`
      : `${selectedItem.die_count ?? 0}d${selectedItem.damage ?? 0}${fmt(singleStats?.addMod)}${fmtCoeff(singleStats?.multCoeff)}`
    : "—"

  const costDisplay = singleStats?.cost
    ? `${singleStats.cost}${singleStats.costLabel}`
    : "0"

  return (
    <div className="border border-border bg-card p-3 flex flex-col justify-between min-h-35">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mb-3">
        <Button
          onClick={() => onAction(false)}
          disabled={!selectedItem}
          className="font-bold uppercase tracking-widest text-[10px] h-9 sm:flex-1 shrink-0"
        >
          {label}
        </Button>
        {/* Dropdown + mobile-only condition bubble */}
        <div className="flex items-center gap-2 flex-1">
          {selectEl}
          <div className="sm:hidden">{conditionBubble}</div>
        </div>
      </div>

      <div className="flex gap-4 border-t border-border pt-3 items-center">
        {/* Damage/cost + desktop-only condition bubble */}
        <div className="flex items-center justify-center gap-3 sm:border-r sm:border-border/50 sm:pr-2 flex-1">
          <div className="flex flex-col items-center">
            <div className="text-lg font-serif text-foreground leading-none">{damageDisplay}</div>
            <div className="w-12 h-px bg-border my-1" />
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">
              Cost: {costDisplay}
            </div>
          </div>
          <div className="hidden sm:block">{conditionBubble}</div>
        </div>
        {/* Description (desktop only) */}
        <div className="pl-1 hidden sm:block flex-1">
          <p className="text-[10px] leading-tight text-muted-foreground italic line-clamp-3">
            {selectedItem?.short_description ?? "No description."}
          </p>
        </div>
      </div>
    </div>
  )
}
