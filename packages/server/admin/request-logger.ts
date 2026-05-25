export interface RequestLogEntry {
  timestamp: string
  endpoint: string
  characterId?: string
  toolCallCount: number
  durationMs: number
  statusCode: number
}

const MAX_ENTRIES = 100
const log: RequestLogEntry[] = []
let totalRequests = 0
let lastRequestAt: string | null = null

export function logRequest(entry: RequestLogEntry): void {
  if (log.length >= MAX_ENTRIES) log.shift()
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
