"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ChevronLeft, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { getAllSpells, deleteSpell } from "@/lib/services/spell-service"
import { EditSpellModal } from "@/features/devtools/components/edit-spell-modal"
import type { SpellRow } from "@/features/devtools/components/edit-spell-modal"
import { parseEffects } from "@/lib/schemas/skill-effect"

type SortField = "name" | "type" | "damage" | "cost" | "cooldown_min" | "active"
type SortDir = "asc" | "desc" | null

function SortIcon({ dir }: { dir: SortDir }) {
  if (!dir) return <span className="ml-1 opacity-30 text-[10px]">⇅</span>
  return <span className="ml-1 text-cyan-400 text-[10px]">{dir === "asc" ? "↑" : "↓"}</span>
}

const SORTABLE: SortField[] = ["name", "type", "damage", "cost", "cooldown_min", "active"]

const COL_LABELS: Record<SortField, string> = {
  name: "Name",
  type: "Type",
  damage: "Damage",
  cost: "Cost",
  cooldown_min: "CD (min)",
  active: "Active",
}

export default function DevSpellsPage() {
  const router = useRouter()
  const [spells, setSpells] = useState<SpellRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [sortField, setSortField] = useState<SortField | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>(null)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [modalOpen, setModalOpen] = useState(false)
  const [editingSpell, setEditingSpell] = useState<SpellRow | null>(null)

  async function loadSpells() {
    const supabase = createClient()
    const data = await getAllSpells(supabase)
    setSpells(data.map(s => ({
      ...s,
      effects: parseEffects(((s as Record<string, unknown>)["effects"] as unknown[]) ?? []),
    })) as unknown as SpellRow[])
  }

  useEffect(() => {
    const supabase = createClient()
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push("/"); return }
      const { data: profile } = await supabase.from("profiles").select("is_dev").eq("id", user.id).single()
      if (!profile?.is_dev) { router.push("/dashboard"); return }
      await loadSpells()
      setLoading(false)
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  function handleSort(field: SortField) {
    if (sortField === field) {
      if (sortDir === "asc") { setSortDir("desc"); return }
      if (sortDir === "desc") { setSortField(null); setSortDir(null); return }
    }
    setSortField(field)
    setSortDir("asc")
  }

  function toggleSelect(id: number) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selectedIds.size === processed.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(processed.map(s => s.id)))
  }

  async function handleBatchDelete() {
    const ids = Array.from(selectedIds)
    if (!window.confirm(`Delete ${ids.length} spell${ids.length !== 1 ? "s" : ""}? This cannot be undone.`)) return
    const supabase = createClient()
    await Promise.all(ids.map(id => deleteSpell(supabase, id)))
    setSpells(prev => prev.filter(s => !ids.includes(s.id)))
    setSelectedIds(new Set())
  }

  async function handleDelete(spell: SpellRow) {
    if (!window.confirm(`Delete "${spell.name}"? This cannot be undone.`)) return
    const supabase = createClient()
    await deleteSpell(supabase, spell.id)
    setSpells(prev => prev.filter(s => s.id !== spell.id))
  }

  function openCreate() { setEditingSpell(null); setModalOpen(true) }
  function openEdit(spell: SpellRow) { setEditingSpell(spell); setModalOpen(true) }

  function handleSaved(saved: SpellRow) {
    setSpells(prev => {
      const exists = prev.some(s => s.id === saved.id)
      if (exists) return prev.map(s => s.id === saved.id ? saved : s).sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""))
      return [...prev, saved].sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""))
    })
  }

  const processed = useMemo(() => {
    let result = spells
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(s =>
        (s.name ?? "").toLowerCase().includes(q) ||
        (s.type ?? "").toLowerCase().includes(q) ||
        (s.subtype ?? "").toLowerCase().includes(q) ||
        (s.description ?? "").toLowerCase().includes(q)
      )
    }
    if (sortField && sortDir) {
      result = [...result].sort((a, b) => {
        const av = (a[sortField as keyof SpellRow] ?? "") as string | number | boolean
        const bv = (b[sortField as keyof SpellRow] ?? "") as string | number | boolean
        if (av === bv) return 0
        const cmp = av < bv ? -1 : 1
        return sortDir === "asc" ? cmp : -cmp
      })
    }
    return result
  }, [spells, search, sortField, sortDir])

  return (
    <div className="min-h-screen bg-background">
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
            <h1 className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Spell Catalog</h1>
          </div>
          <Link href="/dashboard" className="font-serif text-lg tracking-wide text-muted-foreground hover:text-foreground">
            KatabataK
          </Link>
        </div>
      </header>

      <main className="px-6 md:px-12 lg:px-20 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <h2 className="font-serif text-xl text-foreground">Spells</h2>
            {!loading && (
              <span className="font-sans text-[0.6rem] tracking-widest uppercase text-muted-foreground border border-border px-2 py-0.5">
                {processed.length} {search ? "filtered" : "total"}
              </span>
            )}
          </div>
          <Button
            size="sm"
            onClick={openCreate}
            className="bg-foreground text-background hover:bg-foreground/90 uppercase tracking-widest text-xs"
          >
            <Plus className="w-4 h-4 mr-1" />
            Add Spell
          </Button>
        </div>

        {loading ? (
          <div className="border border-border bg-card p-12 text-center">
            <p className="font-serif text-muted-foreground italic">Loading…</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2 items-center">
              <div className="relative flex-1 min-w-48">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs pointer-events-none">⌕</span>
                <input
                  type="text"
                  placeholder="Search spells…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-7 pr-3 py-1.5 text-sm bg-secondary/30 border border-border text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-cyan-500/50"
                />
              </div>
              {selectedIds.size > 0 && (
                <button
                  onClick={handleBatchDelete}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-red-700/60 text-red-400 hover:bg-red-900/20 transition-all"
                >
                  <Trash2 className="w-3 h-3" />
                  Delete {selectedIds.size} selected
                </button>
              )}
            </div>

            <div className="border border-border bg-card overflow-hidden">
              {processed.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="font-serif text-muted-foreground italic">
                    {search ? "No spells match your search." : "No spells yet."}
                  </p>
                </div>
              ) : (
                <>
                  {/* Mobile */}
                  <div className="md:hidden divide-y divide-border">
                    {processed.map(spell => (
                      <div
                        key={spell.id}
                        className={`p-4 space-y-2 ${selectedIds.has(spell.id) ? "bg-red-900/10" : ""}`}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            className="accent-red-500 mt-1 shrink-0"
                            checked={selectedIds.has(spell.id)}
                            onChange={() => toggleSelect(spell.id)}
                          />
                          <div className="flex-1 min-w-0">
                            <button
                              onClick={() => openEdit(spell)}
                              className="font-serif text-left hover:text-cyan-400 transition-colors underline decoration-dotted decoration-muted-foreground/30 underline-offset-4"
                            >
                              {spell.name ?? "Unnamed"}
                            </button>
                            <div className="flex flex-wrap gap-2 mt-1">
                              {spell.type && (
                                <span className="text-[10px] uppercase tracking-widest text-muted-foreground border border-border px-1.5 py-0.5">{spell.type}</span>
                              )}
                              {spell.damage != null && (
                                <span className="text-[10px] uppercase tracking-widest text-foreground/70 border border-border px-1.5 py-0.5">DMG {spell.damage}</span>
                              )}
                              {spell.cost != null && (
                                <span className="text-[10px] uppercase tracking-widest text-foreground/70 border border-border px-1.5 py-0.5">COST {spell.cost}</span>
                              )}
                              {spell.effects.length > 0 && (
                                <span className="text-[10px] uppercase tracking-widest text-cyan-400/70 border border-cyan-800/50 px-1.5 py-0.5">{spell.effects.length} FX</span>
                              )}
                              {spell.active === false && (
                                <span className="text-[10px] uppercase tracking-widest text-muted-foreground/50 border border-border/50 px-1.5 py-0.5">Inactive</span>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => handleDelete(spell)}
                            className="px-2 py-1 text-xs border border-red-800/50 text-red-400 hover:bg-red-900/30 transition-all shrink-0"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop */}
                  <table className="hidden md:table w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-border bg-secondary/50">
                        <th className="w-px p-3">
                          <input
                            type="checkbox"
                            className="accent-red-500"
                            checked={processed.length > 0 && selectedIds.size === processed.length}
                            onChange={toggleSelectAll}
                          />
                        </th>
                        {SORTABLE.map(col => (
                          <th
                            key={col}
                            onClick={() => handleSort(col)}
                            className={`text-xs uppercase tracking-widest p-3 font-normal cursor-pointer hover:text-foreground transition-colors select-none ${
                              sortField === col ? "text-cyan-400" : "text-muted-foreground"
                            }`}
                          >
                            {COL_LABELS[col]}
                            <SortIcon dir={sortField === col ? sortDir : null} />
                          </th>
                        ))}
                        <th className="text-xs uppercase tracking-widest text-muted-foreground p-3 font-normal">FX</th>
                        <th className="w-px p-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {processed.map(spell => (
                        <tr
                          key={spell.id}
                          className={`border-b border-border hover:bg-secondary/20 transition-colors ${selectedIds.has(spell.id) ? "bg-red-900/10" : ""}`}
                        >
                          <td className="p-3">
                            <input
                              type="checkbox"
                              className="accent-red-500"
                              checked={selectedIds.has(spell.id)}
                              onChange={() => toggleSelect(spell.id)}
                            />
                          </td>
                          <td className="p-3">
                            <button
                              onClick={() => openEdit(spell)}
                              className="font-serif text-left hover:text-cyan-400 transition-colors underline decoration-dotted decoration-muted-foreground/30 underline-offset-4"
                            >
                              {spell.name ?? "Unnamed"}
                            </button>
                          </td>
                          <td className="p-3 text-sm text-foreground/80">{spell.type ?? "—"}</td>
                          <td className="p-3 text-sm text-foreground/80">{spell.damage ?? "—"}</td>
                          <td className="p-3 text-sm text-foreground/80">
                            {spell.cost != null ? `${spell.cost}${spell.cost_attribute_name ? ` ${spell.cost_attribute_name}` : ""}` : "—"}
                          </td>
                          <td className="p-3 text-sm text-foreground/80">{spell.cooldown_min ?? "—"}</td>
                          <td className="p-3 text-sm">
                            {spell.active ? (
                              <span className="text-[10px] uppercase tracking-widest text-cyan-400/70 border border-cyan-800/50 px-1.5 py-0.5">Yes</span>
                            ) : (
                              <span className="text-[10px] uppercase tracking-widest text-muted-foreground/50 border border-border/50 px-1.5 py-0.5">No</span>
                            )}
                          </td>
                          <td className="p-3 text-sm text-foreground/80">
                            {spell.effects.length > 0 ? (
                              <span className="text-[10px] uppercase tracking-widest text-cyan-400/70 border border-cyan-800/50 px-1.5 py-0.5">{spell.effects.length}</span>
                            ) : "—"}
                          </td>
                          <td className="p-3 text-right">
                            <button
                              onClick={() => handleDelete(spell)}
                              className="px-2 py-1 text-xs border border-red-800/50 text-red-400 hover:bg-red-900/30 transition-all"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </div>
          </div>
        )}
      </main>

      <EditSpellModal
        spell={editingSpell}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
      />
    </div>
  )
}
