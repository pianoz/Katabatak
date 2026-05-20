"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ChevronLeft, Plus, Lightbulb, Eye, EyeOff, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { ItemTable } from "@/components/item-table"
import type { Item } from "@/components/item-table"
import { CreateItemModal } from "@/components/create-item-modal"
import type { ItemFormValues } from "@/components/create-item-modal"
import { EditItemModal } from "@/components/edit-item-modal"
import type { Item as CatalogItem } from "@/components/types/types"

// ─── Inspire Me ideas ─────────────────────────────────────────────────────────

interface InspireIdea {
  label: string
  badge: string
  description: string
  values: ItemFormValues
}

const INSPIRE_IDEAS: InspireIdea[] = [
  {
    label: "Thornwhisper Dagger",
    badge: "weapon · uncommon",
    description: "A blade carved from petrified thorn. Whispers warnings before ambushes.",
    values: {
      name: "Thornwhisper Dagger",
      type: "weapon",
      subtype: "dagger",
      rarity: "uncommon",
      is_magical: true,
      consumable: false,
      short_description: "A blade carved from petrified thorn. Whispers warnings before ambushes.",
      long_description:
        "Forged deep within the Shrouded Wood, this dagger carries the memory of the forest within its grain. Those who wield it claim to hear faint whispers moments before danger strikes.",
      damage: "4",
      die_count: 1,
      weight: 1,
      hidden: false,
    },
  },
  {
    label: "Ashen Shroud",
    badge: "armor · rare",
    description: "Woven from ashes of burned manuscripts. Forgotten knowledge lingers in its folds.",
    values: {
      name: "Ashen Shroud",
      type: "armor",
      subtype: "cloak",
      rarity: "rare",
      is_magical: true,
      consumable: false,
      short_description: "Woven from ashes of burned manuscripts. Forgotten knowledge lingers in its folds.",
      long_description:
        "The scholars whose works were burned to create this cloak are said to linger within its folds, their knowledge whispering to the wearer in moments of peril.",
      defence: 1,
      weight: 1,
      hidden: false,
    },
  },
  {
    label: "Black Ichor Vial",
    badge: "consumable · uncommon",
    description: "Thick black liquid that mends wounds but stains the soul.",
    values: {
      name: "Black Ichor Vial",
      type: "consumable",
      subtype: "potion",
      rarity: "uncommon",
      is_magical: true,
      consumable: true,
      short_description: "Thick black liquid that mends wounds but stains the soul.",
      action_text: "Drink to restore health. The blackness lingers in your veins.",
      weight: 0,
      hidden: false,
    },
  },
  {
    label: "Rusted Chain Whip",
    badge: "weapon · common",
    description: "Heavy corroded chain links. Each strike draws blood and rust alike.",
    values: {
      name: "Rusted Chain Whip",
      type: "weapon",
      subtype: "whip",
      rarity: "common",
      is_magical: false,
      consumable: false,
      short_description: "Heavy corroded chain links. Each strike draws blood and rust alike.",
      damage: "5",
      die_count: 1,
      weight: 4,
      hidden: false,
    },
  },
  {
    label: "Lantern of Lost Souls",
    badge: "accessory · rare",
    description: "Burns with pale ghost-light. Those nearby feel the gaze of the trapped dead.",
    values: {
      name: "Lantern of Lost Souls",
      type: "accessory",
      subtype: "lantern",
      rarity: "rare",
      is_magical: true,
      consumable: false,
      short_description: "Burns with pale ghost-light. Those nearby feel the gaze of the trapped dead.",
      long_description:
        "The souls imprisoned within this lantern were not placed there willingly. They illuminate the darkness but occasionally reach out to those they once knew.",
      weight: 2,
      hidden: false,
    },
  },
]

// ─── Inspire Me panel ────────────────────────────────────────────────────────

function InspireMePanel({
  onClose,
  onSelect,
}: {
  onClose: () => void
  onSelect: (values: ItemFormValues) => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="font-serif text-2xl text-foreground">Inspire Me</h2>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-0.5">
              Pre-loaded item templates
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Grid */}
        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {INSPIRE_IDEAS.map((idea) => (
            <button
              key={idea.label}
              onClick={() => onSelect(idea.values)}
              className="text-left border border-border bg-background hover:border-foreground/30 hover:bg-card transition-colors p-4 group"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="font-serif text-base text-foreground group-hover:text-foreground/80">
                  {idea.label}
                </h3>
                <span className="font-sans text-[0.55rem] tracking-widest uppercase text-muted-foreground border border-border px-1.5 py-0.5 shrink-0">
                  {idea.badge}
                </span>
              </div>
              <p className="font-serif text-sm text-muted-foreground italic leading-snug">
                {idea.description}
              </p>
            </button>
          ))}
        </div>

        <div className="px-6 pb-4 border-t border-border pt-4">
          <p className="font-sans text-[0.6rem] tracking-widest uppercase text-muted-foreground/50">
            Select a template to pre-fill the item form — edit any field before saving.
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DevItemsPage() {
  const router = useRouter()
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [showHidden, setShowHidden] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [inspiredValues, setInspiredValues] = useState<ItemFormValues | undefined>(undefined)
  const [inspireOpen, setInspireOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<Item | null>(null)

  async function loadItems() {
    const supabase = createClient()
    const { data } = await supabase.from("items").select("*").order("name")
    if (data) setItems(data as unknown as Item[])
  }

  useEffect(() => {
    const supabase = createClient()
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push("/"); return }
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_dev")
        .eq("id", user.id)
        .single()
      if (!profile?.is_dev) { router.push("/dashboard"); return }

      await loadItems()
      setLoading(false)
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  async function handleCreateItem(item: Omit<CatalogItem, "id">) {
    const supabase = createClient()
    const { data } = await supabase.from("items").insert(item).select().single()
    if (data) setItems((prev) => [...prev, data as unknown as Item].sort((a, b) => a.name.localeCompare(b.name)))
  }

  async function handleDelete(item: Item) {
    const supabase = createClient()
    await supabase.from("items").delete().eq("id", item.id)
    setItems(prev => prev.filter(i => i.id !== item.id))
  }

  async function handleBatchDelete(ids: string[]) {
    const supabase = createClient()
    await supabase.from("items").delete().in("id", ids)
    setItems(prev => prev.filter(i => !ids.includes(i.id)))
  }

  function handleItemSaved(updated: Item) {
    setItems(prev => prev.map(i => i.id === updated.id ? updated : i))
  }

  function handleInspireSelect(values: ItemFormValues) {
    setInspiredValues(values)
    setInspireOpen(false)
    setCreateOpen(true)
  }

  const displayedItems = showHidden ? items : items.filter((i) => !i.hidden)

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="px-6 md:px-12 lg:px-20 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                <ChevronLeft className="w-4 h-4 mr-1" />
                Dashboard
              </Button>
            </Link>
            <div className="h-6 w-px bg-border" />
            <h1 className="text-sm uppercase tracking-[0.3em] text-muted-foreground">
              Item Catalog
            </h1>
          </div>
          <Link href="/dashboard" className="font-serif text-lg tracking-wide text-muted-foreground hover:text-foreground">
            KatabataK
          </Link>
        </div>
      </header>

      <main className="px-6 md:px-12 lg:px-20 py-8">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <h2 className="font-serif text-xl text-foreground">Items</h2>
            {!loading && (
              <span className="font-sans text-[0.6rem] tracking-widest uppercase text-muted-foreground border border-border px-2 py-0.5">
                {displayedItems.length} {showHidden ? "total" : "visible"}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* View Hidden toggle */}
            <button
              onClick={() => setShowHidden((v) => !v)}
              className={`flex items-center gap-1.5 font-sans text-[0.65rem] tracking-widest uppercase border px-3 py-1.5 transition-colors ${
                showHidden
                  ? "border-foreground/30 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/20"
              }`}
            >
              {showHidden ? (
                <><EyeOff className="w-3 h-3" /> Hide Hidden</>
              ) : (
                <><Eye className="w-3 h-3" /> View Hidden</>
              )}
            </button>

            {/* Inspire Me */}
            <button
              onClick={() => setInspireOpen(true)}
              className="flex items-center gap-1.5 font-sans text-[0.65rem] tracking-widest uppercase border border-amber-700/50 text-amber-400 px-3 py-1.5 hover:bg-amber-900/20 transition-colors"
            >
              <Lightbulb className="w-3 h-3" />
              Inspire Me
            </button>

            {/* Add Item */}
            <Button
              size="sm"
              onClick={() => { setInspiredValues(undefined); setCreateOpen(true) }}
              className="bg-foreground text-background hover:bg-foreground/90 uppercase tracking-widest text-xs"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Item
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="border border-border bg-card p-12 text-center">
            <p className="font-serif text-muted-foreground italic">Loading the catalog…</p>
          </div>
        ) : (
          <ItemTable
            items={displayedItems}
            columns={["name", "type", "subtype", "damage", "defence", "weight", "short_description", "consumable"]}
            emptyMessage={showHidden ? "No items in the catalog." : "No visible items. Toggle 'View Hidden' to see hidden entries."}
            isGM={true}
            onInspect={item => setEditingItem(item as unknown as Item)}
            onDelete={handleDelete}
            onBatchDelete={handleBatchDelete}
          />
        )}
      </main>

      {inspireOpen && (
        <InspireMePanel
          onClose={() => setInspireOpen(false)}
          onSelect={handleInspireSelect}
        />
      )}

      <CreateItemModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreateItem}
        initialValues={inspiredValues}
      />

      <EditItemModal
        item={editingItem as unknown as CatalogItem}
        onClose={() => { setEditingItem(null); loadItems() }}
        onSaved={updatedItem => handleItemSaved(updatedItem as unknown as Item)}
      />
    </div>
  )
}
