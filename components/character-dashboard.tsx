"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ChevronLeft, Minus, Plus, Shield, Sword, Package } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { SkillTreeViewer } from "@/components/skill-tree-viewer"

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
  damage?: string
  armor_value?: number
  character_id: string
}

interface CharacterDashboardProps {
  character: Character
  items: Item[]
  isOwner: boolean
}

export function CharacterDashboard({ character: initialCharacter, items, isOwner }: CharacterDashboardProps) {
  const router = useRouter()
  const [character, setCharacter] = useState(initialCharacter)
  const [updating, setUpdating] = useState<string | null>(null)

  const weapons = items.filter(item => item.type === "weapon")
  const armor = items.filter(item => item.type === "armor")
  const otherItems = items.filter(item => item.type !== "weapon" && item.type !== "armor")
  
  const totalWeight = items.reduce((sum, item) => sum + (item.weight || 0), 0)

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
          <div className="grid grid-cols-4 gap-4 md:gap-8 w-full max-w-full">
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

          {/* Right Column - Skill Tree Placeholder */}
          <div className="lg:col-span-2">
            <h2 className="text-sm uppercase tracking-[0.3em] text-muted-foreground mb-4">
              Skill Tree
            </h2>
            <SkillTreeViewer isDev={false} characterId={character.id}/>
          </div>
        </div>

        {/* Equipment Section */}
        <section className="mt-12 space-y-8">
          {/* Weapons Table */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <Sword className="w-5 h-5 text-muted-foreground" />
              <h2 className="text-sm uppercase tracking-[0.3em] text-muted-foreground">
                Weapons
              </h2>
            </div>
            <ItemTable 
              items={weapons} 
              columns={["name", "damage", "weight", "description"]}
              emptyMessage="No weapons equipped"
            />
          </div>

          {/* Armor Table */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <Shield className="w-5 h-5 text-muted-foreground" />
              <h2 className="text-sm uppercase tracking-[0.3em] text-muted-foreground">
                Armor
              </h2>
            </div>
            <ItemTable 
              items={armor} 
              columns={["name", "armor_value", "weight", "description"]}
              emptyMessage="No armor equipped"
            />
          </div>

          {/* Other Items Table */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
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
              columns={["name", "weight", "description"]}
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

function ItemTable({ 
  items, 
  columns, 
  emptyMessage 
}: { 
  items: Item[]
  columns: string[]
  emptyMessage: string
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

  const columnLabels: Record<string, string> = {
    name: "Name",
    damage: "Damage",
    armor_value: "Armor",
    weight: "Weight",
    description: "Description"
  }

  return (
    <div className="border border-border bg-card overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border bg-secondary/50">
            {columns.map(col => (
              <th 
                key={col}
                className="text-left text-xs uppercase tracking-widest text-muted-foreground p-3 font-normal"
              >
                {columnLabels[col] || col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr 
              key={item.id} 
              className={index !== items.length - 1 ? "border-b border-border" : ""}
            >
              {columns.map(col => (
                <td key={col} className="p-3 text-sm text-foreground">
                  {col === "name" ? (
                    <span className="font-serif">{item[col as keyof Item] ?? "—"}</span>
                  ) : (
                    <span className="text-foreground/80">{item[col as keyof Item] ?? "—"}</span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
