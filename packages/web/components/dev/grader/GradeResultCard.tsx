"use client"

import { Check, X } from "lucide-react"
import type { CodeGradeResult } from "@/lib/graders/code-grader"
import type { ModelGradeResult } from "@/lib/services/grader-service"

interface Props {
  codeGrade: CodeGradeResult | null
  modelGrade: ModelGradeResult | null
  modelResponse: string | null
  agentProducesJson: boolean
}

function scoreColor(score: number): string {
  if (score >= 80) return "text-green-400"
  if (score >= 60) return "text-amber-400"
  return "text-red-400"
}

export function GradeResultCard({ codeGrade, modelGrade, modelResponse, agentProducesJson }: Props) {
  return (
    <div className="border border-border bg-card/40 divide-y divide-border/40">

      {/* Model response preview */}
      {modelResponse && (
        <div className="px-3 py-2">
          <p className="font-sans text-[0.45rem] uppercase tracking-[0.3em] text-muted-foreground/40 mb-1">
            Response
          </p>
          <p className="font-mono text-[0.55rem] text-foreground/60 line-clamp-3 whitespace-pre-wrap break-words">
            {modelResponse}
          </p>
        </div>
      )}

      {/* Code grade */}
      {agentProducesJson && codeGrade !== null && (
        <div className="px-3 py-2 space-y-1.5">
          <div className="flex items-center justify-between">
            <p className="font-sans text-[0.45rem] uppercase tracking-[0.3em] text-muted-foreground/40">
              Code Grade
            </p>
            <span className={`font-mono text-xs font-bold ${
              codeGrade.total === 0
                ? "text-muted-foreground/40"
                : codeGrade.passed === codeGrade.total
                  ? "text-green-400"
                  : "text-amber-400"
            }`}>
              {codeGrade.total === 0 ? "—" : `${codeGrade.passed}/${codeGrade.total}`}
            </span>
          </div>

          {codeGrade.details.length > 0 && (
            <div className="space-y-1">
              {codeGrade.details.map((d, i) => (
                <div key={i} className="flex items-start gap-1.5">
                  {d.pass ? (
                    <Check className="w-2.5 h-2.5 text-green-500 mt-0.5 shrink-0" />
                  ) : (
                    <X className="w-2.5 h-2.5 text-red-400 mt-0.5 shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <span className="font-mono text-[0.5rem] text-muted-foreground/60">
                      {d.field}
                    </span>
                    {!d.pass && (
                      <div className="font-mono text-[0.45rem] text-muted-foreground/40 mt-0.5">
                        expected <span className="text-green-400/70">{d.expected}</span>{" "}
                        got <span className="text-red-400/70 break-all">{d.got}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {codeGrade.total === 0 && (
            <p className="font-sans text-[0.5rem] italic text-muted-foreground/30">
              No expected fields set
            </p>
          )}
        </div>
      )}

      {/* Model grade */}
      {modelGrade !== null && (
        <div className="px-3 py-2 space-y-1.5">
          <div className="flex items-center justify-between">
            <p className="font-sans text-[0.45rem] uppercase tracking-[0.3em] text-muted-foreground/40">
              Model Grade
            </p>
            <span className={`font-mono text-xs font-bold ${scoreColor(modelGrade.score)}`}>
              {modelGrade.score}/100
            </span>
          </div>
          <p className="font-serif text-[0.65rem] text-foreground/70 leading-relaxed">
            {modelGrade.review}
          </p>
          <p className="font-mono text-[0.45rem] text-muted-foreground/30">
            {modelGrade.usage.input_tokens}↑ {modelGrade.usage.output_tokens}↓
          </p>
        </div>
      )}

      {codeGrade === null && modelGrade === null && !modelResponse && (
        <div className="px-3 py-2">
          <p className="font-sans text-[0.5rem] italic text-muted-foreground/30 uppercase tracking-widest">
            No results yet
          </p>
        </div>
      )}
    </div>
  )
}
