"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ChevronLeft, RefreshCw, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { AGENT_SLUGS, type AgentSlug } from "@/lib/graders/agent-config"

interface AgentStatus {
  slug: AgentSlug
  currentVersion: number | null
  lastTestVersion: number | null
  lastGeneratedAt: string | null
  hasDefaults: boolean
}

type RefreshState = "idle" | "loading" | "success" | "error"

interface RefreshStatus {
  state: RefreshState
  message: string | null
}

function formatRelativeTime(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export default function TestManagerPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [agentStatuses, setAgentStatuses] = useState<AgentStatus[]>([])
  const [refreshStatus, setRefreshStatus] = useState<Record<string, RefreshStatus>>({})
  const [confirmSlug, setConfirmSlug] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()

    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push("/"); return }

      const { data: profile } = await supabase
        .from("profiles").select("is_dev").eq("id", user.id).single()
      if (!profile?.is_dev) { router.push("/dashboard"); return }

      // Fetch latest prompt version per agent slug
      const { data: pvRows } = await supabase
        .from("prompt_versions")
        .select("slug, version")
        .in("slug", AGENT_SLUGS)
        .order("version", { ascending: false })

      // Build max version per slug
      const maxVersions: Record<string, number> = {}
      for (const row of (pvRows ?? [])) {
        if (!(row.slug in maxVersions)) maxVersions[row.slug] = row.version
      }

      // Fetch latest default test case per agent slug
      const { data: tcRows } = await supabase
        .from("prompt_test_cases")
        .select("slug, slug_version, generated_at")
        .in("slug", AGENT_SLUGS)
        .eq("is_default", true)
        .order("generated_at", { ascending: false })

      const latestTests: Record<string, { slug_version: number; generated_at: string }> = {}
      for (const row of (tcRows ?? [])) {
        if (!(row.slug in latestTests)) {
          latestTests[row.slug] = { slug_version: row.slug_version, generated_at: row.generated_at }
        }
      }

      const statuses: AgentStatus[] = AGENT_SLUGS.map((slug) => ({
        slug,
        currentVersion: maxVersions[slug] ?? null,
        lastTestVersion: latestTests[slug]?.slug_version ?? null,
        lastGeneratedAt: latestTests[slug]?.generated_at ?? null,
        hasDefaults: slug in latestTests,
      }))

      setAgentStatuses(statuses)
      setLoading(false)
    }

    init().catch(console.error)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleRefresh(slug: string) {
    setConfirmSlug(null)
    setRefreshStatus((prev) => ({ ...prev, [slug]: { state: "loading", message: null } }))

    try {
      const res = await fetch("/api/dev/test-cases/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      })
      const data = (await res.json()) as { error?: string; slug_version?: number }

      if (!res.ok) {
        setRefreshStatus((prev) => ({ ...prev, [slug]: { state: "error", message: data.error ?? "Refresh failed" } }))
        return
      }

      // Update the agent status to reflect the new version
      setAgentStatuses((prev) =>
        prev.map((s) =>
          s.slug === slug
            ? { ...s, lastTestVersion: data.slug_version ?? s.currentVersion, lastGeneratedAt: new Date().toISOString(), hasDefaults: true }
            : s,
        ),
      )
      setRefreshStatus((prev) => ({ ...prev, [slug]: { state: "success", message: `Updated to v${data.slug_version}` } }))
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network error"
      setRefreshStatus((prev) => ({ ...prev, [slug]: { state: "error", message: msg } }))
    }
  }

  const DISPLAY_NAMES: Record<AgentSlug, string> = {
    "lore-engine": "Lore-Engine",
    "architect": "Architect",
    "ledger": "Ledger",
    "scribe": "Scribe",
    "character-builder": "Character Creator",
  }

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
            <h1 className="text-sm uppercase tracking-[0.3em] text-muted-foreground">
              Prompt Test Suite
            </h1>
          </div>
          <Link href="/dashboard" className="font-serif text-lg tracking-wide text-muted-foreground hover:text-foreground">
            KatabataK
          </Link>
        </div>
      </header>

      <main className="px-6 md:px-12 lg:px-20 py-8 max-w-3xl">
        <div className="flex items-start justify-between mb-8">
          <div>
            <h2 className="font-serif text-xl text-foreground mb-1">Static Test Status</h2>
            <p className="font-sans text-[0.65rem] tracking-wide text-muted-foreground/60 uppercase">
              Red cards indicate saved test cases were generated against an outdated prompt version.
              Refresh to re-hydrate their context blocks with the current prompt.
            </p>
          </div>
          <Link href="/dev/prompt-eval">
            <Button variant="outline" size="sm" className="border-cyan-700/50 text-cyan-400 hover:bg-cyan-950/20 uppercase tracking-widest text-xs shrink-0 ml-6">
              Open Grader
            </Button>
          </Link>
        </div>

        {loading ? (
          <div className="border border-border bg-card p-12 text-center">
            <p className="font-serif text-muted-foreground italic">Loading…</p>
          </div>
        ) : (
          <div className="space-y-3">
            {agentStatuses.map((agent) => {
              const isStale = agent.hasDefaults && agent.currentVersion !== null && agent.lastTestVersion !== agent.currentVersion
              const rStatus = refreshStatus[agent.slug]
              const isRefreshing = rStatus?.state === "loading"

              return (
                <div
                  key={agent.slug}
                  className={`border bg-card px-5 py-4 ${isStale ? "border-red-700/50" : "border-border"}`}
                >
                  <div className="flex items-center justify-between gap-4">
                    {/* Left: agent info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-3 mb-1.5">
                        <span className="font-serif text-base text-foreground">
                          {DISPLAY_NAMES[agent.slug]}
                        </span>

                        {/* Current version badge */}
                        {agent.currentVersion !== null && (
                          <span className="font-sans text-[0.5rem] tracking-widest uppercase border border-border/50 text-muted-foreground/50 px-1.5 py-0.5">
                            prompt v{agent.currentVersion}
                          </span>
                        )}

                        {/* Status badge */}
                        {!agent.hasDefaults ? (
                          <span className="font-sans text-[0.5rem] tracking-widest uppercase border border-border/40 text-muted-foreground/40 px-1.5 py-0.5">
                            No defaults
                          </span>
                        ) : isStale ? (
                          <span className="flex items-center gap-1 font-sans text-[0.5rem] tracking-widest uppercase border border-red-700/50 text-red-400 px-1.5 py-0.5">
                            <AlertTriangle className="w-2.5 h-2.5" />
                            Stale (v{agent.lastTestVersion})
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 font-sans text-[0.5rem] tracking-widest uppercase border border-green-700/40 text-green-500 px-1.5 py-0.5">
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            Current
                          </span>
                        )}
                      </div>

                      {agent.hasDefaults && agent.lastGeneratedAt && (
                        <p className="font-sans text-[0.55rem] text-muted-foreground/50">
                          Last refreshed {formatRelativeTime(agent.lastGeneratedAt)}
                        </p>
                      )}

                      {!agent.hasDefaults && (
                        <p className="font-sans text-[0.55rem] text-muted-foreground/40 italic">
                          Create test cases in the Grader, then Save as Default.
                        </p>
                      )}

                      {/* Feedback message */}
                      {rStatus && rStatus.state !== "loading" && rStatus.message && (
                        <p className={`font-sans text-[0.55rem] mt-1 ${rStatus.state === "error" ? "text-red-400" : "text-green-400"}`}>
                          {rStatus.message}
                        </p>
                      )}
                    </div>

                    {/* Right: refresh button */}
                    {agent.hasDefaults && (
                      <div className="shrink-0">
                        {confirmSlug === agent.slug ? (
                          <div className="flex items-center gap-2">
                            <span className="font-sans text-[0.55rem] tracking-widest uppercase text-muted-foreground/50">
                              Incurs LLM cost.
                            </span>
                            <button
                              onClick={() => handleRefresh(agent.slug)}
                              className="font-sans text-[0.6rem] tracking-widest uppercase border border-cyan-700/50 text-cyan-400 px-3 py-1.5 hover:bg-cyan-900/20 transition-colors"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => setConfirmSlug(null)}
                              className="font-sans text-[0.6rem] tracking-widest uppercase border border-border text-muted-foreground px-3 py-1.5 hover:text-foreground transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmSlug(agent.slug)}
                            disabled={isRefreshing}
                            className="flex items-center gap-1.5 font-sans text-[0.6rem] tracking-widest uppercase border border-border text-muted-foreground px-3 py-1.5 hover:text-foreground hover:border-foreground/30 transition-colors disabled:opacity-40"
                          >
                            {isRefreshing ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <RefreshCw className="w-3 h-3" />
                            )}
                            {isRefreshing ? "Refreshing…" : "Refresh"}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
