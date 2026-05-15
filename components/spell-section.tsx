"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Character } from "./types/types"

// ─── Types ────────────────────────────────────────────────────────────────────

/** Shape returned by the spells table (only the fields this component needs). */
export interface Spell {
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
  cast_time_min?: number
  cooldown_min?: number
  range_m?: number
  description?: string
  req_item_1?: string   // UUID — foreign key → items.id
  req_item_2?: string
  req_item_3?: string
  req_skill_1?: string  // UUID — foreign key → skills.id
  req_skill_2?: string
}

/**
 * Minimal item shape needed to check inventory.
 * Import from types/character.ts in your project.
 */
export interface InventoryItem {
  id: string
  name: string
}

type SpellCasterPools = Pick<Character, "current_power" | "current_will" | "current_essence" | "current_health">

type PoolKey = "current_essence"| "current_power" | "current_will" | "current_health"

export interface SpellTableProps {
  spells: Spell[]
  /** The casting character's inventory — used to gate and consume required items. */
  inventory: InventoryItem[]
  characterId: string
  isOwner: boolean
  character: SpellCasterPools
  updatePool: (pool: PoolKey, delta: number) => Promise<void>
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolvePool(cost_attribute_name?: string): PoolKey {
    if (cost_attribute_name === "power") return "current_power"
    if (cost_attribute_name === "health")  return "current_health"
    if (cost_attribute_name === "will")  return "current_will"
    return "current_essence"  // default
}


/**
 * Returns the inventory items that satisfy a spell's requirements,
 * or null for each slot that is unsatisfied.
 */
function resolveRequiredItems(
  spell: Spell,
  inventory: InventoryItem[],
): { resolved: (InventoryItem | null)[]; allPresent: boolean } {
  const requiredIds = [spell.req_item_1, spell.req_item_2, spell.req_item_3].filter(Boolean) as string[]

  if (requiredIds.length === 0) return { resolved: [], allPresent: true }

  const resolved = requiredIds.map(
    (id) => inventory.find((item) => item.id === id) ?? null,
  )

  return {
    resolved,
    allPresent: resolved.every((r) => r !== null),
  }
}

function formatCost(spell: Spell): string {
  if (!spell.cost) return "—"
  const attr = spell.cost_attribute_name
  const suffix = attr === "power" ? "P" : attr === "will" ? "W" : ""
  return `${spell.cost}${suffix}`
}

function formatDamage(spell: Spell): string {
  if (!spell.damage) return "—"
  const mod = spell.modifier
    ? spell.modifier > 0 ? `+${spell.modifier}` : `${spell.modifier}`
    : ""
  const coeff = spell.coefficient && spell.coefficient !== 1 ? ` x${spell.coefficient}` : ""
  return `${spell.damage}${mod}${coeff}`
}


// ─── Sub-components ───────────────────────────────────────────────────────────

interface RequirementBadgeProps {
  item: InventoryItem | null
  /** The raw UUID from the spell row — used as a fallback label. */
  id: string
}

/**
 * Shows a green "✓ Item Name" badge when the item is in inventory,
 * or a red "✗ Item Name" badge when it is missing.
 */
function RequirementBadge({ item, id }: RequirementBadgeProps) {
  const present = item !== null
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded border font-mono ${
        present
          ? "bg-green-900/30 text-green-400 border-green-800"
          : "bg-red-900/30 text-red-400 border-red-800"
      }`}
    >
      {present ? "✓" : "✗"}
      {/* Show item name when resolved, otherwise show a truncated UUID as a hint */}
      <span className="max-w-[80px] truncate">
        {item?.name ?? id.slice(0, 8) + "…"}
      </span>
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

interface SpellRowProps {
  spell: Spell
  inventory: InventoryItem[]
  isOwner: boolean
  onCast: (spell: Spell) => Promise<void>
  casting: boolean
}

// Shared derived data hook — keeps both row variants in sync
function useSpellRowData(spell: Spell, inventory: InventoryItem[], isOwner: boolean) {
  const { resolved, allPresent } = resolveRequiredItems(spell, inventory)
  const requiredIds = [spell.req_item_1, spell.req_item_2, spell.req_item_3].filter(Boolean) as string[]
  return { resolved, requiredIds, canCast: isOwner && allPresent }
}

// Returns a <div> — safe to place inside the mobile <div> list
function SpellRowMobile({ spell, inventory, isOwner, onCast, casting }: SpellRowProps) {
  const { resolved, requiredIds, canCast } = useSpellRowData(spell, inventory, isOwner)

  return (
    <div className="p-4 space-y-3 hover:bg-secondary/10 transition-colors">
      <div className="flex justify-between items-start gap-2">
        <div>
          <h4 className="font-serif text-base text-foreground">{spell.name}</h4>
          <p className="text-[10px] uppercase text-muted-foreground tracking-wider mt-0.5">
            {spell.type}{spell.subtype ? ` · ${spell.subtype}` : ""}
          </p>
        </div>
        {isOwner && (
          <button
            onClick={() => onCast(spell)}
            disabled={!canCast || casting}
            className="shrink-0 px-3 py-1.5 text-xs bg-cyan-900/30 text-cyan-400 border border-cyan-800 hover:bg-cyan-800 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {casting ? "Casting…" : "Cast"}
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 text-sm">
        <div className="flex flex-col">
          <span className="text-[10px] uppercase text-muted-foreground tracking-tighter">Damage</span>
          <span className="text-foreground/90">{formatDamage(spell)}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] uppercase text-muted-foreground tracking-tighter">Cost</span>
          <span className="text-foreground/90">{formatCost(spell)}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] uppercase text-muted-foreground tracking-tighter">Range</span>
          <span className="text-foreground/90">{spell.range_m ? `${spell.range_m}m` : "—"}</span>
        </div>
      </div>

      {requiredIds.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-[10px] uppercase text-muted-foreground tracking-tighter">Requires</span>
          <div className="flex flex-wrap gap-1">
            {resolved.map((item, i) => (
              <RequirementBadge key={requiredIds[i]} item={item} id={requiredIds[i]} />
            ))}
          </div>
        </div>
      )}

      {spell.description && (
        <p className="text-[11px] text-muted-foreground italic leading-snug">{spell.description}</p>
      )}
    </div>
  )
}

// Returns a <tr> — safe to place inside <tbody>
function SpellRowDesktop({ spell, inventory, isOwner, onCast, casting }: SpellRowProps) {
  const { resolved, requiredIds, canCast } = useSpellRowData(spell, inventory, isOwner)

  return (
    <tr className="border-b border-border hover:bg-secondary/20 transition-colors">
      <td className="p-3 text-sm">
        <div className="font-serif text-foreground">{spell.name}</div>
        <div className="text-[10px] uppercase text-muted-foreground tracking-wider mt-0.5">
          {spell.type}{spell.subtype ? ` · ${spell.subtype}` : ""}
        </div>
      </td>

      <td className="p-3 text-sm text-foreground/80">{formatDamage(spell)}</td>
      <td className="p-3 text-sm text-foreground/80">{formatCost(spell)}</td>
      <td className="p-3 text-sm text-foreground/80">
        {spell.range_m ? `${spell.range_m}m` : "—"}
      </td>

      <td className="p-3">
        {requiredIds.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {resolved.map((item, i) => (
              <RequirementBadge key={requiredIds[i]} item={item} id={requiredIds[i]} />
            ))}
          </div>
        ) : (
          <span className="text-[10px] text-muted-foreground italic">None</span>
        )}
      </td>

      <td className="p-3 text-sm text-muted-foreground italic max-w-[200px]">
        <span className="line-clamp-2">{spell.description ?? "—"}</span>
      </td>

      <td className="p-3 text-right">
        {isOwner && (
          <button
            onClick={() => onCast(spell)}
            disabled={!canCast || casting}
            className="px-3 py-1.5 text-xs bg-cyan-900/30 text-cyan-400 border border-cyan-800 hover:bg-cyan-800 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {casting ? "Casting…" : "Cast"}
          </button>
        )}
      </td>
    </tr>
  )
}



// ─── Main component ───────────────────────────────────────────────────────────

export function SpellTable({ spells, inventory, characterId, isOwner, character, updatePool }: SpellTableProps) {
  const router = useRouter()
  const [castingId, setCastingId] = useState<number | null>(null)
  const [lastCast, setLastCast] = useState<{ name: string; value: number } | null>(null)

  const handleCast = async (spell: Spell) => {
    const { allPresent, resolved } = resolveRequiredItems(spell, inventory)
    if (!allPresent) return  // blocked — button should already be disabled, belt-and-suspenders

    if (spell.cost && spell.cost_attribute_name) {
        const pool = resolvePool(spell.cost_attribute_name)
        if (character[pool] < spell.cost) return  // not enough — block cast
        await updatePool(pool, -spell.cost)
    }

    setCastingId(spell.id)

    try {
      const supabase = createClient()

      // 1. Roll damage
      const base = spell.damage ?? 0
      const total = (base + (spell.modifier ?? 0)) * (spell.coefficient ?? 1)
      setLastCast({ name: spell.name, value: total })

      // 2. Delete each required item from character_inventory
      const itemsToConsume = resolved.filter((i): i is InventoryItem => i !== null)
      for (const item of itemsToConsume) {
        await supabase
          .from("character_inventory")
          .delete()
          .eq("id", item.id)
          .eq("character_id", characterId)  // safety — only delete from this character
      }

      // 3. Deduct pool cost via parent callback
      if (spell.cost && spell.cost_attribute_name) {
        const pool = resolvePool(spell.cost_attribute_name)
        if (character[pool] < spell.cost) return  // not enough — block cast
        await updatePool(pool, -spell.cost)
    }

      router.refresh()
    } finally {
      setCastingId(null)
    }
  }

  if (spells.length === 0) {
    return (
      <div className="border border-cyan-900/50 bg-card/80 p-6 text-center">
        <p className="text-muted-foreground text-sm italic font-serif">No spells known</p>
      </div>
    )
  }

  return (
    <div className="relative group">
      {/* Ethereal glow */}
      <div className="absolute -inset-0.5 bg-cyan-500/20 rounded-lg blur opacity-30 group-hover:opacity-50 transition duration-1000" />

      <div className="relative border border-cyan-900/50 bg-card/80 backdrop-blur-sm overflow-hidden">
        {/* Last cast result */}
        {lastCast && (
          <div className="p-3 bg-cyan-900/20 border-b border-cyan-900/50 text-center animate-in fade-in slide-in-from-top-1">
            <span className="text-xs uppercase tracking-widest text-cyan-400/70">
              {lastCast.name} dealt
            </span>
            <span className="ml-2 font-serif text-2xl text-cyan-100">{lastCast.value}</span>
          </div>
        )}

        {/* ── Mobile list ── */}
        <div className="md:hidden divide-y divide-cyan-900/30">
          {spells.map((spell) => (
            <SpellRowMobile
              key={spell.id}
              spell={spell}
              inventory={inventory}
              isOwner={isOwner}
              onCast={handleCast}
              casting={castingId === spell.id}
            />
          ))}
        </div>

        {/* ── Desktop table ── */}
        <table className="hidden md:table w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-cyan-900/50 bg-cyan-950/20">
              {["Spell", "Damage", "Cost", "Range", "Requires", "Description", ""].map((col) => (
                <th key={col} className="text-xs uppercase tracking-widest text-cyan-400/60 p-3 font-normal">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {spells.map((spell) => (
              <SpellRowDesktop
                key={spell.id}
                spell={spell}
                inventory={inventory}
                isOwner={isOwner}
                onCast={handleCast}
                casting={castingId === spell.id}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}