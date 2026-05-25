import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Request, Response, NextFunction } from 'express'

const TEST_KEY = 'test-secret-key-123'

vi.stubEnv('GM_API_KEY', TEST_KEY)

// Import after env is set so the fail-fast check passes
const { requireGmKey } = await import('./auth.js')

function makeReq(authHeader?: string): Request {
  return { headers: { authorization: authHeader } } as unknown as Request
}

function makeRes(): Response & { statusCode: number; body: unknown } {
  const res = {
    statusCode: 200,
    body: null as unknown,
    status(code: number) { this.statusCode = code; return this },
    json(b: unknown) { this.body = b; return this },
  }
  return res as unknown as Response & { statusCode: number; body: unknown }
}

describe('requireGmKey middleware', () => {
  let next: NextFunction

  beforeEach(() => {
    next = vi.fn()
  })

  it('calls next() for a valid Bearer token', () => {
    const req = makeReq(`Bearer ${TEST_KEY}`)
    const res = makeRes()
    requireGmKey(req, res, next)
    expect(next).toHaveBeenCalledOnce()
    expect(res.statusCode).toBe(200)
  })

  it('returns 401 for a wrong Bearer token', () => {
    const req = makeReq('Bearer wrong-key')
    const res = makeRes()
    requireGmKey(req, res, next)
    expect(next).not.toHaveBeenCalled()
    expect(res.statusCode).toBe(401)
  })

  it('returns 401 when Authorization header is missing', () => {
    const req = makeReq(undefined)
    const res = makeRes()
    requireGmKey(req, res, next)
    expect(next).not.toHaveBeenCalled()
    expect(res.statusCode).toBe(401)
  })

  it('returns 401 when header is not prefixed with Bearer', () => {
    const req = makeReq(TEST_KEY)
    const res = makeRes()
    requireGmKey(req, res, next)
    expect(next).not.toHaveBeenCalled()
    expect(res.statusCode).toBe(401)
  })

  it('returns 401 for a Basic auth header', () => {
    const req = makeReq(`Basic ${TEST_KEY}`)
    const res = makeRes()
    requireGmKey(req, res, next)
    expect(next).not.toHaveBeenCalled()
    expect(res.statusCode).toBe(401)
  })
})
