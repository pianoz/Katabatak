"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Plus, X, Loader2, Search, Check } from "lucide-react"
import { useRouter } from "next/navigation"

export function AddSpellModal({
  characterId,
}: {
  characterId: string
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [catalog, setCatalog] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const router = useRouter()

  useEffect(() => {
    if (isOpen) {
      const fetchCatalog = async () => {
        const supabase = createClient()
        const { data } = await supabase.from("spells").select("*").order("name")
        if (data) setCatalog(data)
      }
      fetchCatalog()
    } else {
      // Reset selection when closing
      setSelectedIds(new Set())
      setSearchTerm("")
    }
  }, [isOpen])

  const toggleItem = (id: string) => {
    const next = new Set(selectedIds)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    setSelectedIds(next)
  }

  const handleAddSelected = async () => {
    if (selectedIds.size === 0) return

    setLoading(true)
    const supabase = createClient()

    // Prepare the rows for bulk insertion
    const spellsToAdd = catalog
      .filter((spell) => selectedIds.has(spell.id))
      .map((spell) => ({
        character_id: characterId,
        spell_id: spell.id,
      }))

    const { error } = await supabase
      .from("character_spells")
      .insert(spellsToAdd)

    if (!error) {
      setIsOpen(false)
      router.refresh()
    } else {
      console.error("Error adding items:", error.message, characterId)
    }
    setLoading(false)
  }

  const filteredCatalog = catalog.filter((spell) =>
    spell.name?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (!isOpen) {
    return (
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(true)}
        className="h-6 w-6 rounded-md border border-dashed border-muted-foreground/50 hover:border-foreground"
      >
        <Plus className="w-4 h-4" />
      </Button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md border border-border bg-card shadow-2xl rounded-none flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex justify-between items-center p-6 pb-4">
          <h3 className="font-serif text-xl tracking-tight">Spell Catalog</h3>
          <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Search */}
        <div className="px-6 mb-4">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              placeholder="Search items..."
              className="w-full bg-secondary/30 border border-border py-2 pl-8 pr-4 text-sm outline-none focus:ring-1 focus:ring-foreground/20"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Scrollable List */}
        <div className="flex-1 overflow-y-auto px-6 space-y-2 custom-scrollbar">
          {filteredCatalog.map((spell) => {
            const isSelected = selectedIds.has(spell.id)
            return (
              <div
                key={spell.id}
                onClick={() => toggleItem(spell.id)}
                className={`flex items-center justify-between p-3 border cursor-pointer transition-colors ${
                  isSelected 
                    ? "border-primary bg-primary/10" 
                    : "border-border bg-secondary/10 hover:bg-secondary/20"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-4 h-4 border flex items-center justify-center ${isSelected ? "bg-primary border-primary" : "border-muted-foreground"}`}>
                    {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
                  </div>
                  <div>
                    <p className="font-serif text-sm">{spell.name}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
                      {spell.description}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer Actions */}
        <div className="p-6 mt-2 border-t border-border bg-secondary/5">
          <Button
            className="w-full rounded-none uppercase tracking-widest text-xs h-10"
            disabled={selectedIds.size === 0 || loading}
            onClick={handleAddSelected}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              `Add Selected (${selectedIds.size})`
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}