"use client"

import { useState, useEffect } from "react"
import type { ComponentType } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  GripVertical,
  X,
  MessageSquare,
  Bot,
  Database,
  Play,
  Loader2,
  Save,
  FolderOpen,
  Plus,
  Zap,
  RefreshCw,
} from "lucide-react"
import ReactMarkdown from "react-markdown"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { createClient } from "@/lib/supabase/client"
import type { Character, Item, Spell } from "@/components/types/types"
import {
  PLACEHOLDER_REGISTRY,
  parsePlaceholders,
  extractUsedTypes,
} from "@/lib/prompt-placeholders"
import {
  getPromptSlugs,
  getLatestPrompt,
  savePrompt,
} from "@/lib/services/prompt-service"
import type { SavedPromptBlock, HydraConfig } from "@/lib/services/prompt-service"

// ─── Types ────────────────────────────────────────────────────────────────────

type HydraTable = 'character' | 'inventory' | 'location' | 'npcs' | 'encounter' | 'syngem_game'

type BlockKind = "system" | "user" | "assistant" | "auto-hydrator"

interface Block {
  id: string
  kind: BlockKind
  label: string
  content: string
  hydraConfig?: HydraConfig
}

interface EvalResponse {
  text?: string
  usage?: { input_tokens: number; output_tokens: number }
  error?: string
}

interface SkillRow {
  id: string
  name: string
  skill_text?: string | null
}


// ─── Block visual config ──────────────────────────────────────────────────────

const BLOCK_CONFIG: Record<
  BlockKind,
  { label: string; icon: ComponentType<{ className?: string }>; border: string; header: string; bg: string }
> = {
  system: {
    label: "System",
    icon: Database,
    border: "border-amber-700/50",
    header: "text-amber-400",
    bg: "bg-amber-950/10",
  },
  user: {
    label: "User",
    icon: MessageSquare,
    border: "border-border",
    header: "text-foreground",
    bg: "bg-background",
  },
  assistant: {
    label: "Assistant",
    icon: Bot,
    border: "border-cyan-700/50",
    header: "text-cyan-400",
    bg: "bg-cyan-950/10",
  },
  "auto-hydrator": {
    label: "Auto-Hydrator",
    icon: Zap,
    border: "border-violet-700/50",
    header: "text-violet-400",
    bg: "bg-violet-950/10",
  },
}

const HYDRA_TABLES: Array<{ id: HydraTable; label: string }> = [
  { id: 'character', label: 'Character' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'location', label: 'Location' },
  { id: 'npcs', label: 'NPCs' },
  { id: 'encounter', label: 'Encounter' },
  { id: 'syngem_game', label: 'Syngem Game' },
]

const DEFAULT_TABLES: HydraTable[] = ['character', 'inventory', 'location', 'npcs', 'encounter', 'syngem_game']

// ─── Sample blocks ────────────────────────────────────────────────────────────

const SAMPLE_BLOCKS: Array<{ name: string; blocks: Array<{ kind: BlockKind; content: string }> }> = [
  {
    name: "Last 3 Turns",
    // Matches architect.ts: lastFourTurns.map(t => ({ role: t.role === 'player' ? 'user' : 'assistant', content }))
    blocks: [
      {
        kind: "user",
        content: `I follow the cloaked figure through the market district, keeping my distance.`,
      },
      {
        kind: "assistant",
        content: `The figure moves with purpose through the evening crowd, never looking back — but twice you notice their hand brush against the same iron post. Signalling someone. When they turn down the Coppergate passage the crowd thins. You're more exposed now.`,
      },
      {
        kind: "user",
        content: `I duck into the doorway of a butcher's stall and wait to see if anyone's watching me.`,
      },
      {
        kind: "assistant",
        content: `Smart. Three heartbeats pass. Then you see her — a woman in grey, stationary, pretending to study a vendor's wares but watching the mouth of Coppergate. She hasn't moved since you entered the passage. She saw you.`,
      },
      {
        kind: "user",
        content: `I make eye contact with the woman in grey, then deliberately walk in the opposite direction.`,
      },
      {
        kind: "assistant",
        content: `She lets you go — for now. But as you turn onto the main road you hear the distinct two-tone whistle of a signal call, close behind you. They're communicating. Whoever the cloaked figure was meeting, they now know they were followed.`,
      },
    ],
  },
  {
    name: "Summary / Quest",
    // Matches architect.ts: systemParts.push(`=== STORY SO FAR ===\n${scribeSummary}`) and `=== QUESTS & OBJECTIVES ===\n${JSON.stringify(questObjectives, null, 2)}`)
    blocks: [
      {
        kind: "system",
        content: `=== STORY SO FAR ===
Kael escaped Hollowwatch prison four days ago carrying an encrypted ledger that implicates members of the Vorrenmoor city council in dealings with the Ash Covenant. He was aided by a guard named Perris, whose loyalty remains unclear. In the city he made contact with Doran of the Ironwright faction and sold him one encrypted page in exchange for a name — "the Lector" — the Covenant's Vorrenmoor intermediary. Kael has since confirmed the Covenant has active assets in the trade district.

=== QUESTS & OBJECTIVES ===
[
  {
    "id": "find_the_lector",
    "title": "Find the Lector",
    "status": "active",
    "description": "Track down the Ash Covenant's Vorrenmoor intermediary, known only as the Lector."
  },
  {
    "id": "decode_the_ledger",
    "title": "Decode the Ledger",
    "status": "active",
    "description": "The encrypted ledger requires a scholar or someone with knowledge of Covenant ciphers."
  },
  {
    "id": "evade_hollowwatch",
    "title": "Evade the Hollowwatch",
    "status": "active",
    "description": "A Hollowwatch recovery team has arrived in Vorrenmoor; Kael must avoid capture."
  },
  {
    "id": "escape_prison",
    "title": "Escape Hollowwatch Prison",
    "status": "completed",
    "description": "Kael broke out of the Hollowwatch garrison and fled to Vorrenmoor."
  }
]`,
      },
    ],
  },
]

// ─── BlockOverlay ─────────────────────────────────────────────────────────────

function BlockOverlay({ block }: { block: Block }) {
  const cfg = BLOCK_CONFIG[block.kind]
  const Icon = cfg.icon
  return (
    <div className={`border ${cfg.border} ${cfg.bg} shadow-2xl opacity-90`}>
      <div className={`flex items-center gap-2 px-3 py-2 border-b ${cfg.border}`}>
        <GripVertical className="w-3.5 h-3.5 text-muted-foreground" />
        <Icon className={`w-3 h-3 ${cfg.header}`} />
        <span className={`font-sans text-[0.6rem] uppercase tracking-widest ${cfg.header}`}>
          {cfg.label}
        </span>
      </div>
      <div className="px-3 py-2">
        <p className="font-mono text-[0.65rem] text-muted-foreground line-clamp-3 whitespace-pre-wrap">
          {block.content || "…"}
        </p>
      </div>
    </div>
  )
}

// ─── AutoHydratorBlockBody ────────────────────────────────────────────────────

function AutoHydratorBlockBody({
  block,
  characters,
  onUpdateHydra,
}: {
  block: Block
  characters: Character[]
  onUpdateHydra: (id: string, hydraConfig: HydraConfig, content?: string) => void
}) {
  const [fetching, setFetching] = useState(false)
  const hydra = block.hydraConfig ?? { characterId: '', gameId: '', tables: [...DEFAULT_TABLES] }

  function setConfig(patch: Partial<HydraConfig>) {
    onUpdateHydra(block.id, { ...hydra, ...patch })
  }

  function toggleTable(table: HydraTable) {
    const tables = hydra.tables.includes(table)
      ? hydra.tables.filter((t) => t !== table)
      : [...hydra.tables, table]
    onUpdateHydra(block.id, { ...hydra, tables })
  }

  async function handleFetch() {
    if (!hydra.characterId) return
    setFetching(true)
    try {
      const res = await fetch('/api/gm/hydrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          characterId: hydra.characterId,
          gameId: hydra.gameId || undefined,
          tables: hydra.tables,
        }),
      })
      const data = await res.json() as { text?: string; error?: string }
      if (res.ok && data.text) {
        onUpdateHydra(block.id, hydra, data.text)
      }
    } finally {
      setFetching(false)
    }
  }

  return (
    <div className="space-y-3">
      {/* Character picker */}
      <div className="space-y-1">
        <p className="font-sans text-[0.5rem] uppercase tracking-[0.3em] text-violet-400/60">Character</p>
        <Select value={hydra.characterId} onValueChange={(v) => setConfig({ characterId: v })}>
          <SelectTrigger className="border-violet-700/40 bg-background text-xs h-7">
            <SelectValue placeholder="Select…" />
          </SelectTrigger>
          <SelectContent>
            {characters.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table checkboxes */}
      <div className="space-y-1">
        <p className="font-sans text-[0.5rem] uppercase tracking-[0.3em] text-violet-400/60">Tables</p>
        <div className="flex flex-wrap gap-1">
          {HYDRA_TABLES.map(({ id, label }) => {
            const active = hydra.tables.includes(id)
            return (
              <button
                key={id}
                onClick={() => toggleTable(id)}
                className={`font-mono text-[0.55rem] border px-1.5 py-0.5 transition-colors ${
                  active
                    ? "border-violet-600/60 text-violet-300 bg-violet-950/40"
                    : "border-border/30 text-muted-foreground/40"
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Fetch button */}
      <button
        onClick={handleFetch}
        disabled={!hydra.characterId || fetching}
        className="flex items-center gap-1.5 border border-violet-700/50 px-2 py-1 font-sans text-[0.55rem] uppercase tracking-widest text-violet-400 hover:bg-violet-950/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {fetching
          ? <><Loader2 className="w-2.5 h-2.5 animate-spin" />Fetching…</>
          : <><RefreshCw className="w-2.5 h-2.5" />Fetch Context</>
        }
      </button>

      {/* Content preview */}
      {block.content && (
        <pre className="font-mono text-[0.6rem] text-violet-200/60 leading-relaxed whitespace-pre-wrap max-h-40 overflow-y-auto border border-violet-700/20 bg-violet-950/20 px-2 py-1.5">
          {block.content}
        </pre>
      )}
    </div>
  )
}

// ─── SortableBlock ────────────────────────────────────────────────────────────

function SortableBlock({
  block,
  characters,
  onRemove,
  onUpdate,
  onUpdateHydra,
  onFocus,
}: {
  block: Block
  characters: Character[]
  onRemove: (id: string) => void
  onUpdate: (id: string, content: string) => void
  onUpdateHydra: (id: string, hydraConfig: HydraConfig, content?: string) => void
  onFocus: (id: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
  })
  const style = { transform: CSS.Transform.toString(transform), transition }
  const cfg = BLOCK_CONFIG[block.kind]
  const Icon = cfg.icon

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`border ${cfg.border} ${cfg.bg} transition-opacity ${isDragging ? "opacity-25" : ""}`}
    >
      <div className={`flex items-center gap-2 px-3 py-2 border-b ${cfg.border}`}>
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none"
          aria-label="Drag to reorder"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </button>
        <Icon className={`w-3 h-3 ${cfg.header}`} />
        <span className={`font-sans text-[0.6rem] uppercase tracking-widest ${cfg.header} flex-1`}>
          {cfg.label}
        </span>
        <button
          onClick={() => onRemove(block.id)}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="p-3">
        {block.kind === "auto-hydrator" ? (
          <AutoHydratorBlockBody
            block={block}
            characters={characters}
            onUpdateHydra={onUpdateHydra}
          />
        ) : (
          <Textarea
            value={block.content}
            onChange={(e) => onUpdate(block.id, e.target.value)}
            onFocus={() => onFocus(block.id)}
            placeholder={`Enter ${cfg.label.toLowerCase()} content…`}
            className="min-h-20 resize-y font-mono text-xs border-0 bg-transparent p-0 focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/40"
          />
        )}
      </div>
    </div>
  )
}

// ─── Models ───────────────────────────────────────────────────────────────────

const MODELS = [
  { value: "claude-sonnet-4-6", label: "Sonnet 4.6" },
  { value: "claude-opus-4-8", label: "Opus 4.8" },
  { value: "claude-haiku-4-5-20251001", label: "Haiku 4.5" },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PromptBuilderPage() {
  const router = useRouter()
  const supabase = createClient()

  // DB data for tester instance pickers
  const [characters, setCharacters] = useState<Character[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [spells, setSpells] = useState<Spell[]>([])
  const [skills, setSkills] = useState<SkillRow[]>([])
  const [dataLoading, setDataLoading] = useState(true)

  // Saved slugs
  const [savedSlugs, setSavedSlugs] = useState<string[]>([])

  // Save / load state
  const [promptName, setPromptName] = useState("")
  const [promptSlug, setPromptSlug] = useState("")
  const [saveMsg, setSaveMsg] = useState<string | null>(null)

  // Canvas
  const [blocks, setBlocks] = useState<Block[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(null)

  // Config
  const [model, setModel] = useState("claude-sonnet-4-6")
  const [maxTokens, setMaxTokens] = useState(1024)
  const [temperature, setTemperature] = useState(0.7)

  // Left panel open sections
  const [openTypes, setOpenTypes] = useState<Set<string>>(new Set())

  // Right panel collapsed previews
  const [systemExpanded, setSystemExpanded] = useState(false)
  const [messagesExpanded, setMessagesExpanded] = useState(false)

  // Test instances: type → DB row as generic object
  const [testInstances, setTestInstances] = useState<Record<string, Record<string, unknown>>>({})

  // Run state
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<EvalResponse | null>(null)
  const [serverStatus, setServerStatus] = useState<"unknown" | "online" | "offline">("unknown")
  const [sessionTokens, setSessionTokens] = useState({ input: 0, output: 0 })

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // ─── Init ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push("/"); return }
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_dev")
        .eq("id", user.id)
        .single()
      if (!profile?.is_dev) { router.push("/dashboard"); return }

      const [{ data: chars }, { data: itemData }, { data: spellData }, { data: skillData }] =
        await Promise.all([
          supabase.from("characters").select("*").eq("user_id", user.id).order("name"),
          supabase.from("items").select("*").order("name"),
          supabase.from("spells").select("*").order("name"),
          supabase.from("skills").select("id, name, skill_text").order("name"),
        ])
      setCharacters((chars as Character[]) ?? [])
      setItems((itemData as Item[]) ?? [])
      setSpells((spellData as Spell[]) ?? [])
      setSkills((skillData as SkillRow[]) ?? [])

      const slugs = await getPromptSlugs(supabase)
      setSavedSlugs(slugs)

      setDataLoading(false)
    }
    init().catch(console.error)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  useEffect(() => {
    fetch("/api/gm/health")
      .then((r) => r.json())
      .then((d: { status: string }) =>
        setServerStatus(d.status === "online" ? "online" : "offline"),
      )
      .catch(() => setServerStatus("offline"))
  }, [])

  // ─── Block ops ─────────────────────────────────────────────────────────────

  function addBlock(kind: BlockKind) {
    const id = crypto.randomUUID()
    const extra = kind === "auto-hydrator"
      ? { hydraConfig: { characterId: '', gameId: '', tables: [...DEFAULT_TABLES] } }
      : {}
    setBlocks((prev) => [...prev, { id, kind, label: BLOCK_CONFIG[kind].label, content: "", ...extra }])
    setFocusedBlockId(id)
  }

  function addSampleBlocks(samples: Array<{ kind: BlockKind; content: string }>) {
    const newBlocks = samples.map(({ kind, content }) => ({
      id: crypto.randomUUID(),
      kind,
      label: BLOCK_CONFIG[kind].label,
      content,
    }))
    setBlocks((prev) => [...prev, ...newBlocks])
    const lastId = newBlocks.at(-1)?.id
    if (lastId) setFocusedBlockId(lastId)
  }

  function removeBlock(id: string) {
    setBlocks((prev) => prev.filter((b) => b.id !== id))
    if (focusedBlockId === id) setFocusedBlockId(null)
  }

  function updateBlock(id: string, content: string) {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, content } : b)))
  }

  function updateBlockHydra(id: string, hydraConfig: HydraConfig, content?: string) {
    setBlocks((prev) =>
      prev.map((b) =>
        b.id === id
          ? { ...b, hydraConfig, ...(content !== undefined ? { content } : {}) }
          : b,
      ),
    )
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string)
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null)
    const { active, over } = event
    if (over && active.id !== over.id) {
      setBlocks((prev) => {
        const oldIndex = prev.findIndex((b) => b.id === active.id)
        const newIndex = prev.findIndex((b) => b.id === over.id)
        return arrayMove(prev, oldIndex, newIndex)
      })
    }
  }

  // ─── Placeholder injection ─────────────────────────────────────────────────

  function injectField(type: string, field: string) {
    if (!focusedBlockId) return
    const token = `{{${type}.${field}}}`
    setBlocks((prev) =>
      prev.map((b) => (b.id === focusedBlockId ? { ...b, content: b.content + token } : b)),
    )
  }

  function toggleType(type: string) {
    setOpenTypes((prev) => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }

  // ─── Save / Load ───────────────────────────────────────────────────────────

  async function handleLoad(slug: string) {
    if (!slug) return
    const row = await getLatestPrompt(supabase, slug)
    if (!row) return
    const { blocks: saved, model: m, maxTokens: mt, temperature: temp } = row.prompt
    setBlocks(saved.map((b: SavedPromptBlock) => ({ ...b, id: crypto.randomUUID() })))
    setModel(m)
    setMaxTokens(mt)
    setTemperature(temp)
    setPromptName(row.name)
    setPromptSlug(row.slug)
    setResult(null)
    setTestInstances({})
  }

  async function handleSave() {
    if (!promptName.trim() || !promptSlug.trim() || blocks.length === 0) return
    const savedBlocks: SavedPromptBlock[] = blocks.map(({ kind, label, content, hydraConfig }) => ({
      kind,
      label,
      content,
      ...(hydraConfig ? { hydraConfig } : {}),
    }))
    const row = await savePrompt(supabase, {
      name: promptName.trim(),
      slug: promptSlug.trim(),
      prompt: { blocks: savedBlocks, model, maxTokens, temperature },
    })
    setSavedSlugs((prev) =>
      prev.includes(row.slug) ? prev : [...prev, row.slug].sort(),
    )
    setSaveMsg(`Saved v${row.version}`)
    setTimeout(() => setSaveMsg(null), 2500)
  }

  // ─── Test instance pickers ─────────────────────────────────────────────────

  function instanceOptions(type: string): Array<{ id: string; label: string }> {
    if (type === "character") return characters.map((c) => ({ id: c.id, label: c.name }))
    if (type === "item") return items.map((i) => ({ id: i.id, label: i.name }))
    if (type === "spell") return spells.filter((s) => s.name).map((s) => ({ id: String(s.id), label: s.name! }))
    if (type === "skill") return skills.map((s) => ({ id: s.id, label: s.name }))
    return []
  }

  function setTestInstance(type: string, instanceId: string) {
    const opts = instanceOptions(type)
    const found = opts.find((o) => o.id === instanceId)
    if (!found) {
      setTestInstances((prev) => { const next = { ...prev }; delete next[type]; return next })
      return
    }
    let row: Record<string, unknown> | undefined
    if (type === "character") row = characters.find((c) => c.id === instanceId) as Record<string, unknown>
    else if (type === "item") row = items.find((i) => i.id === instanceId) as Record<string, unknown>
    else if (type === "spell") row = spells.find((s) => String(s.id) === instanceId) as Record<string, unknown>
    else if (type === "skill") row = skills.find((s) => s.id === instanceId) as unknown as Record<string, unknown>
    if (row) setTestInstances((prev) => ({ ...prev, [type]: row! }))
  }

  // ─── Run ──────────────────────────────────────────────────────────────────

  async function handleRun() {
    const systemBlocks = blocks.filter((b) => b.kind === "system" || b.kind === "auto-hydrator")
    const messageBlocks = blocks.filter((b) => b.kind !== "system" && b.kind !== "auto-hydrator")
    const data = testInstances

    const system = systemBlocks.map((b) => parsePlaceholders(b.content, data)).join("\n\n")
    const messages = messageBlocks.map((b) => ({
      role: b.kind as "user" | "assistant",
      content: parsePlaceholders(b.content, data),
    }))

    setLoading(true)
    setResult(null)
    try {
      const res = await fetch("/api/gm/eval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages,
          system: system || undefined,
          model,
          maxTokens,
          temperature,
        }),
      })
      const payload = (await res.json()) as EvalResponse
      setResult(res.ok ? payload : { error: payload.error ?? `Server returned ${res.status}` })
      if (res.ok) {
        setServerStatus("online")
        if (payload.usage) {
          setSessionTokens((prev) => ({
            input: prev.input + payload.usage!.input_tokens,
            output: prev.output + payload.usage!.output_tokens,
          }))
        }
      }
    } catch {
      setResult({ error: "Failed to reach the web server" })
    } finally {
      setLoading(false)
    }
  }

  // ─── Derived ──────────────────────────────────────────────────────────────

  const systemBlocks = blocks.filter((b) => b.kind === "system" || b.kind === "auto-hydrator")
  const messageBlocks = blocks.filter((b) => b.kind !== "system" && b.kind !== "auto-hydrator")
  const lastMessage = messageBlocks[messageBlocks.length - 1]
  const canRun =
    !loading &&
    serverStatus !== "offline" &&
    messageBlocks.length > 0 &&
    lastMessage?.kind === "user" &&
    lastMessage.content.trim() !== ""

  const activeBlock = blocks.find((b) => b.id === activeId)
  const usedTypes = extractUsedTypes(blocks)

  // ─── Loading state ────────────────────────────────────────────────────────

  if (dataLoading) {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <p className="font-serif text-muted-foreground italic">Loading…</p>
      </div>
    )
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">

      {/* Header */}
      <header className="shrink-0 border-b border-border">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                <ChevronLeft className="w-4 h-4 mr-1" />
                Dashboard
              </Button>
            </Link>
            <div className="h-5 w-px bg-border" />
            <h1 className="text-sm uppercase tracking-[0.3em] text-muted-foreground">
              Prompt Builder
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {sessionTokens.input > 0 && (
              <span className="font-mono text-[0.5rem] uppercase tracking-widest border border-border/50 text-muted-foreground/50 px-2 py-0.5">
                {sessionTokens.input.toLocaleString()} in · {sessionTokens.output.toLocaleString()} out
              </span>
            )}
            {serverStatus !== "unknown" && (
              <span
                className={`font-sans text-[0.55rem] uppercase tracking-widest border px-2 py-0.5 ${
                  serverStatus === "online"
                    ? "border-cyan-700/50 text-cyan-400"
                    : "border-red-700/50 text-red-400"
                }`}
              >
                Server {serverStatus}
              </span>
            )}
            <Link
              href="/dashboard"
              className="font-serif text-base tracking-wide text-muted-foreground hover:text-foreground"
            >
              KatabataK
            </Link>
          </div>
        </div>
      </header>

      {/* 3-column body */}
      <div className="flex flex-1 overflow-hidden min-h-0">

        {/* LEFT: Data field injector */}
        <aside className="w-52 shrink-0 border-r border-border overflow-y-auto bg-card/30">

          {/* Sample blocks */}
          <div className="px-3 pt-4 pb-3 border-b border-border/30">
            <p className="font-sans text-[0.5rem] uppercase tracking-[0.3em] text-muted-foreground/50 mb-2">
              Samples
            </p>
            <div className="space-y-0.5">
              {SAMPLE_BLOCKS.map((s) => (
                <button
                  key={s.name}
                  onClick={() => addSampleBlocks(s.blocks)}
                  className="w-full text-left flex items-center gap-1.5 px-1 py-1.5 font-sans text-[0.6rem] uppercase tracking-widest text-muted-foreground hover:text-foreground hover:bg-card/50 transition-colors"
                >
                  <Plus className="w-2.5 h-2.5 shrink-0" />
                  {s.name}
                </button>
              ))}
            </div>
          </div>

          <div className="px-3 pt-4 pb-2">
            <p className="font-sans text-[0.5rem] uppercase tracking-[0.3em] text-muted-foreground/50 mb-1">
              Inject Field
            </p>
            {!focusedBlockId && (
              <p className="font-sans text-[0.5rem] italic text-muted-foreground/40 mb-2">
                Focus a block first
              </p>
            )}
          </div>

          {Object.entries(PLACEHOLDER_REGISTRY).map(([type, def]) => {
            const isOpen = openTypes.has(type)
            return (
              <div key={type} className="border-t border-border/30">
                <button
                  onClick={() => toggleType(type)}
                  className="flex items-center justify-between w-full px-3 py-2 text-left hover:bg-card/50 transition-colors"
                >
                  <span className="font-sans text-[0.6rem] uppercase tracking-widest text-muted-foreground">
                    {def.label}
                  </span>
                  <ChevronDown
                    className={`w-3 h-3 text-muted-foreground/50 transition-transform ${isOpen ? "rotate-180" : ""}`}
                  />
                </button>
                {isOpen && (
                  <div className="px-2 pb-2 flex flex-wrap gap-1">
                    {def.fields.map((field) => (
                      <button
                        key={field}
                        onClick={() => injectField(type, field)}
                        disabled={!focusedBlockId}
                        className={`font-mono text-[0.55rem] border px-1.5 py-0.5 transition-colors ${
                          focusedBlockId
                            ? "border-cyan-700/50 text-cyan-400 hover:bg-cyan-950/30 cursor-pointer"
                            : "border-border/30 text-muted-foreground/30 cursor-not-allowed"
                        }`}
                      >
                        .{field}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </aside>

        {/* MIDDLE: Block canvas */}
        <main className="flex-1 overflow-y-auto min-w-0 bg-background/60">
          {/* Add block buttons */}
          <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-2 flex items-center gap-2 flex-wrap">
            <span className="font-sans text-[0.5rem] uppercase tracking-[0.3em] text-muted-foreground/40 mr-1">
              Add
            </span>
            {(["system", "user", "assistant", "auto-hydrator"] as BlockKind[]).map((kind) => {
              const cfg = BLOCK_CONFIG[kind]
              const Icon = cfg.icon
              return (
                <button
                  key={kind}
                  onClick={() => addBlock(kind)}
                  className={`flex items-center gap-1.5 border px-2 py-1 font-sans text-[0.55rem] uppercase tracking-widest transition-colors hover:bg-card ${cfg.border} ${cfg.header}`}
                >
                  <Plus className="w-2.5 h-2.5" />
                  {cfg.label}
                </button>
              )
            })}
          </div>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="p-6 space-y-3">
              {blocks.length === 0 ? (
                <div className="border border-dashed border-border p-16 text-center">
                  <p className="font-serif text-muted-foreground italic text-sm mb-2">
                    Canvas is empty
                  </p>
                  <p className="font-sans text-[0.6rem] uppercase tracking-widest text-muted-foreground/40">
                    Use the buttons above to add blocks
                  </p>
                </div>
              ) : (
                <SortableContext
                  items={blocks.map((b) => b.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {blocks.map((block) => (
                    <SortableBlock
                      key={block.id}
                      block={block}
                      characters={characters}
                      onRemove={removeBlock}
                      onUpdate={updateBlock}
                      onUpdateHydra={updateBlockHydra}
                      onFocus={setFocusedBlockId}
                    />
                  ))}
                </SortableContext>
              )}
            </div>
            <DragOverlay>
              {activeBlock ? <BlockOverlay block={activeBlock} /> : null}
            </DragOverlay>
          </DndContext>
        </main>

        {/* RIGHT: Save/load + config + tester */}
        <aside className="w-96 shrink-0 border-l border-border overflow-y-auto bg-card/20">
          <div className="p-5 space-y-5">

            {/* Section 1: Save / Load */}
            <section className="space-y-3">
              <p className="font-sans text-[0.5rem] uppercase tracking-[0.3em] text-muted-foreground/50">
                Save / Load
              </p>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setBlocks([])
                    setPromptName("")
                    setPromptSlug("")
                    setResult(null)
                    setTestInstances({})
                    setFocusedBlockId(null)
                  }}
                  className="border border-border px-2 py-1.5 font-sans text-[0.55rem] uppercase tracking-widest text-muted-foreground hover:text-foreground hover:bg-card transition-colors shrink-0"
                >
                  New
                </button>
                <Select value="" onValueChange={handleLoad}>
                  <SelectTrigger className="flex-1 border-border bg-background text-xs uppercase tracking-wider">
                    <FolderOpen className="w-3 h-3 mr-1.5 shrink-0 text-muted-foreground" />
                    <SelectValue placeholder="Load slug…" />
                  </SelectTrigger>
                  <SelectContent>
                    {savedSlugs.length === 0 ? (
                      <div className="px-3 py-2 text-xs text-muted-foreground italic">
                        No saved prompts
                      </div>
                    ) : (
                      savedSlugs.map((slug) => (
                        <SelectItem key={slug} value={slug}>
                          {slug}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <input
                type="text"
                value={promptName}
                onChange={(e) => setPromptName(e.target.value)}
                placeholder="Prompt name…"
                className="w-full border border-border bg-background px-2 py-1.5 text-xs font-sans text-foreground focus:outline-none focus:border-foreground/40 placeholder:text-muted-foreground/40"
              />
              <input
                type="text"
                value={promptSlug}
                onChange={(e) =>
                  setPromptSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"))
                }
                placeholder="slug (e.g. gm-main)…"
                className="w-full border border-border bg-background px-2 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:border-foreground/40 placeholder:text-muted-foreground/40"
              />
              <button
                onClick={handleSave}
                disabled={!promptName.trim() || !promptSlug.trim() || blocks.length === 0}
                className="w-full flex items-center justify-center gap-2 border border-border px-3 py-2 font-sans text-[0.6rem] uppercase tracking-widest text-foreground hover:bg-card disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Save className="w-3 h-3" />
                {saveMsg ?? "Save New Version"}
              </button>
            </section>

            {/* Section 2: Config */}
            <section className="space-y-3 border-t border-border/50 pt-5">
              <p className="font-sans text-[0.5rem] uppercase tracking-[0.3em] text-muted-foreground/50">
                Config
              </p>

              <div className="flex items-center gap-2">
                <Select value={model} onValueChange={setModel}>
                  <SelectTrigger className="flex-1 border-border bg-background text-xs uppercase tracking-wider">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MODELS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <input
                  type="number"
                  min={64}
                  max={8192}
                  step={64}
                  value={maxTokens}
                  onChange={(e) =>
                    setMaxTokens(Math.max(64, Math.min(8192, Number(e.target.value))))
                  }
                  className="w-24 border border-border bg-background px-2 py-2 text-xs font-sans text-foreground focus:outline-none focus:border-foreground/40"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-sans text-[0.55rem] uppercase tracking-widest text-muted-foreground/60">
                    Temperature
                  </span>
                  <span className="font-mono text-[0.6rem] text-muted-foreground">
                    {temperature.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={temperature}
                  onChange={(e) => setTemperature(Number(e.target.value))}
                  className="w-full accent-cyan-500"
                />
              </div>
            </section>

            {/* Section 3: Tester */}
            <section className="border-t border-border/50 pt-5 space-y-4">
              <p className="font-sans text-[0.5rem] uppercase tracking-[0.3em] text-muted-foreground/50">
                Tester
              </p>

              {/* System preview */}
              {systemBlocks.length > 0 && (
                <div>
                  <button
                    onClick={() => setSystemExpanded((v) => !v)}
                    className="flex items-center gap-2 w-full text-left mb-1"
                  >
                    <ChevronRight
                      className={`w-3 h-3 text-amber-400/60 transition-transform ${systemExpanded ? "rotate-90" : ""}`}
                    />
                    <span className="font-sans text-[0.5rem] uppercase tracking-[0.3em] text-amber-400/60">
                      System Preview
                    </span>
                  </button>
                  {systemExpanded && (
                    <div className="border border-amber-700/30 bg-amber-950/10 px-3 py-2 max-h-40 overflow-y-auto">
                      <pre className="font-mono text-[0.6rem] text-amber-200/70 leading-relaxed whitespace-pre-wrap">
                        {systemBlocks.map((b) => b.content).join("\n\n")}
                      </pre>
                    </div>
                  )}
                </div>
              )}

              {/* Messages preview */}
              {messageBlocks.length > 0 && (
                <div>
                  <button
                    onClick={() => setMessagesExpanded((v) => !v)}
                    className="flex items-center gap-2 w-full text-left mb-1"
                  >
                    <ChevronRight
                      className={`w-3 h-3 text-muted-foreground/50 transition-transform ${messagesExpanded ? "rotate-90" : ""}`}
                    />
                    <span className="font-sans text-[0.5rem] uppercase tracking-[0.3em] text-muted-foreground/50">
                      Messages Preview
                    </span>
                  </button>
                  {messagesExpanded && (
                    <div className="space-y-2">
                      {messageBlocks.map((b) => (
                        <div
                          key={b.id}
                          className={`border px-3 py-2 ${
                            b.kind === "user"
                              ? "border-border bg-background"
                              : "border-cyan-700/30 bg-cyan-950/10"
                          }`}
                        >
                          <p
                            className={`font-sans text-[0.5rem] uppercase tracking-widest mb-1 ${
                              b.kind === "user" ? "text-muted-foreground" : "text-cyan-500"
                            }`}
                          >
                            {b.kind}
                          </p>
                          <p className="font-mono text-[0.65rem] text-foreground/80 leading-relaxed whitespace-pre-wrap line-clamp-4">
                            {b.content || (
                              <span className="italic text-muted-foreground/30">empty</span>
                            )}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Test data instance pickers */}
              {usedTypes.length > 0 && (
                <div className="space-y-2">
                  <p className="font-sans text-[0.5rem] uppercase tracking-[0.3em] text-muted-foreground/50">
                    Test Data
                  </p>
                  {usedTypes.map((type) => {
                    const opts = instanceOptions(type)
                    const selected = testInstances[type]
                      ? String((testInstances[type] as Record<string, unknown>).id)
                      : ""
                    return (
                      <div key={type} className="flex items-center gap-2">
                        <span className="font-sans text-[0.55rem] uppercase tracking-widest text-muted-foreground/60 w-16 shrink-0">
                          {PLACEHOLDER_REGISTRY[type]?.label ?? type}
                        </span>
                        <Select value={selected} onValueChange={(id) => setTestInstance(type, id)}>
                          <SelectTrigger className="flex-1 border-border bg-background text-xs">
                            <SelectValue placeholder="Select…" />
                          </SelectTrigger>
                          <SelectContent>
                            {opts.map((o) => (
                              <SelectItem key={o.id} value={o.id}>
                                {o.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Validation hint */}
              {messageBlocks.length > 0 && lastMessage?.kind !== "user" && (
                <p className="font-sans text-[0.6rem] uppercase tracking-widest text-red-400/70">
                  Last block must be a user message
                </p>
              )}

              {/* Run button */}
              <Button
                onClick={handleRun}
                disabled={!canRun}
                className="w-full bg-foreground text-background hover:bg-foreground/90 uppercase tracking-widest text-xs"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                    Running
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 mr-2" />
                    Run Prompt
                  </>
                )}
              </Button>
              {serverStatus === "offline" && (
                <p className="font-sans text-[0.6rem] uppercase tracking-widest text-red-400/70 text-center">
                  Server offline — start GM server to run
                </p>
              )}

              {/* Response */}
              {result && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-sans text-[0.5rem] uppercase tracking-[0.3em] text-muted-foreground/50">
                      Response
                    </p>
                    {result.usage && (
                      <span className="font-sans text-[0.5rem] uppercase tracking-widest text-muted-foreground/40">
                        {result.usage.input_tokens} in · {result.usage.output_tokens} out
                      </span>
                    )}
                  </div>
                  {result.error ? (
                    <div className="border border-red-700/40 bg-red-950/20 px-3 py-2">
                      <p className="font-mono text-xs text-red-300/80">{result.error}</p>
                    </div>
                  ) : (
                    <div
                      className="border border-border bg-card px-4 py-3 prose prose-sm prose-invert max-w-none
                        prose-p:font-serif prose-p:text-foreground/90 prose-p:leading-relaxed prose-p:text-sm
                        prose-headings:font-sans prose-headings:uppercase prose-headings:tracking-widest prose-headings:text-xs prose-headings:text-muted-foreground
                        prose-strong:text-foreground prose-code:text-cyan-400 prose-code:text-xs
                        prose-li:font-serif prose-li:text-foreground/90 prose-li:text-sm"
                    >
                      <ReactMarkdown>{result.text ?? ""}</ReactMarkdown>
                    </div>
                  )}
                </div>
              )}
            </section>
          </div>
        </aside>
      </div>
    </div>
  )
}
