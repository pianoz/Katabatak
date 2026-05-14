"use client"

// ─── External imports ────────────────────────────────────────────────────────
import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ChevronLeft, Minus, Package, Plus, Shield, Sword } from "lucide-react"

// ─── Internal imports ─────────────────────────────────────────────────────────
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { AddItemModal } from "@/components/add-item-modal"
import { AddSpellModal } from "@/components/add-spell-modal"
import { InspectItemModal } from "./inspect-item-modal"
import { SkillTreeViewer } from "@/components/skill-tree-viewer"

// NOTE: This import appears unused and references a Next.js internal — remove it.
// import { handleBuildComplete } from "next/dist/build/adapter/build-complete"


// ─── Types ────────────────────────────────────────────────────────────────────

interface Character {
  id: string
  name: string
  current_essence: number
  current_power: number
  current_will: number
  essence_max: number
  power_max: number
  will_max: number
  health_max: number
  current_health: number
  speed?: number
  height?: string
  weight_kgs?: string
  carrying_capacity?: number
  current_carry_weight?: number
  denarius?: number
  background_primary?: string
  background_secondary?: string
  physical_description?: string
  backstory?: string
  is_active?: boolean
  created_at: string
  user_id: string
}

interface Item {
  id: string
  name: string
  type: string
  weight?: number
  short_description?: string
  damage?: number
  defence?: number
  character_id: string
  condition: number
  consumable: boolean
  die_count?: number
  modifier?: number
  modifier_attribute_name?: string
  coefficient?: number
  coefficient_attribute_name?: string
  cost?: number
  cost_attribute_name?: "power" | "will"
  image_url?: string
  action_text?: string
}

interface Spell {
  id: number
  name: string
  type: string
  subtype?: string
  damage?: number
  defence?: number
  modifier?: number
  coefficient?: number
  cost?: number
  cost_attribute_name?: string
  range_m?: number
  cast_time_min?: number
  cooldown_min?: number
}

type PoolKey = "current_essence" | "current_power" | "current_will" | "current_health"

type ActionType = "Attack" | "Defend" | "Cast"

interface Notification {
  text?: string
  url?: string
}


// ─── Utilities ────────────────────────────────────────────────────────────────

/**
 * Returns an RGB background style interpolated from deep red (0%) to deep green (100%).
 * Shared by ActionCard and ItemTable to keep condition colouring consistent.
 */
function getConditionStyle(percent: number): React.CSSProperties {
  const p = Math.min(Math.max(percent, 1), 100) / 100
  const start = { r: 92, g: 1, b: 1 }
  const end   = { r: 3,  g: 92, b: 1 }
  const r = Math.round(start.r + (end.r - start.r) * p)
  const g = Math.round(start.g + (end.g - start.g) * p)
  const b = Math.round(start.b + (end.b - start.b) * p)
  return {
    backgroundColor: `rgb(${r}, ${g}, ${b})`,
    transition: "background-color 0.5s ease-in",
    border: "1px solid rgba(255, 255, 255, 0.1)",
  }
}

/** Roll `count` dice each with `sides` faces and return the sum. */
function rollDice(count: number, sides: number): number {
  let total = 0
  for (let i = 0; i < count; i++) {
    total += Math.floor(Math.random() * sides) + 1
  }
  return total
}

/** Format a modifier value as "+2", "-1", or "" for zero. */
function formatModifier(modifier: number | undefined): string {
  if (!modifier) return ""
  return modifier > 0 ? `+${modifier}` : `${modifier}`
}

/** Format a coefficient value as "x2" or "" for 1 / undefined. */
function formatCoefficient(coefficient: number | undefined): string {
  if (!coefficient || coefficient === 1) return ""
  return ` x${coefficient}`
}


// ─── Sub-components ───────────────────────────────────────────────────────────

interface PoolCounterProps {
  label: string
  value: number
  max: number
  onIncrement: () => void
  onDecrement: () => void
  disabled?: boolean
  loading?: boolean
}

function PoolCounter({ label, value, max, onIncrement, onDecrement, disabled, loading }: PoolCounterProps) {
  return (
    <div className="border border-border bg-card p-4 text-center">
      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">
        {label}
      </p>
      <div className="flex items-center justify-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={onDecrement}
          disabled={disabled || loading || value <= 0}
          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
        >
          <Minus className="w-4 h-4" />
        </Button>
        <span className={`font-serif text-4xl md:text-5xl text-foreground min-w-[3ch] ${loading ? "opacity-50" : ""}`}>
          {value}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={onIncrement}
          disabled={disabled || loading || value >= max}
          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

interface AttributeRowProps {
  label: string
  value: string | number
  /** Reserved for future use; currently renders identically either way. */
  highlight?: boolean
}

function AttributeRow({ label, value, highlight }: AttributeRowProps) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-sm ${highlight ? "text-foreground font-medium" : "text-foreground"}`}>
        {value}
      </span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

interface DescriptionBlockProps {
  label: string
  text?: string
  expandable?: boolean
}

function DescriptionBlock({ label, text, expandable }: DescriptionBlockProps) {
  const [expanded, setExpanded] = useState(false)

  if (!text) return null

  const shouldTruncate = expandable && text.length > 200 && !expanded

  return (
    <div className="border border-border bg-card p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">
        {label}
      </p>
      <p className={`font-serif text-sm text-foreground/90 leading-relaxed ${shouldTruncate ? "line-clamp-4" : ""}`}>
        {text}
      </p>
      {expandable && text.length > 200 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground mt-2"
        >
          {expanded ? "Show Less" : "Read More"}
        </button>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

interface ActionCardProps {
  label: string
  items: Item[]
  selectedId: string
  onSelect: (id: string) => void
  onAction: () => void
  /** When true the card displays flat defence instead of a dice roll. */
  isFlat?: boolean
}

function ActionCard({ label, items, selectedId, onSelect, onAction, isFlat = false }: ActionCardProps) {
  const selectedItem = items.find((i) => i.id === selectedId)

  const getShortStats = (item: Item): string => {
    const power = isFlat ? (item.defence ?? 0) : item.damage
    return `${power}/${item.cost ?? 0}`
  }

  const damageDisplay = selectedItem
    ? isFlat
      ? `${selectedItem.defence ?? 0}${formatModifier(selectedItem.modifier)}${formatCoefficient(selectedItem.coefficient)}`
      : `${selectedItem.die_count}d${selectedItem.damage}${formatModifier(selectedItem.modifier)}${formatCoefficient(selectedItem.coefficient)}`
    : "—"

  const costDisplay = selectedItem?.cost
    ? `${selectedItem.cost}${selectedItem.cost_attribute_name === "power" ? "P" : "W"}`
    : "0"

  return (
    <div className="border border-border bg-card p-3 flex flex-col justify-between min-h-[140px]">
      {/* Top: action button + item selector */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mb-3">
        <Button
          onClick={onAction}
          disabled={!selectedItem}
          className="font-bold uppercase tracking-widest text-[10px] h-9 sm:flex-1 shrink-0"
        >
          {label}
        </Button>

        <select
          value={selectedId}
          onChange={(e) => onSelect(e.target.value)}
          className="bg-secondary/40 text-[10px] uppercase tracking-wider text-foreground border border-border h-9 px-2 rounded-sm focus:ring-1 focus:ring-foreground/20 w-full sm:flex-[2] cursor-pointer"
        >
          {items.length === 0 && <option>None</option>}
          {items.map((i) => (
            <option key={i.id} value={i.id} className="bg-card text-foreground">
              {i.name} ({getShortStats(i)})
            </option>
          ))}
        </select>
      </div>

      {/* Bottom: stats + description */}
      <div className="grid grid-cols-2 gap-4 border-t border-border pt-3 items-center">
        <div className="flex items-center justify-center gap-3 border-r border-border/50 pr-2">
          <div className="flex flex-col items-center">
            <div className="text-lg font-serif text-foreground leading-none">{damageDisplay}</div>
            <div className="w-12 h-px bg-border my-1" />
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">
              Cost: {costDisplay}
            </div>
          </div>

          {selectedItem && (
            <div
              style={getConditionStyle(selectedItem.condition ?? 100)}
              className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-inner"
            >
              <span className="text-[10px] font-bold text-gray-400">
                {selectedItem.condition ?? 100}
              </span>
            </div>
          )}
        </div>

        <div className="pl-1">
          <p className="text-[10px] leading-tight text-muted-foreground italic line-clamp-3">
            {selectedItem?.short_description ?? "No description."}
          </p>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

// RECOMMENDATION: Extract ItemTable into its own file (components/item-table.tsx).
// It is large, self-contained, and has no dependency on CharacterDashboard state.

const COLUMN_LABELS: Record<string, string> = {
  damage:            "Damage",
  defence:           "Armor",
  weight:            "Weight",
  short_description: "Short Description",
  condition:         "Condition",
}

interface ItemTableProps {
  items: Item[]
  columns: string[]
  emptyMessage: string
  onRepair?: (item: Item) => void
  onConsume?: (item: Item) => Promise<void> | void
  onDrop?: (item: Item) => void
  onInspect?: (item: Item) => void
}

function ItemTable({ items, columns, emptyMessage, onRepair, onConsume, onDrop, onInspect }: ItemTableProps) {
  if (items.length === 0) {
    return (
      <div className="border border-border bg-card p-6 text-center">
        <p className="text-muted-foreground text-sm italic font-serif">{emptyMessage}</p>
      </div>
    )
  }

  const genericColumns = columns.filter((col) => col !== "condition")
  const showCondition  = columns.includes("condition")

  return (
    <div className="border border-border bg-card overflow-hidden">
      {/* ── Mobile view ── */}
      <div className="md:hidden divide-y divide-border">
        {items.map((item) => (
          <div key={item.id} className="p-4 space-y-3 hover:bg-secondary/10 transition-colors">
            <div className="flex justify-between items-start">
              <button
                onClick={() => onInspect?.(item)}
                className="flex flex-col items-start group text-left"
              >
                <h4 className="font-serif text-lg text-foreground group-hover:text-cyan-400 transition-colors underline decoration-dotted decoration-muted-foreground/30 underline-offset-4">
                  {item.name}
                </h4>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mt-1">
                  {item.weight} lbs • <span className="text-cyan-500/70">View Details</span>
                </p>
              </button>

              {showCondition && (
                <div
                  className="flex flex-col items-center justify-center w-10 h-10 rounded-sm"
                  style={getConditionStyle(item.condition)}
                >
                  <span className="text-[8px] uppercase text-white/60 tracking-tight leading-none mb-0.5">
                    Cond
                  </span>
                  <span className="text-[11px] font-semibold text-white/90 leading-none">
                    {item.condition}%
                  </span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm">
              {genericColumns
                .filter((c) => c !== "name" && c !== "weight")
                .map((col) => (
                  <div key={col} className="flex flex-col">
                    <span className="text-[10px] uppercase text-muted-foreground tracking-tighter">
                      {COLUMN_LABELS[col] ?? col}
                    </span>
                    <span className="text-foreground/90">{item[col as keyof Item] ?? "—"}</span>
                  </div>
                ))}
            </div>

            <div className="flex gap-2 pt-2">
              {!item.consumable && (item.condition ?? 100) < 100 && (
                <button
                  onClick={() => onRepair?.(item)}
                  className="flex-1 py-2 text-xs bg-blue-900/30 text-blue-400 border border-blue-800 active:bg-blue-800 transition-all"
                >
                  Repair
                </button>
              )}
              {item.consumable && (
                <button
                  onClick={() => window.confirm(`Use ${item.name}? This will destroy it.`) && onConsume?.(item)}
                  className="flex-1 py-2 text-xs bg-green-900/30 text-green-400 border border-green-800 active:bg-green-800 transition-all"
                >
                  Use
                </button>
              )}
              <button
                onClick={() => window.confirm(`Drop ${item.name}?`) && onDrop?.(item)}
                className="flex-1 py-2 text-xs bg-red-900/30 text-red-400 border border-red-800 active:bg-red-800 transition-all"
              >
                Drop
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* ── Desktop view ── */}
      <table className="hidden md:table w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-border bg-secondary/50">
            {genericColumns.map((col) => (
              <th key={col} className="text-xs uppercase tracking-widest text-muted-foreground p-3 font-normal">
                {COLUMN_LABELS[col] ?? col}
              </th>
            ))}
            {showCondition && (
              <th className="text-xs uppercase tracking-widest text-muted-foreground p-3 font-normal">
                {COLUMN_LABELS["condition"]}
              </th>
            )}
            <th className="w-px whitespace-nowrap text-right text-xs uppercase tracking-widest text-muted-foreground p-3 font-normal">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-b border-border hover:bg-secondary/20 transition-colors">
              {genericColumns.map((col) => (
                <td key={col} className="p-3 text-sm text-foreground">
                  {col === "name" ? (
                    <button
                      onClick={() => onInspect?.(item)}
                      className="font-serif text-left hover:text-cyan-400 transition-colors underline decoration-dotted decoration-muted-foreground/30 underline-offset-4"
                    >
                      {item.name}
                    </button>
                  ) : (
                    <span className="text-foreground/80">{item[col as keyof Item] ?? "—"}</span>
                  )}
                </td>
              ))}

              {showCondition && (
                <td className="p-3 text-sm text-foreground whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <div className="w-12 h-2 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full transition-all"
                        style={{
                          width: `${item.condition}%`,
                          backgroundColor: getConditionStyle(item.condition).backgroundColor,
                        }}
                      />
                    </div>
                    <span className="text-[10px] tabular-nums">{item.condition}%</span>
                  </div>
                </td>
              )}

              <td className="p-3 text-right space-x-2 whitespace-nowrap">
                {!item.consumable && (item.condition ?? 100) < 100 && (
                  <button
                    onClick={() => onRepair?.(item)}
                    className="px-2 py-1 text-xs bg-blue-900/30 text-blue-400 border border-blue-800 hover:bg-blue-800 hover:text-white transition-all"
                  >
                    Repair 1d10
                  </button>
                )}
                {item.consumable && (
                  <button
                    onClick={async () => {
                      if (window.confirm(`Use ${item.name}? This will destroy it.`)) {
                        await onConsume?.(item)
                      }
                    }}
                    className="px-2 py-1 text-xs bg-green-900/30 text-green-400 border border-green-800 hover:bg-green-800 hover:text-white transition-all"
                  >
                    Use
                  </button>
                )}
                <button
                  onClick={() => window.confirm(`Drop ${item.name}?`) && onDrop?.(item)}
                  className="px-2 py-1 text-xs bg-red-900/30 text-red-400 border border-red-800 hover:bg-red-800 hover:text-white transition-all"
                >
                  Drop
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

// RECOMMENDATION: Extract SpellsSection into its own file (components/spells-section.tsx).
// It receives `spells` as a prop and has no other coupling to CharacterDashboard.

interface SpellsSectionProps {
  spells: Spell[]
}

function SpellsSection({ spells }: SpellsSectionProps) {
  return (
    <div className="space-y-4 pt-4">
      <div className="relative group">
        <div className="absolute -inset-0.5 bg-cyan-500/20 rounded-lg blur opacity-30 group-hover:opacity-50 transition duration-1000" />
        <div className="relative border border-cyan-900/50 bg-card/80 backdrop-blur-sm overflow-hidden">
          {/* NOTE: Casting spells as `any` to work around the Item/Spell type mismatch.
              Consider creating a unified InventoryItem type or a dedicated SpellTable component. */}
          <ItemTable
            items={spells as unknown as Item[]}
            columns={["name", "damage", "description", "cost"]}
            emptyMessage="No spells known"
          />
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

// RECOMMENDATION: Extract NotificationOverlay into its own file
// (components/notification-overlay.tsx) — it is entirely presentational.

interface NotificationOverlayProps {
  notification: Notification
  onDismiss: () => void
}

function NotificationOverlay({ notification, onDismiss }: NotificationOverlayProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="fixed inset-0 bg-black/20 backdrop-blur-sm" onClick={onDismiss} />
      <div className="relative flex flex-col items-center p-6 bg-gray-900 border border-green-500 rounded-xl shadow-2xl w-full max-w-md min-w-[320px] text-center transform animate-in zoom-in-95 duration-300">
        <button
          onClick={onDismiss}
          className="absolute top-3 right-3 text-gray-400 hover:text-white transition-colors"
        >
          ✕
        </button>

        {notification.url && (
          <img
            src={notification.url}
            alt="Item effect"
            className="w-24 h-24 object-contain mb-4 rounded border border-gray-700 bg-gray-800 p-2"
          />
        )}

        <p className="text-green-400 text-lg font-semibold mb-2">
          {notification.text ?? "Item consumed!"}
        </p>

        <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-gray-800 overflow-hidden rounded-b-xl">
          <div
            className="h-full bg-green-500 animate-shrink-width"
            style={{ width: "100%", transition: "width 10s linear" }}
          />
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

interface RepairToastProps {
  message: string
}

function RepairToast({ message }: RepairToastProps) {
  return (
    <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 pointer-events-none transition-opacity animate-in fade-in zoom-in duration-300">
      <div className="bg-blue-600/90 text-white px-6 py-2 rounded-full border border-blue-400 shadow-[0_0_15px_rgba(37,99,235,0.5)] font-serif italic">
        {message}
      </div>
    </div>
  )
}


// ─── Main component ───────────────────────────────────────────────────────────

interface CharacterDashboardProps {
  character: Character
  items: Item[]
  spells: Spell[]
  isOwner: boolean
}

export function CharacterDashboard({
  character: initialCharacter,
  items,
  spells,
  isOwner,
}: CharacterDashboardProps) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  const [character,      setCharacter]      = useState(initialCharacter)
  const [updating,       setUpdating]       = useState<string | null>(null)
  const [lastRoll,       setLastRoll]       = useState<{ label: string; value: number } | null>(null)
  const [inspectingItem, setInspectingItem] = useState<Item | null>(null)
  const [notification,   setNotification]   = useState<Notification | null>(null)
  const [repairPopup,    setRepairPopup]    = useState<string | null>(null)

  // ── Derived item lists ──────────────────────────────────────────────────────

  const attackItems  = items.filter((i) => i.type === "weapon")
  const defendItems  = items.filter((i) => i.type === "armor")
  const castItems    = items.filter((i) => i.type === "spell")
  const weapons      = attackItems
  const armor        = defendItems
  const otherItems   = items.filter((i) => i.type !== "weapon" && i.type !== "armor")
  const totalWeight  = items.reduce((sum, item) => sum + (item.weight ?? 0), 0)

  const [selectedAttackId, setSelectedAttackId] = useState(attackItems[0]?.id ?? "")
  const [selectedDefendId, setSelectedDefendId] = useState(defendItems[0]?.id ?? "")
  const [selectedCastId,   setSelectedCastId]   = useState(castItems[0]?.id  ?? "")

  // ── Handlers ────────────────────────────────────────────────────────────────

  const updatePool = async (pool: PoolKey, delta: number) => {
    if (!isOwner) return
    const newValue = Math.max(0, character[pool] + delta)
    setUpdating(pool)
    const supabase = createClient()
    const { error } = await supabase
      .from("characters")
      .update({ [pool]: newValue })
      .eq("id", character.id)
    if (!error) setCharacter((prev) => ({ ...prev, [pool]: newValue }))
    setUpdating(null)
  }

  const updateMoney = async (delta: number) => {
    if (!isOwner) return
    const newValue = Math.max(0, (character.denarius ?? 0) + delta)
    setUpdating("denarius")
    const supabase = createClient()
    const { error } = await supabase
      .from("characters")
      .update({ denarius: newValue })
      .eq("id", character.id)
    if (!error) setCharacter((prev) => ({ ...prev, denarius: newValue }))
    setUpdating(null)
  }

  const handleAction = async (actionType: ActionType, itemId: string) => {
    const item = items.find((i) => i.id === itemId)
    if (!item) return

    const supabase = createClient()

    let baseValue: number
    if (actionType === "Defend") {
      baseValue = item.defence ?? 0
    } else {
      baseValue = rollDice(item.die_count ?? 0, item.damage ?? 0)
    }

    const total = (baseValue + (item.modifier ?? 0)) * (item.coefficient ?? 1)
    setLastRoll({ label: `${actionType}ed for`, value: total })

    if (actionType === "Attack" || actionType === "Cast") {
      const newCondition = Math.max(0, (item.condition ?? 0) - total)
      if (newCondition <= 0) {
        await supabase.from("character_inventory").delete().eq("id", item.id)
      } else {
        await supabase.from("character_inventory").update({ condition: newCondition }).eq("id", item.id)
      }
      startTransition(() => router.refresh())
    }

    if (isOwner && item.cost && item.cost_attribute_name) {
      const pool: PoolKey = item.cost_attribute_name === "power" ? "current_power" : "current_will"
      await updatePool(pool, -item.cost)
    }
  }

  const handleRepair = async (item: Item) => {
    const repairAmount  = rollDice(1, 10)
    const newCondition  = Math.min(100, (item.condition ?? 0) + repairAmount)
    const actualRepaired = newCondition - (item.condition ?? 0)

    const supabase = createClient()
    const { error } = await supabase
      .from("character_inventory")
      .update({ condition: newCondition })
      .eq("id", item.id)

    if (!error) {
      setRepairPopup(`Repaired ${actualRepaired}`)
      setTimeout(() => setRepairPopup(null), 2000)
      router.refresh()
    } else {
      console.error("Repair error:", error)
    }
  }

  const handleConsume = async (item: Item) => {
    const supabase = createClient()
    const { error } = await supabase
      .from("character_inventory")
      .delete()
      .eq("id", item.id)

    if (!error) {
      setNotification({ text: item.action_text, url: item.image_url })
      setTimeout(() => setNotification(null), 10_000)
      router.refresh()
    }
  }

  const handleDrop = async (item: Item) => {
    const supabase = createClient()
    const { error } = await supabase
      .from("character_inventory")
      .delete()
      .eq("id", item.id)

    if (!error) router.refresh()
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="px-6 md:px-12 lg:px-20 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                <ChevronLeft className="w-4 h-4 mr-1" />
                Back
              </Button>
            </Link>
            <div className="h-6 w-px bg-border" />
            <h1 className="font-serif text-2xl tracking-wide text-foreground">
              {character.name}
            </h1>
            {character.is_active && (
              <span className="text-xs uppercase tracking-widest text-muted-foreground bg-secondary px-2 py-1">
                Active
              </span>
            )}
          </div>
          <Link href="/dashboard" className="font-serif text-lg tracking-wide text-muted-foreground hover:text-foreground">
            KatabataK
          </Link>
        </div>
      </header>

      <main className="px-6 md:px-12 lg:px-20 py-8">
        {/* Resource pools */}
        <section className="mb-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8 w-full max-w-full">
            <PoolCounter
              label={`Essence (${character.essence_max})`}
              value={character.current_essence}
              max={character.essence_max}
              onIncrement={() => updatePool("current_essence", 1)}
              onDecrement={() => updatePool("current_essence", -1)}
              disabled={!isOwner}
              loading={updating === "current_essence"}
            />
            <PoolCounter
              label={`Power (${character.power_max})`}
              value={character.current_power}
              max={character.power_max}
              onIncrement={() => updatePool("current_power", 1)}
              onDecrement={() => updatePool("current_power", -1)}
              disabled={!isOwner}
              loading={updating === "current_power"}
            />
            <PoolCounter
              label={`Will (${character.will_max})`}
              value={character.current_will}
              max={character.will_max}
              onIncrement={() => updatePool("current_will", 1)}
              onDecrement={() => updatePool("current_will", -1)}
              disabled={!isOwner}
              loading={updating === "current_will"}
            />
            <PoolCounter
              label={`Health (${character.health_max})`}
              value={character.current_health}
              max={character.health_max}
              onIncrement={() => updatePool("current_health", 1)}
              onDecrement={() => updatePool("current_health", -1)}
              disabled={!isOwner}
              loading={updating === "current_health"}
            />
          </div>
        </section>

        {/* Two-column layout: attributes | actions + skill tree */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12">
          {/* Left: Attributes */}
          <div className="lg:col-span-1 space-y-6">
            <h2 className="text-sm uppercase tracking-[0.3em] text-muted-foreground mb-4">
              Attributes
            </h2>

            <div className="border border-border bg-card p-6 space-y-4">
              <AttributeRow label="Speed"            value={character.speed            ?? "—"} />
              <AttributeRow label="Height"           value={character.height           ?? "—"} />
              <AttributeRow label="Weight"           value={character.weight_kgs       ?? "—"} />
              <AttributeRow label="Carrying Capacity" value={character.carrying_capacity ?? "—"} />

              {/* Denarius */}
              <div className="flex items-center justify-between py-2 border-t border-border">
                <span className="text-sm text-muted-foreground font-medium uppercase tracking-wider">
                  Denarius
                </span>
                <div className="flex items-center gap-3">
                  {isOwner && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 rounded-md border border-border"
                      onClick={() => updateMoney(-1)}
                      disabled={updating === "denarius" || (character.denarius ?? 0) < 1}
                    >
                      <Minus className="w-3 h-3" />
                    </Button>
                  )}
                  <span className="font-serif text-lg text-foreground min-w-[3ch] text-center">
                    {character.denarius ?? 0}
                  </span>
                  {isOwner && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 rounded-md border border-border"
                      onClick={() => updateMoney(1)}
                      disabled={updating === "denarius"}
                    >
                      <Plus className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Text descriptions */}
            <div className="space-y-4">
              <DescriptionBlock label="Primary Background"   text={character.background_primary}   />
              <DescriptionBlock label="Secondary Background" text={character.background_secondary} />
              <DescriptionBlock label="Physical Description" text={character.physical_description} />
              <DescriptionBlock label="Backstory"           text={character.backstory} expandable  />
            </div>

            <div className="text-xs text-muted-foreground pt-4 border-t border-border">
              Created {new Date(character.created_at).toLocaleDateString()}
            </div>
          </div>

          {/* Right: Actions + Skill tree */}
          <div className="lg:col-span-2">
            <section>
              <h2 className="text-sm uppercase tracking-[0.3em] text-muted-foreground mb-4">
                Actions
              </h2>

              {lastRoll && (
                <div className="mb-4 p-3 bg-secondary/30 border border-border text-center animate-in fade-in slide-in-from-top-1">
                  <span className="text-xs uppercase tracking-widest text-muted-foreground">
                    {lastRoll.label} Result:
                  </span>
                  <span className="ml-2 font-serif text-2xl text-foreground">{lastRoll.value}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <ActionCard
                  label="Attack"
                  items={attackItems}
                  selectedId={selectedAttackId}
                  onSelect={setSelectedAttackId}
                  onAction={() => handleAction("Attack", selectedAttackId)}
                  isFlat={false}
                />
                <ActionCard
                  label="Defend"
                  items={defendItems}
                  selectedId={selectedDefendId}
                  onSelect={setSelectedDefendId}
                  onAction={() => handleAction("Defend", selectedDefendId)}
                  isFlat={true}
                />
                <ActionCard
                  label="Cast"
                  items={castItems}
                  selectedId={selectedCastId}
                  onSelect={setSelectedCastId}
                  onAction={() => handleAction("Cast", selectedCastId)}
                  isFlat={false}
                />
              </div>
            </section>

            <h2 className="text-sm uppercase tracking-[0.3em] text-muted-foreground mb-4 pt-5">
              Skill Tree
            </h2>
            <SkillTreeViewer isDev={false} characterId={character.id} />
          </div>
        </div>

        {/* Grimoire */}
        <section className="mt-12 space-y-8">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <AddSpellModal characterId={character.id} />
              <Sword className="w-5 h-5 text-cyan-400 rotate-45 drop-shadow-[0_0_5px_rgba(34,211,238,0.6)]" />
              <h2 className="text-sm uppercase tracking-[0.3em] text-cyan-100 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]">
                Grimoire
              </h2>
            </div>
            <SpellsSection spells={spells} />
          </div>
        </section>

        {/* Equipment */}
        <section className="mt-12 space-y-8">
          {repairPopup && <RepairToast message={repairPopup} />}

          {/* Weapons */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <AddItemModal characterId={character.id} type="weapon" />
              <Sword className="w-5 h-5 text-muted-foreground" />
              <h2 className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Weapons</h2>
            </div>
            <ItemTable
              items={weapons}
              columns={["name", "damage", "weight", "condition", "short_description"]}
              emptyMessage="No weapons equipped"
              onRepair={handleRepair}
              onConsume={handleConsume}
              onDrop={handleDrop}
              onInspect={setInspectingItem}
            />
          </div>

          {/* Armor */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <AddItemModal characterId={character.id} type="armor" />
              <Shield className="w-5 h-5 text-muted-foreground" />
              <h2 className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Armor</h2>
            </div>
            <ItemTable
              items={armor}
              columns={["name", "defence", "weight", "condition", "short_description"]}
              emptyMessage="No armor equipped"
              onRepair={handleRepair}
              onConsume={handleConsume}
              onDrop={handleDrop}
              onInspect={setInspectingItem}
            />
          </div>

          {/* Other items */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <AddItemModal characterId={character.id} type="all" />
                <Package className="w-5 h-5 text-muted-foreground" />
                <h2 className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Items</h2>
              </div>
              <span className="text-sm text-muted-foreground">
                Total Weight:{" "}
                <span className="text-foreground font-medium">{totalWeight}</span>
                {character.carrying_capacity && (
                  <span className="text-muted-foreground"> / {character.carrying_capacity}</span>
                )}
              </span>
            </div>
            <ItemTable
              items={otherItems}
              columns={["name", "weight", "condition", "short_description"]}
              emptyMessage="No items in inventory"
              onRepair={handleRepair}
              onConsume={handleConsume}
              onDrop={handleDrop}
              onInspect={setInspectingItem}
            />
          </div>
        </section>
      </main>

      {/* Overlays */}
      <InspectItemModal item={inspectingItem} onClose={() => setInspectingItem(null)} />
      {notification && (
        <NotificationOverlay notification={notification} onDismiss={() => setNotification(null)} />
      )}
    </div>
  )
}
