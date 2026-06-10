"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ChevronLeft, Play, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import {
  AGENT_CONFIGS,
  AGENT_SLUGS,
  type AgentSlug,
  type BlockDef,
} from "@/lib/graders/agent-config"
import {
  gradeOutput,
  type ExpectedOutput,
  type CodeGradeResult,
} from "@/lib/graders/code-grader"
import {
  hydrateBlock,
  runAgentEval,
  runModelGrader,
  type ModelGradeResult,
} from "@/lib/services/grader-service"
import {
  getPromptVersions,
  getPromptByVersion,
  getLatestEvaluatorPrompt,
  type VersionMetaRow,
  type PromptVersionRow,
  type SavedPromptBlock,
} from "@/lib/services/prompt-service"

import { AgentSelector } from "@/components/dev/grader/AgentSelector"
import { CharacterSelector } from "@/components/dev/grader/CharacterSelector"
import {
  BlockSequenceViewer,
  type HydratedBlock,
  type BlockStatus,
} from "@/components/dev/grader/BlockSequenceViewer"
import {
  TestCaseEditor,
  type TestCase,
  type TestCaseResult,
  type TestCaseStatus,
} from "@/components/dev/grader/TestCaseEditor"

// ─── Types ─────────────────────────────────────────────────────────────────────

interface CharacterOption {
  id: string
  name: string
}

interface RunLogEntry {
  timestamp: string
  agentSlug: string
  agentVersion: number | null
  characterName: string
  cases: Array<{
    index: number
    codeGrade: CodeGradeResult | null
    modelScore: number | null
    modelReview: string | null
    agentTokens: { input_tokens: number; output_tokens: number } | null
    graderTokens: { input_tokens: number; output_tokens: number } | null
  }>
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeDefaultExpected(slug: AgentSlug | ""): ExpectedOutput {
  if (!slug) return { kind: "none" }
  const kind = AGENT_CONFIGS[slug as AgentSlug]?.expectedOutputKind ?? "none"
  if (kind === "lore-engine") return { kind: "lore-engine", value: {} }
  if (kind === "ledger") return { kind: "ledger", value: { actions: [] } }
  if (kind === "scribe") return {
    kind: "scribe",
    value: { has_summary: true, has_objectives_array: true, has_completed_ids_array: true },
  }
  if (kind === "character-creator") return { kind: "character-creator" }
  return { kind: "none" }
}

function makeTestCase(slug: AgentSlug | ""): TestCase {
  return { id: crypto.randomUUID(), userInput: "", expectedOutput: makeDefaultExpected(slug) }
}

function formatTimestamp(): string {
  return new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function PromptEvalPage() {
  const router = useRouter()
  const supabase = createClient()

  // Auth / data
  const [characters, setCharacters] = useState<CharacterOption[]>([])
  const [dataLoading, setDataLoading] = useState(true)
  const [dbSlugs, setDbSlugs] = useState<string[]>([])
  const [serverStatus, setServerStatus] = useState<"unknown" | "online" | "offline">("unknown")

  // Col 1 — agent / version / character / blocks
  const [selectedSlug, setSelectedSlug] = useState<AgentSlug | "">("")
  const [versions, setVersions] = useState<VersionMetaRow[]>([])
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null)
  const [loadedPrompt, setLoadedPrompt] = useState<PromptVersionRow | null>(null)
  const [evaluatorPrompt, setEvaluatorPrompt] = useState<string | null>(null)
  const [selectedCharacterId, setSelectedCharacterId] = useState("")
  const [hydratedBlocks, setHydratedBlocks] = useState<HydratedBlock[]>([])

  // Col 2 — test cases
  const [testCases, setTestCases] = useState<TestCase[]>([makeTestCase("")])

  // Col 3 — results + run log
  const [results, setResults] = useState<TestCaseResult[]>([])
  const [running, setRunning] = useState(false)
  const [sessionTokens, setSessionTokens] = useState({ input: 0, output: 0 })
  const [runLog, setRunLog] = useState<RunLogEntry[]>([])

  // Col resize
  const [col1Width, setCol1Width] = useState(336)
  const [col3Width, setCol3Width] = useState(368)
  const dragRef = useRef<{ col: 1 | 3; startX: number; startW: number } | null>(null)

  // ─── Init ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push("/"); return }
      const { data: profile } = await supabase
        .from("profiles").select("is_dev").eq("id", user.id).single()
      if (!profile?.is_dev) { router.push("/dashboard"); return }

      const { data: chars } = await supabase
        .from("characters").select("id, name").eq("user_id", user.id).eq("ai_game", true).order("name")
      setCharacters((chars ?? []) as CharacterOption[])

      // Fetch DB slugs to surface any prompt not in static list
      const { data: slugRows } = await supabase
        .from("prompt_versions").select("slug").order("slug")
      const seen = new Set<string>()
      const slugList: string[] = []
      for (const r of (slugRows ?? [])) {
        if (!seen.has(r.slug)) { seen.add(r.slug); slugList.push(r.slug) }
      }
      setDbSlugs(slugList)
      setDataLoading(false)
    }
    init().catch(console.error)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!dragRef.current) return
      const delta = e.clientX - dragRef.current.startX
      const next = Math.max(180, Math.min(700, dragRef.current.startW + (dragRef.current.col === 1 ? delta : -delta)))
      if (dragRef.current.col === 1) setCol1Width(next)
      else setCol3Width(next)
    }
    function onMouseUp() { dragRef.current = null }
    document.addEventListener("mousemove", onMouseMove)
    document.addEventListener("mouseup", onMouseUp)
    return () => {
      document.removeEventListener("mousemove", onMouseMove)
      document.removeEventListener("mouseup", onMouseUp)
    }
  }, [])

  useEffect(() => {
    fetch("/api/gm/health")
      .then((r) => r.json())
      .then((d: { status: string }) => setServerStatus(d.status === "online" ? "online" : "offline"))
      .catch(() => setServerStatus("offline"))
  }, [])

  // ─── Agent / version selection ─────────────────────────────────────────────

  async function handleSlugChange(slug: AgentSlug) {
    setSelectedSlug(slug)
    setLoadedPrompt(null)
    setEvaluatorPrompt(null)
    setHydratedBlocks([])
    setResults([])
    setTestCases([makeTestCase(slug)])

    const [vers, evalPrompt] = await Promise.all([
      getPromptVersions(supabase, slug),
      getLatestEvaluatorPrompt(supabase, slug),
    ])
    setVersions(vers)
    setEvaluatorPrompt(evalPrompt)

    let row: PromptVersionRow | null = null
    if (vers.length > 0) {
      setSelectedVersion(vers[0].version)
      row = await getPromptByVersion(supabase, slug, vers[0].version)
      setLoadedPrompt(row)
    } else {
      setSelectedVersion(null)
    }

    // Re-hydrate context blocks if character is already selected
    if (selectedCharacterId) {
      await hydrateContextBlocks(slug, selectedCharacterId, row)
    }
  }

  async function handleVersionChange(version: number) {
    setSelectedVersion(version)
    setResults([])
    const row = await getPromptByVersion(supabase, selectedSlug as string, version)
    setLoadedPrompt(row)
    if (selectedSlug && selectedCharacterId) {
      await hydrateContextBlocks(selectedSlug, selectedCharacterId, row)
    }
  }

  // ─── Context hydration ─────────────────────────────────────────────────────

  const hydrateContextBlocks = useCallback(async (slug: AgentSlug | "", characterId: string, promptRow?: PromptVersionRow | null) => {
    if (!slug || !characterId) return
    const config = AGENT_CONFIGS[slug as AgentSlug]
    if (!config) return

    // Any block with hydrateTables needs a character fetch; system blocks without hydrateTables get content from the loaded prompt
    const blocksNeedingFetch = config.blocks.filter((b: BlockDef) => b.hydrateTables && b.hydrateTables.length > 0)
    const systemPromptBlocks = config.blocks.filter((b: BlockDef) => b.kind === "system" && (!b.hydrateTables || b.hydrateTables.length === 0))

    // Seed system prompt blocks from loadedPrompt immediately (no fetch needed)
    const systemEntries: HydratedBlock[] = systemPromptBlocks.map((b) => {
      const savedBlocks = (promptRow?.prompt.blocks ?? []).filter((pb: SavedPromptBlock) => pb.kind === "system")
      const content = savedBlocks.map((pb: SavedPromptBlock) => pb.content).join("\n\n").trim() || null
      return { blockId: b.id, status: (content ? "loaded" : "empty") as BlockStatus, content }
    })

    // Set fetchable blocks to loading
    setHydratedBlocks([
      ...systemEntries,
      ...blocksNeedingFetch.map((b) => ({ blockId: b.id, status: "loading" as BlockStatus, content: null })),
    ])

    const fetchedEntries: HydratedBlock[] = await Promise.all(
      blocksNeedingFetch.map(async (block) => {
        const tables = block.hydrateTables ?? []
        const text = await hydrateBlock(characterId, tables)
        return {
          blockId: block.id,
          status: (text ? "loaded" : block.optional ? "placeholder" : "empty") as BlockStatus,
          content: text,
        }
      })
    )

    setHydratedBlocks([...systemEntries, ...fetchedEntries])
  }, [])

  async function handleCharacterSelect(characterId: string) {
    setSelectedCharacterId(characterId)
    setResults([])
    if (selectedSlug) {
      await hydrateContextBlocks(selectedSlug, characterId, loadedPrompt)
    }
  }

  // ─── Test case ops ─────────────────────────────────────────────────────────

  function addCase() {
    setTestCases((prev) => [...prev, makeTestCase(selectedSlug)])
  }

  function removeCase(id: string) {
    setTestCases((prev) => prev.filter((c) => c.id !== id))
    setResults((prev) => prev.filter((r) => r.caseId !== id))
  }

  function updateInput(id: string, value: string) {
    setTestCases((prev) => prev.map((c) => (c.id === id ? { ...c, userInput: value } : c)))
  }

  function updateExpected(id: string, value: ExpectedOutput) {
    setTestCases((prev) =>
      prev.map((c) => (c.id === id ? { ...c, expectedOutput: value } : c))
    )
  }

  function setResultField(caseId: string, patch: Partial<TestCaseResult>) {
    setResults((prev) =>
      prev.map((r) => (r.caseId === caseId ? { ...r, ...patch } : r))
    )
  }

  // ─── Run ──────────────────────────────────────────────────────────────────

  async function handleRun() {
    if (!selectedSlug) return
    const config = AGENT_CONFIGS[selectedSlug as AgentSlug]
    if (!config) return

    const activeCases = testCases.filter((c) => c.userInput.trim())
    if (activeCases.length === 0) return

    // Build system prompt from loaded blocks
    const systemBlocks: SavedPromptBlock[] = (loadedPrompt?.prompt.blocks ?? []).filter(
      (b: SavedPromptBlock) => b.kind === "system"
    )
    const system = systemBlocks.map((b: SavedPromptBlock) => b.content).join("\n\n")

    // Build context message from hydrated context blocks
    const contextContent = hydratedBlocks
      .filter((h) => h.status === "loaded" && h.content)
      .map((h) => h.content!)
      .join("\n\n")

    // Reset results
    setResults(
      activeCases.map((c) => ({
        caseId: c.id,
        status: "idle" as TestCaseStatus,
        modelResponse: null,
        codeGrade: null,
        modelGrade: null,
      }))
    )
    setRunning(true)

    const logEntry: RunLogEntry = {
      timestamp: formatTimestamp(),
      agentSlug: selectedSlug,
      agentVersion: selectedVersion,
      characterName: characters.find((c) => c.id === selectedCharacterId)?.name ?? "(no character)",
      cases: [],
    }

    for (const tc of activeCases) {
      setResultField(tc.id, { status: "running-agent" })

      try {
        // Assemble messages: context block + history placeholder + user input
        const messages = [
          ...(contextContent
            ? [{ role: "user" as const, content: contextContent }]
            : []),
          {
            role: "user" as const,
            content: [
              contextContent ? "" : null,
              "=== RECENT HISTORY ===",
              "(no prior turns)",
              "",
              `=== ${config.userInputLabel.toUpperCase()} ===`,
              tc.userInput,
            ]
              .filter((l) => l !== null)
              .join("\n"),
          },
        ].filter((m) => m.content.trim())

        // If no context, just send user input directly
        const evalMessages =
          contextContent
            ? [
                { role: "user" as const, content: contextContent },
                {
                  role: "user" as const,
                  content: `=== RECENT HISTORY ===\n(no prior turns)\n\n=== ${config.userInputLabel.toUpperCase()} ===\n${tc.userInput}`,
                },
              ]
            : [{ role: "user" as const, content: tc.userInput }]

        const agentResult = await runAgentEval(system, evalMessages, config)

        addTokens(agentResult.usage)
        setResultField(tc.id, {
          modelResponse: agentResult.text,
          agentUsage: agentResult.usage,
          status: "running-grader",
        })

        // Code grading
        const codeGrade =
          config.producesJson
            ? gradeOutput(agentResult.text, tc.expectedOutput, selectedSlug as AgentSlug)
            : null

        // Model grading (mandatory, all agents)
        const modelGrade = await runModelGrader(selectedSlug, tc.userInput, agentResult.text, evaluatorPrompt)
        addTokens(modelGrade.usage)

        setResultField(tc.id, {
          codeGrade,
          modelGrade,
          status: "done",
        })

        logEntry.cases.push({
          index: activeCases.indexOf(tc) + 1,
          codeGrade,
          modelScore: modelGrade.score,
          modelReview: modelGrade.review,
          agentTokens: agentResult.usage,
          graderTokens: modelGrade.usage,
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        setResultField(tc.id, { status: "error", error: msg })
        logEntry.cases.push({
          index: activeCases.indexOf(tc) + 1,
          codeGrade: null,
          modelScore: null,
          modelReview: null,
          agentTokens: null,
          graderTokens: null,
        })
      }
    }

    setRunLog((prev) => [logEntry, ...prev])
    setRunning(false)
  }

  function addTokens(usage: { input_tokens: number; output_tokens: number }) {
    setSessionTokens((prev) => ({
      input: prev.input + usage.input_tokens,
      output: prev.output + usage.output_tokens,
    }))
  }

  // ─── Derived ──────────────────────────────────────────────────────────────

  const config = selectedSlug ? AGENT_CONFIGS[selectedSlug as AgentSlug] : null

  const hasEmptyRequired = hydratedBlocks.some((h) => h.status === "empty")

  const canRun =
    !running &&
    serverStatus !== "offline" &&
    !!selectedSlug &&
    !hasEmptyRequired &&
    testCases.some((c) => c.userInput.trim())

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
              Agent Grader
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

      {/* 3-column body */}
      <div className="flex flex-1 overflow-hidden min-h-0">

        {/* ── COL 1: Agent + blocks ─────────────────────────────────────── */}
        <aside style={{ width: col1Width }} className="shrink-0 overflow-y-auto bg-card/30 p-4 space-y-5">
          <AgentSelector
            selectedSlug={selectedSlug}
            onSlugChange={handleSlugChange}
            versions={versions}
            selectedVersion={selectedVersion}
            onVersionChange={handleVersionChange}
            dbSlugs={dbSlugs}
          />

          {selectedSlug && (
            <div className="border-t border-border/40 pt-4 space-y-3">
              <CharacterSelector
                characters={characters}
                selectedId={selectedCharacterId}
                onSelect={handleCharacterSelect}
              />

              {hasEmptyRequired && (
                <div className="border border-red-700/40 bg-red-950/20 px-2.5 py-2">
                  <p className="font-sans text-[0.5rem] uppercase tracking-widest text-red-400">
                    Required context block returned empty
                  </p>
                </div>
              )}
            </div>
          )}

          {selectedSlug && config && (
            <div className="border-t border-border/40 pt-4">
              <BlockSequenceViewer
                blocks={config.blocks}
                hydratedBlocks={hydratedBlocks}
              />
            </div>
          )}
        </aside>

        {/* drag handle col1 */}
        <div
          className="w-1 shrink-0 cursor-col-resize bg-border/50 hover:bg-cyan-500/50 transition-colors"
          onMouseDown={(e) => { e.preventDefault(); dragRef.current = { col: 1, startX: e.clientX, startW: col1Width } }}
        />

        {/* ── COL 2: Test cases ─────────────────────────────────────────── */}
        <main className="flex-1 flex flex-col overflow-hidden min-w-0">
          {selectedSlug && config ? (
            <TestCaseEditor
              cases={testCases}
              results={results}
              expectedOutputKind={config.expectedOutputKind}
              agentProducesJson={config.producesJson}
              userInputLabel={config.userInputLabel}
              userInputPlaceholder={config.userInputPlaceholder}
              onAdd={addCase}
              onRemove={removeCase}
              onUpdateInput={updateInput}
              onUpdateExpected={updateExpected}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <p className="font-serif text-muted-foreground/40 italic text-sm">
                Select an agent to begin
              </p>
            </div>
          )}
        </main>

        {/* drag handle col3 */}
        <div
          className="w-1 shrink-0 cursor-col-resize bg-border/50 hover:bg-cyan-500/50 transition-colors"
          onMouseDown={(e) => { e.preventDefault(); dragRef.current = { col: 3, startX: e.clientX, startW: col3Width } }}
        />

        {/* ── COL 3: Run + Log ──────────────────────────────────────────── */}
        <aside style={{ width: col3Width }} className="shrink-0 overflow-y-auto bg-card/20 p-4 space-y-5">

          {/* Agent config (read-only) */}
          {config && (
            <section className="space-y-2">
              <p className="font-sans text-[0.5rem] uppercase tracking-[0.3em] text-muted-foreground/50">
                Agent Config
              </p>
              <div className="border border-border/30 px-3 py-2 bg-background/30 space-y-1">
                <p className="font-mono text-[0.6rem] text-foreground/60">{config.model}</p>
                <p className="font-mono text-[0.55rem] text-muted-foreground/50">
                  {config.maxTokens} max tokens · t={config.temperature}
                </p>
                <p className="font-sans text-[0.5rem] uppercase tracking-widest text-muted-foreground/40">
                  Grader: Haiku 4.5 · 200 tokens
                </p>
              </div>
            </section>
          )}

          {/* Run */}
          <section className="border-t border-border/50 pt-4 space-y-2">
            {!selectedSlug && (
              <p className="font-sans text-[0.55rem] uppercase tracking-widest text-muted-foreground/40">
                Select an agent first
              </p>
            )}
            {hasEmptyRequired && (
              <p className="font-sans text-[0.55rem] uppercase tracking-widest text-red-400/70">
                Fix empty context blocks
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
                <><Play className="w-3.5 h-3.5 mr-2" /> Run All Tests</>
              )}
            </Button>
            {serverStatus === "offline" && (
              <p className="font-sans text-[0.6rem] uppercase tracking-widest text-red-400/70 text-center">
                GM Server offline
              </p>
            )}
          </section>

          {/* Run log */}
          {runLog.length > 0 && (
            <section className="border-t border-border/50 pt-4 space-y-4">
              <p className="font-sans text-[0.5rem] uppercase tracking-[0.3em] text-muted-foreground/50">
                Run Log
              </p>
              {runLog.map((entry, entryIdx) => (
                <div key={entryIdx} className="border border-border/30 bg-background/20 p-3 space-y-2">
                  {/* Entry header */}
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[0.5rem] text-muted-foreground/40">
                        {entry.timestamp}
                      </span>
                    </div>
                    <p className="font-sans text-[0.55rem] uppercase tracking-widest text-foreground/70">
                      {entry.agentSlug}
                      {entry.agentVersion !== null && (
                        <span className="text-muted-foreground/40 ml-1">v{entry.agentVersion}</span>
                      )}
                    </p>
                    <p className="font-serif text-[0.6rem] text-muted-foreground/50 italic">
                      {entry.characterName}
                    </p>
                  </div>

                  {/* Per-case summary */}
                  {entry.cases.map((c) => (
                    <div key={c.index} className="border-t border-border/20 pt-2 space-y-1">
                      <p className="font-sans text-[0.5rem] uppercase tracking-widest text-muted-foreground/50">
                        Test {c.index}
                      </p>

                      <div className="flex items-center gap-3">
                        {c.codeGrade && c.codeGrade.total > 0 && (
                          <span className={`font-mono text-[0.6rem] ${
                            c.codeGrade.passed === c.codeGrade.total ? "text-green-400" : "text-amber-400"
                          }`}>
                            Code {c.codeGrade.passed}/{c.codeGrade.total}
                          </span>
                        )}
                        {c.modelScore !== null && (
                          <span className={`font-mono text-[0.6rem] ${
                            c.modelScore >= 80 ? "text-green-400" :
                            c.modelScore >= 60 ? "text-amber-400" : "text-red-400"
                          }`}>
                            Model {c.modelScore}/100
                          </span>
                        )}
                        {c.agentTokens && (
                          <span className="font-mono text-[0.45rem] text-muted-foreground/30">
                            {c.agentTokens.input_tokens + (c.graderTokens?.input_tokens ?? 0)}↑
                            {c.agentTokens.output_tokens + (c.graderTokens?.output_tokens ?? 0)}↓
                          </span>
                        )}
                      </div>

                      {c.modelReview && (
                        <p className="font-serif text-[0.55rem] text-foreground/60 leading-relaxed line-clamp-2">
                          {c.modelReview}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </section>
          )}
        </aside>

      </div>
    </div>
  )
}
