/**
 * Bumper lanes: pre-Zod normalization for LLM string outputs.
 *
 * Each table maps a collapsed form (lowercase alphanumeric only) to its canonical value.
 * Edit these tables when you need to teach the system about new LLM phrasings.
 */

function collapse(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function applyBumperLane(value: unknown, map: Record<string, string>): unknown {
  if (typeof value !== 'string') return value
  return map[collapse(value)] ?? value
}

// ─── Ledger action names ───────────────────────────────────────────────────────

export const LEDGER_ACTIONS: Record<string, string> = {
  movecharacter: 'move_character',
  moveto: 'move_character',
  move: 'move_character',

  updateentity: 'update_entity',
  modifyentity: 'update_entity',

  createentity: 'create_entity',
  addentity: 'create_entity',
  newentity: 'create_entity',

  deleteentity: 'delete_entity',
  removeentity: 'delete_entity',
  destroyentity: 'delete_entity',

  updatenpc: 'update_npc',
  modifynpc: 'update_npc',

  longrest: 'long_rest',
  overnightrest: 'long_rest',
  fullrest: 'long_rest',
  sleep: 'long_rest',
  rest: 'long_rest',

  grantitem: 'grant_item',
  giveitem: 'grant_item',
  additem: 'grant_item',
  pickup: 'grant_item',
}

// ─── LoreEngine action_type values ────────────────────────────────────────────

export const LORE_ACTION_TYPES: Record<string, string> = {
  info: 'info',
  information: 'info',
  inquiry: 'info',
  explore: 'info',
  passive: 'info',

  task: 'task',
  action: 'task',
  attempt: 'task',

  attack: 'attack',
  combat: 'attack',
  fight: 'attack',
  strike: 'attack',
}

// ─── LoreEngine pool values ────────────────────────────────────────────────────

export const LORE_POOLS: Record<string, string> = {
  power: 'Power',
  strength: 'Power',
  physical: 'Power',
  constitution: 'Power',
  conviction: 'Power',

  essence: 'Essence',
  magic: 'Essence',
  perception: 'Essence',
  lore: 'Essence',

  will: 'Will',
  willpower: 'Will',
  mental: 'Will',
  social: 'Will',
  endurance: 'Will',
}

// ─── Quest objective status values ────────────────────────────────────────────

export const QUEST_STATUSES: Record<string, string> = {
  active: 'active',
  inprogress: 'active',
  ongoing: 'active',
  started: 'active',
  open: 'active',

  completed: 'completed',
  complete: 'completed',
  done: 'completed',
  finished: 'completed',
  success: 'completed',
  succeeded: 'completed',

  failed: 'failed',
  failure: 'failed',
  abandoned: 'failed',
  lost: 'failed',
}

// ─── grant_item item_type values ──────────────────────────────────────────────

export const ITEM_TYPES: Record<string, string> = {
  weapon: 'weapon',
  sword: 'weapon',
  blade: 'weapon',
  bow: 'weapon',
  staff: 'weapon',

  armor: 'armor',
  armour: 'armor',
  shield: 'armor',
  helm: 'armor',
  helmet: 'armor',

  consumable: 'consumable',
  potion: 'consumable',
  food: 'consumable',
  drink: 'consumable',
  scroll: 'consumable',

  misc: 'misc',
  miscellaneous: 'misc',
  other: 'misc',
  key: 'misc',
  tool: 'misc',
  trinket: 'misc',

  currency: 'currency',
  gold: 'currency',
  silver: 'currency',
  money: 'currency',
  dollars: 'currency',
  coin: 'currency',
  coins: 'currency',
  denarius: 'currency',
  denarii: 'currency',
}

// ─── NPC mutation field names ─────────────────────────────────────────────────

export const NPC_MUTATION_FIELDS: Record<string, string> = {
  knowledgeappend: 'knowledge_append',
  addknowledge: 'knowledge_append',
  appendknowledge: 'knowledge_append',
  knowledgeadd: 'knowledge_append',
  knownfactsappend: 'known_facts_append',
  addfact: 'known_facts_append',
  appendfact: 'known_facts_append',
}

// ─── Normalizer functions ──────────────────────────────────────────────────────

/** Normalizes a single raw Ledger action object before Zod parsing. */
export function normalizeLedgerAction(raw: Record<string, unknown>): Record<string, unknown> {
  const action = applyBumperLane(raw['action'], LEDGER_ACTIONS)
  const result: Record<string, unknown> = { ...raw, action }
  if (action === 'grant_item' && 'item_type' in result) {
    result['item_type'] = applyBumperLane(result['item_type'], ITEM_TYPES)
  }
  if (action === 'update_npc' && result['mutations'] && typeof result['mutations'] === 'object') {
    const rawMutations = result['mutations'] as Record<string, unknown>
    const normalized: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(rawMutations)) {
      const canonicalKey = NPC_MUTATION_FIELDS[collapse(key)] ?? key
      normalized[canonicalKey] = value
    }
    result['mutations'] = normalized
  }
  return result
}

/** Normalizes a raw LoreEngine output object before Zod parsing. */
export function normalizeLoreEngineRaw(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw
  const obj = raw as Record<string, unknown>
  return {
    ...obj,
    action_type: applyBumperLane(obj['action_type'], LORE_ACTION_TYPES),
    pool: applyBumperLane(obj['pool'], LORE_POOLS),
  }
}

/** Normalizes a raw Scribe output object's quest objective statuses before Zod parsing. */
export function normalizeScribeRaw(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw
  const obj = raw as Record<string, unknown>
  const questUpdates = obj['quest_updates']
  if (!questUpdates || typeof questUpdates !== 'object') return raw
  const qu = questUpdates as Record<string, unknown>
  const objectives = qu['objectives']
  if (!Array.isArray(objectives)) return raw
  return {
    ...obj,
    quest_updates: {
      ...qu,
      objectives: objectives.map((o: unknown) => {
        if (!o || typeof o !== 'object') return o
        const obj2 = o as Record<string, unknown>
        return { ...obj2, status: applyBumperLane(obj2['status'], QUEST_STATUSES) }
      }),
    },
  }
}
