"use client"

import { Plus, X } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type {
  ExpectedOutput,
  LoreEngineExpected,
  LedgerExpectedAction,
  ScribeExpected,
} from "@/lib/graders/code-grader"
import type { ExpectedOutputKind } from "@/lib/graders/agent-config"

interface Props {
  kind: ExpectedOutputKind
  value: ExpectedOutput
  onChange: (next: ExpectedOutput) => void
}

const LEDGER_ACTIONS = [
  "move_character",
  "update_entity",
  "create_entity",
  "delete_entity",
  "update_npc",
  "long_rest",
  "grant_item",
] as const

const ITEM_TYPES = ["weapon", "armor", "consumable", "misc", "currency"] as const

export function ExpectedOutputEditor({ kind, value, onChange }: Props) {
  if (kind === "none") return null

  // ── Lore-Engine ────────────────────────────────────────────────────────────

  if (kind === "lore-engine") {
    const lv = value.kind === "lore-engine" ? value.value : ({} as LoreEngineExpected)

    function update(patch: Partial<LoreEngineExpected>) {
      onChange({ kind: "lore-engine", value: { ...lv, ...patch } })
    }

    return (
      <div className="space-y-2 border-t border-border/30 pt-2">
        <p className="font-sans text-[0.45rem] uppercase tracking-[0.3em] text-muted-foreground/40">
          Expected Output
        </p>

        {/* action_type */}
        <div className="flex items-center gap-2">
          <label className="font-sans text-[0.5rem] uppercase tracking-widest text-muted-foreground/60 w-24 shrink-0">
            action_type
          </label>
          <Select
            value={lv.action_type ?? ""}
            onValueChange={(v) => update({ action_type: v as LoreEngineExpected["action_type"] })}
          >
            <SelectTrigger className="flex-1 border-border bg-background text-xs h-7">
              <SelectValue placeholder="Any…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="info">info</SelectItem>
              <SelectItem value="task">task</SelectItem>
              <SelectItem value="attack">attack</SelectItem>
            </SelectContent>
          </Select>
          {lv.action_type && (
            <button
              onClick={() => update({ action_type: undefined })}
              className="text-muted-foreground/40 hover:text-muted-foreground"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* requires_check */}
        <div className="flex items-center gap-2">
          <label className="font-sans text-[0.5rem] uppercase tracking-widest text-muted-foreground/60 w-24 shrink-0">
            requires_check
          </label>
          <div className="flex gap-2">
            {[true, false].map((b) => (
              <button
                key={String(b)}
                onClick={() => update({ requires_check: lv.requires_check === b ? undefined : b })}
                className={`border px-2 py-0.5 font-sans text-[0.5rem] uppercase tracking-widest transition-colors ${
                  lv.requires_check === b
                    ? "border-cyan-600 text-cyan-400 bg-cyan-950/30"
                    : "border-border text-muted-foreground/50 hover:border-border/80"
                }`}
              >
                {String(b)}
              </button>
            ))}
          </div>
        </div>

        {/* pool (only when requires_check=true) */}
        {lv.requires_check === true && (
          <div className="flex items-center gap-2">
            <label className="font-sans text-[0.5rem] uppercase tracking-widest text-muted-foreground/60 w-24 shrink-0">
              pool
            </label>
            <Select
              value={lv.pool ?? ""}
              onValueChange={(v) => update({ pool: v as LoreEngineExpected["pool"] })}
            >
              <SelectTrigger className="flex-1 border-border bg-background text-xs h-7">
                <SelectValue placeholder="Any…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Power">Power</SelectItem>
                <SelectItem value="Essence">Essence</SelectItem>
                <SelectItem value="Will">Will</SelectItem>
              </SelectContent>
            </Select>
            {lv.pool && (
              <button
                onClick={() => update({ pool: undefined })}
                className="text-muted-foreground/40 hover:text-muted-foreground"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
      </div>
    )
  }

  // ── Ledger ─────────────────────────────────────────────────────────────────

  if (kind === "ledger") {
    const lv = value.kind === "ledger" ? value.value : { actions: [] }

    function updateActions(actions: LedgerExpectedAction[]) {
      onChange({ kind: "ledger", value: { actions } })
    }

    function addAction() {
      updateActions([...lv.actions, { action: "long_rest" }])
    }

    function removeAction(idx: number) {
      updateActions(lv.actions.filter((_, i) => i !== idx))
    }

    function updateAction(idx: number, patch: Partial<LedgerExpectedAction>) {
      updateActions(lv.actions.map((a, i) => (i === idx ? { ...a, ...patch } : a)))
    }

    return (
      <div className="space-y-2 border-t border-border/30 pt-2">
        <div className="flex items-center justify-between">
          <p className="font-sans text-[0.45rem] uppercase tracking-[0.3em] text-muted-foreground/40">
            Expected Actions
          </p>
          <button
            onClick={addAction}
            className="flex items-center gap-1 border border-border px-1.5 py-0.5 font-sans text-[0.45rem] uppercase tracking-widest text-muted-foreground/50 hover:text-foreground hover:bg-card transition-colors"
          >
            <Plus className="w-2.5 h-2.5" />
            Add
          </button>
        </div>

        {lv.actions.length === 0 && (
          <p className="font-sans text-[0.5rem] italic text-muted-foreground/30">
            No expected actions — code grader will skip
          </p>
        )}

        {lv.actions.map((action, idx) => (
          <div key={idx} className="flex items-center gap-1.5">
            <Select
              value={action.action}
              onValueChange={(v) => updateAction(idx, { action: v, item_type: undefined })}
            >
              <SelectTrigger className="flex-1 border-border bg-background text-xs h-7">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEDGER_ACTIONS.map((a) => (
                  <SelectItem key={a} value={a}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {action.action === "grant_item" && (
              <Select
                value={action.item_type ?? ""}
                onValueChange={(v) => updateAction(idx, { item_type: v || undefined })}
              >
                <SelectTrigger className="w-24 border-border bg-background text-xs h-7">
                  <SelectValue placeholder="type…" />
                </SelectTrigger>
                <SelectContent>
                  {ITEM_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <button
              onClick={() => removeAction(idx)}
              className="text-muted-foreground/40 hover:text-red-400 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    )
  }

  // ── Scribe ─────────────────────────────────────────────────────────────────

  if (kind === "scribe") {
    const lv: ScribeExpected =
      value.kind === "scribe"
        ? value.value
        : { has_summary: true, has_objectives_array: true, has_completed_ids_array: true }

    function update(patch: Partial<ScribeExpected>) {
      onChange({ kind: "scribe", value: { ...lv, ...patch } })
    }

    return (
      <div className="space-y-2 border-t border-border/30 pt-2">
        <p className="font-sans text-[0.45rem] uppercase tracking-[0.3em] text-muted-foreground/40">
          Expected Output
        </p>
        {(
          [
            ["has_summary", "summary non-empty"],
            ["has_objectives_array", "objectives array"],
            ["has_completed_ids_array", "completed_quest_ids array"],
          ] as const
        ).map(([field, label]) => (
          <label key={field} className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={lv[field]}
              onChange={(e) => update({ [field]: e.target.checked })}
              className="accent-cyan-500 w-3 h-3"
            />
            <span className="font-sans text-[0.5rem] uppercase tracking-widest text-muted-foreground/60">
              {label}
            </span>
          </label>
        ))}
      </div>
    )
  }

  // ── Character Creator ──────────────────────────────────────────────────────

  if (kind === "character-creator") {
    return (
      <div className="space-y-1.5 border-t border-border/30 pt-2">
        <p className="font-sans text-[0.45rem] uppercase tracking-[0.3em] text-muted-foreground/40">
          Expected Output
        </p>
        <p className="font-sans text-[0.5rem] italic text-muted-foreground/40">
          Checks all 5 required fields: background_primary, physical_description, backstory, story_hook,
          initial_quest
        </p>
      </div>
    )
  }

  return null
}
