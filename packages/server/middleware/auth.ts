import type { Request, Response, NextFunction } from 'express'

const apiKey = process.env.GM_API_KEY
if (!apiKey) throw new Error('GM_API_KEY env var is required — set it in .env.local')

/** Express middleware that validates the `Authorization: Bearer <GM_API_KEY>` header on all `/gm/*` routes. */
export function requireGmKey(req: Request, res: Response, next: NextFunction): void {
  const auth = req.headers['authorization']
  if (!auth || !auth.startsWith('Bearer ') || auth.slice(7) !== apiKey) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  next()
}
