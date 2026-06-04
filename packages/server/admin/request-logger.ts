export interface StageTiming {
  hydratorMs: number
  loreMs: number
  architectMs: number
}

export interface TraceEntry {
  ts: string
  tag: string
  msg: string
  detail?: unknown
}

export interface RequestLogEntry {
  timestamp: string
  endpoint: string
  characterId?: string
  toolCallCount: number
  durationMs: number
  statusCode: number
  errorMessage?: string
  stageTiming?: StageTiming
  requestId?: string
}

const MAX_ENTRIES = 100
const log: RequestLogEntry[] = []
let totalRequests = 0
let lastRequestAt: string | null = null

const traceStore = new Map<string, TraceEntry[]>()

export function addTraceEntry(requestId: string, entry: TraceEntry): void {
  const entries = traceStore.get(requestId)
  if (entries) {
    entries.push(entry)
  } else {
    traceStore.set(requestId, [entry])
  }
}

export function getTrace(requestId: string): TraceEntry[] {
  return traceStore.get(requestId) ?? []
}

export function logRequest(entry: RequestLogEntry): void {
  if (log.length >= MAX_ENTRIES) {
    const evicted = log.shift()
    if (evicted?.requestId) traceStore.delete(evicted.requestId)
  }
  log.push(entry)
  totalRequests++
  lastRequestAt = entry.timestamp
}

export function getRecentRequests(): RequestLogEntry[] {
  return [...log].reverse()
}

export function getStats(): { totalRequests: number; lastRequestAt: string | null } {
  return { totalRequests, lastRequestAt }
}
