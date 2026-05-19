"use client"

// ─── External imports ────────────────────────────────────────────────────────
import { useState, useTransition, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Bell, ChevronLeft, Check, Info, Minus, Package, Pencil, Plus, Shield, Sword, Trash2, X } from "lucide-react"

// ─── Internal imports ─────────────────────────────────────────────────────────
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { AddItemModal } from "@/components/add-item-modal"
import { AddSpellModal } from "@/components/add-spell-modal"
import { InspectItemModal } from "./inspect-item-modal"
import { SkillTreeViewer } from "@/components/skill-tree-viewer"
import { NotificationOverlay, type PendingOfferData } from "@/components/notification-overlay"
import { getConditionStyle } from "@/lib/utils"
import { ItemTable } from "./item-table"
import { ActionCard } from "./action-card"
import { SpellTable } from "@/components/spell-section"
import VirtualGMComponent from "@/components/virtual-gm-component"
import { Character, Spell } from "@/components/types/types"
import { resolvePendingOffer } from "@/lib/pending-offers"
import type { Tables } from "@/components/types/supabase"
import { evaluateSkillEffects, type SkillEffect, type ActionContext } from "@/lib/skill-engine"

interface Item {
  id: string
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
}

export function CharacterDashboard({
  character: initialCharacter,
  items,
  spells,
  isOwner,
  activeSkills,
  isDev,
  level,
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
  const [pendingOffers,      setPendingOffers]      = useState<PendingOfferData[]>([])
  const [activePendingOffer, setActivePendingOffer] = useState<PendingOfferData | null>(null)
  const [activeOfferItem,    setActiveOfferItem]    = useState<Item | null>(null)
  const [bellOpen,           setBellOpen]           = useState(false)
  const [actionError,        setActionError]        = useState<string | null>(null)

  // ── Pending offers: initial load + real-time subscription ───────────────────

  useEffect(() => {
    if (!isOwner) return

    const supabase = createClient()

    const resolveLabel = async (row: Tables<"pending_offers">): Promise<string> => {
      if (row.type === "item" && row.source_id) {
        const { data } = await supabase.from("items").select("name").eq("id", row.source_id).single()
        return data?.name ?? "Unknown Item"
      } else if (row.type === "spell" && row.source_id) {
        const { data } = await supabase.from("spells").select("name").eq("id", Number(row.source_id)).single()
        return data?.name ?? "Unknown Spell"
      } else if (row.type === "denarius") {
        return `${row.quantity ?? 0} Denarius`
      } else if (row.type === "skill_point") {
        const qty = row.quantity ?? 0
        return `${qty} Skill ${qty === 1 ? "Point" : "Points"}`
      }
      return ""
    }

    const loadOffers = async () => {
      const { data } = await supabase
        .from("pending_offers")
        .select("*")
        .eq("character_id", character.id)
      if (!data?.length) return
      const resolved = await Promise.all(
        data.map(async (row) => ({
          id: row.id,
          type: row.type,
          label: await resolveLabel(row),
          quantity: row.quantity,
          source_id: row.source_id,
        } as PendingOfferData))
      )
      setPendingOffers(resolved)
    }

    loadOffers()

    const channel = supabase
      .channel(`pending_offers:${character.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "pending_offers",
          filter: `character_id=eq.${character.id}`,
        },
        async (payload) => {
          const row = payload.new as Tables<"pending_offers">
          const label = await resolveLabel(row)
          const newOffer: PendingOfferData = { id: row.id, type: row.type, label, quantity: row.quantity, source_id: row.source_id }
          setPendingOffers(prev => [...prev, newOffer])
          if (row.type === "item" && row.source_id) {
            const { data: itemData } = await supabase.from("items").select("*").eq("id", row.source_id).single()
            setActiveOfferItem(itemData ? itemData as unknown as Item : null)
          }
          setActivePendingOffer(newOffer)
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [character.id, isOwner])

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
    const { data } = await supabase
      .from("characters")
      .select("*")
      .eq("id", character.id)
      .single()
    if (data) setCharacter(data as Character)
  }

  // ── Handlers ────────────────────────────────────────────────────────────────

  const updatePool = async (pool: PoolKey, delta: number) => {
    if (!isOwner) return
    const newValue = Math.max(0, (character[pool] ?? 0) + delta)
    setUpdating(pool)
    const supabase = createClient()
    const { error } = await supabase
      .from("characters")
      .update({ [pool]: newValue } as unknown as { current_health?: number | null; current_essence?: number | null; current_power?: number | null; current_will?: number | null })
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
          await supabase.from("character_inventory").delete().eq("id", item.id)
        } else {
          await supabase.from("character_inventory").update({ condition: newCondition }).eq("id", item.id)
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

  const handleRest = async () => {
    if (!isOwner) return
    const restFx = evaluateSkillEffects(activeSkills, { actionType: 'rest' })
    const supabase = createClient()
    const updates = {
      current_health:  Math.min(character.health_max  ?? 0, (character.health_max  ?? 0) + (restFx.poolOverrides.restGains['health']  ?? 0)),
      current_essence: Math.min(character.essence_max ?? 0, (character.essence_max ?? 0) + (restFx.poolOverrides.restGains['essence'] ?? 0)),
      current_power:   Math.min(character.power_max   ?? 0, (character.power_max   ?? 0) + (restFx.poolOverrides.restGains['power']   ?? 0)),
      current_will:    Math.min(character.will_max    ?? 0, (character.will_max    ?? 0) + (restFx.poolOverrides.restGains['will']    ?? 0)),
    }
    const { error } = await supabase.from('characters').update(updates).eq('id', character.id)
    if (!error) setCharacter(prev => ({ ...prev, ...updates }))
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

  const openOfferPopup = async (offer: PendingOfferData) => {
    setBellOpen(false)
    if (offer.type === "item" && offer.source_id) {
      const supabase = createClient()
      const { data } = await supabase.from("items").select("*").eq("id", offer.source_id).single()
      setActiveOfferItem(data ? data as unknown as Item : null)
    }
    setActivePendingOffer(offer)
  }

  const handleOfferClose = () => {
    setActivePendingOffer(null)
    setActiveOfferItem(null)
  }

  const handleOfferAccept = async (offer?: PendingOfferData) => {
    const target = offer ?? activePendingOffer
    if (!target) return
    await resolvePendingOffer(target.id, true)
    setPendingOffers(prev => prev.filter(o => o.id !== target.id))
    if (activePendingOffer?.id === target.id) { setActivePendingOffer(null); setActiveOfferItem(null) }
    await refreshCharacter()
    startTransition(() => router.refresh())
  }

  const handleOfferDecline = async (offer?: PendingOfferData) => {
    const target = offer ?? activePendingOffer
    if (!target) return
    await resolvePendingOffer(target.id, false)
    setPendingOffers(prev => prev.filter(o => o.id !== target.id))
    if (activePendingOffer?.id === target.id) { setActivePendingOffer(null); setActiveOfferItem(null) }
  }

  const handleSaveDescription = async (field: "physical_description" | "backstory", value: string) => {
    const supabase = createClient()
    const patch = field === "physical_description" ? { physical_description: value } : { backstory: value }
    const { error } = await supabase.from("characters").update(patch).eq("id", character.id)
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
            <span className="text-xs uppercase tracking-widest text-muted-foreground bg-secondary px-2 py-1">
              Lv. {level}
            </span>
            {character.is_active && (
              <span className="text-xs uppercase tracking-widest text-muted-foreground bg-secondary px-2 py-1">
                Active
              </span>
            )}
          </div>
          <div className="flex items-center gap-4">
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
      </header>

      <main className="px-6 md:px-12 lg:px-20 py-8">
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
              <AttributeRow label="Carrying Capacity" value={character.carrying_capacity != null ? effectiveCarryCapacity : "—"} />

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
              <DescriptionBlock label="Primary Background"   text={character.background_primary ?? undefined}   />
              <DescriptionBlock label="Secondary Background" text={character.background_secondary ?? undefined} />
              <DescriptionBlock label="Physical Description" text={character.physical_description ?? undefined} onSave={isOwner ? (v) => handleSaveDescription("physical_description", v) : undefined} />
              <DescriptionBlock label="Backstory"            text={character.backstory ?? undefined} expandable onSave={isOwner ? (v) => handleSaveDescription("backstory", v) : undefined} />
            </div>
            <div className="text-xs text-muted-foreground pt-4 border-t border-border">
              Created {character.created_at ? new Date(character.created_at).toLocaleDateString() : "Unknown"}
            </div>
          </div>

          {/* Right: Actions + Skill tree */}
          <div className="lg:col-span-2">
            <section>
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            </section>

            <div className="flex items-center gap-2 mb-4 pt-5">
              <h2 className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Skill Tree</h2>
              <InfoTooltip text="Spend skill points to unlock new abilities. Skills are interconnected — unlocking one may open paths to deeper, more powerful abilities gained through discovery and level-ups." />
            </div>
            <SkillTreeViewer
              isDev={isDev}
              characterId={character.id}
              unused_skill_points={character.unused_skill_points}
              onSkillChange={async () => {
                await refreshCharacter()
                startTransition(() => router.refresh())
              }}
            />
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
              <InfoTooltip text="Equipped weapons power your Attack action. Each has a damage die and modifier. All weapons degrade with use and must be repair to stay effective" />
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
                <InfoTooltip text="Your carried inventory, tracked against your carrying capacity. Consumables are used once; other items degrade with use and can be repaired." />
              </div>
              <span className="text-sm text-muted-foreground">
                Total Weight:{" "}
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
    </div>
  )
}
