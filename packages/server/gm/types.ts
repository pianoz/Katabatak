import { z } from 'zod'
import type { Database } from '@db-types'
import type { FullCharacter } from '../services/character-service.js'
import type { GameWithMembers, EncounterWithCreatures } from '../services/game-service.js'
import type { SyngemGameRow } from '../services/syngem-game-service.js'

export type CharacterRow = Database['public']['Tables']['characters']['Row']

// ─── Conversation ────────────────────────────────────────────────────────────

/** A single persisted turn in the GM conversation history. */
export interface ConversationTurn {
  role: 'player' | 'assistant'
  content: string
}

/** Input to the main SYNGEM pipeline handler. */
export interface GMMessageInput {
  message: string
  characterId: string
  userId?: string
  gameId?: string
  checkResolution?: CheckResolution
  /** BYOK: user-supplied Anthropic API key. Used per-request only — never stored. */
  anthropicApiKey?: string
  /** Correlation ID generated at the Express layer — threads through all pipeline stages for admin trace. */
  requestId?: string
  /** Output ref: populated by the handler with per-stage wall-clock timings after the architect stream closes. */
  _timingOut?: { hydratorMs?: number; loreMs?: number; architectMs?: number }
}

export type ToolResult = Record<string, unknown> & { error?: string }

// ─── Context block (Auto-Hydrator output) ────────────────────────────────────

// ─── NPC profile types ────────────────────────────────────────────────────────

/** Time-of-day location schedule stored in personality_profile.routine */
export interface NpcRoutine {
  morning?: string
  afternoon?: string
  evening?: string
  night?: string
}

/** Compressed per-NPC memory updated by the Ledger on significant interactions */
export interface NpcMemory {
  last_encounter_summary?: string
  known_facts?: string[]
  last_encounter_tick?: number
  relationship_arc?: string
}

export interface NpcCurrentTask {
  description: string
  target_location_id: string
  assigned_tick: number
}

/** Structure of the npcs.personality_profile JSONB column */
export interface NpcPersonalityProfile {
  personality?: string
  /** Fallback location when no routine slot matches, or when no routine is defined */
  home_location_id?: string
  routine?: NpcRoutine
  memory?: NpcMemory
  current_task?: NpcCurrentTask | null
}

/** NPC mutations the Ledger can emit — only for semantically significant events */
export interface NpcMutations {
  disposition_delta?: number
  memory_append?: string
  known_facts_append?: string[]
  current_task?: NpcCurrentTask | null
  current_location_id?: string
  is_alive?: boolean
  following_character_id?: string | null
}

/** Enriched NPC data surfaced to the Architect — computed by the Auto-Hydrator */
export interface EnrichedNpc {
  id: string
  name: string
  title: string | null
  faction: string | null
  disposition: number
  dispositionLabel: 'hostile' | 'wary' | 'neutral' | 'friendly'
  isFollowing: boolean
  lastEncounterSummary: string | null
  currentTask: NpcCurrentTask | null
  /** Populated only for party members (isFollowing === true) */
  personality: string | null
  /** One-liner for bystanders (isFollowing === false) */
  smallSummary: string | null
}

// ─── World entities ───────────────────────────────────────────────────────────

/** Minimal world-entity data surfaced to agents for the player's current location. */
export interface LocationEntity {
  id: string
  name: string
  short_description: string
  long_description: string
}

/** Full world-entity data for entities physically present at the player's location. */
export interface LocationEntityFull extends LocationEntity {
  type: string
  data: Record<string, unknown>
}

/** GM-only notes for an active quest, fetched from quest_templates. Not shown to the player. */
export interface ActiveQuestNote {
  questId: string
  gmNotes: string
}

/** All context assembled by the Auto-Hydrator and passed down the SYNGEM pipeline. */
export interface ContextBlock {
  character: FullCharacter
  game: GameWithMembers | null
  syngemGame: SyngemGameRow | null
  healthText: string
  essenceText: string
  powerText: string
  willText: string
  locationEntities: LocationEntity[]
  /** Character-scoped improvised entities at the current location (from improvised_entities table). */
  improvisedEntities: LocationEntity[]
  /** Canonical world_entities that are children of the player's current place. */
  entitiesAtLocation: LocationEntityFull[]
  /** Other places/locations in the same region as the player's current place. */
  connectedLocations: Array<{ id: string; name: string; short_description: string }>
  encounterData: EncounterWithCreatures | null
  npcs: EnrichedNpc[]
  /** Subset of character inventory flagged as tracked (equipped + quest/special items). */
  trackedInventory: FullCharacter['inventory']
  inventoryWeight: { current: number; max: number }
  backstory: string | null
  physicalDescription: string | null
  activeQuestNotes: ActiveQuestNote[]
}

// ─── Lore-Engine output ───────────────────────────────────────────────────────

/** A world-search query emitted by the Lore-Engine when the player's intent requires lore lookup. */
export interface SearchObject {
  action: string
  target: string
  container: string
}

/** Structured classification produced by the Lore-Engine for a single player message. */
export interface LoreEngineOutput {
  action_type: 'info' | 'task' | 'attack'
  requires_check: boolean
  difficulty?: number
  pool?: 'Power' | 'Essence' | 'Will'
  check_description?: string
  search_objects?: SearchObject[]
  narrative_notes?: string
}

// ─── Check flow ───────────────────────────────────────────────────────────────

/** Yielded by the pipeline handler when a skill check must be resolved before the narrative continues. */
export interface CheckRequired {
  type: 'check_required'
  difficulty: number
  pool: 'Power' | 'Essence' | 'Will'
  check_description: string
}

/** Player's resolution of a check — either spending from a pool (auto-success) or rolling a d20. */
export interface CheckResolution {
  choice: 'spend' | 'roll'
  pool: 'Power' | 'Essence' | 'Will'
  roll_result?: number
  pool_contributed?: number
  succeeded?: boolean
}

// ─── Location context (passed from handler into Ledger + StateExecutor) ──────

/** Canonical location breadcrumb extracted from the character's current position. */
export interface LocationContext {
  locationPlaceId: string | null
  placeContext: string | null
  regionContext: string | null
  nationContext: string | null
}

// ─── Ledger output ────────────────────────────────────────────────────────────

/** Discriminated union of world-state mutations that the Ledger can produce. */
export type LedgerOutput =
  | { action: 'move_character'; destination_entity_id: string }
  | { action: 'update_entity'; entity_id: string; mutations: Record<string, unknown> }
  | { action: 'create_entity'; entity: Record<string, unknown> }
  | { action: 'delete_entity'; entity_id: string; replacement_description: string }
  | { action: 'update_npc'; npc_id: string; mutations: NpcMutations }
  | { action: 'long_rest' }
  | { action: 'grant_item'; item_name: string; item_type: string; description?: string; quantity?: number }

// ─── Runtime schemas ──────────────────────────────────────────────────────────

const NpcMutationsSchema = z.object({
  disposition_delta: z.number().optional(),
  memory_append: z.string().optional(),
  known_facts_append: z.array(z.string()).optional(),
  current_task: z
    .object({ description: z.string(), target_location_id: z.string(), assigned_tick: z.number() })
    .nullable()
    .optional(),
  current_location_id: z.string().optional(),
  is_alive: z.boolean().optional(),
  following_character_id: z.string().nullable().optional(),
})

export const LedgerOutputSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('move_character'), destination_entity_id: z.string() }),
  z.object({ action: z.literal('update_entity'), entity_id: z.string(), mutations: z.record(z.unknown()) }),
  z.object({ action: z.literal('create_entity'), entity: z.record(z.unknown()) }),
  z.object({ action: z.literal('delete_entity'), entity_id: z.string(), replacement_description: z.string() }),
  z.object({ action: z.literal('update_npc'), npc_id: z.string(), mutations: NpcMutationsSchema }),
  z.object({ action: z.literal('long_rest') }),
  z.object({
    action: z.literal('grant_item'),
    item_name: z.string(),
    item_type: z.string(),
    description: z.string().optional(),
    quantity: z.number().optional(),
  }),
])

const SearchObjectSchema = z.object({ action: z.string(), target: z.string(), container: z.string() })

export const LoreEngineOutputSchema = z.object({
  action_type: z.enum(['info', 'task', 'attack']),
  requires_check: z.boolean(),
  difficulty: z.number().optional(),
  pool: z.enum(['Power', 'Essence', 'Will']).optional(),
  check_description: z.string().optional(),
  search_objects: z.array(SearchObjectSchema).optional(),
  narrative_notes: z.string().optional(),
})
