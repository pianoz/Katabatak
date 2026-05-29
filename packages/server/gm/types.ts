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
}

// ─── World entities ───────────────────────────────────────────────────────────

/** Minimal world-entity data surfaced to agents for the player's current location. */
export interface LocationEntity {
  id: string
  name: string
  short_description: string
  long_description: string
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
  encounterData: EncounterWithCreatures | null
  npcs: EnrichedNpc[]
  inventoryWeight: { current: number; max: number }
  backstory: string | null
  physicalDescription: string | null
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

/** Player's resolution of a check — either spending from a pool (auto-success) or rolling a d10. */
export interface CheckResolution {
  choice: 'spend' | 'roll'
  pool: 'Power' | 'Essence' | 'Will'
  roll_result?: number
}

// ─── Ledger output ────────────────────────────────────────────────────────────

/** Discriminated union of world-state mutations that the Ledger can produce. */
export type LedgerOutput =
  | { action: 'move_character'; destination_entity_id: string }
  | { action: 'update_entity'; entity_id: string; mutations: Record<string, unknown> }
  | { action: 'create_entity'; entity: Record<string, unknown> }
  | { action: 'delete_entity'; entity_id: string; replacement_description: string }
  | { action: 'update_npc'; npc_id: string; mutations: NpcMutations }
