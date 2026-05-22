"use client"

// ─── External imports ────────────────────────────────────────────────────────
import { useState, useTransition, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Bell, ChevronLeft, Check, Info, Minus, Package, Pencil, Plus, Shield, Sword, Trash2, Wrench, X } from "lucide-react"

// ─── Internal imports ─────────────────────────────────────────────────────────
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { createClient } from "@/lib/supabase/client"
import {
  updateCharacterPool as svcUpdatePool,
  updateCharacterMoney as svcUpdateMoney,
  refreshCharacter as svcRefreshCharacter,
  updateCharacter,
  deleteCharacter,
} from "@/lib/services/character-service"
import {
  updateInventoryItem,
  removeInventoryItem,
} from "@/lib/services/item-service"
import { AddItemModal } from "@/features/characters/components/inventory/add-item-modal"
import { AddSpellModal } from "@/features/characters/components/spells/add-spell-modal"
import { InspectItemModal } from "@/features/characters/components/inventory/inspect-item-modal"
import { GiveToAllyModal } from "@/features/characters/components/inventory/give-to-ally-modal"
import { SkillTreeViewer } from "@/features/skills/components/skill-tree-viewer"
import { NotificationOverlay, type PendingOfferData } from "@/features/characters/components/offers/notification-overlay"
import { getConditionStyle } from "@/lib/utils"
import { ItemTable } from "@/features/characters/components/inventory/item-table"
import { ActionCard } from "@/features/characters/components/actions/action-card"
import { SpellTable } from "@/features/characters/components/spells/spell-section"
import VirtualGMComponent from "@/components/virtual-gm-component"
import { Character, Spell } from "@/components/types/types"
import { evaluateSkillEffects, type SkillEffect, type ActionContext } from "@/lib/skill-engine"
import { SkillCheckPanel } from "@/features/characters/components/actions/skill-check-panel"
import { ActionSkillModal, type ActionSkill } from "@/features/characters/components/actions/action-skill-modal"
import { PoolCounter } from "@/features/characters/components/pools/pool-counter"
import { usePendingOffers } from "@/features/characters/hooks/use-pending-offers"

interface Item {
  id: string
  base_id?: string
  name: string
  type: string
  subtype?: string
  weight?: number
  short_description?: string
  damage?: number
  defence?: number
  strong_damage?: number | null
  strong_defence?: number | null
  strong_cost?: number | null
  character_id?: string | null
  condition?: number | null
  consumable: boolean
  die_count?: number
  modifier?: number
  modifier_attribute_name?: string
  coefficient?: number
  coefficient_attribute_name?: string
  cost?: number
  cost_attribute_name?: "power" | "will"
  description?: string
  image_url?: string
  action_text?: string
  hidden: boolean
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


// ─────────────────────────────────────────────────────────────────────────────

interface DescriptionBlockProps {
  label: string
  text?: string
  expandable?: boolean
  onSave?: (text: string) => Promise<void>
}

function DescriptionBlock({ label, text, expandable, onSave }: DescriptionBlockProps) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(text ?? "")
  const [saving, setSaving] = useState(false)

  if (!text && !onSave) return null

  const handleSave = async () => {
    if (!onSave) return
    setSaving(true)
    await onSave(draft)
    setSaving(false)
    setEditing(false)
  }

  const handleCancel = () => {
    setDraft(text ?? "")
    setEditing(false)
  }

  const shouldTruncate = expandable && (text?.length ?? 0) > 200 && !expanded && !editing

  return (
    <div className="border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          {label}
        </p>
        {onSave && !editing && (
          <button
            onClick={() => setEditing(true)}
            className="text-muted-foreground/40 hover:text-muted-foreground transition-colors"
          >
            <Pencil className="w-3 h-3" />
          </button>
        )}
        {onSave && editing && (
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="text-muted-foreground/40 hover:text-foreground transition-colors"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <button onClick={handleCancel} className="text-muted-foreground/40 hover:text-foreground transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
      {editing ? (
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={6}
          className="w-full bg-background border border-border text-sm font-serif text-foreground/90 leading-relaxed p-2 resize-y focus:outline-none focus:border-foreground/40"
        />
      ) : (
        <>
          <p className={`font-serif text-sm text-foreground/90 leading-relaxed ${shouldTruncate ? "line-clamp-4" : ""}`}>
            {text || <span className="text-muted-foreground/40 italic">None</span>}
          </p>
          {expandable && (text?.length ?? 0) > 200 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground mt-2"
            >
              {expanded ? "Show Less" : "Read More"}
            </button>
          )}
        </>
      )}
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

// ─────────────────────────────────────────────────────────────────────────────

function InfoTooltip({ text }: { text: string }) {
  return (
    <span className="relative group inline-flex items-center">
      <Info className="w-3.5 h-3.5 text-muted-foreground/40 hover:text-muted-foreground/80 cursor-help transition-colors" />
      <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-60 bg-card border border-border text-[10px] text-muted-foreground leading-relaxed px-3 py-2 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 font-sans normal-case tracking-normal shadow-lg">
        {text}
      </span>
    </span>
  )
}


function usePersistedSelection(key: string, items: { id: string }[]) {
  const [selectedId, setSelectedId] = useState(items[0]?.id ?? "")

  useEffect(() => {
    const stored = localStorage.getItem(key)
    if (stored && items.some((i) => i.id === stored)) setSelectedId(stored)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const select = (id: string) => {
    setSelectedId(id)
    localStorage.setItem(key, id)
  }

  return [selectedId, select] as const
}

const offerTypeLabel: Record<PendingOfferData["type"], string> = {
  item:        "Item Offer",
  spell:       "Spell Offer",
  denarius:    "Currency",
  skill_point: "Skill Point",
}

// ─── Main component ───────────────────────────────────────────────────────────

interface CharacterDashboardProps {
  character: Character
  items: Item[]
  spells: Spell[]
  isOwner: boolean
  activeSkills: Array<{ effects: SkillEffect[]; current_rank: number }>
  isDev: boolean
  level: number
  actionSkills: ActionSkill[]
}

export function CharacterDashboard({
  character: initialCharacter,
  items,
  spells,
  isOwner,
  activeSkills,
  isDev,
  level,
  actionSkills,
}: CharacterDashboardProps) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [devModeEnabled, setDevModeEnabled] = useState(false)
  const [activeTab,      setActiveTab]      = useState("actions")

  const [character,      setCharacter]      = useState(initialCharacter)
  const [updating,       setUpdating]       = useState<string | null>(null)
  const [isDeleting,     setIsDeleting]     = useState(false)
  const [lastRoll,       setLastRoll]       = useState<{ label: string; value: number } | null>(null)
  const [inspectingItem, setInspectingItem] = useState<Item | null>(null)
  const [givingItem,     setGivingItem]     = useState<Item | null>(null)
  const [notification,   setNotification]   = useState<Notification | null>(null)
  const [repairPopup,    setRepairPopup]    = useState<string | null>(null)
  const [actionError,        setActionError]        = useState<string | null>(null)
  const [actionSkillsOpen,   setActionSkillsOpen]   = useState(false)

  // ── Derived item lists ──────────────────────────────────────────────────────

  const attackItems  = items.filter((i) => i.type === "weapon")
  const defendItems  = items.filter((i) => i.type === "armor")
  const castItems    = items.filter((i) => i.type === "spell")
  const weapons      = attackItems
  const armor        = defendItems
  const otherItems = items.filter((i) => i.type !== "weapon" && i.type !== "armor")

  const [selectedAttackId, setSelectedAttackId] = usePersistedSelection(`action_attack_${character.id}`, attackItems)
  const [selectedDefendId, setSelectedDefendId] = usePersistedSelection(`action_defend_${character.id}`, defendItems)
  const [selectedCastId,   setSelectedCastId]   = usePersistedSelection(`action_cast_${character.id}`,   castItems)

  // ── Skill engine ──────────────────────────────────────────────────────────
  const invFx = evaluateSkillEffects(activeSkills, { actionType: 'inventory_check' })
  const effectiveWeight = (item: Item) => {
    const typeReduction = invFx.modifiers.weightReduction[item.type] ?? 0
    const allReduction   = invFx.modifiers.weightReduction['all']    ?? 0
    return Math.max(0, (item.weight ?? 0) - typeReduction - allReduction)
  }
  const totalWeight = items.reduce((sum, item) => sum + effectiveWeight(item), 0)
  const effectiveCarryCapacity = Math.round(
    ((character.carrying_capacity ?? 0) + invFx.modifiers.carryCapacity.add)
    * invFx.modifiers.carryCapacity.multiply
  )
  const effectiveAttackItems = attackItems.map(item => {
    if (item.id !== selectedAttackId) return item
    const fx = evaluateSkillEffects(activeSkills, { actionType: 'attack', weaponType: item.subtype ?? undefined, isCombat: true })
    return { ...item, modifier: (item.modifier ?? 0) + fx.modifiers.damage.add, coefficient: (item.coefficient ?? 1) * fx.modifiers.damage.multiply }
  })
  const effectiveDefendItems = defendItems.map(item => {
    if (item.id !== selectedDefendId) return item
    const fx = evaluateSkillEffects(activeSkills, { actionType: 'defense', armorType: item.subtype ?? undefined, isCombat: true })
    return { ...item, modifier: (item.modifier ?? 0) + fx.modifiers.defense.add, coefficient: (item.coefficient ?? 1) * fx.modifiers.defense.multiply }
  })

  // ── Skill Tree Updates───────────────────────────────────────────────────────

  

  // ── GM reply refresh ────────────────────────────────────────────────────────

  const refreshCharacter = async () => {
    const supabase = createClient()
    const data = await svcRefreshCharacter(supabase, character.id)
    if (data) setCharacter(data as Character)
  }

  // ── Pending offers ──────────────────────────────────────────────────────────

  const {
    pendingOffers,
    activePendingOffer,
    activeOfferItem: activeOfferItemRaw,
    bellOpen,
    setBellOpen,
    openOfferPopup,
    handleOfferClose,
    handleOfferAccept,
    handleOfferDecline,
  } = usePendingOffers(character.id, isOwner, async () => {
    await refreshCharacter()
    startTransition(() => router.refresh())
  })
  const activeOfferItem = activeOfferItemRaw as Item | null

  // ── Handlers ────────────────────────────────────────────────────────────────

  const updatePool = async (pool: PoolKey, delta: number) => {
    if (!isOwner) return
    const newValue = Math.max(0, (character[pool] ?? 0) + delta)
    setUpdating(pool)
    const supabase = createClient()
    const { error } = await svcUpdatePool(supabase, character.id, pool, newValue)
    if (!error) setCharacter((prev) => ({ ...prev, [pool]: newValue }))
    setUpdating(null)
  }

  const updateMoney = async (delta: number) => {
    if (!isOwner) return
    const newValue = Math.max(0, (character.denarius ?? 0) + delta)
    setUpdating("denarius")
    const supabase = createClient()
    const { error } = await svcUpdateMoney(supabase, character.id, newValue)
    if (!error) setCharacter((prev) => ({ ...prev, denarius: newValue }))
    setUpdating(null)
  }

  const handleAction = async (actionType: ActionType, itemId: string, isStrong = false) => {
    const item = items.find((i) => i.id === itemId)
    if (!item) return

    const supabase = createClient()

    const fxContext: ActionContext = actionType === "Defend"
      ? { actionType: 'defense', armorType: item.subtype ?? undefined, isCombat: true }
      : { actionType: 'attack', weaponType: item.subtype ?? undefined, isCombat: true }
    const fx = evaluateSkillEffects(activeSkills, fxContext)
    const skillMod = actionType === "Defend" ? fx.modifiers.defense : fx.modifiers.damage

    let baseValue: number
    if (actionType === "Defend") {
      baseValue = isStrong ? (item.strong_defence ?? item.defence ?? 0) : (item.defence ?? 0)
    } else {
      const dieFace = isStrong ? (item.strong_damage ?? item.damage ?? 0) : (item.damage ?? 0)
      baseValue = rollDice(item.die_count ?? 0, dieFace)
    }

    const total = ((baseValue + (item.modifier ?? 0) + skillMod.add) * (item.coefficient ?? 1)) * skillMod.multiply
    setLastRoll({ label: `${actionType}ed for`, value: total })

    if (actionType === "Attack" || actionType === "Cast") {
      if (item.subtype !== "melee") {
        const newCondition = Math.max(0, (item.condition ?? 0) - total)
        if (newCondition <= 0) {
          await removeInventoryItem(supabase, item.id)
        } else {
          await updateInventoryItem(supabase, item.id, { condition: newCondition })
        }
        startTransition(() => router.refresh())
      }
    }

    const cost = isStrong ? (item.strong_cost ?? item.cost) : item.cost
    if (isOwner && cost && item.cost_attribute_name) {
      const pool: PoolKey = item.cost_attribute_name === "power" ? "current_power" : "current_will"
      const currentValue = character[pool] ?? 0
      if (currentValue < cost) {
        const attrLabel = item.cost_attribute_name === "power" ? "Power" : "Will"
        setActionError(`You do not have enough ${attrLabel} to do that action`)
        setTimeout(() => setActionError(null), 3000)
        return
      }
      await updatePool(pool, -cost)
    }
  }

  const handleRepair = async (item: Item) => {
    const repairAmount   = rollDice(1, 10)
    const newCondition   = Math.min(100, (item.condition ?? 0) + repairAmount)
    const actualRepaired = newCondition - (item.condition ?? 0)

    const supabase = createClient()
    const { error } = await updateInventoryItem(supabase, item.id, { condition: newCondition })

    if (!error) {
      setRepairPopup(`Repaired ${actualRepaired}`)
      setTimeout(() => setRepairPopup(null), 2000)
      router.refresh()
    } else {
      console.error("Repair error:", error)
    }
  }

  const handleRest = async () => {
    if (!isOwner) return
    const restFx = evaluateSkillEffects(activeSkills, { actionType: 'rest' })
    const BASE_REST = 7
    const updates = {
      current_health:  Math.min(character.health_max  ?? 0, (character.current_health  ?? 0) + BASE_REST + (restFx.poolOverrides.restGains['health']  ?? 0)),
      current_essence: Math.min(character.essence_max ?? 0, (character.current_essence ?? 0) + BASE_REST + (restFx.poolOverrides.restGains['essence'] ?? 0)),
      current_power:   Math.min(character.power_max   ?? 0, (character.current_power   ?? 0) + BASE_REST + (restFx.poolOverrides.restGains['power']   ?? 0)),
      current_will:    Math.min(character.will_max    ?? 0, (character.current_will    ?? 0) + BASE_REST + (restFx.poolOverrides.restGains['will']    ?? 0)),
    }
    const { error } = await updateCharacter(createClient(), character.id, updates)
    if (!error) setCharacter((prev) => ({ ...prev, ...updates }))
  }

  const handleConsume = async (item: Item) => {
    const supabase = createClient()
    const { error } = await removeInventoryItem(supabase, item.id)
    if (!error) {
      setNotification({ text: item.action_text, url: item.image_url })
      setTimeout(() => setNotification(null), 10_000)
      router.refresh()
    }
  }

  const handleDrop = async (item: Item) => {
    const supabase = createClient()
    const { error } = await removeInventoryItem(supabase, item.id)
    if (!error) router.refresh()
  }

  const handleSaveDescription = async (field: "physical_description" | "backstory", value: string) => {
    const { error } = await updateCharacter(createClient(), character.id, { [field]: value })
    if (!error) setCharacter(prev => ({ ...prev, [field]: value } as Character))
  }

  // handle for deleting a character
  const handleDeleteCharacter = async () => {
    if (!isOwner) return
    
    const confirmed = window.confirm(
      `Are you sure you want to delete ${character.name}? This action is permanent and cannot be undone.`
    )

    if (confirmed) {
      setIsDeleting(true)
      const { error } = await deleteCharacter(createClient(), character.id)

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
            <div className="hidden md:block h-6 w-px bg-border" />
            <h1 className="hidden md:block font-serif text-2xl tracking-wide text-foreground">
              {character.name}
            </h1>
            <span className="hidden md:inline-block text-xs uppercase tracking-widest text-muted-foreground bg-secondary px-2 py-1">
              Lv. {level}
            </span>
            {character.is_active && (
              <span className="hidden md:inline-block text-xs uppercase tracking-widest text-muted-foreground bg-secondary px-2 py-1">
                Active
              </span>
            )}
          </div>
          <div className="flex items-center gap-4">
            {isDev && (
              <div className="flex items-center gap-2">
                <Wrench className="w-3.5 h-3.5 text-muted-foreground" />
                <Switch
                  checked={devModeEnabled}
                  onCheckedChange={setDevModeEnabled}
                  id="dev-mode-char-toggle"
                />
                <label
                  htmlFor="dev-mode-char-toggle"
                  className="text-xs uppercase tracking-widest text-muted-foreground cursor-pointer select-none"
                >
                  Dev
                </label>
              </div>
            )}
            {isOwner && (
              <div className="relative">
                <button
                  onClick={() => setBellOpen(prev => !prev)}
                  className="relative p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Bell className="w-5 h-5" />
                  {pendingOffers.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 text-black text-[9px] font-bold flex items-center justify-center rounded-full">
                      {pendingOffers.length > 9 ? "9+" : pendingOffers.length}
                    </span>
                  )}
                </button>
                {bellOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setBellOpen(false)} />
                    <div className="absolute right-0 top-full mt-1 w-72 bg-card border border-border shadow-xl z-50">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground px-4 py-2 border-b border-border">
                        Pending Offers
                      </p>
                      {pendingOffers.length === 0 ? (
                        <p className="font-serif text-sm text-muted-foreground italic px-4 py-3">No pending offers.</p>
                      ) : (
                        <div className="max-h-64 overflow-y-auto">
                          {pendingOffers.map(offer => (
                            <div key={offer.id} className="flex items-center gap-2 px-3 py-2.5 border-b border-border/50 last:border-0 hover:bg-secondary/20">
                              <button
                                onClick={() => openOfferPopup(offer)}
                                className="flex-1 text-left min-w-0"
                              >
                                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{offerTypeLabel[offer.type]}</p>
                                <p className="font-serif text-sm text-foreground truncate">{offer.label}</p>
                              </button>
                              <div className="flex gap-1 shrink-0">
                                <button
                                  onClick={() => handleOfferAccept(offer)}
                                  className="text-[0.6rem] uppercase tracking-widest border border-amber-500/60 text-amber-400 px-2 py-1 hover:bg-amber-950/40 transition-colors"
                                >
                                  Accept
                                </button>
                                <button
                                  onClick={() => handleOfferDecline(offer)}
                                  className="text-[0.6rem] uppercase tracking-widest border border-border text-muted-foreground px-2 py-1 hover:border-foreground/40 transition-colors"
                                >
                                  Decline
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
            <Link href="/dashboard" className="font-serif text-lg tracking-wide text-muted-foreground hover:text-foreground">
              KatabataK
            </Link>
          </div>
        </div>
        {/* Mobile secondary header: name, level, active tab */}
        <div className="md:hidden border-t border-border px-6 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="font-serif text-lg tracking-wide text-foreground">{character.name}</h2>
            <span className="text-xs uppercase tracking-widest text-muted-foreground bg-secondary px-2 py-0.5">
              Lv. {level}
            </span>
          </div>
          <span className="text-xs uppercase tracking-widest text-muted-foreground">{activeTab}</span>
        </div>
      </header>

      <main className="px-6 md:px-12 lg:px-20 py-8">
        <section className="mb-10">
          <h2 className="text-sm uppercase tracking-[0.3em] text-muted-foreground mb-4">Skill Checks</h2>
          <SkillCheckPanel character={character} onCharacterUpdate={patch => setCharacter(prev => ({ ...prev, ...patch }))} />
        </section>

        <section className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Pools</h2>
            <InfoTooltip text="Your four resource pools — Essence, Power, Will, and Health — each start at 10. They are spent on actions and combat, and their current level has passive effects on your character." />
            {isOwner && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRest}
                className="ml-auto text-[10px] uppercase tracking-widest border border-border text-muted-foreground hover:text-foreground h-7 px-3"
              >
                Long Rest
              </Button>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8 w-full max-w-full">
            <PoolCounter
              label={`Essence (${character.essence_max})`}
              value={character.current_essence ?? 0}
              max={character.essence_max ?? 0}
              onIncrement={() => updatePool("current_essence", 1)}
              onDecrement={() => updatePool("current_essence", -1)}
              disabled={!isOwner}
              loading={updating === "current_essence"}
            />
            <PoolCounter
              label={`Power (${character.power_max})`}
              value={character.current_power ?? 0}
              max={character.power_max ?? 0}
              onIncrement={() => updatePool("current_power", 1)}
              onDecrement={() => updatePool("current_power", -1)}
              disabled={!isOwner}
              loading={updating === "current_power"}
            />
            <PoolCounter
              label={`Will (${character.will_max})`}
              value={character.current_will ?? 0}
              max={character.will_max ?? 0}
              onIncrement={() => updatePool("current_will", 1)}
              onDecrement={() => updatePool("current_will", -1)}
              disabled={!isOwner}
              loading={updating === "current_will"}
            />
            <PoolCounter
              label={`Health (${character.health_max})`}
              value={character.current_health ?? 0}
              max={character.health_max ?? 0}
              onIncrement={() => updatePool("current_health", 1)}
              onDecrement={() => updatePool("current_health", -1)}
              disabled={!isOwner}
              loading={updating === "current_health"}
            />
          </div>
        </section>

        {repairPopup && <RepairToast message={repairPopup} />}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full bg-secondary mb-8">
            <TabsTrigger value="actions" className="flex-1 uppercase tracking-widest text-xs data-[state=active]:bg-card">
              Actions
            </TabsTrigger>
            <TabsTrigger value="skills" className="flex-1 uppercase tracking-widest text-xs data-[state=active]:bg-card">
              Skills & Attributes
            </TabsTrigger>
            <TabsTrigger value="items" className="flex-1 uppercase tracking-widest text-xs data-[state=active]:bg-card">
              Items
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Actions */}
          <TabsContent value="actions">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Actions</h2>
              <InfoTooltip text="Execute combat using equipped weapons and armor. Attack rolls your weapon's dice for damage; Defend applies flat damage reduction from your armor." />
            </div>

            {actionError && (
              <div className="mb-4 p-3 bg-red-950/60 border border-red-700/70 text-center animate-in fade-in slide-in-from-top-1">
                <span className="text-xs uppercase tracking-widest text-red-400">
                  {actionError}
                </span>
              </div>
            )}

            {lastRoll && (
              <div className="mb-4 p-3 bg-secondary/30 border border-border text-center animate-in fade-in slide-in-from-top-1">
                <span className="text-xs uppercase tracking-widest text-muted-foreground">
                  {lastRoll.label} Result:
                </span>
                <span className="ml-2 font-serif text-2xl text-foreground">{lastRoll.value}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 mb-10">
              <ActionCard
                label="Attack"
                items={effectiveAttackItems}
                selectedId={selectedAttackId}
                onSelect={setSelectedAttackId}
                onAction={(isStrong) => handleAction("Attack", selectedAttackId, isStrong)}
                isFlat={false}
              />
              <ActionCard
                label="Defend"
                items={effectiveDefendItems}
                selectedId={selectedDefendId}
                onSelect={setSelectedDefendId}
                onAction={(isStrong) => handleAction("Defend", selectedDefendId, isStrong)}
                isFlat={true}
              />
            </div>

            {/* Active Skills */}
            <div className="mb-10">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Active Skills</h2>
                <button
                  onClick={() => setActionSkillsOpen(true)}
                  className="text-[9px] uppercase tracking-widest border border-amber-700/40 text-amber-500/70 px-3 py-1.5 hover:bg-amber-950/20 transition-colors"
                >
                  {actionSkills.length > 0 ? `${actionSkills.length} skill${actionSkills.length === 1 ? "" : "s"}` : "View"}
                </button>
              </div>
              {actionSkills.length === 0 ? (
                <p className="font-serif text-xs text-muted-foreground/40 italic border border-border/30 p-3">
                  No active skills assigned.
                </p>
              ) : (
                <div className="border border-border/30 divide-y divide-border/20">
                  {actionSkills.slice(0, 3).map((s) => (
                    <div key={s.id} className="flex items-center justify-between px-3 py-2">
                      <span className="font-serif text-sm text-foreground truncate">{s.name}</span>
                      {s.type && (
                        <span className="text-[9px] uppercase tracking-widest text-muted-foreground/50 shrink-0 ml-2">
                          {s.type}
                        </span>
                      )}
                    </div>
                  ))}
                  {actionSkills.length > 3 && (
                    <div className="px-3 py-2">
                      <span className="text-[10px] uppercase tracking-widest text-muted-foreground/40">
                        +{actionSkills.length - 3} more
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Grimoire */}
            <div>
              <div className="flex items-center gap-3 mb-4">
                <AddSpellModal characterId={character.id} />
                <Sword className="w-5 h-5 text-cyan-400 rotate-45 drop-shadow-[0_0_5px_rgba(34,211,238,0.6)]" />
                <h2 className="text-sm uppercase tracking-[0.3em] text-cyan-100 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]">
                  Grimoire
                </h2>
                <InfoTooltip text="Spells cost Essence to cast. Some require a focus item — casting degrades that item's condition. Maintain your focus or lose access to its magic." />
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
          </TabsContent>

          {/* Tab 2: Skills & Attributes */}
          <TabsContent value="skills">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12">
              {/* Left: Attributes + descriptions */}
              <div className="lg:col-span-1 space-y-6">
                <div>
                  <h2 className="text-sm uppercase tracking-[0.3em] text-muted-foreground mb-3">Attributes</h2>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: "Speed",  value: character.speed      ?? "—" },
                      { label: "Height", value: character.height     ?? "—" },
                      { label: "Weight", value: character.weight_kgs ?? "—" },
                      { label: "Carry",  value: character.carrying_capacity != null ? effectiveCarryCapacity : "—" },
                    ].map(({ label, value }) => (
                      <div key={label} className="border border-border bg-card p-3 text-center">
                        <p className="font-serif text-xl text-foreground leading-none">{value}</p>
                        <p className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground mt-1.5">{label}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-2 border border-border bg-card px-4 py-3 flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Denarius</span>
                    <div className="flex items-center gap-2">
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

                <div className="space-y-4">
                  <DescriptionBlock label="Primary Background"   text={character.background_primary ?? undefined}   />
                  <DescriptionBlock label="Secondary Background" text={character.background_secondary ?? undefined} />
                  <DescriptionBlock label="Physical Description" text={character.physical_description ?? undefined} onSave={isOwner ? (v) => handleSaveDescription("physical_description", v) : undefined} />
                  <DescriptionBlock label="Backstory"            text={character.backstory ?? undefined} expandable onSave={isOwner ? (v) => handleSaveDescription("backstory", v) : undefined} />
                </div>
                <div className="text-xs text-muted-foreground pt-4 border-t border-border">
                  Created {character.created_at ? new Date(character.created_at).toLocaleDateString() : "Unknown"}
                </div>
              </div>

              {/* Right: Skill Tree */}
              <div className="lg:col-span-2">
                <div className="flex items-center gap-2 mb-4">
                  <InfoTooltip text="Spend skill points to unlock new abilities. Skills are interconnected — unlocking one may open paths to deeper, more powerful abilities gained through discovery and level-ups." />
                </div>
                <SkillTreeViewer
                  isDev={devModeEnabled}
                  characterId={character.id}
                  unused_skill_points={character.unused_skill_points}
                  onSkillChange={async () => {
                    await refreshCharacter()
                    startTransition(() => router.refresh())
                  }}
                />
              </div>
            </div>

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
          </TabsContent>

          {/* Tab 3: Items */}
          <TabsContent value="items">
            <section className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <h2 className="text-sm uppercase tracking-[0.3em] text-muted-foreground">All Items</h2>
                  <AddItemModal characterId={character.id} type="all" />
                  <Package className="w-5 h-5 text-muted-foreground" />
                  <InfoTooltip text="Your carried inventory, tracked against your carrying capacity. Consumables are used once; other items degrade with use and can be repaired." />
                </div>
                <span className="text-sm text-muted-foreground">
                  Weight:{" "}
                  <span className="text-foreground font-medium">{totalWeight}</span>
                  {character.carrying_capacity && (
                    <span className="text-muted-foreground"> / {effectiveCarryCapacity}</span>
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
            </section>

            <section className="mb-8">
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Weapons</h2>
                <AddItemModal characterId={character.id} type="weapon" />
                <Sword className="w-5 h-5 text-muted-foreground" />
                <InfoTooltip text="Equipped weapons power your Attack action. Each has a damage die and modifier. All weapons degrade with use and must be repaired to stay effective." />
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
            </section>

            <section>
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Armor</h2>
                <AddItemModal characterId={character.id} type="armor" />
                <Shield className="w-5 h-5 text-muted-foreground" />
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
            </section>
          </TabsContent>
        </Tabs>
      </main>

      {/* Overlays */}
      <ActionSkillModal
        isOpen={actionSkillsOpen}
        onClose={() => setActionSkillsOpen(false)}
        skills={actionSkills}
        characterId={character.id}
      />
      <InspectItemModal
        item={inspectingItem}
        onClose={() => setInspectingItem(null)}
        onGiveToAlly={isOwner ? () => { setGivingItem(inspectingItem); setInspectingItem(null) } : undefined}
      />
      {notification && (
        <NotificationOverlay notification={notification} onDismiss={() => setNotification(null)} />
      )}
      {activePendingOffer && activePendingOffer.type === "item" && activeOfferItem ? (
        <InspectItemModal
          item={activeOfferItem}
          onClose={handleOfferClose}
          onAccept={handleOfferAccept}
          onDecline={handleOfferDecline}
        />
      ) : activePendingOffer ? (
        <NotificationOverlay
          pendingOffer={activePendingOffer}
          onDismiss={handleOfferDecline}
          onAccept={handleOfferAccept}
        />
      ) : null}
      {givingItem && (
        <GiveToAllyModal
          item={{
            id: givingItem.id,
            base_id: givingItem.base_id,
            name: givingItem.name,
            condition: givingItem.condition,
          }}
          characterId={character.id}
          onClose={() => setGivingItem(null)}
          onGiven={() => {
            setGivingItem(null)
            startTransition(() => router.refresh())
          }}
        />
      )}
    </div>
  )
}
