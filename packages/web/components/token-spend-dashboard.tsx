"use client"

import { useEffect, useState } from "react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts"
import { Coins } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

interface UsageRow {
  agent: string
  model: string
  input_tokens: number
  output_tokens: number
  character_id: string | null
  created_at: string
}

interface AgentTotal {
  agent: string
  tokens: number
}

interface TokenSpendDashboardProps {
  tokenBudget: number | null
}

export function TokenSpendDashboard({ tokenBudget }: TokenSpendDashboardProps) {
  const [rows, setRows] = useState<UsageRow[]>([])
  const [loading, setLoading] = useState(true)
  const [budgetDraft, setBudgetDraft] = useState(tokenBudget?.toString() ?? "")
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/token-usage")
      .then((r) => r.json())
      .then(({ usage }: { usage?: UsageRow[] }) => {
        setRows(usage ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const totalTokens = rows.reduce((s, r) => s + r.input_tokens + r.output_tokens, 0)

  const byAgent: AgentTotal[] = Object.values(
    rows.reduce<Record<string, AgentTotal>>((acc, r) => {
      const total = r.input_tokens + r.output_tokens
      acc[r.agent] = acc[r.agent]
        ? { agent: r.agent, tokens: acc[r.agent].tokens + total }
        : { agent: r.agent, tokens: total }
      return acc
    }, {}),
  )

  const budgetPct =
    tokenBudget && totalTokens > 0
      ? Math.min((totalTokens / tokenBudget) * 100, 100)
      : null
  const isCritical = budgetPct !== null && budgetPct > 90
  const barColor = isCritical ? "#dc2626" : "#22d3ee"

  const handleSaveBudget = async () => {
    setSaving(true)
    setSaveMsg(null)
    const budget = budgetDraft === "" ? null : parseInt(budgetDraft, 10)
    try {
      const res = await fetch("/api/token-budget", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ budget }),
      })
      const data = await res.json() as { ok?: boolean; error?: string }
      setSaveMsg(data.ok ? "Cap saved." : (data.error ?? "Save failed."))
    } catch {
      setSaveMsg("Save failed.")
    }
    setSaving(false)
  }

  return (
    <div className="border-t border-border/50 pt-6 mt-2 grid gap-4">
      <p className="text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-2">
        <Coins className="w-3 h-3 text-cyan-500" />
        Token Expenditure
      </p>

      {loading ? (
        <p className="text-xs text-zinc-600 uppercase tracking-widest">Loading records…</p>
      ) : (
        <>
          <div className="flex gap-6 text-sm">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-zinc-600">Total Used</p>
              <p className="font-mono text-cyan-400">{totalTokens.toLocaleString()}</p>
            </div>
            {tokenBudget !== null && (
              <div>
                <p className="text-[10px] uppercase tracking-widest text-zinc-600">Budget Cap</p>
                <p className={`font-mono ${isCritical ? "text-red-400" : "text-zinc-300"}`}>
                  {tokenBudget.toLocaleString()}
                  {budgetPct !== null && ` (${budgetPct.toFixed(1)}%)`}
                </p>
              </div>
            )}
          </div>

          {byAgent.length > 0 && (
            <div className="h-36">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byAgent} barSize={18}>
                  <XAxis
                    dataKey="agent"
                    tick={{ fontSize: 9, fill: "#52525b" }}
                    tickLine={false}
                  />
                  <YAxis tick={{ fontSize: 9, fill: "#52525b" }} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      background: "#09090b",
                      border: "1px solid #27272a",
                      fontSize: 11,
                    }}
                    formatter={(v: number) => [v.toLocaleString(), "tokens"]}
                  />
                  <Bar dataKey="tokens">
                    {byAgent.map((_, i) => (
                      <Cell key={i} fill={barColor} opacity={0.8} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}

      {/* Budget cap control */}
      <div className="space-y-2">
        <Label htmlFor="tokenBudget" className="text-xs uppercase tracking-tighter">
          Token Budget Cap
        </Label>
        <Input
          id="tokenBudget"
          type="number"
          min={1000}
          value={budgetDraft}
          onChange={(e) => { setBudgetDraft(e.target.value); setSaveMsg(null) }}
          placeholder="Leave blank for unlimited"
          className="bg-input border-border focus:ring-0 font-mono text-xs"
        />
        <p className="text-[10px] text-zinc-600 uppercase tracking-widest">
          Min 1,000. Leave blank to remove cap.
        </p>
      </div>

      {saveMsg && (
        <p className="text-xs text-zinc-400 uppercase tracking-widest">{saveMsg}</p>
      )}

      <Button
        onClick={handleSaveBudget}
        disabled={saving}
        variant="outline"
        className="w-full uppercase tracking-widest text-xs border-border"
      >
        {saving ? "Saving…" : "Save Budget Cap"}
      </Button>
    </div>
  )
}
