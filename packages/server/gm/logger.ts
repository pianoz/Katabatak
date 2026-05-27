/** Dev-only SYNGEM pipeline logger. Writes to packages/server/logs/syngem-YYYY-MM-DD.log. No-ops in production. */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const IS_DEV = process.env.NODE_ENV !== 'production'

const LOGS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'logs')
let logsDirReady = false

export type LogLevel = 'verbose' | 'errors+' | 'errors' | 'silent'
let logLevel: LogLevel = 'verbose'

export function setLogLevel(level: LogLevel): void {
  logLevel = level
}

function shouldLog(msg: string, hasDetail: boolean): boolean {
  switch (logLevel) {
    case 'silent': return false
    case 'verbose': return true
    case 'errors': return msg.startsWith('⚠') || msg.startsWith('✗')
    case 'errors+': return msg.startsWith('⚠') || msg.startsWith('✗') || hasDetail
  }
}

function ensureLogsDir(): void {
  if (logsDirReady) return
  fs.mkdirSync(LOGS_DIR, { recursive: true })
  logsDirReady = true
}

function getLogPath(): string {
  return path.join(LOGS_DIR, `syngem-${new Date().toISOString().slice(0, 10)}.log`)
}

function writeEntry(tag: string, msg: string, detail?: unknown): void {
  ensureLogsDir()
  const ts = new Date().toISOString()
  const prefix = tag === 'HANDLER' && msg.startsWith('→ request') ? '\n' : ''
  let entry = `${prefix}${ts} [${tag}] ${msg}\n`
  if (detail !== undefined) {
    const serialized = typeof detail === 'string' ? detail : JSON.stringify(detail, null, 2)
    entry += serialized
      .split('\n')
      .map((line) => `              ${line}`)
      .join('\n') + '\n'
  }
  fs.appendFileSync(getLogPath(), entry, 'utf8')
}

/**
 * Writes a timestamped log entry to the daily log file.
 * Pass `detail` for a second indented block with serialized data (e.g. full JSON output).
 * Filtered by the current LogLevel — see setLogLevel().
 */
export function synLog(tag: string, msg: string, detail?: unknown): void {
  if (!IS_DEV) return
  if (!shouldLog(msg, detail !== undefined)) return
  writeEntry(tag, msg, detail)
}

/** Writes only when logLevel is 'verbose'. Use for large payloads (full prompts, raw responses). */
export function synLogVerbose(tag: string, msg: string, detail?: unknown): void {
  if (!IS_DEV || logLevel !== 'verbose') return
  writeEntry(tag, msg, detail)
}
