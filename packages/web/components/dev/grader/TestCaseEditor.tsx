"use client"

import { X, Loader2 } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { ExpectedOutputEditor } from "./ExpectedOutputEditor"
import { GradeResultCard } from "./GradeResultCard"
import type { ExpectedOutput, CodeGradeResult } from "@/lib/graders/code-grader"
import type { ModelGradeResult } from "@/lib/services/grader-service"
import type { ExpectedOutputKind } from "@/lib/graders/agent-config"

export type TestCaseStatus =
  | "idle"
  | "running-agent"
  | "running-grader"
  | "done"
  | "error"

export interface TestCase {
  id: string
  userInput: string
  expectedOutput: ExpectedOutput
}

export interface TestCaseResult {
  caseId: string
  status: TestCaseStatus
  modelResponse: string | null
  codeGrade: CodeGradeResult | null
  modelGrade: ModelGradeResult | null
  error?: string
  agentUsage?: { input_tokens: number; output_tokens: number }
}

interface Props {
  cases: TestCase[]
  results: TestCaseResult[]
  expectedOutputKind: ExpectedOutputKind
  agentProducesJson: boolean
  userInputLabel: string
  userInputPlaceholder: string
  onAdd: () => void
  onRemove: (id: string) => void
  onUpdateInput: (id: string, value: string) => void
  onUpdateExpected: (id: string, value: ExpectedOutput) => void
}

const STATUS_CHIP: Record<TestCaseStatus, { label: string; cls: string }> = {
  idle: { label: "Idle", cls: "text-muted-foreground/40" },
  "running-agent": { label: "Agent…", cls: "text-amber-400" },
  "running-grader": { label: "Grading…", cls: "text-cyan-400" },
  done: { label: "Done", cls: "text-green-500" },
  error: { label: "Error", cls: "text-red-400" },
}

export function TestCaseEditor({
  cases,
  results,
  expectedOutputKind,
  agentProducesJson,
  userInputLabel,
  userInputPlaceholder,
  onAdd,
  onRemove,
  onUpdateInput,
  onUpdateExpected,
}: Props) {
  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="shrink-0 border-b border-border px-4 py-2 flex items-center justify-between bg-background/95 backdrop-blur">
        <span className="font-sans text-[0.5rem] uppercase tracking-[0.3em] text-muted-foreground/50">
          Test Cases
        </span>
        <button
          onClick={onAdd}
          className="border border-border px-2 py-1 font-sans text-[0.55rem] uppercase tracking-widest text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
        >
          + Add
        </button>
      </div>

      {/* Cases */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {cases.map((tc, idx) => {
          const result = results.find((r) => r.caseId === tc.id)
          const status = result?.status ?? "idle"
          const chip = STATUS_CHIP[status]

          return (
            <div key={tc.id} className="border border-border bg-background">
              {/* Case header */}
              <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
                <span className="font-sans text-[0.55rem] uppercase tracking-widest text-muted-foreground/60 flex-1">
                  Test {idx + 1}
                </span>

                {(status === "running-agent" || status === "running-grader") && (
                  <Loader2 className="w-2.5 h-2.5 animate-spin text-amber-400" />
                )}
                <span className={`font-sans text-[0.5rem] uppercase tracking-widest ${chip.cls}`}>
                  {chip.label}
                </span>

                {/* Mini result summary */}
                {result?.status === "done" && (
                  <span className="font-mono text-[0.5rem] text-muted-foreground/50">
                    {agentProducesJson && result.codeGrade && result.codeGrade.total > 0 && (
                      <span className={result.codeGrade.passed === result.codeGrade.total ? "text-green-400" : "text-amber-400"}>
                        {result.codeGrade.passed}/{result.codeGrade.total}
                      </span>
                    )}
                    {result.modelGrade && (
                      <span
                        className={`ml-2 ${
                          result.modelGrade.score >= 80
                            ? "text-green-400"
                            : result.modelGrade.score >= 60
                              ? "text-amber-400"
                              : "text-red-400"
                        }`}
                      >
                        {result.modelGrade.score}/100
                      </span>
                    )}
                  </span>
                )}

                {result?.error && (
                  <span
                    className="font-mono text-[0.5rem] text-red-400/70 max-w-[120px] truncate"
                    title={result.error}
                  >
                    {result.error}
                  </span>
                )}

                {cases.length > 1 && (
                  <button
                    onClick={() => onRemove(tc.id)}
                    className="text-muted-foreground/40 hover:text-foreground transition-colors ml-1"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="p-3 space-y-3">
                {/* User input */}
                <div>
                  <label className="block font-sans text-[0.5rem] uppercase tracking-widest text-muted-foreground/50 mb-1">
                    {userInputLabel}
                  </label>
                  <Textarea
                    value={tc.userInput}
                    onChange={(e) => onUpdateInput(tc.id, e.target.value)}
                    placeholder={userInputPlaceholder}
                    className="min-h-20 resize-y font-mono text-xs border-border bg-background/60"
                  />
                </div>

                {/* Expected output */}
                <ExpectedOutputEditor
                  kind={expectedOutputKind}
                  value={tc.expectedOutput}
                  onChange={(next) => onUpdateExpected(tc.id, next)}
                />

                {/* Inline result */}
                {result && result.status !== "idle" && (
                  <GradeResultCard
                    codeGrade={result.codeGrade}
                    modelGrade={result.modelGrade}
                    modelResponse={result.modelResponse}
                    agentProducesJson={agentProducesJson}
                  />
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
