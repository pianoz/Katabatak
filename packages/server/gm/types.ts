import type { Database } from '@db-types'
import type { FullCharacter } from '../services/character-service.js'
import type { GameWithMembers, EncounterWithCreatures } from '../services/game-service.js'
import type { SyngemGameRow } from '../services/syngem-game-service.js'
import type { NpcRow } from '../services/world-service.js'

export type CharacterRow = Database['public']['Tables']['characters']['Row']

// ─── Conversation ────────────────────────────────────────────────────────────

export interface ConversationTurn {
  role: 'player' | 'assistant'
  content: string
}

export interface GMMessageInput {
  message: string
  characterId: string
  userId: string
  gameId?: string
  checkResolution?: CheckResolution
}

export type ToolResult = Record<string, unknown> & { error?: string }

// ─── Context block (Auto-Hydrator output) ────────────────────────────────────

export interface LocationEntity {
  id: string
  name: string
  short_description: string
}

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
}

// ─── Lore-Engine output ───────────────────────────────────────────────────────

export interface SearchObject {
  action: string
  target: string
  container: string
}

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

export interface CheckRequired {
  type: 'check_required'
  difficulty: number
  pool: 'Power' | 'Essence' | 'Will'
  check_description: string
}

export interface CheckResolution {
  choice: 'spend' | 'roll'
  pool: 'Power' | 'Essence' | 'Will'
  roll_result?: number
}

// ─── Ledger output ────────────────────────────────────────────────────────────

export type LedgerOutput =
  | { action: 'move_character'; destination_entity_id: string }
  | { action: 'update_entity'; entity_id: string; mutations: Record<string, unknown> }
  | { action: 'create_entity'; entity: Record<string, unknown> }
  | { action: 'delete_entity'; entity_id: string; replacement_description: string }
