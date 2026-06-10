export type AgentSlug = 'lore-engine' | 'architect1' | 'ledger' | 'scribe' | 'character-builder'

export type BlockKind = 'system' | 'context' | 'history' | 'user-input'

export type ExpectedOutputKind =
  | 'lore-engine'
  | 'ledger'
  | 'scribe'
  | 'character-creator'
  | 'none'

export interface BlockDef {
  id: string
  label: string
  kind: BlockKind
  hydrateTables?: string[]
  optional?: boolean
  description: string
}

export interface AgentConfig {
  slug: AgentSlug
  displayName: string
  model: string
  maxTokens: number
  temperature: number
  blocks: BlockDef[]
  producesJson: boolean
  expectedOutputKind: ExpectedOutputKind
  userInputLabel: string
  userInputPlaceholder: string
}

export const AGENT_CONFIGS: Record<AgentSlug, AgentConfig> = {
  'lore-engine': {
    slug: 'lore-engine',
    displayName: 'Lore-Engine',
    model: 'claude-haiku-4-5-20251001',
    maxTokens: 300,
    temperature: 0,
    producesJson: true,
    expectedOutputKind: 'lore-engine',
    userInputLabel: 'Player Input',
    userInputPlaceholder: 'Enter what the player says or does…',
    blocks: [
      {
        id: 'system',
        label: 'System Prompt',
        kind: 'system',
        description: 'Loaded from prompt_versions slug=lore-engine, or fallback constant.',
      },
      {
        id: 'context',
        label: 'Game State',
        kind: 'context',
        hydrateTables: ['character', 'inventory', 'location', 'npcs', 'encounter'],
        description: 'Character stats, location, inventory, nearby NPCs, combat state.',
      },
      {
        id: 'history',
        label: 'Recent History',
        kind: 'history',
        optional: true,
        hydrateTables: ['recent_history'],
        description: 'Last 4 turns from conversation_turns for this character.',
      },
      {
        id: 'user-input',
        label: 'Player Input',
        kind: 'user-input',
        description: 'The player\'s action or question, injected from the test case.',
      },
    ],
  },

  architect1: {
    slug: 'architect1',
    displayName: 'Architect',
    model: 'claude-sonnet-4-6',
    maxTokens: 1024,
    temperature: 0.8,
    producesJson: false,
    expectedOutputKind: 'none',
    userInputLabel: 'Player Input',
    userInputPlaceholder: 'Enter what the player says or does…',
    blocks: [
      {
        id: 'system-base',
        label: 'Base System Prompt',
        kind: 'system',
        description: 'Loaded from prompt_versions slug=architect1, or style file fallback.',
      },
      {
        id: 'system-summary',
        label: 'Story So Far',
        kind: 'system',
        optional: true,
        hydrateTables: ['summary'],
        description: 'Scribe summary block injected if one exists for the character.',
      },
      {
        id: 'system-quests',
        label: 'Quests & Objectives',
        kind: 'system',
        optional: true,
        hydrateTables: ['quest_objectives'],
        description: 'Active quest objectives from the character\'s quest_objectives JSON.',
      },
      {
        id: 'system-quest-notes',
        label: 'Quest GM Notes',
        kind: 'system',
        optional: true,
        hydrateTables: ['quest_notes'],
        description: 'GM-only quest context from activeQuestNotes. Not revealed to the player.',
      },
      {
        id: 'context',
        label: 'Context Block',
        kind: 'context',
        hydrateTables: ['character', 'inventory', 'location', 'npcs', 'encounter', 'syngem_game'],
        description: 'Full serialized character state passed as the first user message.',
      },
      {
        id: 'history',
        label: 'Recent History',
        kind: 'history',
        optional: true,
        hydrateTables: ['recent_history'],
        description: 'Last 4 turns from conversation_turns for this character.',
      },
      {
        id: 'user-input',
        label: 'Player Input',
        kind: 'user-input',
        description: 'The player\'s action, appended as the final user message.',
      },
    ],
  },

  ledger: {
    slug: 'ledger',
    displayName: 'Ledger',
    model: 'claude-sonnet-4-6',
    maxTokens: 500,
    temperature: 0,
    producesJson: true,
    expectedOutputKind: 'ledger',
    userInputLabel: 'GM Narrative',
    userInputPlaceholder: 'Paste a sample GM narrative (Architect output) here…',
    blocks: [
      {
        id: 'system',
        label: 'System Prompt',
        kind: 'system',
        description: 'Loaded from prompt_versions slug=ledger, or fallback constant.',
      },
      {
        id: 'context',
        label: 'Character + Location',
        kind: 'context',
        hydrateTables: ['character', 'location'],
        description: 'Character ID and current location chain.',
      },
      {
        id: 'user-input',
        label: 'GM Narrative',
        kind: 'user-input',
        description: 'The Architect\'s narrative output — the Ledger extracts state changes from this.',
      },
    ],
  },

  scribe: {
    slug: 'scribe',
    displayName: 'Scribe',
    model: 'claude-haiku-4-5-20251001',
    maxTokens: 1500,
    temperature: 0.5,
    producesJson: true,
    expectedOutputKind: 'scribe',
    userInputLabel: 'Turns to Summarize',
    userInputPlaceholder: '[PLAYER]: ...\n[GM]: ...\n[PLAYER]: ...\n[GM]: ...',
    blocks: [
      {
        id: 'system',
        label: 'System Prompt',
        kind: 'system',
        description: 'Loaded from prompt_versions slug=scribe, or fallback constant.',
      },
      {
        id: 'history',
        label: 'Prior Summary',
        kind: 'history',
        optional: true,
        hydrateTables: ['summary'],
        description: 'Existing Scribe summary for the character, if one exists.',
      },
      {
        id: 'user-input',
        label: 'Turns to Summarize',
        kind: 'user-input',
        description: 'Conversation turns in [PLAYER]/[GM] format for the Scribe to compress.',
      },
    ],
  },

  'character-builder': {
    slug: 'character-builder',
    displayName: 'Character Creator',
    model: 'claude-sonnet-4-6',
    maxTokens: 1200,
    temperature: 0.9,
    producesJson: true,
    expectedOutputKind: 'character-creator',
    userInputLabel: 'Q&A Input',
    userInputPlaceholder:
      'Q: What is your character\'s name?\nA: Kaelen\n\nQ: What drives your character?\nA: A quest for redemption…',
    blocks: [
      {
        id: 'system',
        label: 'System Prompt',
        kind: 'system',
        description: 'Loaded from prompt_versions slug=character-builder, or fallback constant.',
      },
      {
        id: 'user-input',
        label: 'Q&A Input',
        kind: 'user-input',
        description: 'Character creation Q&A pairs provided by the user.',
      },
    ],
  },
}

export const AGENT_SLUGS = Object.keys(AGENT_CONFIGS) as AgentSlug[]
