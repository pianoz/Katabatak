"use client"

import { useState, useMemo } from "react"
import { getConditionStyle } from "@/lib/utils"
import { MoreHorizontal, Trash2 } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"

const COLUMN_LABELS: Record<string, string> = {
  damage:            "Damage",
  defence:           "Armor",
  weight:            "Weight",
  short_description: "Short Description",
  condition:         "Condition",
  name:              "Name",
  type:              "Type",
  subtype:           "Subtype",
  character_id:      "Owner",
  consumable:        "Consumable",
}

const SORTABLE_COLUMNS = ["name", "type", "subtype", "weight", "damage", "defence", "condition", "character_id"]

export interface Item {
  id: string
  name: string
  type: string
  hidden: boolean
  is_equipped?: boolean
  is_magical?: boolean
  subtype?: string
  weight?: number
  short_description?: string
  damage?: number
  defence?: number
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
  image_url?: string
  action_text?: string
}

type SortDirection = "asc" | "desc" | null
type SortField = keyof Item | null

interface FilterState {
  search: string
  type: string
  subtype: string
  minCondition: string
  maxCondition: string
  showHidden: boolean
  magical: "all" | "magical" | "mundane"
  consumable: "all" | "consumable" | "equipment"
}

export interface GameCharacter {
  id: string
  name: string
}

interface ItemTableProps {
  items: Item[]
  columns: string[]
  emptyMessage: string
  isGM?: boolean
  gameCharacters?: GameCharacter[]
  onEquip?: (item: Item) => void
  onRepair?: (item: Item) => void
  onConsume?: (item: Item) => void
  onDrop?: (item: Item) => void
  onInspect?: (item: Item) => void
  onGrantToCharacter?: (item: Item, gameCharacters: GameCharacter[]) => void
  onDelete?: (item: Item) => void
  onBatchDelete?: (ids: string[]) => void
}

function SortIcon({ direction }: { direction: SortDirection }) {
  if (!direction) return (
    <span className="ml-1 opacity-30 text-[10px]">⇅</span>
  )
  return (
    <span className="ml-1 text-cyan-400 text-[10px]">{direction === "asc" ? "↑" : "↓"}</span>
  )
}

export function ItemTable({
  items,
  columns,
  emptyMessage,
  isGM = false,
  gameCharacters = [],
  onEquip,
  onRepair,
  onConsume,
  onDrop,
  onInspect,
  onGrantToCharacter,
  onDelete,
  onBatchDelete,
}: ItemTableProps) {
  const [sortField, setSortField] = useState<SortField>(null)
  const [sortDir, setSortDir] = useState<SortDirection>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [filters, setFilters] = useState<FilterState>({
    search: "",
    type: "",
    subtype: "",
    minCondition: "",
    maxCondition: "",
    showHidden: false,
    magical: "all",
    consumable: "all",
  })
  const [filtersOpen, setFiltersOpen] = useState(false)

  // Derived unique values for filter dropdowns
  const allTypes    = useMemo(() => [...new Set(items.map(i => i.type).filter(Boolean))].sort(), [items])
  const allSubtypes = useMemo(() => [...new Set(items.map(i => i.subtype).filter(Boolean) as string[])].sort(), [items])

  const effectiveColumns = columns

  const genericColumns = effectiveColumns.filter(col => col !== "condition")
  const showCondition  = effectiveColumns.includes("condition")

  function handleSort(col: string) {
    if (!SORTABLE_COLUMNS.includes(col)) return
    if (sortField === col) {
      if (sortDir === "asc")  { setSortDir("desc"); return }
      if (sortDir === "desc") { setSortField(null); setSortDir(null); return }
    }
    setSortField(col as keyof Item)
    setSortDir("asc")
  }

  function updateFilter<K extends keyof FilterState>(key: K, value: FilterState[K]) {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  function clearFilters() {
    setFilters({ search: "", type: "", subtype: "", minCondition: "", maxCondition: "", showHidden: false, magical: "all", consumable: "all" })
    setSortField(null)
    setSortDir(null)
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selectedIds.size === processedItems.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(processedItems.map(i => i.id)))
    }
  }

  function handleBatchDelete() {
    const ids = Array.from(selectedIds)
    if (!window.confirm(`Delete ${ids.length} item${ids.length !== 1 ? "s" : ""}? This cannot be undone.`)) return
    onBatchDelete?.(ids)
    setSelectedIds(new Set())
  }

  const activeFilterCount = [
    filters.search,
    filters.type,
    filters.subtype,
    filters.minCondition,
    filters.maxCondition,
    filters.showHidden,
    filters.magical !== "all",
    filters.consumable !== "all",
  ].filter(Boolean).length

  const processedItems = useMemo(() => {
    let result = isGM ? items : items.filter(item => !item.hidden)

    // Apply filters
    if (filters.search) {
      const q = filters.search.toLowerCase()
      result = result.filter(item =>
        item.name.toLowerCase().includes(q) ||
        item.type?.toLowerCase().includes(q) ||
        item.subtype?.toLowerCase().includes(q) ||
        item.short_description?.toLowerCase().includes(q) ||
        item.character_id?.toLowerCase().includes(q)
      )
    }
    if (!isGM || !filters.showHidden) {
      if (!isGM) result = result.filter(item => !item.hidden)
    }
    if (filters.type)    result = result.filter(item => item.type === filters.type)
    if (filters.subtype) result = result.filter(item => item.subtype === filters.subtype)
    if (filters.minCondition !== "") result = result.filter(item => (item.condition ?? 0) >= Number(filters.minCondition))
    if (filters.maxCondition !== "") result = result.filter(item => (item.condition ?? 0) <= Number(filters.maxCondition))
    if (filters.magical === "magical") result = result.filter(item => item.is_magical)
    if (filters.magical === "mundane") result = result.filter(item => !item.is_magical)
    if (filters.consumable === "consumable") result = result.filter(item => item.consumable)
    if (filters.consumable === "equipment")  result = result.filter(item => !item.consumable)

    // Apply sort
    if (sortField && sortDir) {
      result = [...result].sort((a, b) => {
        const av = a[sortField] ?? ""
        const bv = b[sortField] ?? ""
        if (av === bv) return 0
        const cmp = av < bv ? -1 : 1
        return sortDir === "asc" ? cmp : -cmp
      })
    }

    return result
  }, [items, isGM, filters, sortField, sortDir])

  const isEmpty = processedItems.length === 0

  return (
    <div className="space-y-3">
      {/* ── Toolbar ── */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Search */}
        <div className="relative flex-1 min-w-45">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs pointer-events-none">⌕</span>
          <input
            type="text"
            placeholder="Search items…"
            value={filters.search}
            onChange={e => updateFilter("search", e.target.value)}
            className="w-full pl-7 pr-3 py-1.5 text-sm bg-secondary/30 border border-border text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-cyan-500/50 focus:bg-secondary/50 transition-all"
          />
        </div>

        {/* Filter toggle */}
        <button
          onClick={() => setFiltersOpen(v => !v)}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs border transition-all ${
            filtersOpen || activeFilterCount > 0
              ? "bg-cyan-900/40 border-cyan-600/50 text-cyan-400"
              : "bg-secondary/30 border-border text-muted-foreground hover:text-foreground hover:border-border/80"
          }`}
        >
          <span>Filters</span>
          {activeFilterCount > 0 && (
            <span className="bg-cyan-500 text-black text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>

        {/* GM indicator */}
        {isGM && (
          <span className="px-2 py-1 text-[10px] uppercase tracking-widest bg-amber-900/30 border border-amber-700/50 text-amber-400 font-mono">
            GM View
          </span>
        )}

        {/* Clear */}
        {(activeFilterCount > 0 || sortField) && (
          <button
            onClick={clearFilters}
            className="px-3 py-1.5 text-xs text-red-400/70 border border-red-900/30 hover:border-red-700/50 hover:text-red-400 transition-all"
          >
            Clear
          </button>
        )}

        {/* Batch delete */}
        {onBatchDelete && selectedIds.size > 0 && (
          <button
            onClick={handleBatchDelete}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-red-700/60 text-red-400 hover:bg-red-900/20 transition-all"
          >
            <Trash2 className="w-3 h-3" />
            Delete {selectedIds.size} selected
          </button>
        )}
      </div>

      {/* ── Filter panel ── */}
      {filtersOpen && (
        <div className="border border-border bg-card/80 p-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {/* Type */}
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Type</span>
            <select
              value={filters.type}
              onChange={e => updateFilter("type", e.target.value)}
              className="text-sm bg-secondary/30 border border-border text-foreground px-2 py-1 focus:outline-none focus:border-cyan-500/50"
            >
              <option value="">All</option>
              {allTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>

          {/* Subtype */}
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Subtype</span>
            <select
              value={filters.subtype}
              onChange={e => updateFilter("subtype", e.target.value)}
              className="text-sm bg-secondary/30 border border-border text-foreground px-2 py-1 focus:outline-none focus:border-cyan-500/50"
            >
              <option value="">All</option>
              {allSubtypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>

          {/* Condition range */}
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Min Condition %</span>
            <input
              type="number" min={0} max={100}
              value={filters.minCondition}
              onChange={e => updateFilter("minCondition", e.target.value)}
              placeholder="0"
              className="text-sm bg-secondary/30 border border-border text-foreground px-2 py-1 focus:outline-none focus:border-cyan-500/50 w-full"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Max Condition %</span>
            <input
              type="number" min={0} max={100}
              value={filters.maxCondition}
              onChange={e => updateFilter("maxCondition", e.target.value)}
              placeholder="100"
              className="text-sm bg-secondary/30 border border-border text-foreground px-2 py-1 focus:outline-none focus:border-cyan-500/50 w-full"
            />
          </label>

          {/* Magical */}
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Magic</span>
            <select
              value={filters.magical}
              onChange={e => updateFilter("magical", e.target.value as FilterState["magical"])}
              className="text-sm bg-secondary/30 border border-border text-foreground px-2 py-1 focus:outline-none focus:border-cyan-500/50"
            >
              <option value="all">All</option>
              <option value="magical">Magical only</option>
              <option value="mundane">Mundane only</option>
            </select>
          </label>

          {/* Consumable */}
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Category</span>
            <select
              value={filters.consumable}
              onChange={e => updateFilter("consumable", e.target.value as FilterState["consumable"])}
              className="text-sm bg-secondary/30 border border-border text-foreground px-2 py-1 focus:outline-none focus:border-cyan-500/50"
            >
              <option value="all">All</option>
              <option value="consumable">Consumables</option>
              <option value="equipment">Equipment</option>
            </select>
          </label>

          {/* Show hidden — GM only */}
          {isGM && (
            <label className="flex items-center gap-2 col-span-2 sm:col-span-1 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.showHidden}
                onChange={e => updateFilter("showHidden", e.target.checked)}
                className="accent-cyan-500"
              />
              <span className="text-sm text-muted-foreground">Show hidden items</span>
            </label>
          )}
        </div>
      )}

      {/* ── Result count ── */}
      <div className="text-[11px] text-muted-foreground/60 tabular-nums">
        {processedItems.length} item{processedItems.length !== 1 ? "s" : ""}
        {activeFilterCount > 0 && ` (filtered from ${isGM ? items.length : items.filter(i => !i.hidden).length})`}
      </div>

      {/* ── Table ── */}
      <div className="border border-border bg-card overflow-hidden">
        {isEmpty ? (
          <div className="border border-border bg-card p-6 text-center">
            <p className="text-muted-foreground text-sm italic font-serif">{emptyMessage}</p>
          </div>
        ) : (
          <>
            {/* ── Mobile view ── */}
            <div className="md:hidden divide-y divide-border">
              {processedItems.map((item) => (
                <div
                  key={item.id}
                  className={`p-4 space-y-3 hover:bg-secondary/10 transition-colors ${item.hidden ? "opacity-50" : ""} ${selectedIds.has(item.id) ? "bg-red-900/10" : ""}`}
                >
                  <div className="flex justify-between items-start">
                    {onDelete && (
                      <input
                        type="checkbox"
                        className="accent-red-500 mt-1 mr-2 shrink-0"
                        checked={selectedIds.has(item.id)}
                        onChange={() => toggleSelect(item.id)}
                      />
                    )}
                    <button
                      onClick={() => onInspect?.(item)}
                      className="flex flex-col items-start group text-left flex-1"
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className={
                          item.is_magical
                            ? "font-serif italic text-blue-300 drop-shadow-[0_0_6px_rgba(147,197,253,0.55)] transition-colors"
                            : "font-serif text-lg text-foreground group-hover:text-cyan-400 transition-colors underline decoration-dotted decoration-muted-foreground/30 underline-offset-4"
                        }>
                          {item.name}
                        </h4>
                        {isGM && item.hidden && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-yellow-900/40 border border-yellow-700/40 text-yellow-500 uppercase tracking-wider">Hidden</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mt-1">
                        {item.weight} lbs • <span className="text-cyan-500/70">View Details</span>
                      </p>
                      {isGM && (
                        <p className="text-xs text-amber-400/60 mt-0.5">Owner: {item.character_id}</p>
                      )}
                    </button>

                    {showCondition && (
                      <div
                        className="flex flex-col items-center justify-center w-10 h-10 rounded-sm shrink-0"
                        style={getConditionStyle(item.condition ?? 100)}
                      >
                        <span className="text-[8px] uppercase text-white/60 tracking-tight leading-none mb-0.5">Cond</span>
                        <span className="text-[11px] font-semibold text-white/90 leading-none">{item.condition}%</span>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {genericColumns
                      .filter(c => c !== "name" && c !== "weight")
                      .map(col => (
                        <div key={col} className="flex flex-col">
                          <span className="text-[10px] uppercase text-muted-foreground tracking-tighter">
                            {COLUMN_LABELS[col] ?? col}
                          </span>
                          <span className="text-foreground/90">{item[col as keyof Item] ?? "—"}</span>
                        </div>
                      ))}
                  </div>

                  {!isGM && (
                    <div className="flex gap-2 pt-2">
                      {onEquip && (item.type === "weapon" || item.type === "armor") && (
                        <button
                          onClick={() => onEquip(item)}
                          title={item.is_equipped ? "Unequip" : "Equip"}
                          className={`px-3 py-2 text-xs font-bold tracking-widest border transition-all ${
                            item.is_equipped
                              ? "border-blue-500 text-blue-400 bg-blue-950/30"
                              : "border-muted-foreground/30 text-muted-foreground"
                          }`}
                        >
                          E
                        </button>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="flex items-center justify-center px-3 py-2 text-xs border border-muted-foreground/30 text-muted-foreground hover:border-muted-foreground/60 transition-all">
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-card border-border">
                          {!item.consumable && (item.condition ?? 100) < 100 && (
                            <DropdownMenuItem
                              onClick={() => onRepair?.(item)}
                              className="text-blue-400 focus:text-blue-300 text-xs uppercase tracking-widest cursor-pointer"
                            >
                              Repair
                            </DropdownMenuItem>
                          )}
                          {item.consumable && (
                            <DropdownMenuItem
                              onClick={() => window.confirm(`Use ${item.name}? This will destroy it.`) && onConsume?.(item)}
                              className="text-green-400 focus:text-green-300 text-xs uppercase tracking-widest cursor-pointer"
                            >
                              Use
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() => window.confirm(`Drop ${item.name}?`) && onDrop?.(item)}
                            className="text-red-400 focus:text-red-300 text-xs uppercase tracking-widest cursor-pointer"
                          >
                            Drop
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}
                  {isGM && onGrantToCharacter && (
                    <div className="pt-2">
                      <button
                        onClick={() => onGrantToCharacter(item, gameCharacters)}
                        className="w-full py-2 text-xs bg-amber-900/30 text-amber-400 border border-amber-700/50 active:bg-amber-800 transition-all uppercase tracking-widest"
                      >
                        Grant to Character
                      </button>
                    </div>
                  )}
                  {onDelete && (
                    <div className="pt-2">
                      <button
                        onClick={() => window.confirm(`Delete "${item.name}"? This cannot be undone.`) && onDelete(item)}
                        className="w-full py-2 text-xs bg-red-900/20 text-red-400 border border-red-800/50 active:bg-red-800 transition-all uppercase tracking-widest flex items-center justify-center gap-1.5"
                      >
                        <Trash2 className="w-3 h-3" /> Delete
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* ── Desktop view ── */}
            <table className="hidden md:table w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  {onDelete && (
                    <th className="w-px p-3">
                      <input
                        type="checkbox"
                        className="accent-red-500"
                        checked={processedItems.length > 0 && selectedIds.size === processedItems.length}
                        onChange={toggleSelectAll}
                      />
                    </th>
                  )}
                  {genericColumns.map(col => {
                    const sortable = SORTABLE_COLUMNS.includes(col)
                    const isActive = sortField === col
                    return (
                      <th
                        key={col}
                        onClick={() => handleSort(col)}
                        className={`text-xs uppercase tracking-widest text-muted-foreground p-3 font-normal select-none ${
                          sortable ? "cursor-pointer hover:text-foreground transition-colors" : ""
                        } ${isActive ? "text-cyan-400" : ""}`}
                      >
                        {COLUMN_LABELS[col] ?? col}
                        {sortable && <SortIcon direction={isActive ? sortDir : null} />}
                      </th>
                    )
                  })}
                  {showCondition && (
                    <th
                      onClick={() => handleSort("condition")}
                      className={`text-xs uppercase tracking-widest p-3 font-normal cursor-pointer hover:text-foreground transition-colors select-none ${
                        sortField === "condition" ? "text-cyan-400" : "text-muted-foreground"
                      }`}
                    >
                      {COLUMN_LABELS["condition"]}
                      <SortIcon direction={sortField === "condition" ? sortDir : null} />
                    </th>
                  )}
                  {isGM && onGrantToCharacter && (
                    <th className="w-px whitespace-nowrap text-right text-xs uppercase tracking-widest text-muted-foreground p-3 font-normal">
                      Actions
                    </th>
                  )}
                  {!isGM && (
                    <th className="w-px whitespace-nowrap text-right text-xs uppercase tracking-widest text-muted-foreground p-3 font-normal">
                      Actions
                    </th>
                  )}
                  {onDelete && (
                    <th className="w-px p-3" />
                  )}
                </tr>
              </thead>
              <tbody>
                {processedItems.map(item => (
                  <tr
                    key={item.id}
                    className={`border-b border-border hover:bg-secondary/20 transition-colors ${item.hidden ? "opacity-50" : ""} ${selectedIds.has(item.id) ? "bg-red-900/10" : ""}`}
                  >
                    {onDelete && (
                      <td className="p-3">
                        <input
                          type="checkbox"
                          className="accent-red-500"
                          checked={selectedIds.has(item.id)}
                          onChange={() => toggleSelect(item.id)}
                        />
                      </td>
                    )}
                    {genericColumns.map(col => (
                      <td key={col} className="p-3 text-sm text-foreground">
                        {col === "name" ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => onInspect?.(item)}
                              className={
                                item.is_magical
                                  ? "font-serif italic text-blue-300 drop-shadow-[0_0_6px_rgba(147,197,253,0.55)] text-left transition-colors"
                                  : "font-serif text-left hover:text-cyan-400 transition-colors underline decoration-dotted decoration-muted-foreground/30 underline-offset-4"
                              }
                            >
                              {item.name}
                            </button>
                            {isGM && item.hidden && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-yellow-900/40 border border-yellow-700/40 text-yellow-500 uppercase tracking-wider">Hidden</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-foreground/80">{item[col as keyof Item] ?? "—"}</span>
                        )}
                      </td>
                    ))}

                    {showCondition && (
                      <td className="p-3 text-sm text-foreground whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-12 h-2 bg-secondary rounded-full overflow-hidden">
                            <div
                              className="h-full transition-all"
                              style={{
                                width: `${item.condition}%`,
                                backgroundColor: getConditionStyle(item.condition ?? 100).backgroundColor,
                              }}
                            />
                          </div>
                          <span className="text-[10px] tabular-nums">{item.condition}%</span>
                        </div>
                      </td>
                    )}

                    {isGM && onGrantToCharacter && (
                      <td className="p-3 text-right whitespace-nowrap">
                        <button
                          onClick={() => onGrantToCharacter(item, gameCharacters)}
                          className="px-2 py-1 text-xs bg-amber-900/30 text-amber-400 border border-amber-700/50 hover:bg-amber-800 hover:text-white transition-all uppercase tracking-widest"
                        >
                          Grant to Character
                        </button>
                      </td>
                    )}
                    {!isGM && (
                      <td className="p-3 text-right space-x-2 whitespace-nowrap">
                        {onEquip && (item.type === "weapon" || item.type === "armor") && (
                          <button
                            onClick={() => onEquip(item)}
                            title={item.is_equipped ? "Unequip" : "Equip"}
                            className={`px-2 py-1 text-xs font-bold tracking-widest border transition-all ${
                              item.is_equipped
                                ? "border-blue-500 text-blue-400 bg-blue-950/30"
                                : "border-muted-foreground/30 text-muted-foreground hover:border-muted-foreground/60"
                            }`}
                          >
                            E
                          </button>
                        )}
                        {!item.consumable && (item.condition ?? 100) < 100 && (
                          <button
                            onClick={() => onRepair?.(item)}
                            className="px-2 py-1 text-xs bg-blue-900/30 text-blue-400 border border-blue-800 hover:bg-blue-800 hover:text-white transition-all"
                          >
                            Repair 1d10
                          </button>
                        )}
                        {item.consumable && (
                          <button
                            onClick={async () => {
                              if (window.confirm(`Use ${item.name}? This will destroy it.`)) {
                                await onConsume?.(item)
                              }
                            }}
                            className="px-2 py-1 text-xs bg-green-900/30 text-green-400 border border-green-800 hover:bg-green-800 hover:text-white transition-all"
                          >
                            Use
                          </button>
                        )}
                        <button
                          onClick={() => window.confirm(`Drop ${item.name}?`) && onDrop?.(item)}
                          className="px-2 py-1 text-xs bg-red-900/30 text-red-400 border border-red-800 hover:bg-red-800 hover:text-white transition-all"
                        >
                          Drop
                        </button>
                      </td>
                    )}
                    {onDelete && (
                      <td className="p-3 text-right whitespace-nowrap">
                        <button
                          onClick={() => window.confirm(`Delete "${item.name}"? This cannot be undone.`) && onDelete(item)}
                          className="px-2 py-1 text-xs bg-red-900/20 text-red-400 border border-red-800/50 hover:bg-red-900/40 hover:text-red-300 transition-all"
                          title="Delete item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  )
}