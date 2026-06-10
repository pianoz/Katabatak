"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { AGENT_CONFIGS, AGENT_SLUGS, type AgentSlug } from "@/lib/graders/agent-config"
import type { VersionMetaRow } from "@/lib/services/prompt-service"

interface Props {
  selectedSlug: AgentSlug | ""
  onSlugChange: (slug: AgentSlug) => void
  versions: VersionMetaRow[]
  selectedVersion: number | null
  onVersionChange: (version: number) => void
  dbSlugs: string[]
}

export function AgentSelector({
  selectedSlug,
  onSlugChange,
  versions,
  selectedVersion,
  onVersionChange,
  dbSlugs,
}: Props) {
  // Show all known agent slugs; also include any DB slugs not in the static list
  const extraSlugs = dbSlugs.filter((s) => !AGENT_SLUGS.includes(s as AgentSlug))

  return (
    <div className="space-y-3">
      <p className="font-sans text-[0.5rem] uppercase tracking-[0.3em] text-muted-foreground/50">
        Agent
      </p>

      <div className="space-y-1.5">
        <label className="block font-sans text-[0.55rem] uppercase tracking-widest text-muted-foreground/60">
          Slug
        </label>
        <Select value={selectedSlug} onValueChange={(v) => onSlugChange(v as AgentSlug)}>
          <SelectTrigger className="w-full border-border bg-background text-xs">
            <SelectValue placeholder="Select agent…" />
          </SelectTrigger>
          <SelectContent>
            {AGENT_SLUGS.map((slug) => (
              <SelectItem key={slug} value={slug}>
                {AGENT_CONFIGS[slug].displayName}
                <span className="ml-2 font-mono text-[0.55rem] text-muted-foreground/50">
                  {slug}
                </span>
              </SelectItem>
            ))}
            {extraSlugs.map((slug) => (
              <SelectItem key={slug} value={slug}>
                {slug}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedSlug && versions.length > 0 && selectedVersion !== null && (
        <div className="space-y-1.5">
          <label className="block font-sans text-[0.55rem] uppercase tracking-widest text-muted-foreground/60">
            Version
          </label>
          <Select value={String(selectedVersion)} onValueChange={(v) => onVersionChange(Number(v))}>
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

      {selectedSlug && versions.length === 0 && (
        <p className="font-sans text-[0.5rem] uppercase tracking-widest text-amber-400/70">
          No saved versions — fallback prompt will be used
        </p>
      )}

      {selectedSlug && (
        <div className="border border-border/30 px-2.5 py-2 bg-background/30 space-y-0.5">
          <p className="font-sans text-[0.45rem] uppercase tracking-[0.3em] text-muted-foreground/40">
            Config
          </p>
          <p className="font-mono text-[0.6rem] text-muted-foreground/70">
            {AGENT_CONFIGS[selectedSlug as AgentSlug]?.model ?? "—"}
          </p>
          <p className="font-mono text-[0.55rem] text-muted-foreground/50">
            {AGENT_CONFIGS[selectedSlug as AgentSlug]?.maxTokens ?? "—"} tokens ·{" "}
            t={AGENT_CONFIGS[selectedSlug as AgentSlug]?.temperature ?? "—"}
          </p>
        </div>
      )}
    </div>
  )
}
