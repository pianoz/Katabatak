import type { Database } from '@db-types'
import type { FullCharacter } from '../services/character-service.js'
import type { GameWithMembers, EncounterWithCreatures } from '../services/game-service.js'
import type { SyngemGameRow } from '../services/syngem-game-service.js'
import type { NpcRow } from '../services/world-service.js'

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
  userId: string
  gameId?: string
  checkResolution?: CheckResolution
}

export type ToolResult = Record<string, unknown> & { error?: string }

// ─── Context block (Auto-Hydrator output) ────────────────────────────────────

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
  npcs: NpcRow[]
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
