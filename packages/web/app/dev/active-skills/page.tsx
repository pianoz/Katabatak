"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ChevronLeft, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { getAllActiveSkills, deleteActiveSkill } from "@/lib/services/active-skill-service"
import type { ActiveSkill } from "@/lib/services/active-skill-service"
import { EditActiveSkillModal } from "@/features/devtools/components/edit-active-skill-modal"

type SortField = "name" | "cooldown" | "effects"
type SortDir = "asc" | "desc" | null

function SortIcon({ dir }: { dir: SortDir }) {
  if (!dir) return <span className="ml-1 opacity-30 text-[10px]">⇅</span>
  return <span className="ml-1 text-cyan-400 text-[10px]">{dir === "asc" ? "↑" : "↓"}</span>
}

export default function DevActiveSkillsPage() {
  const router = useRouter()
  const [skills, setSkills] = useState<ActiveSkill[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [sortField, setSortField] = useState<SortField | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [modalOpen, setModalOpen] = useState(false)
  const [editingSkill, setEditingSkill] = useState<ActiveSkill | null>(null)

  async function loadSkills() {
    const supabase = createClient()
    const data = await getAllActiveSkills(supabase)
    setSkills(data as unknown as ActiveSkill[])
  }

  useEffect(() => {
    const supabase = createClient()
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push("/"); return }
      const { data: profile } = await supabase.from("profiles").select("is_dev").eq("id", user.id).single()
      if (!profile?.is_dev) { router.push("/dashboard"); return }
      await loadSkills()
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

  function toggleSelect(id: string) {
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
    if (!window.confirm(`Delete ${ids.length} skill${ids.length !== 1 ? "s" : ""}? This cannot be undone.`)) return
    const supabase = createClient()
    await Promise.all(ids.map(id => deleteActiveSkill(supabase, id)))
    setSkills(prev => prev.filter(s => !ids.includes(s.id)))
    setSelectedIds(new Set())
  }

  async function handleDelete(skill: ActiveSkill) {
    if (!window.confirm(`Delete "${skill.name}"? This cannot be undone.`)) return
    const supabase = createClient()
    await deleteActiveSkill(supabase, skill.id)
    setSkills(prev => prev.filter(s => s.id !== skill.id))
  }

  function openCreate() { setEditingSkill(null); setModalOpen(true) }
  function openEdit(skill: ActiveSkill) { setEditingSkill(skill); setModalOpen(true) }

  function handleSaved(saved: ActiveSkill) {
    setSkills(prev => {
      const exists = prev.some(s => s.id === saved.id)
      if (exists) return prev.map(s => s.id === saved.id ? saved : s).sort((a, b) => a.name.localeCompare(b.name))
      return [...prev, saved].sort((a, b) => a.name.localeCompare(b.name))
    })
  }

  const processed = useMemo(() => {
    let result = skills
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(s =>
        s.name.toLowerCase().includes(q) ||
        (s.description ?? "").toLowerCase().includes(q)
      )
    }
    if (sortField && sortDir) {
      result = [...result].sort((a, b) => {
        let av: number | string, bv: number | string
        if (sortField === "effects") { av = a.effects.length; bv = b.effects.length }
        else if (sortField === "cooldown") { av = a.cooldown ?? -1; bv = b.cooldown ?? -1 }
        else { av = a.name; bv = b.name }
        if (av === bv) return 0
        const cmp = av < bv ? -1 : 1
        return sortDir === "asc" ? cmp : -cmp
      })
    }
    return result
  }, [skills, search, sortField, sortDir])

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
            <h1 className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Active Skills</h1>
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
            <h2 className="font-serif text-xl text-foreground">Active Skills</h2>
            {!loading && (
              <span className="font-sans text-[0.6rem] tracking-widest uppercase text-muted-foreground border border-border px-2 py-0.5">
                {processed.length} {search ? "filtered" : "total"}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={openCreate}
              className="bg-foreground text-background hover:bg-foreground/90 uppercase tracking-widest text-xs"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Skill
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="border border-border bg-card p-12 text-center">
            <p className="font-serif text-muted-foreground italic">Loading…</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Search + batch bar */}
            <div className="flex flex-wrap gap-2 items-center">
              <div className="relative flex-1 min-w-48">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs pointer-events-none">⌕</span>
                <input
                  type="text"
                  placeholder="Search skills…"
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

            {/* Table */}
            <div className="border border-border bg-card overflow-hidden">
              {processed.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="font-serif text-muted-foreground italic">
                    {search ? "No skills match your search." : "No active skills yet."}
                  </p>
                </div>
              ) : (
                <>
                  {/* Mobile */}
                  <div className="md:hidden divide-y divide-border">
                    {processed.map(skill => (
                      <div
                        key={skill.id}
                        className={`p-4 space-y-2 ${selectedIds.has(skill.id) ? "bg-red-900/10" : ""}`}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            className="accent-red-500 mt-1 shrink-0"
                            checked={selectedIds.has(skill.id)}
                            onChange={() => toggleSelect(skill.id)}
                          />
                          <div className="flex-1 min-w-0">
                            <button
                              onClick={() => openEdit(skill)}
                              className="font-serif text-left hover:text-cyan-400 transition-colors underline decoration-dotted decoration-muted-foreground/30 underline-offset-4"
                            >
                              {skill.name}
                            </button>
                            {skill.description && (
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{skill.description}</p>
                            )}
                            <div className="flex gap-2 mt-1">
                              {skill.cooldown != null && (
                                <span className="text-[10px] uppercase tracking-widest text-muted-foreground border border-border px-1.5 py-0.5">
                                  CD {skill.cooldown}
                                </span>
                              )}
                              {skill.effects.length > 0 && (
                                <span className="text-[10px] uppercase tracking-widest text-cyan-400/70 border border-cyan-800/50 px-1.5 py-0.5">
                                  {skill.effects.length} FX
                                </span>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => handleDelete(skill)}
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
                        {(["name", "cooldown", "effects"] as SortField[]).map(col => (
                          <th
                            key={col}
                            onClick={() => handleSort(col)}
                            className={`text-xs uppercase tracking-widest p-3 font-normal cursor-pointer hover:text-foreground transition-colors select-none ${
                              sortField === col ? "text-cyan-400" : "text-muted-foreground"
                            }`}
                          >
                            {col === "effects" ? "FX" : col.charAt(0).toUpperCase() + col.slice(1)}
                            <SortIcon dir={sortField === col ? sortDir : null} />
                          </th>
                        ))}
                        <th className="text-xs uppercase tracking-widest text-muted-foreground p-3 font-normal">Description</th>
                        <th className="w-px p-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {processed.map(skill => (
                        <tr
                          key={skill.id}
                          className={`border-b border-border hover:bg-secondary/20 transition-colors ${selectedIds.has(skill.id) ? "bg-red-900/10" : ""}`}
                        >
                          <td className="p-3">
                            <input
                              type="checkbox"
                              className="accent-red-500"
                              checked={selectedIds.has(skill.id)}
                              onChange={() => toggleSelect(skill.id)}
                            />
                          </td>
                          <td className="p-3">
                            <button
                              onClick={() => openEdit(skill)}
                              className="font-serif text-left hover:text-cyan-400 transition-colors underline decoration-dotted decoration-muted-foreground/30 underline-offset-4"
                            >
                              {skill.name}
                            </button>
                          </td>
                          <td className="p-3 text-sm text-foreground/80">
                            {skill.cooldown != null ? (
                              <span className="text-[10px] uppercase tracking-widest text-muted-foreground border border-border px-2 py-0.5">
                                {skill.cooldown}
                              </span>
                            ) : "—"}
                          </td>
                          <td className="p-3 text-sm text-foreground/80">
                            {skill.effects.length > 0 ? (
                              <span className="text-[10px] uppercase tracking-widest text-cyan-400/70 border border-cyan-800/50 px-2 py-0.5">
                                {skill.effects.length}
                              </span>
                            ) : "—"}
                          </td>
                          <td className="p-3 text-sm text-muted-foreground max-w-xs truncate">
                            {skill.description ?? "—"}
                          </td>
                          <td className="p-3 text-right">
                            <button
                              onClick={() => handleDelete(skill)}
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

      <EditActiveSkillModal
        skill={editingSkill}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
      />
    </div>
  )
}
