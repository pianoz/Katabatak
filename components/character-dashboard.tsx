"use client"

// ─── External imports ────────────────────────────────────────────────────────
import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ChevronLeft, Minus, Package, Plus, Shield, Sword, Trash2 } from "lucide-react"

// ─── Internal imports ─────────────────────────────────────────────────────────
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { AddItemModal } from "@/components/add-item-modal"
import { AddSpellModal } from "@/components/add-spell-modal"
import { InspectItemModal } from "./inspect-item-modal"
import { SkillTreeViewer } from "@/components/skill-tree-viewer"
import { NotificationOverlay } from "@/components/notification-overlay"
import { getConditionStyle } from "@/lib/utils"
import { ItemTable } from "./item-table"
import { SpellTable } from "@/components/spell-section"

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
  subtype?: string
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
  hidden: boolean
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
  const [isDeleting,     setIsDeleting]     = useState(false)
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
      // Only calculate and update if it's NOT melee
      if (item.subtype !== "melee") {
        const newCondition = Math.max(0, (item.condition ?? 0) - total);
        
        if (newCondition <= 0) {
          await supabase.from("character_inventory").delete().eq("id", item.id);
        } else {
          await supabase.from("character_inventory").update({ condition: newCondition }).eq("id", item.id);
        }
        
        startTransition(() => router.refresh());
      }
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

  // handle for deleting a character 
  const handleDeleteCharacter = async () => {
    if (!isOwner) return
    
    const confirmed = window.confirm(
      `Are you sure you want to delete ${character.name}? This action is permanent and cannot be undone.`
    )

    if (confirmed) {
      setIsDeleting(true)
      const supabase = createClient()
      
      const { error } = await supabase
        .from("characters")
        .delete()
        .eq("id", character.id)

      if (!error) {
        router.push("/dashboard")
        router.refresh()
      } else {
        console.error("Delete error:", error)
        alert("Failed to delete character. Please try again.")
        setIsDeleting(false)
      }
    }
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
            <SpellTable
              spells={spells}
              inventory={items}         
              characterId={character.id}
              isOwner={isOwner}
              character={character}
              updatePool={updatePool}
            />
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
        {isOwner && (
          <section className="mt-20 pt-8 border-t border-red-900/20">
            <div className="flex flex-col items-center justify-center space-y-4">
              <h2 className="text-[10px] uppercase tracking-[0.4em] text-red-500/50 font-bold">
                Danger Zone
              </h2>
              <Button
                variant="ghost"
                onClick={handleDeleteCharacter}
                disabled={isDeleting}
                className="group border border-red-900/30 hover:bg-red-950/30 hover:border-red-600 transition-all duration-300 px-8"
              >
                <Trash2 className="w-4 h-4 mr-2 text-red-500 group-hover:text-red-400" />
                <span className="text-xs uppercase tracking-widest text-red-500 group-hover:text-red-400">
                  {isDeleting ? "Deleting..." : "Delete Character"}
                </span>
              </Button>
              <p className="text-[10px] text-muted-foreground/40 italic">
                This will remove all associated inventory, spells, and progress.
              </p>
            </div>
          </section>
        )}
      </main>

      {/* Overlays */}
      <InspectItemModal item={inspectingItem} onClose={() => setInspectingItem(null)} />
      {notification && (
        <NotificationOverlay notification={notification} onDismiss={() => setNotification(null)} />
      )}
    </div>
  )
}
