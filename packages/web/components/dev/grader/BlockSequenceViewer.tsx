"use client"

import { useState, useEffect } from "react"
import { Loader2, X } from "lucide-react"
import type { BlockDef } from "@/lib/graders/agent-config"

export type BlockStatus = "idle" | "loading" | "loaded" | "empty" | "placeholder"

export interface HydratedBlock {
  blockId: string
  status: BlockStatus
  content: string | null
}

const KIND_CHIP: Record<string, string> = {
  system: "bg-cyan-950/60 text-cyan-400 border-cyan-700/40",
  context: "bg-amber-950/60 text-amber-400 border-amber-700/40",
  history: "bg-zinc-800 text-zinc-400 border-zinc-600/40",
  "user-input": "bg-purple-950/60 text-purple-400 border-purple-700/40",
}

const STATUS_BADGE: Record<BlockStatus, { label: string; cls: string }> = {
  idle: { label: "PENDING", cls: "text-muted-foreground/40 border-border/30" },
  loading: { label: "LOADING", cls: "text-amber-400 border-amber-700/40" },
  loaded: { label: "LOADED", cls: "text-green-500 border-green-700/40" },
  empty: { label: "EMPTY", cls: "text-red-400 border-red-700/40" },
  placeholder: { label: "PLACEHOLDER", cls: "text-muted-foreground/40 border-border/30" },
}

interface Props {
  blocks: BlockDef[]
  hydratedBlocks: HydratedBlock[]
}

export function BlockSequenceViewer({ blocks, hydratedBlocks }: Props) {
  const [modal, setModal] = useState<{ block: BlockDef; content: string } | null>(null)

  useEffect(() => {
    if (!modal) return
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setModal(null) }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [modal])

  function getHydrated(blockId: string): HydratedBlock | undefined {
    return hydratedBlocks.find((h) => h.blockId === blockId)
  }

  function resolveContent(block: BlockDef, hydrated: HydratedBlock | undefined): string {
    if (hydrated?.content) return hydrated.content
    if (block.kind === "history") return "(no prior turns)"
    if (block.kind === "user-input") return "← from test case"
    return block.description
  }

  function resolveStatus(block: BlockDef, hydrated: HydratedBlock | undefined): BlockStatus {
    if (hydrated) return hydrated.status
    if (block.kind === "history" || block.kind === "user-input") return "placeholder"
    return "idle"
  }

  return (
    <>
    <div className="space-y-2">
      <p className="font-sans text-[0.5rem] uppercase tracking-[0.3em] text-muted-foreground/50">
        Block Sequence
      </p>
      {blocks.map((block, idx) => {
        const hydrated = getHydrated(block.id)
        const status = resolveStatus(block, hydrated)
        const content = resolveContent(block, hydrated)
        const badge = STATUS_BADGE[status]
        const chipCls = KIND_CHIP[block.kind] ?? "bg-zinc-800 text-zinc-400 border-zinc-600/40"

        const clickable = status === "loaded" && !!hydrated?.content

        return (
          <div
            key={block.id}
            onClick={() => clickable && setModal({ block, content: hydrated!.content! })}
            className={`border bg-background/30 ${
              status === "empty" ? "border-red-700/50" : "border-border/40"
            } ${clickable ? "cursor-pointer hover:border-border/70 hover:bg-background/50" : ""}`}
          >
            {/* Header row */}
            <div className="flex items-center gap-2 px-2.5 py-1.5 border-b border-border/30">
              <span className="font-mono text-[0.5rem] text-muted-foreground/40 w-3 shrink-0">
                {idx + 1}
              </span>
              <span className={`border px-1.5 py-0.5 font-sans text-[0.45rem] uppercase tracking-widest ${chipCls}`}>
                {block.kind}
              </span>
              <span className="flex-1 font-sans text-[0.55rem] uppercase tracking-widest text-muted-foreground/70 truncate">
                {block.label}
              </span>
              {block.optional && (
                <span className="font-sans text-[0.4rem] uppercase tracking-widest text-muted-foreground/30 border border-border/20 px-1">
                  OPT
                </span>
              )}
              <span className={`border px-1.5 py-0.5 font-sans text-[0.4rem] uppercase tracking-widest ${badge.cls}`}>
                {status === "loading" ? (
                  <span className="flex items-center gap-0.5">
                    <Loader2 className="w-2 h-2 animate-spin" />
                    LOADING
                  </span>
                ) : (
                  badge.label
                )}
              </span>
            </div>

            {/* Content preview */}
            <div className="px-2.5 py-1.5">
              <p
                className={`font-mono text-[0.55rem] leading-relaxed line-clamp-3 whitespace-pre-wrap break-words ${
                  status === "loaded"
                    ? "text-foreground/60"
                    : status === "empty"
                      ? "text-red-400/60 italic"
                      : "text-muted-foreground/30 italic"
                }`}
              >
                {status === "empty" ? "No data returned — check character has this context" : content}
              </p>
            </div>
          </div>
        )
      })}
    </div>

    {/* Block content modal */}
      {modal && (
        <div
          className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-8"
          onClick={() => setModal(null)}
        >
          <div
            className="bg-background border border-border w-full max-w-2xl max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 shrink-0">
              <div className="flex items-center gap-2">
                <span className={`border px-1.5 py-0.5 font-sans text-[0.45rem] uppercase tracking-widest ${KIND_CHIP[modal.block.kind] ?? "bg-zinc-800 text-zinc-400 border-zinc-600/40"}`}>
                  {modal.block.kind}
                </span>
                <span className="font-sans text-[0.55rem] uppercase tracking-widest text-muted-foreground/70">
                  {modal.block.label}
                </span>
              </div>
              <button onClick={() => setModal(null)} className="text-muted-foreground/50 hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <pre className="font-mono text-xs text-foreground/70 whitespace-pre-wrap wrap-break-word leading-relaxed">
                {modal.content}
              </pre>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
