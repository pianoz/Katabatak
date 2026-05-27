/** Dev-only SYNGEM pipeline logger. No-ops in production. */
const IS_DEV = process.env.NODE_ENV !== 'production'

const COLORS: Record<string, string> = {
  HANDLER:          '\x1b[36m',
  HYDRATOR:         '\x1b[34m',
  'LORE-ENGINE':    '\x1b[35m',
  ARCHITECT:        '\x1b[33m',
  LEDGER:           '\x1b[32m',
  'STATE-EXECUTOR': '\x1b[90m',
  SCRIBE:           '\x1b[31m',
  STYLE:            '\x1b[37m',
}
const R = '\x1b[0m'
const D = '\x1b[2m'

export function synLog(tag: string, msg: string): void {
  if (!IS_DEV) return
  const ts = new Date().toISOString().slice(11, 23)
  const color = COLORS[tag] ?? '\x1b[37m'
  console.log(`${D}${ts}${R} ${color}[${tag}]${R} ${msg}`)
}
