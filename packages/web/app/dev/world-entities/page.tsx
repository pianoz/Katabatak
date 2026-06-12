"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ChevronLeft, Plus, X, Check, ChevronsUpDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { createClient } from "@/lib/supabase/client"
import {
  listWorldEntities,
  createWorldEntity,
  updateWorldEntity,
  type EntityType,
  type WorldEntity,
  type CreateWorldEntityPayload,
} from "@/lib/services/world-entity-service"

// ─── Constants ────────────────────────────────────────────────────────────────

const ENTITY_TYPES: EntityType[] = ["nation", "region", "place", "location", "npc", "item"]

const TYPE_PREFIX: Record<EntityType, string> = {
  nation: "nat_",
  region: "reg_",
  place: "loc_",
  location: "loc_",
  npc: "npc_",
  item: "item_",
}

const VALID_PARENT_TYPES: Record<EntityType, EntityType[]> = {
  nation: [],
  region: ["nation"],
  place: ["nation", "region", "place"],
  location: ["place", "region"],
  npc: ["place", "location", "region"],
  item: ["place", "location"],
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cleanSlug(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
}

function deriveContext(
  parent: WorldEntity,
  newName: string,
  newType: EntityType
): { nation_context: string; region_context: string; place_context: string } {
  return {
    nation_context:
      parent.type === "nation" ? parent.name : (parent.nation_context ?? ""),
    region_context:
      parent.type === "region" ? parent.name : (parent.region_context ?? ""),
    place_context:
      newType === "place" && parent.type === "region"
        ? newName
        : parent.type === "place" || parent.type === "location"
        ? parent.name
        : (parent.place_context ?? ""),
  }
}

// ─── Form state ───────────────────────────────────────────────────────────────

interface FormState {
  type: EntityType | ""
  slug: string
  name: string
  parent_id: string
  parentComboOpen: boolean
  nation_context: string
  region_context: string
  place_context: string
  short_description: string
  long_description: string
  knowledge: string[]
  knowledgeInput: string
}

const BLANK_FORM: FormState = {
  type: "",
  slug: "",
  name: "",
  parent_id: "",
  parentComboOpen: false,
  nation_context: "",
  region_context: "",
  place_context: "",
  short_description: "",
  long_description: "",
  knowledge: [],
  knowledgeInput: "",
}

function entityToForm(e: WorldEntity): FormState {
  const d = e.data
  return {
    type: e.type,
    slug: "",
    name: e.name,
    parent_id: e.parent_id ?? "",
    parentComboOpen: false,
    nation_context: e.nation_context ?? "",
    region_context: e.region_context ?? "",
    place_context: e.place_context ?? "",
    short_description: (d.short_description as string) ?? "",
    long_description: (d.long_description as string) ?? "",
    knowledge: (d.knowledge as string[]) ?? [],
    knowledgeInput: "",
  }
}

// ─── Style constants ──────────────────────────────────────────────────────────

const inputClass =
  "w-full bg-background border border-border px-3 py-2 text-sm text-foreground focus:outline-none focus:border-foreground/50 placeholder:text-muted-foreground/50"

const labelClass = "text-[10px] uppercase tracking-widest text-muted-foreground"

// ─── Sort ─────────────────────────────────────────────────────────────────────

type SortField = "id" | "name" | "type" | "parent_id"
type SortDir = "asc" | "desc" | null

function SortIcon({ dir }: { dir: SortDir }) {
  if (!dir) return <span className="ml-1 opacity-30 text-[10px]">⇅</span>
  return <span className="ml-1 text-cyan-400 text-[10px]">{dir === "asc" ? "↑" : "↓"}</span>
}

// ─── Entity Modal ─────────────────────────────────────────────────────────────

interface EntityModalProps {
  isOpen: boolean
  entity: WorldEntity | null
  allEntities: WorldEntity[]
  onClose: () => void
  onSaved: (saved: WorldEntity, isEdit: boolean) => void
}

function EntityModal({ isOpen, entity, allEntities, onClose, onSaved }: EntityModalProps) {
  const isEdit = entity !== null
  const [form, setForm] = useState<FormState>(entity ? entityToForm(entity) : BLANK_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setForm(entity ? entityToForm(entity) : BLANK_FORM)
    setError(null)
  }, [entity, isOpen])

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const activeType: EntityType | "" = isEdit ? entity!.type : form.type
  const hasParent = activeType !== "" && VALID_PARENT_TYPES[activeType].length > 0

  const parentOptions = useMemo(() => {
    if (!activeType) return []
    const validTypes = VALID_PARENT_TYPES[activeType]
    if (validTypes.length === 0) return []
    return allEntities.filter((e) => validTypes.includes(e.type) && e.id !== entity?.id)
  }, [activeType, allEntities, entity])

  const selectedParent = parentOptions.find((e) => e.id === form.parent_id) ?? null

  useEffect(() => {
    if (!form.parent_id || !activeType) return
    const parent = parentOptions.find((e) => e.id === form.parent_id)
    if (!parent) return
    const ctx = deriveContext(parent, form.name, activeType as EntityType)
    setForm((prev) => ({
      ...prev,
      nation_context: ctx.nation_context,
      region_context: ctx.region_context,
      place_context: ctx.place_context,
    }))
  }, [form.parent_id, form.name, activeType, parentOptions])

  const previewId =
    !isEdit && activeType && cleanSlug(form.slug)
      ? TYPE_PREFIX[activeType] + cleanSlug(form.slug)
      : ""

  async function handleSave() {
    if (!form.name.trim()) { setError("Name is required."); return }
    if (!isEdit && !form.type) { setError("Type is required."); return }
    if (!isEdit && !cleanSlug(form.slug)) { setError("ID slug is required."); return }

    setSubmitting(true)
    setError(null)

    const type = isEdit ? entity!.type : (form.type as EntityType)
    const data: Record<string, unknown> = {}
    if (form.short_description.trim()) data.short_description = form.short_description.trim()
    if (form.long_description.trim()) data.long_description = form.long_description.trim()
    if (type === "npc" && form.knowledge.length > 0) data.knowledge = form.knowledge

    const supabase = createClient()

    if (isEdit) {
      const { data: saved, error: err } = await updateWorldEntity(supabase, entity!.id, {
        name: form.name.trim(),
        parent_id: form.parent_id || null,
        nation_context: form.nation_context.trim() || null,
        region_context: form.region_context.trim() || null,
        place_context: form.place_context.trim() || null,
        data,
      })
      setSubmitting(false)
      if (err) { setError(err.message); return }
      if (saved) onSaved(saved as unknown as WorldEntity, true)
    } else {
      const payload: CreateWorldEntityPayload = {
        id: TYPE_PREFIX[type] + cleanSlug(form.slug),
        name: form.name.trim(),
        type,
        parent_id: form.parent_id || null,
        nation_context: form.nation_context.trim() || null,
        region_context: form.region_context.trim() || null,
        place_context: form.place_context.trim() || null,
        data,
      }
      const { data: saved, error: err } = await createWorldEntity(supabase, payload)
      setSubmitting(false)
      if (err) { setError(err.message); return }
      if (saved) onSaved(saved as unknown as WorldEntity, false)
    }
    onClose()
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-10 bg-background/80 backdrop-blur-md overflow-y-auto"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-2xl border border-border bg-card shadow-2xl mb-12">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card z-10">
          <h2 className="text-[10px] uppercase tracking-widest text-muted-foreground">
            {isEdit ? `Edit — ${entity!.id}` : "New Entity"}
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-8">
          {/* Type */}
          {isEdit ? (
            <div className="space-y-1">
              <p className={labelClass}>Type</p>
              <span className="inline-block px-3 py-1 text-[10px] uppercase tracking-widest border border-foreground text-foreground bg-foreground/10">
                {entity!.type}
              </span>
            </div>
          ) : (
            <div className="space-y-2">
              <p className={labelClass}>Type *</p>
              <div className="flex flex-wrap gap-2">
                {ENTITY_TYPES.map((t) => (
                  <button
                    key={t}
                    onClick={() => setForm({ ...BLANK_FORM, type: t })}
                    className={`px-3 py-1 text-[10px] uppercase tracking-widest border transition-colors ${
                      form.type === t
                        ? "border-foreground text-foreground bg-foreground/10"
                        : "border-border text-muted-foreground hover:border-foreground/40"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}

          {(activeType !== "" || isEdit) && (
            <>
              {/* ID + Name */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <p className={labelClass}>{isEdit ? "ID (read-only)" : "ID Slug *"}</p>
                  {isEdit ? (
                    <div className="px-3 py-2 text-sm font-mono text-muted-foreground border border-border bg-muted/30 select-all">
                      {entity!.id}
                    </div>
                  ) : (
                    <>
                      <div className="flex items-stretch">
                        <span className="px-3 py-2 text-sm bg-muted text-muted-foreground border border-border border-r-0 select-none whitespace-nowrap">
                          {TYPE_PREFIX[activeType as EntityType]}
                        </span>
                        <input
                          className={`${inputClass} flex-1`}
                          placeholder="my_entity_name"
                          value={form.slug}
                          onChange={(e) => set("slug", e.target.value)}
                        />
                      </div>
                      {previewId && (
                        <p className="text-[10px] text-muted-foreground/60 font-mono">→ {previewId}</p>
                      )}
                    </>
                  )}
                </div>

                <div className="space-y-2">
                  <p className={labelClass}>Name *</p>
                  <input
                    className={inputClass}
                    placeholder="Display name"
                    value={form.name}
                    onChange={(e) => set("name", e.target.value)}
                  />
                </div>
              </div>

              {/* Parent */}
              <div className="space-y-2">
                <p className={labelClass}>
                  Parent{!hasParent ? " — not applicable for nations" : ""}
                </p>
                <Popover
                  open={form.parentComboOpen}
                  onOpenChange={(open) => set("parentComboOpen", open)}
                >
                  <PopoverTrigger asChild>
                    <button
                      disabled={!hasParent}
                      className={`flex items-center justify-between w-full md:w-80 px-3 py-2 text-sm border border-border bg-background text-left transition-colors ${
                        !hasParent ? "opacity-40 cursor-not-allowed" : "hover:border-foreground/40"
                      }`}
                    >
                      <span className={selectedParent ? "text-foreground" : "text-muted-foreground/50"}>
                        {selectedParent
                          ? `${selectedParent.id} — ${selectedParent.name}`
                          : "Select parent…"}
                      </span>
                      <ChevronsUpDown className="w-4 h-4 text-muted-foreground ml-2 shrink-0" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-96 p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search entities…" />
                      <CommandList>
                        <CommandEmpty>No entities found.</CommandEmpty>
                        <CommandGroup>
                          {parentOptions.map((opt) => (
                            <CommandItem
                              key={opt.id}
                              value={`${opt.id} ${opt.name}`}
                              onSelect={() => {
                                set("parent_id", opt.id)
                                set("parentComboOpen", false)
                              }}
                            >
                              <Check
                                className={`mr-2 h-4 w-4 ${form.parent_id === opt.id ? "opacity-100" : "opacity-0"}`}
                              />
                              <span className="font-mono text-xs text-muted-foreground mr-2">
                                [{opt.type}]
                              </span>
                              <span className="text-sm">{opt.name}</span>
                              <span className="ml-auto font-mono text-[10px] text-muted-foreground/50">
                                {opt.id}
                              </span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {form.parent_id && (
                  <button
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        parent_id: "",
                        nation_context: "",
                        region_context: "",
                        place_context: "",
                      }))
                    }
                    className="text-[10px] uppercase tracking-widest text-muted-foreground/50 hover:text-muted-foreground"
                  >
                    clear parent
                  </button>
                )}
              </div>

              {/* Context */}
              <div className="space-y-2">
                <p className={labelClass}>Context — auto-populated, override if needed</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {(
                    [
                      { key: "nation_context", label: "Nation" },
                      { key: "region_context", label: "Region" },
                      { key: "place_context", label: "Place" },
                    ] as const
                  ).map(({ key, label }) => (
                    <div key={key} className="space-y-1">
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60">
                        {label}
                      </p>
                      <input
                        className={inputClass}
                        placeholder="—"
                        value={form[key]}
                        onChange={(e) => set(key, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Descriptions */}
              <div className="space-y-6">
                <div className="space-y-2">
                  <p className={labelClass}>Short Description</p>
                  <textarea
                    className={`${inputClass} resize-none`}
                    rows={2}
                    placeholder="One-sentence description surfaced to agents."
                    value={form.short_description}
                    onChange={(e) => set("short_description", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <p className={labelClass}>Long Description</p>
                  <textarea
                    className={`${inputClass} resize-none`}
                    rows={5}
                    placeholder="Full description or personality blurb used by the GM pipeline."
                    value={form.long_description}
                    onChange={(e) => set("long_description", e.target.value)}
                  />
                </div>
              </div>

              {/* Knowledge (NPC only) */}
              {activeType === "npc" && (
                <div className="space-y-3">
                  <p className={labelClass}>Knowledge — information the npc knows</p>
                  <div className="flex gap-2">
                    <input
                      className={`${inputClass} flex-1`}
                      placeholder="Add a knowledge entry…"
                      value={form.knowledgeInput}
                      onChange={(e) => set("knowledgeInput", e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && form.knowledgeInput.trim()) {
                          e.preventDefault()
                          setForm((prev) => ({
                            ...prev,
                            knowledge: [...prev.knowledge, prev.knowledgeInput.trim()],
                            knowledgeInput: "",
                          }))
                        }
                      }}
                    />
                    <button
                      onClick={() => {
                        if (!form.knowledgeInput.trim()) return
                        setForm((prev) => ({
                          ...prev,
                          knowledge: [...prev.knowledge, prev.knowledgeInput.trim()],
                          knowledgeInput: "",
                        }))
                      }}
                      className="px-3 py-2 border border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  {form.knowledge.length > 0 && (
                    <ul className="space-y-1">
                      {form.knowledge.map((entry, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-2 text-sm text-foreground/80 border border-border/50 px-3 py-2"
                        >
                          <span className="flex-1">{entry}</span>
                          <button
                            onClick={() =>
                              setForm((prev) => ({
                                ...prev,
                                knowledge: prev.knowledge.filter((_, j) => j !== i),
                              }))
                            }
                            className="text-muted-foreground/50 hover:text-foreground shrink-0 mt-px"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-border">
            <div>
              {error && <p className="text-xs text-destructive">{error}</p>}
            </div>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-[10px] uppercase tracking-widest border border-border text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={submitting || (!isEdit && activeType === "")}
                className="px-6 py-2 text-[10px] uppercase tracking-widest border border-foreground/30 text-foreground hover:bg-foreground/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {submitting
                  ? isEdit ? "Saving…" : "Creating…"
                  : isEdit ? "Save Changes" : "Create Entity"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WorldEntitiesPage() {
  const router = useRouter()
  const [entities, setEntities] = useState<WorldEntity[]>([])
  const [loading, setLoading] = useState(true)

  // Modal
  const [modalOpen, setModalOpen] = useState(false)
  const [editingEntity, setEditingEntity] = useState<WorldEntity | null>(null)

  // Table filters + sort
  const [tableTypeFilter, setTableTypeFilter] = useState<EntityType | "all">("all")
  const [parentFilter, setParentFilter] = useState("")
  const [sortField, setSortField] = useState<SortField | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>(null)

  // ─── Auth + initial load ─────────────────────────────────────────────────

  useEffect(() => {
    const supabase = createClient()
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push("/"); return }
      const { data: profile } = await supabase
        .from("profiles").select("is_dev").eq("id", user.id).single()
      if (!profile?.is_dev) { router.push("/dashboard"); return }
      setEntities(await listWorldEntities(supabase))
      setLoading(false)
    }
    init()
  }, [router])

  // ─── Sort ────────────────────────────────────────────────────────────────

  function handleSort(field: SortField) {
    if (sortField === field) {
      if (sortDir === "asc") { setSortDir("desc"); return }
      if (sortDir === "desc") { setSortField(null); setSortDir(null); return }
    }
    setSortField(field)
    setSortDir("asc")
  }

  // ─── Modal handlers ──────────────────────────────────────────────────────

  function openCreate() {
    setEditingEntity(null)
    setModalOpen(true)
  }

  function openEdit(entity: WorldEntity) {
    setEditingEntity(entity)
    setModalOpen(true)
  }

  function handleSaved(saved: WorldEntity, isEdit: boolean) {
    setEntities((prev) => {
      if (isEdit) return prev.map((e) => e.id === saved.id ? saved : e)
      return [...prev, saved].sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name))
    })
  }

  // ─── Processed rows ──────────────────────────────────────────────────────

  const processedEntities = useMemo(() => {
    let result = tableTypeFilter === "all"
      ? entities
      : entities.filter((e) => e.type === tableTypeFilter)

    if (parentFilter.trim()) {
      const q = parentFilter.toLowerCase()
      result = result.filter((e) => (e.parent_id ?? "").toLowerCase().includes(q))
    }

    if (sortField && sortDir) {
      result = [...result].sort((a, b) => {
        const av = (a[sortField] ?? "") as string
        const bv = (b[sortField] ?? "") as string
        const cmp = av.localeCompare(bv)
        return sortDir === "asc" ? cmp : -cmp
      })
    }

    return result
  }, [entities, tableTypeFilter, parentFilter, sortField, sortDir])

  // ─── Render ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Loading…</p>
      </div>
    )
  }

  const COL_DEFS: { field: SortField; label: string }[] = [
    { field: "id", label: "ID" },
    { field: "name", label: "Name" },
    { field: "type", label: "Type" },
    { field: "parent_id", label: "Parent" },
  ]

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border">
        <div className="px-6 md:px-12 lg:px-20 py-4 flex items-center gap-4">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
              <ChevronLeft className="w-4 h-4 mr-1" />
              Dashboard
            </Button>
          </Link>
          <div className="h-6 w-px bg-border" />
          <h1 className="text-sm uppercase tracking-[0.3em] text-muted-foreground">
            World Entities
          </h1>
        </div>
      </header>

      <div className="px-6 md:px-12 lg:px-20 py-10 max-w-6xl">
        {/* ── Toolbar ── */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
              All Entities
            </span>
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground border border-border px-2 py-0.5">
              {processedEntities.length}
            </span>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 text-[10px] uppercase tracking-widest border border-foreground/30 text-foreground hover:bg-foreground/5 transition-colors"
          >
            <Plus className="w-3 h-3" />
            New Entity
          </button>
        </div>

        {/* ── Filters ── */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          {/* Type filter */}
          <div className="flex flex-wrap gap-1">
            {(["all", ...ENTITY_TYPES] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTableTypeFilter(t)}
                className={`px-2 py-1 text-[10px] uppercase tracking-widest border transition-colors ${
                  tableTypeFilter === t
                    ? "border-foreground text-foreground bg-foreground/10"
                    : "border-border text-muted-foreground hover:border-foreground/40"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Parent filter */}
          <input
            className="px-3 py-1 text-xs bg-background border border-border text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/50 w-52"
            placeholder="Filter by parent id…"
            value={parentFilter}
            onChange={(e) => setParentFilter(e.target.value)}
          />
          {parentFilter && (
            <button
              onClick={() => setParentFilter("")}
              className="text-muted-foreground/50 hover:text-muted-foreground"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* ── Table ── */}
        {processedEntities.length === 0 ? (
          <p className="text-sm text-muted-foreground/50 mt-8">No entities found.</p>
        ) : (
          <div className="border border-border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  {COL_DEFS.map(({ field, label }) => (
                    <th
                      key={field}
                      onClick={() => handleSort(field)}
                      className={`text-left px-4 py-2 text-[10px] uppercase tracking-widest font-normal cursor-pointer select-none hover:text-foreground transition-colors ${
                        sortField === field ? "text-cyan-400" : "text-muted-foreground"
                      }`}
                    >
                      {label}
                      <SortIcon dir={sortField === field ? sortDir : null} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {processedEntities.map((e, i) => (
                  <tr
                    key={e.id}
                    onClick={() => openEdit(e)}
                    className={`border-b border-border/50 cursor-pointer hover:bg-secondary/30 transition-colors ${
                      i % 2 === 0 ? "" : "bg-muted/10"
                    }`}
                  >
                    <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
                      {e.id}
                    </td>
                    <td className="px-4 py-2 text-foreground">{e.name}</td>
                    <td className="px-4 py-2">
                      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                        {e.type}
                      </span>
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-muted-foreground/60">
                      {e.parent_id ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <EntityModal
        isOpen={modalOpen}
        entity={editingEntity}
        allEntities={entities}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
      />
    </div>
  )
}
