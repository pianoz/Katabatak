"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ChevronLeft, Minus, Plus, Shield, Sword, Package, Hammer, Soup, Trash2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { SkillTreeViewer } from "@/components/skill-tree-viewer"
import { AddItemModal } from "@/components/add-item-modal"
import {AddSpellModal} from "@/components/add-spell-modal"

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
  current_carry_weight?:number
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
  description?: string
  damage?: number
  defence?: number
  character_id: string
  // Mechanics fields
  condition: number
  consumable: boolean
  die_count?: number
  modifier?: number
  modifier_attribute_name?: string
  coefficient?: number
  coefficient_attribute_name?: string
  cost?: number
  cost_attribute_name?: 'power' | 'will'
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
  // Add other schema fields as needed for display
}

interface CharacterDashboardProps {
  character: Character
  items: Item[]
  spells: Spell[]
  isOwner: boolean
}

export function CharacterDashboard({ character: initialCharacter, items, spells, isOwner }: CharacterDashboardProps) {
  const router = useRouter()
  const [character, setCharacter] = useState(initialCharacter)
  const [updating, setUpdating] = useState<string | null>(null)
  const [lastRoll, setLastRoll] = useState<{ label: string, value: number } | null>(null)

  // Filter items for dropdowns
  const attackItems = items.filter(i => i.type === "weapon")
  const defendItems = items.filter(i => i.type === "armor")
  const castItems = items.filter(i => i.type === "spell")

  // Selected IDs for dropdowns
  const [selectedAttackId, setSelectedAttackId] = useState(attackItems[0]?.id || "")
  const [selectedDefendId, setSelectedDefendId] = useState(defendItems[0]?.id || "")
  const [selectedCastId, setSelectedCastId] = useState(castItems[0]?.id || "")

  const weapons = items.filter(item => item.type === "weapon")
  const armor = items.filter(item => item.type === "armor")
  const otherItems = items.filter(item => item.type !== "weapon" && item.type !== "armor")
  
  const totalWeight = items.reduce((sum, item) => sum + (item.weight || 0), 0)

  const handleAction = async (actionType: "Attack" | "Defend" | "Cast", itemId: string) => {
    const item = items.find(i => i.id === itemId)
    if (!item) return
    let baseValue = 0

      // Logic Branch: To roll or not to roll?
      if (actionType === "Defend") {
        // Defense is a flat value from the armor_value field
        baseValue = item.defence || 0
      } else {
        // Attack and Cast still use the virtual dice roll
        const count = item.die_count || 0
        const type = item.damage || 0
        
        for (let i = 0; i < count; i++) {
          baseValue += Math.floor(Math.random() * type) + 1
        }
      }

      // Apply modifiers and coefficients to the base (whether rolled or flat)
      const total = (baseValue + (item.modifier || 0)) * (item.coefficient || 1)
      
      setLastRoll({ label: '${actionType}ed for', value: total })

      // Handle Cost subtraction (Power or Will)
      if (isOwner && item.cost && item.cost_attribute_name) {
        const pool = item.cost_attribute_name === "power" ? "current_power" : "current_will"
        updatePool(pool, -item.cost)
      }
    }

  const updateMoney = async (delta: number) => {
    if (!isOwner) return
     // Ensure money never goes below 0
    const newValue = Math.max(0, (character.denarius || 0) + delta)
        setUpdating("denarius")
    
    const supabase = createClient()
    const { error } = await supabase
        .from("characters")
        .update({ denarius: newValue }) // Use 'denarius' here if that is your DB column name
        .eq("id", character.id)

    if (!error) {
        setCharacter(prev => ({ ...prev, denarius: newValue }))
    }
    setUpdating(null)
 }

  const updatePool = async (pool: "current_essence" | "current_power" | "current_will" | "current_health", delta: number) => {
    if (!isOwner) return
    
    const newValue = Math.max(0, character[pool] + delta)
    setUpdating(pool)
    
    const supabase = createClient()
    const { error } = await supabase
      .from("characters")
      .update({ [pool]: newValue })
      .eq("id", character.id)

    if (!error) {
      setCharacter(prev => ({ ...prev, [pool]: newValue }))
    }
    setUpdating(null)
  }

  const handleRepair = async ({ id }: { id: string }) => { 
  const supabase = createClient();
  
  // Now 'id' is definitely the string "inventory_id_123"
  const { error } = await supabase
    .from("character_inventory")
    .update({ condition: 100 })
    .eq("id", id);
  
    if (error) console.error("Repair error:", error);
    if (!error) router.refresh();
  };

  const handleConsume = async (item: Item) => {
    const supabase = createClient();
    // Typically consumption removes the item or reduces quantity
    const { error } = await supabase
      .from("character_inventory")
      .delete()
      .eq("id", item.id);
      
    if (!error) router.refresh();
  };

  const handleDrop = async (item: Item) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("character_inventory")
      .delete()
      .eq("id", item.id);
      
    if (!error) router.refresh();
  };

  const SpellsSection = () => (
  <div className="space-y-4 pt-4">
    {/* Table with Ethereal Styling */}
    <div className="relative group">
      {/* Outer Glow Effect */}
      <div className="absolute -inset-0.5 bg-cyan-500/20 rounded-lg blur opacity-30 group-hover:opacity-50 transition duration-1000"></div>
      
      <div className="relative border border-cyan-900/50 bg-card/80 backdrop-blur-sm overflow-hidden">
        <ItemTable 
          items={spells as any} 
          columns={["name", "damage", "cost", "range_m"]}
          emptyMessage="No spells known"
          // We'll pass a custom className if your ItemTable supports it, 
          // otherwise, the wrapper above handles the "vibe"
        />
      </div>
    </div>
  </div>
)

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
        {/* Character Pools - Top Section */}
        <section className="mb-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8 w-full max-w-full">
            <PoolCounter 
              label={`Essence (${character.essence_max})`}
              value={character.current_essence} 
              max= {character.essence_max}
              onIncrement={() => updatePool("current_essence", 1)}
              onDecrement={() => updatePool("current_essence", -1)}
              disabled={!isOwner}
              loading={updating === "essence"}
            />
            <PoolCounter 
              label={`Power (${character.power_max})`}
              value={character.current_power} 
              max = {character.power_max}
              onIncrement={() => updatePool("current_power", 1)}
              onDecrement={() => updatePool("current_power", -1)}
              disabled={!isOwner}
              loading={updating === "current_power"}
            />
            <PoolCounter 
              label={`Will (${character.will_max})`} 
              value={character.current_will} 
              max = {character.will_max}
              onIncrement={() => updatePool("current_will", 1)}
              onDecrement={() => updatePool("current_will", -1)}
              disabled={!isOwner}
              loading={updating === "current_will"}
            />
            <PoolCounter 
              label={`Health (${character.health_max})`} 
              value={character.current_health} 
              max = {character.health_max}
              onIncrement={() => updatePool("current_health", 1)}
              onDecrement={() => updatePool("current_health", -1)}
              disabled={!isOwner}
              loading={updating === "current_health"}
            />
          </div>
        </section>

        {/* Main Content Area */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12">
          {/* Left Column - Attributes */}
          <div className="lg:col-span-1 space-y-6">
            <h2 className="text-sm uppercase tracking-[0.3em] text-muted-foreground mb-4">
              Attributes
            </h2>
            
            <div className="border border-border bg-card p-6 space-y-4">
              <AttributeRow label="Speed" value={character.speed ?? "—"} />
              <AttributeRow label="Height" value={character.height ?? "—"} />
              <AttributeRow label="Weight" value={character.weight_kgs ?? "—"} />
              <AttributeRow label="Carrying Capacity" value={character.carrying_capacity ?? "—"} />
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
                            onClick={() => updateMoney(-1)} // Quick spend 1
                            disabled={updating === "denarius" || (character.denarius || 0) < 1}
                        >
                            <Minus className="w-3 h-3" />
                        </Button>
                        )}
                        
                        <span className="font-serif text-lg text-foreground min-w-[3ch] text-center">
                        {character.denarius || 0}
                        </span>

                        {isOwner && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 rounded-md border border-border"
                            onClick={() => updateMoney(1)} // Quick gain 1
                            disabled={updating === "denarius"}
                        >
                            <Plus className="w-3 h-3" />
                        </Button>
                        )}
                    </div>
                </div>
            </div>

            {/* Text Descriptions */}
            <div className="space-y-4">
              <DescriptionBlock 
                label="Primary Background" 
                text={character.background_primary} 
              />
              <DescriptionBlock 
                label="Secondary Background" 
                text={character.background_secondary} 
              />
              <DescriptionBlock 
                label="Physical Description" 
                text={character.physical_description} 
              />
              <DescriptionBlock 
                label="Backstory" 
                text={character.backstory} 
                expandable
              />
            </div>

            <div className="text-xs text-muted-foreground pt-4 border-t border-border">
              Created {new Date(character.created_at).toLocaleDateString()}
            </div>
          </div>

          {/* Right Column - Skill Tree and Actions */}
          <div className="lg:col-span-2">
            {/* Action Sections */}
            <section>
              <h2 className="text-sm uppercase tracking-[0.3em] text-muted-foreground mb-4">
                Actions
              </h2>
              {lastRoll && (
                <div className="mb-4 p-3 bg-secondary/30 border border-border text-center animate-in fade-in slide-in-from-top-1">
                  <span className="text-xs uppercase tracking-widest text-muted-foreground">{lastRoll.label} Result:</span>
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
            <SkillTreeViewer isDev={false} characterId={character.id}/>
          </div>
        </div>

        {/* Mobile Spells: Above Skill Tree */}
        <section className="mt-12 space-y-8">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <AddSpellModal characterId={character.id} />
              <Sword className="w-5 h-5 text-cyan-400 rotate-45 drop-shadow-[0_0_5px_rgba(34,211,238,0.6)]" /> 
              <h2 className="text-sm uppercase tracking-[0.3em] text-cyan-100 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]">
                Grimoire 
              </h2>
            </div>
            <SpellsSection />
          </div>
        </section>

        {/* Equipment Section */}
        <section className="mt-12 space-y-8">
          {/* Weapons Table */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <AddItemModal characterId={character.id} type="weapon" />
              <Sword className="w-5 h-5 text-muted-foreground" />
              <h2 className="text-sm uppercase tracking-[0.3em] text-muted-foreground">
                Weapons 
              </h2>
            </div>
            <ItemTable 
              items={weapons} 
              columns={["name", "damage", "weight", "condition", "description"]}
              emptyMessage="No weapons equipped"
            />
          </div>

          {/* Armor Table */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <AddItemModal characterId={character.id} type="armor" />
              <Shield className="w-5 h-5 text-muted-foreground" />
              <h2 className="text-sm uppercase tracking-[0.3em] text-muted-foreground">
                Armor 
              </h2>
            </div>
            <ItemTable 
              items={armor} 
              columns={["name", "armor_value", "weight", "condition", "description"]}
              emptyMessage="No armor equipped"
            />
          </div>

          {/* Other Items Table */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <AddItemModal characterId={character.id} type="all" />
                <Package className="w-5 h-5 text-muted-foreground" />
                <h2 className="text-sm uppercase tracking-[0.3em] text-muted-foreground">
                  Items 
                </h2>
              </div>
              <span className="text-sm text-muted-foreground">
                Total Weight: <span className="text-foreground font-medium">{totalWeight}</span>
                {character.carrying_capacity && (
                  <span className="text-muted-foreground"> / {character.carrying_capacity}</span>
                )}
              </span>
            </div>
            <ItemTable 
              items={otherItems} 
              columns={["name", "weight", "condition", "description"]}
              emptyMessage="No items in inventory"
            />
          </div>
        </section>
      </main>
    </div>
  )
}

function PoolCounter({ 
  label, 
  value, 
  max,
  onIncrement, 
  onDecrement, 
  disabled,
  loading 
}: { 
  label: string
  value: number,
  max: number,
  onIncrement: () => void
  onDecrement: () => void
  disabled?: boolean
  loading?: boolean
}) {
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
        <span className={`font-serif text-4xl md:text-5xl text-foreground min-w-[3ch] ${loading ? 'opacity-50' : ''}`}>
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

function AttributeRow({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-sm ${highlight ? 'text-foreground font-medium' : 'text-foreground'}`}>
        {value}
      </span>
    </div>
  )
}

function DescriptionBlock({ label, text, expandable }: { label: string; text?: string; expandable?: boolean }) {
  const [expanded, setExpanded] = useState(false)
  
  if (!text) return null

  const shouldTruncate = expandable && text.length > 200 && !expanded

  return (
    <div className="border border-border bg-card p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">
        {label}
      </p>
      <p className={`font-serif text-sm text-foreground/90 leading-relaxed ${shouldTruncate ? 'line-clamp-4' : ''}`}>
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

function ActionCard({ 
  label, 
  items, 
  selectedId, 
  onSelect, 
  onAction,
  isFlat = false 
}: { 
  label: string, 
  items: Item[], 
  selectedId: string, 
  onSelect: (id: string) => void,
  onAction: () => void,
  isFlat?: boolean
}) {
  const selectedItem = items.find(i => i.id === selectedId)
  
  // Clean Integer Calculation for Dropdown Display
  const getShortStats = (item: Item) => {
    const power = isFlat ? (item.defence ?? 0) : item.damage
    const cost = item.cost ?? 0
    return `${power}/${cost}`
  }

  const damageDisplay = selectedItem ? (
    isFlat 
      ? `${selectedItem.defence ?? 0}${selectedItem.modifier ? (selectedItem.modifier > 0 ? `+${selectedItem.modifier}` : selectedItem.modifier) : ''}${selectedItem.coefficient && selectedItem.coefficient !== 1 ? ` x${selectedItem.coefficient}` : ''}`
      : `${selectedItem.die_count}d${selectedItem.damage}${selectedItem.modifier ? (selectedItem.modifier > 0 ? `+${selectedItem.modifier}` : selectedItem.modifier) : ''}${selectedItem.coefficient && selectedItem.coefficient !== 1 ? ` x${selectedItem.coefficient}` : ''}`
  ) : "—"

  const costDisplay = selectedItem?.cost 
    ? `${selectedItem.cost}${selectedItem.cost_attribute_name === 'power' ? 'P' : 'W'}` 
    : "0"
  
  return (
    <div className="border border-border bg-card p-3 flex flex-col justify-between min-h-[140px]">
      {/* Top Section */}
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
          {items.map(i => (
            <option key={i.id} value={i.id} className="bg-card text-foreground">
              {i.name} ({getShortStats(i)})
            </option>
          ))}
        </select>
      </div>

      {/* Bottom Section: Split Grid */}
      <div className="grid grid-cols-2 gap-4 border-t border-border pt-3 items-center">
        {/* Left: Stats */}
        <div className="flex flex-col items-center border-r border-border/50 pr-2">
          <div className="text-lg font-serif text-foreground leading-none">{damageDisplay}</div>
          <div className="w-12 h-px bg-border my-1" />
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">
            Cost: {costDisplay}
          </div>
        </div>

        {/* Right: Description */}
        <div className="pl-1">
          <p className="text-[10px] leading-tight text-muted-foreground italic line-clamp-3">
            {selectedItem?.description || "No description."}
          </p>
        </div>
      </div>
    </div>
  )
}

function ItemTable({ 
  items, 
  columns, 
  emptyMessage,
  onRepair,
  onConsume,
  onDrop
}: { 
  items: Item[]
  columns: string[]
  emptyMessage: string
  onRepair?: (item: Item) => void
  onConsume?: (item: Item) => void
  onDrop?: (item: Item) => void
}) {
  if (items.length === 0) {
    return (
      <div className="border border-border bg-card p-6 text-center">
        <p className="text-muted-foreground text-sm italic font-serif">
          {emptyMessage}
        </p>
      </div>
    )
  }

  const getConditionStyle = (percent: number) => {
    if (percent <= 15) {
      return {
        backgroundColor: '#0f0202',
        border: '1px solid #450a0a',
        boxShadow: '0 0 4px #7f1d1d'
      }
    }
    const hue = Math.min(Math.max((percent - 20) * 1.5, 0), 120)
    return {
      backgroundColor: `hsl(${hue}, 80%, 45%)`,
      transition: 'background-color 0.5s ease-in'
    }
  }

  const columnLabels: Record<string, string> = {
    name: "Name",
    damage: "Damage",
    defence: "Armor",
    weight: "Weight",
    description: "Description",
  }

  const genericColumns = columns.filter(col => col !== "condition")
  const showCondition = columns.includes("condition")

  return (
    <div className="border border-border bg-card overflow-hidden">
      {/* MOBILE VIEW: List of Cards */}
      <div className="md:hidden divide-y divide-border">
        {items.map((item) => (
          <div key={item.id} className="p-4 space-y-3 hover:bg-secondary/10 transition-colors">
            {/* Header: Name and Condition */}
            <div className="flex justify-between items-start">
              <div>
                <h4 className="font-serif text-lg text-foreground">{item.name}</h4>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">
                  {item.weight} lbs
                </p>
              </div>
              {showCondition && (
                <div
                  className="flex items-center justify-center w-10 h-10 rounded-sm"
                  style={getConditionStyle(item.condition)}
                >
                  <span className="text-[11px] font-semibold text-white/90">
                    {item.condition}%
                  </span>
                </div>
              )}
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-2 text-sm">
              {genericColumns.filter(c => c !== 'name' && c !== 'weight').map(col => (
                <div key={col} className="flex flex-col">
                  <span className="text-[10px] uppercase text-muted-foreground tracking-tighter">
                    {columnLabels[col] || col}
                  </span>
                  <span className="text-foreground/90">{item[col as keyof Item] ?? "—"}</span>
                </div>
              ))}
            </div>

            {/* Actions */}
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
                  onClick={() => onConsume?.(item)}
                  className="flex-1 py-2 text-xs bg-green-900/30 text-green-400 border border-green-800 active:bg-green-800 transition-all"
                >
                  Use
                </button>
              )}
              <button
                onClick={() => confirm(`Drop ${item.name}?`) && onDrop?.(item)}
                className="flex-1 py-2 text-xs bg-red-900/30 text-red-400 border border-red-800 active:bg-red-800 transition-all"
              >
                Drop
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* DESKTOP VIEW: Retained Original Table */}
      <table className="hidden md:table w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-border bg-secondary/50">
            {genericColumns.map(col => (
              <th key={col} className="text-xs uppercase tracking-widest text-muted-foreground p-3 font-normal">
                {columnLabels[col] || col}
              </th>
            ))}
            {showCondition && (
              <th className="text-xs uppercase tracking-widest text-muted-foreground p-3 font-normal">Condition</th>
            )}
            <th className="text-right text-xs uppercase tracking-widest text-muted-foreground p-3 font-normal">Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={item.id} className="border-b border-border hover:bg-secondary/20 transition-colors last:border-0">
              {genericColumns.map(col => (
                <td key={col} className="p-3 text-sm text-foreground">
                  <span className={col === "name" ? "font-serif" : "text-foreground/80"}>
                    {item[col as keyof Item] ?? "—"}
                  </span>
                </td>
              ))}
              {showCondition && (
                <td className="p-2">
                  <div className="relative flex items-center justify-center w-10 h-10 rounded-sm" style={getConditionStyle(item.condition)}>
                    <span className="text-[11px] font-semibold tracking-tight text-white/90">
                      {item.condition}%
                    </span>
                  </div>
                </td>
              )}
              <td className="p-3 text-right space-x-2 whitespace-nowrap">
                {/* ... Original Desktop Buttons ... */}
                {!item.consumable && (item.condition ?? 100) < 100 && (
                  <button onClick={() => onRepair?.(item)} className="px-2 py-1 text-xs bg-blue-900/30 text-blue-400 border border-blue-800 hover:bg-blue-800 hover:text-white transition-all">Repair</button>
                )}
                {item.consumable && (
                  <button onClick={() => onConsume?.(item)} className="px-2 py-1 text-xs bg-green-900/30 text-green-400 border border-green-800 hover:bg-green-800 hover:text-white transition-all">Use</button>
                )}
                <button onClick={() => confirm(`Drop ${item.name}?`) && onDrop?.(item)} className="px-2 py-1 text-xs bg-red-900/30 text-red-400 border border-red-800 hover:bg-red-800 hover:text-white transition-all">Drop</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
