import { describe, it, expect, beforeEach } from 'vitest'

// Re-import fresh module state for each test suite via dynamic import with cache busting
// In practice, since logRequest mutates module-level state, tests run in order
import { logRequest, getRecentRequests, getStats } from './request-logger.js'

function makeEntry(overrides: Partial<Parameters<typeof logRequest>[0]> = {}): Parameters<typeof logRequest>[0] {
  return {
    timestamp: new Date().toISOString(),
    endpoint: '/gm',
    toolCallCount: 2,
    durationMs: 450,
    statusCode: 200,
    ...overrides,
  }
}

describe('request-logger', () => {
  it('records requests and returns them newest-first', () => {
    const before = getRecentRequests().length
    logRequest(makeEntry({ endpoint: '/gm' }))
    logRequest(makeEntry({ endpoint: '/gm/summarize' }))
    const recent = getRecentRequests()
    expect(recent.length).toBeGreaterThan(before)
    // newest first
    expect(recent[0].endpoint).toBe('/gm/summarize')
  })

  it('increments totalRequests with each log call', () => {
    const { totalRequests: before } = getStats()
    logRequest(makeEntry())
    const { totalRequests: after } = getStats()
    expect(after).toBe(before + 1)
  })

  it('updates lastRequestAt', () => {
    const ts = '2026-01-01T00:00:00.000Z'
    logRequest(makeEntry({ timestamp: ts }))
    expect(getStats().lastRequestAt).toBe(ts)
  })

  it('stores characterId when provided', () => {
    logRequest(makeEntry({ characterId: 'char-abc' }))
    const recent = getRecentRequests()
    expect(recent[0].characterId).toBe('char-abc')
  })

  it('caps the ring buffer at 100 entries', () => {
    for (let i = 0; i < 110; i++) {
      logRequest(makeEntry())
    }
    expect(getRecentRequests().length).toBeLessThanOrEqual(100)
  })
})
