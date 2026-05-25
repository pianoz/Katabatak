"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ChevronLeft, Play, Plus, X, Loader2 } from "lucide-react"
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
  parsePlaceholders,
  extractUsedTypes,
  PLACEHOLDER_REGISTRY,
} from "@/lib/prompt-placeholders"
import {
  getPromptSlugs,
  getPromptVersions,
  getPromptByVersion,
} from "@/lib/services/prompt-service"
import type { PromptVersionRow, VersionMetaRow, SavedPromptBlock } from "@/lib/services/prompt-service"

// ─── Types ────────────────────────────────────────────────────────────────────

interface SkillRow {
  id: string
  name: string
  skill_text?: string | null
}

interface UserInputBlock {
  id: string
  content: string
}

interface BlockResult {
  blockId: string
  status: "idle" | "running-model" | "running-grader" | "done" | "error"
  modelResponse: string | null
  graderOutput: string | null
  modelUsage?: { input_tokens: number; output_tokens: number }
  graderUsage?: { input_tokens: number; output_tokens: number }
  error?: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MODELS = [
  { value: "claude-sonnet-4-6", label: "Sonnet 4.6" },
  { value: "claude-opus-4-7", label: "Opus 4.7" },
  { value: "claude-haiku-4-5-20251001", label: "Haiku 4.5" },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PromptEvalPage() {
  const router = useRouter()
  const supabase = createClient()

  // DB data for instance pickers
  const [characters, setCharacters] = useState<Character[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [spells, setSpells] = useState<Spell[]>([])
  const [skills, setSkills] = useState<SkillRow[]>([])
  const [dataLoading, setDataLoading] = useState(true)

  // Col 1 — slug / version
  const [slugs, setSlugs] = useState<string[]>([])
  const [selectedSlug, setSelectedSlug] = useState("")
  const [versions, setVersions] = useState<VersionMetaRow[]>([])
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null)
  const [loadedPrompt, setLoadedPrompt] = useState<PromptVersionRow | null>(null)
  const [usedTypes, setUsedTypes] = useState<string[]>([])
  const [testInstances, setTestInstances] = useState<Record<string, Record<string, unknown>>>({})

  // Col 2 — user input blocks
  const [inputBlocks, setInputBlocks] = useState<UserInputBlock[]>([
    { id: crypto.randomUUID(), content: "" },
  ])

  // Col 3 — grader prompt
  const [graderPrompt, setGraderPrompt] = useState("")

  // Col 4 — config + results
  const [model, setModel] = useState("claude-sonnet-4-6")
  const [maxTokens, setMaxTokens] = useState(1024)
  const [temperature, setTemperature] = useState(0.7)
  const [results, setResults] = useState<BlockResult[]>([])
  const [running, setRunning] = useState(false)
  const [serverStatus, setServerStatus] = useState<"unknown" | "online" | "offline">("unknown")
  const [sessionTokens, setSessionTokens] = useState({ input: 0, output: 0 })

  // ─── Init ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push("/"); return }
      const { data: profile } = await supabase
        .from("profiles").select("is_dev").eq("id", user.id).single()
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

      const slugList = await getPromptSlugs(supabase)
      setSlugs(slugList)
      setDataLoading(false)
    }
    init().catch(console.error)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  useEffect(() => {
    fetch("/api/gm/health")
      .then((r) => r.json())
      .then((d: { status: string }) => setServerStatus(d.status === "online" ? "online" : "offline"))
      .catch(() => setServerStatus("offline"))
  }, [])

  // ─── Slug / version loading ────────────────────────────────────────────────

  async function handleSlugSelect(slug: string) {
    setSelectedSlug(slug)
    setLoadedPrompt(null)
    setUsedTypes([])
    setTestInstances({})
    setResults([])

    const vers = await getPromptVersions(supabase, slug)
    setVersions(vers)

    if (vers.length > 0) {
      // vers is sorted descending — first entry is latest
      const latest = vers[0]
      setSelectedVersion(latest.version)
      await loadVersion(slug, latest.version)
    }
  }

  async function handleVersionSelect(versionStr: string) {
    const version = Number(versionStr)
    setSelectedVersion(version)
    setResults([])
    await loadVersion(selectedSlug, version)
  }

  async function loadVersion(slug: string, version: number) {
    const row = await getPromptByVersion(supabase, slug, version)
    if (!row) return
    setLoadedPrompt(row)
    setUsedTypes(extractUsedTypes(row.prompt.blocks))
    setTestInstances({})
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
    if (!instanceId) {
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

  // ─── Input block ops ───────────────────────────────────────────────────────

  function addInputBlock() {
    setInputBlocks((prev) => [...prev, { id: crypto.randomUUID(), content: "" }])
  }

  function removeInputBlock(id: string) {
    setInputBlocks((prev) => prev.filter((b) => b.id !== id))
    setResults((prev) => prev.filter((r) => r.blockId !== id))
  }

  function updateInputBlock(id: string, content: string) {
    setInputBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, content } : b)))
  }

  // ─── Run ──────────────────────────────────────────────────────────────────

  async function handleRun() {
    if (!loadedPrompt) return
    const activeBlocks = inputBlocks.filter((b) => b.content.trim())
    if (activeBlocks.length === 0) return

    const { blocks } = loadedPrompt.prompt
    const systemParts = blocks
      .filter((b: SavedPromptBlock) => b.kind === "system")
      .map((b: SavedPromptBlock) => parsePlaceholders(b.content, testInstances))
    const system = systemParts.join("\n\n") || undefined

    const contextMessages = blocks
      .filter((b: SavedPromptBlock) => b.kind !== "system")
      .map((b: SavedPromptBlock) => ({
        role: b.kind as "user" | "assistant",
        content: parsePlaceholders(b.content, testInstances),
      }))

    setResults(activeBlocks.map((b) => ({
      blockId: b.id,
      status: "idle",
      modelResponse: null,
      graderOutput: null,
    })))
    setRunning(true)

    for (const block of activeBlocks) {
      // Run the loaded prompt + this user input through the main model
      setResults((prev) => prev.map((r) =>
        r.blockId === block.id ? { ...r, status: "running-model" } : r
      ))

      try {
        const messages = [...contextMessages, { role: "user", content: block.content }]
        const evalRes = await fetch("/api/gm/eval", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages, system, model, maxTokens, temperature }),
        })
        const evalData = (await evalRes.json()) as { text?: string; usage?: { input_tokens: number; output_tokens: number }; error?: string }

        if (!evalRes.ok) {
          setResults((prev) => prev.map((r) =>
            r.blockId === block.id ? { ...r, status: "error", error: evalData.error ?? "Model call failed" } : r
          ))
          continue
        }

        const modelResponse = evalData.text ?? ""
        setResults((prev) => prev.map((r) =>
          r.blockId === block.id ? { ...r, modelResponse, modelUsage: evalData.usage } : r
        ))
        if (evalData.usage) {
          setSessionTokens((prev) => ({
            input: prev.input + evalData.usage!.input_tokens,
            output: prev.output + evalData.usage!.output_tokens,
          }))
        }

        if (!graderPrompt.trim()) {
          setResults((prev) => prev.map((r) =>
            r.blockId === block.id ? { ...r, status: "done" } : r
          ))
          continue
        }

        // Run grader: receives the user input + model response
        setResults((prev) => prev.map((r) =>
          r.blockId === block.id ? { ...r, status: "running-grader" } : r
        ))

        const graderMessages = [{
          role: "user" as const,
          content: `<user_input>\n${block.content}\n</user_input>\n\n<model_response>\n${modelResponse}\n</model_response>`,
        }]
        const graderRes = await fetch("/api/gm/eval", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: graderMessages,
            system: graderPrompt,
            model,
            maxTokens,
            temperature,
          }),
        })
        const graderData = (await graderRes.json()) as { text?: string; usage?: { input_tokens: number; output_tokens: number }; error?: string }

        setResults((prev) => prev.map((r) =>
          r.blockId === block.id
            ? {
                ...r,
                status: graderRes.ok ? "done" : "error",
                graderOutput: graderData.text ?? null,
                graderUsage: graderData.usage,
                error: graderRes.ok ? undefined : (graderData.error ?? "Grader call failed"),
              }
            : r
        ))
        if (graderRes.ok && graderData.usage) {
          setSessionTokens((prev) => ({
            input: prev.input + graderData.usage!.input_tokens,
            output: prev.output + graderData.usage!.output_tokens,
          }))
        }
      } catch {
        setResults((prev) => prev.map((r) =>
          r.blockId === block.id ? { ...r, status: "error", error: "Network error" } : r
        ))
      }
    }

    setRunning(false)
  }

  // ─── Derived ──────────────────────────────────────────────────────────────

  const canRun =
    !running &&
    serverStatus !== "offline" &&
    !!loadedPrompt &&
    inputBlocks.some((b) => b.content.trim())

  // ─── Loading ──────────────────────────────────────────────────────────────

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
              Prompt Evaluator
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {sessionTokens.input > 0 && (
              <span className="font-mono text-[0.5rem] uppercase tracking-widest border border-border/50 text-muted-foreground/50 px-2 py-0.5">
                {sessionTokens.input.toLocaleString()} in · {sessionTokens.output.toLocaleString()} out
              </span>
            )}
            {serverStatus !== "unknown" && (
              <span className={`font-sans text-[0.55rem] uppercase tracking-widest border px-2 py-0.5 ${
                serverStatus === "online"
                  ? "border-cyan-700/50 text-cyan-400"
                  : "border-red-700/50 text-red-400"
              }`}>
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

      {/* 4-column body */}
      <div className="flex flex-1 overflow-hidden min-h-0">

        {/* ── COL 1: Slug / version / data pickers ─────────────────────── */}
        <aside className="w-56 shrink-0 border-r border-border overflow-y-auto bg-card/30 p-4 space-y-5">

          {/* Slug selector */}
          <div className="space-y-3">
            <p className="font-sans text-[0.5rem] uppercase tracking-[0.3em] text-muted-foreground/50">
              Prompt
            </p>
            <div className="space-y-1.5">
              <label className="block font-sans text-[0.55rem] uppercase tracking-widest text-muted-foreground/60">
                Slug
              </label>
              <Select value={selectedSlug} onValueChange={handleSlugSelect}>
                <SelectTrigger className="w-full border-border bg-background text-xs">
                  <SelectValue placeholder="Select slug…" />
                </SelectTrigger>
                <SelectContent>
                  {slugs.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-muted-foreground italic">
                      No saved prompts
                    </div>
                  ) : (
                    slugs.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Version selector — only shown after slug is picked */}
            {versions.length > 0 && selectedVersion !== null && (
              <div className="space-y-1.5">
                <label className="block font-sans text-[0.55rem] uppercase tracking-widest text-muted-foreground/60">
                  Version
                </label>
                <Select value={String(selectedVersion)} onValueChange={handleVersionSelect}>
                  <SelectTrigger className="w-full border-border bg-background text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {versions.map((v) => (
                      <SelectItem key={v.version} value={String(v.version)}>
                        v{v.version} — {v.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Loaded prompt summary */}
            {loadedPrompt && (
              <div className="border border-border/40 px-3 py-2 bg-background/40 space-y-0.5">
                <p className="font-sans text-[0.45rem] uppercase tracking-[0.3em] text-muted-foreground/40">
                  Loaded
                </p>
                <p className="font-mono text-[0.65rem] text-foreground/70 truncate">
                  {loadedPrompt.name}
                </p>
                <p className="font-sans text-[0.45rem] uppercase tracking-widest text-muted-foreground/40">
                  {loadedPrompt.prompt.blocks.length} blocks
                </p>
              </div>
            )}
          </div>

          {/* Data type pickers — shown when prompt uses placeholder types */}
          {usedTypes.length > 0 && (
            <div className="space-y-3 border-t border-border/40 pt-4">
              <p className="font-sans text-[0.5rem] uppercase tracking-[0.3em] text-muted-foreground/50">
                Test Data
              </p>
              {usedTypes.map((type) => {
                const opts = instanceOptions(type)
                const selectedId = testInstances[type]
                  ? String((testInstances[type] as Record<string, unknown>).id)
                  : ""
                return (
                  <div key={type} className="space-y-1.5">
                    <label className="block font-sans text-[0.55rem] uppercase tracking-widest text-muted-foreground/60">
                      {PLACEHOLDER_REGISTRY[type]?.label ?? type}
                    </label>
                    <Select value={selectedId} onValueChange={(id) => setTestInstance(type, id)}>
                      <SelectTrigger className="w-full border-border bg-background text-xs">
                        <SelectValue placeholder="Select…" />
                      </SelectTrigger>
                      <SelectContent>
                        {opts.map((o) => (
                          <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )
              })}
            </div>
          )}
        </aside>

        {/* ── COL 2: User input blocks ──────────────────────────────────── */}
        <main className="flex-1 flex flex-col overflow-hidden min-w-0 border-r border-border">
          <div className="shrink-0 border-b border-border px-4 py-2 flex items-center justify-between bg-background/95 backdrop-blur">
            <span className="font-sans text-[0.5rem] uppercase tracking-[0.3em] text-muted-foreground/50">
              User Inputs
            </span>
            <button
              onClick={addInputBlock}
              className="flex items-center gap-1 border border-border px-2 py-1 font-sans text-[0.55rem] uppercase tracking-widest text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
            >
              <Plus className="w-2.5 h-2.5" />
              Add Block
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {inputBlocks.map((block, idx) => {
              const result = results.find((r) => r.blockId === block.id)
              return (
                <div key={block.id} className="border border-border bg-background">
                  <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
                    <span className="font-sans text-[0.55rem] uppercase tracking-widest text-muted-foreground/60 flex-1">
                      Input {idx + 1}
                    </span>
                    {result?.status === "running-model" && (
                      <span className="flex items-center gap-1 font-sans text-[0.5rem] uppercase tracking-widest text-amber-400">
                        <Loader2 className="w-2.5 h-2.5 animate-spin" />
                        Model
                      </span>
                    )}
                    {result?.status === "running-grader" && (
                      <span className="flex items-center gap-1 font-sans text-[0.5rem] uppercase tracking-widest text-cyan-400">
                        <Loader2 className="w-2.5 h-2.5 animate-spin" />
                        Grading
                      </span>
                    )}
                    {result?.status === "done" && (
                      <span className="font-sans text-[0.5rem] uppercase tracking-widest text-green-500">
                        Done
                      </span>
                    )}
                    {result?.status === "error" && (
                      <span className="font-sans text-[0.5rem] uppercase tracking-widest text-red-400">
                        Error
                      </span>
                    )}
                    {inputBlocks.length > 1 && (
                      <button
                        onClick={() => removeInputBlock(block.id)}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="p-3">
                    <Textarea
                      value={block.content}
                      onChange={(e) => updateInputBlock(block.id, e.target.value)}
                      placeholder="Enter user input for this test case…"
                      className="min-h-24 resize-y font-mono text-xs border-0 bg-transparent p-0 focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/40"
                    />
                  </div>
                  {/* Model response preview under the input */}
                  {result?.modelResponse && (
                    <div className="border-t border-border/40 px-3 py-2 bg-cyan-950/10">
                      <p className="font-sans text-[0.45rem] uppercase tracking-[0.3em] text-cyan-400/60 mb-1">
                        Model Response
                      </p>
                      <p className="font-mono text-[0.6rem] text-foreground/70 line-clamp-4 whitespace-pre-wrap">
                        {result.modelResponse}
                      </p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </main>

        {/* ── COL 3: Grader prompt ──────────────────────────────────────── */}
        <aside className="w-64 shrink-0 border-r border-border flex flex-col bg-card/20 p-4">
          <p className="font-sans text-[0.5rem] uppercase tracking-[0.3em] text-muted-foreground/50 mb-2 shrink-0">
            Grader Prompt
          </p>
          <p className="font-sans text-[0.5rem] italic text-muted-foreground/40 leading-relaxed mb-3 shrink-0">
            System prompt for the grader model. Receives each user input + model response as context.
          </p>
          <Textarea
            value={graderPrompt}
            onChange={(e) => setGraderPrompt(e.target.value)}
            placeholder="You are an expert evaluator. Given the user input and model response, rate the response and explain your reasoning…"
            className="flex-1 resize-none font-mono text-xs border-border bg-background"
          />
        </aside>

        {/* ── COL 4: Config + Run + Results ────────────────────────────── */}
        <aside className="w-72 shrink-0 overflow-y-auto bg-card/20 p-4 space-y-5">

          {/* Config */}
          <section className="space-y-3">
            <p className="font-sans text-[0.5rem] uppercase tracking-[0.3em] text-muted-foreground/50">
              Config
            </p>
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger className="w-full border-border bg-background text-xs uppercase tracking-wider">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODELS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div>
              <label className="block font-sans text-[0.5rem] uppercase tracking-widest text-muted-foreground/50 mb-1">
                Max Tokens
              </label>
              <input
                type="number"
                min={64}
                max={8192}
                step={64}
                value={maxTokens}
                onChange={(e) => setMaxTokens(Math.max(64, Math.min(8192, Number(e.target.value))))}
                className="w-full border border-border bg-background px-2 py-1.5 text-xs font-sans text-foreground focus:outline-none focus:border-foreground/40"
              />
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-sans text-[0.5rem] uppercase tracking-widest text-muted-foreground/50">
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

          {/* Run */}
          <section className="border-t border-border/50 pt-4 space-y-2">
            {!loadedPrompt && (
              <p className="font-sans text-[0.55rem] uppercase tracking-widest text-muted-foreground/40">
                Load a prompt slug first
              </p>
            )}
            <Button
              onClick={handleRun}
              disabled={!canRun}
              className="w-full bg-foreground text-background hover:bg-foreground/90 uppercase tracking-widest text-xs"
            >
              {running ? (
                <><Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> Running</>
              ) : (
                <><Play className="w-3.5 h-3.5 mr-2" /> Run Eval</>
              )}
            </Button>
            {serverStatus === "offline" && (
              <p className="font-sans text-[0.6rem] uppercase tracking-widest text-red-400/70 text-center">
                Server offline
              </p>
            )}
          </section>

          {/* Grader output per block */}
          {results.length > 0 && (
            <section className="border-t border-border/50 pt-4 space-y-5">
              <p className="font-sans text-[0.5rem] uppercase tracking-[0.3em] text-muted-foreground/50">
                Grader Output
              </p>
              {results.map((result, idx) => (
                <div key={result.blockId} className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-sans text-[0.5rem] uppercase tracking-widest text-muted-foreground/50">
                      Input {idx + 1}
                    </span>
                    {(result.modelUsage ?? result.graderUsage) && (
                      <span className="font-sans text-[0.45rem] uppercase tracking-widest text-muted-foreground/30">
                        {result.modelUsage && `${result.modelUsage.input_tokens}↑${result.modelUsage.output_tokens}↓`}
                        {result.graderUsage && ` · ${result.graderUsage.input_tokens}↑${result.graderUsage.output_tokens}↓`}
                      </span>
                    )}
                  </div>

                  {(result.status === "idle" || result.status === "running-model") && (
                    <div className="border border-border/30 px-3 py-2">
                      <p className="font-sans text-[0.55rem] uppercase tracking-widest text-muted-foreground/30 italic">
                        {result.status === "running-model" ? "Running model…" : "Pending"}
                      </p>
                    </div>
                  )}

                  {result.status === "running-grader" && (
                    <div className="border border-border/30 px-3 py-2">
                      <p className="flex items-center gap-1 font-sans text-[0.55rem] uppercase tracking-widest text-cyan-400/70">
                        <Loader2 className="w-2.5 h-2.5 animate-spin" />
                        Grading…
                      </p>
                    </div>
                  )}

                  {result.status === "error" && (
                    <div className="border border-red-700/40 bg-red-950/20 px-3 py-2">
                      <p className="font-mono text-xs text-red-300/80">{result.error}</p>
                    </div>
                  )}

                  {result.status === "done" && result.graderOutput && (
                    <div className="border border-border bg-card px-3 py-2 prose prose-sm prose-invert max-w-none
                      prose-p:font-serif prose-p:text-foreground/90 prose-p:leading-relaxed prose-p:text-xs
                      prose-headings:font-sans prose-headings:uppercase prose-headings:tracking-widest prose-headings:text-[0.6rem] prose-headings:text-muted-foreground
                      prose-strong:text-foreground prose-code:text-cyan-400 prose-code:text-xs
                      prose-li:font-serif prose-li:text-foreground/90 prose-li:text-xs">
                      <ReactMarkdown>{result.graderOutput}</ReactMarkdown>
                    </div>
                  )}

                  {result.status === "done" && !result.graderOutput && (
                    <div className="border border-border/30 px-3 py-2">
                      <p className="font-sans text-[0.55rem] uppercase tracking-widest text-muted-foreground/40 italic">
                        No grader prompt — see model response in block
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </section>
          )}
        </aside>

      </div>
    </div>
  )
}
