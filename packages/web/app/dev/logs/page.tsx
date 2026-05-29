'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { RefreshCw } from 'lucide-react'

interface LogEntry {
  lines: string[]
  tag: string
  isSystemPrompt: boolean
  isHydrator: boolean
}

function buildEntry(lines: string[]): LogEntry {
  const header = lines[0] ?? ''
  const tagMatch = header.match(/\[([A-Z-]+)\]/)
  const tag = tagMatch?.[1] ?? ''
  return {
    lines,
    tag,
    isSystemPrompt: header.includes('system prompt:') || header.includes('user content:'),
    isHydrator: tag === 'HYDRATOR',
  }
}

function parseLog(text: string): LogEntry[] {
  const entries: LogEntry[] = []
  let current: string[] = []
  for (const line of text.split('\n')) {
    if (/^\d{4}-\d{2}-\d{2}T/.test(line)) {
      if (current.length > 0) entries.push(buildEntry(current))
      current = [line]
    } else if (current.length > 0) {
      current.push(line)
    }
  }
  if (current.length > 0) entries.push(buildEntry(current))
  return entries
}

function entryColor(tag: string, header: string): string {
  if (header.includes('✗')) return 'text-red-400'
  if (header.includes('⚠')) return 'text-yellow-400'
  if (['LORE-ENGINE', 'ARCHITECT', 'LEDGER'].includes(tag)) return 'text-cyan-300/90'
  if (tag === 'HYDRATOR') return 'text-amber-400'
  if (tag === 'STYLE') return 'text-purple-400'
  return 'text-foreground/70'
}

export default function LogsPage() {
  const [entries, setEntries] = useState<LogEntry[]>([])
  const [showSystemPrompts, setShowSystemPrompts] = useState(true)
  const [showHydrator, setShowHydrator] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/dev/logs')
      if (!res.ok) throw new Error(`${res.status}`)
      const text = await res.text()
      setEntries(parseLog(text))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const visible = entries.filter(
    (e) => (showSystemPrompts || !e.isSystemPrompt) && (showHydrator || !e.isHydrator)
  )

  return (
    <div className="h-screen flex flex-col bg-background text-foreground overflow-hidden">
      {/* Header bar */}
      <div className="shrink-0 border-b border-border px-5 py-3 flex items-center gap-3 flex-wrap">
        <Link
          href="/"
          className="text-[0.55rem] uppercase tracking-[0.3em] text-muted-foreground hover:text-foreground transition-colors"
        >
          Dashboard
        </Link>
        <span className="text-muted-foreground/40 text-xs">/</span>
        <span className="text-[0.55rem] uppercase tracking-[0.3em] text-foreground">Pipeline Logs</span>

        <div className="ml-auto flex items-center gap-3 flex-wrap">
          <button
            onClick={() => setShowSystemPrompts((v) => !v)}
            className={`text-[0.55rem] uppercase tracking-[0.3em] px-3 py-1 border transition-colors ${
              showSystemPrompts
                ? 'border-cyan-400 text-cyan-400'
                : 'border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground'
            }`}
          >
            System Prompts
          </button>
          <button
            onClick={() => setShowHydrator((v) => !v)}
            className={`text-[0.55rem] uppercase tracking-[0.3em] px-3 py-1 border transition-colors ${
              showHydrator
                ? 'border-amber-400 text-amber-400'
                : 'border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground'
            }`}
          >
            Hydrator
          </button>

          <span className="text-[0.55rem] tracking-widest text-muted-foreground">
            {visible.length}/{entries.length}
          </span>

          <button
            onClick={() => void load()}
            disabled={loading}
            className="border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 px-2 py-1 transition-colors disabled:opacity-40"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Log body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-px">
        {loading && entries.length === 0 && (
          <p className="text-[0.55rem] uppercase tracking-[0.3em] text-muted-foreground">Loading...</p>
        )}
        {error && (
          <p className="text-[0.55rem] uppercase tracking-[0.3em] text-red-400">Error: {error}</p>
        )}
        {!loading && !error && visible.length === 0 && (
          <p className="text-[0.55rem] uppercase tracking-[0.3em] text-muted-foreground">No entries</p>
        )}
        {visible.map((entry, i) => (
          <pre
            key={i}
            className={`font-mono text-[0.6rem] leading-relaxed whitespace-pre-wrap break-all ${entryColor(entry.tag, entry.lines[0] ?? '')}`}
          >
            {entry.lines.join('\n')}
          </pre>
        ))}
      </div>
    </div>
  )
}
