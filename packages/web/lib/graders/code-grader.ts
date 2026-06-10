import type { AgentSlug } from './agent-config'
import {
  applyBumperLane,
  LEDGER_ACTIONS,
  LORE_ACTION_TYPES,
  LORE_POOLS,
  ITEM_TYPES,
  QUEST_STATUSES,
} from './bumper-lanes'

// ─── Expected output types ─────────────────────────────────────────────────────

export interface LoreEngineExpected {
  action_type?: 'info' | 'task' | 'attack'
  requires_check?: boolean
  pool?: 'Power' | 'Essence' | 'Will'
}

export interface LedgerExpectedAction {
  action: string
  item_type?: string
}

export interface LedgerExpected {
  actions: LedgerExpectedAction[]
}

export interface ScribeExpected {
  has_summary: boolean
  has_objectives_array: boolean
  has_completed_ids_array: boolean
}

export type ExpectedOutput =
  | { kind: 'lore-engine'; value: LoreEngineExpected }
  | { kind: 'ledger'; value: LedgerExpected }
  | { kind: 'scribe'; value: ScribeExpected }
  | { kind: 'character-creator' }
  | { kind: 'none' }

// ─── Result types ──────────────────────────────────────────────────────────────

export interface CodeGradeDetail {
  field: string
  expected: string
  got: string
  pass: boolean
}

export interface CodeGradeResult {
  passed: number
  total: number
  details: CodeGradeDetail[]
}

// ─── JSON parse helper ─────────────────────────────────────────────────────────

function parseJson(raw: string): unknown {
  const trimmed = raw.trim()
  // Strip markdown code fences if present
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/i)
  const jsonStr = fenced ? fenced[1].trim() : trimmed
  try {
    return JSON.parse(jsonStr)
  } catch {
    return null
  }
}

// ─── Per-agent graders ─────────────────────────────────────────────────────────

function gradeLoreEngine(raw: string, expected: LoreEngineExpected): CodeGradeResult {
  const details: CodeGradeDetail[] = []
  const parsed = parseJson(raw)

  // The Lore-Engine uses forced tool calling — response may be tool_use block or raw JSON
  let obj: Record<string, unknown> | null = null
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    obj = parsed as Record<string, unknown>
  }

  if (expected.action_type !== undefined) {
    const raw_val = obj?.action_type
    const normalized = String(applyBumperLane(raw_val, LORE_ACTION_TYPES))
    details.push({
      field: 'action_type',
      expected: expected.action_type,
      got: obj ? String(raw_val ?? '(missing)') : '(parse error)',
      pass: normalized === expected.action_type,
    })
  }

  if (expected.requires_check !== undefined) {
    const got_val = obj?.requires_check
    const got_bool = got_val === true || got_val === 'true'
    details.push({
      field: 'requires_check',
      expected: String(expected.requires_check),
      got: obj ? String(got_val ?? '(missing)') : '(parse error)',
      pass: got_bool === expected.requires_check,
    })
  }

  if (expected.pool !== undefined && expected.requires_check !== false) {
    const raw_val = obj?.pool
    const normalized = String(applyBumperLane(raw_val, LORE_POOLS))
    details.push({
      field: 'pool',
      expected: expected.pool,
      got: obj ? String(raw_val ?? '(missing)') : '(parse error)',
      pass: normalized === expected.pool,
    })
  }

  const passed = details.filter((d) => d.pass).length
  return { passed, total: details.length, details }
}

function gradeLedger(raw: string, expected: LedgerExpected): CodeGradeResult {
  const details: CodeGradeDetail[] = []
  const parsed = parseJson(raw)

  // Ledger output is an array of action objects; LLM may also return a single object
  const items: unknown[] = Array.isArray(parsed)
    ? parsed
    : parsed !== null
      ? [parsed]
      : []

  // Normalize all action fields
  const normalizedActions = items
    .filter((i): i is Record<string, unknown> => typeof i === 'object' && i !== null)
    .map((i) => {
      const action = String(applyBumperLane(i['action'], LEDGER_ACTIONS))
      const item_type =
        action === 'grant_item' && 'item_type' in i
          ? String(applyBumperLane(i['item_type'], ITEM_TYPES))
          : undefined
      return { action, item_type }
    })

  if (expected.actions.length === 0) {
    return { passed: 0, total: 0, details: [] }
  }

  for (const exp of expected.actions) {
    const canonicalAction = String(applyBumperLane(exp.action, LEDGER_ACTIONS))

    if (exp.item_type) {
      // Check for grant_item + matching item_type
      const canonicalItemType = String(applyBumperLane(exp.item_type, ITEM_TYPES))
      const found = normalizedActions.find(
        (a) => a.action === canonicalAction && a.item_type === canonicalItemType,
      )
      details.push({
        field: `action=${exp.action} item_type=${exp.item_type}`,
        expected: `${canonicalAction} + ${canonicalItemType}`,
        got:
          normalizedActions.length > 0
            ? normalizedActions.map((a) => `${a.action}${a.item_type ? `(${a.item_type})` : ''}`).join(', ')
            : '(no valid output)',
        pass: !!found,
      })
    } else {
      const found = normalizedActions.some((a) => a.action === canonicalAction)
      details.push({
        field: `action=${exp.action}`,
        expected: canonicalAction,
        got:
          normalizedActions.length > 0
            ? normalizedActions.map((a) => a.action).join(', ')
            : '(no valid output)',
        pass: found,
      })
    }
  }

  const passed = details.filter((d) => d.pass).length
  return { passed, total: details.length, details }
}

function gradeScribe(raw: string, expected: ScribeExpected): CodeGradeResult {
  const details: CodeGradeDetail[] = []
  const parsed = parseJson(raw)
  const obj =
    parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null

  if (expected.has_summary) {
    const summary = obj?.summary
    const pass = typeof summary === 'string' && summary.trim().length > 0
    details.push({
      field: 'summary',
      expected: 'non-empty string',
      got: obj ? (typeof summary === 'string' ? `"${summary.slice(0, 40)}…"` : String(summary ?? '(missing)')) : '(parse error)',
      pass,
    })
  }

  if (expected.has_objectives_array) {
    const qu = obj?.quest_updates
    const objectives = (qu as Record<string, unknown> | undefined)?.objectives
    const pass = Array.isArray(objectives)

    // Extra check: normalize each objective status
    let statusNote = ''
    if (pass && Array.isArray(objectives) && objectives.length > 0) {
      const badStatuses = objectives.filter((o) => {
        if (typeof o !== 'object' || !o) return false
        const status = (o as Record<string, unknown>).status
        const normalized = applyBumperLane(status, QUEST_STATUSES)
        return !['active', 'completed', 'failed'].includes(String(normalized))
      })
      if (badStatuses.length > 0) {
        statusNote = ` (${badStatuses.length} objective(s) have invalid status)`
      }
    }

    details.push({
      field: 'quest_updates.objectives',
      expected: 'array',
      got: obj
        ? Array.isArray(objectives)
          ? `array[${objectives.length}]${statusNote}`
          : String(objectives ?? '(missing)')
        : '(parse error)',
      pass,
    })
  }

  if (expected.has_completed_ids_array) {
    const qu = obj?.quest_updates
    const completed = (qu as Record<string, unknown> | undefined)?.completed_quest_ids
    const pass = Array.isArray(completed)
    details.push({
      field: 'quest_updates.completed_quest_ids',
      expected: 'array',
      got: obj
        ? Array.isArray(completed)
          ? `array[${completed.length}]`
          : String(completed ?? '(missing)')
        : '(parse error)',
      pass,
    })
  }

  const passed = details.filter((d) => d.pass).length
  return { passed, total: details.length, details }
}

function gradeCharacterCreator(raw: string): CodeGradeResult {
  const REQUIRED_FIELDS = [
    'background_primary',
    'physical_description',
    'backstory',
    'story_hook',
    'initial_quest',
  ] as const

  const parsed = parseJson(raw)
  const obj =
    parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null

  const details: CodeGradeDetail[] = REQUIRED_FIELDS.map((field) => {
    const val = obj?.[field]
    const pass =
      field === 'initial_quest'
        ? typeof val === 'object' && val !== null
        : typeof val === 'string' && (val as string).trim().length > 0
    return {
      field,
      expected: field === 'initial_quest' ? 'object' : 'non-empty string',
      got: obj ? (val !== undefined ? JSON.stringify(val).slice(0, 60) : '(missing)') : '(parse error)',
      pass,
    }
  })

  const passed = details.filter((d) => d.pass).length
  return { passed, total: details.length, details }
}

// ─── Main entry point ──────────────────────────────────────────────────────────

export function gradeOutput(
  rawResponse: string,
  expected: ExpectedOutput,
  _agentSlug: AgentSlug,
): CodeGradeResult {
  switch (expected.kind) {
    case 'lore-engine':
      return gradeLoreEngine(rawResponse, expected.value)
    case 'ledger':
      return gradeLedger(rawResponse, expected.value)
    case 'scribe':
      return gradeScribe(rawResponse, expected.value)
    case 'character-creator':
      return gradeCharacterCreator(rawResponse)
    case 'none':
      return { passed: 0, total: 0, details: [] }
  }
}
