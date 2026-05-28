import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.stubEnv('SUPABASE_URL', 'http://localhost:54321')
vi.stubEnv('SUPABASE_SECRET_KEY', 'test-key')

vi.mock('./db.js', () => ({ default: { from: vi.fn() } }))

const mockGetCharacter = vi.fn()
const mockUpdateCharacter = vi.fn()
vi.mock('../../services/character-service.js', () => ({
  getCharacter: mockGetCharacter,
  updateCharacter: mockUpdateCharacter,
}))

const mockSearchWorldEntities = vi.fn()
const mockGetCampaignFacts = vi.fn()
const mockGetNpcsForGame = vi.fn()
vi.mock('../../services/world-service.js', () => ({
  searchWorldEntities: mockSearchWorldEntities,
  getCampaignFacts: mockGetCampaignFacts,
  getNpcsForGame: mockGetNpcsForGame,
}))

const mockGetGameAllyCharacters = vi.fn()
const mockGetActiveEncounter = vi.fn()
vi.mock('../../services/game-service.js', () => ({
  getGameAllyCharacters: mockGetGameAllyCharacters,
  getActiveEncounter: mockGetActiveEncounter,
}))

const mockGetNpcResponse = vi.fn()
vi.mock('../agents/npc.js', () => ({ getNpcResponse: mockGetNpcResponse }))

const { executeTool } = await import('./index.js')

const fakeChar = {
  id: 'char-1',
  name: 'Aldric',
  level: 3,
  current_health: 8,
  health_max: 10,
  current_essence: 5,
  essence_max: 10,
  current_power: 6,
  power_max: 10,
  current_will: 7,
  will_max: 10,
  denarius: 50,
  unused_skill_points: 2,
  speed: 30,
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUpdateCharacter.mockResolvedValue({ error: null })
})

describe('executeTool – stat name normalization', () => {
  it('maps "health" → current_health', async () => {
    mockGetCharacter.mockResolvedValue(fakeChar)
    const result = await executeTool('update_stat', { stat: 'health', delta: -2 }, 'char-1')
    expect(result).toMatchObject({ current_health: 6 })
  })

  it('maps "hp" → current_health', async () => {
    mockGetCharacter.mockResolvedValue(fakeChar)
    const result = await executeTool('update_stat', { stat: 'hp', delta: 1 }, 'char-1')
    expect(result).toMatchObject({ current_health: 9 })
  })

  it('maps "mana" → current_essence', async () => {
    mockGetCharacter.mockResolvedValue(fakeChar)
    const result = await executeTool('update_stat', { stat: 'mana', delta: -2 }, 'char-1')
    expect(result).toMatchObject({ current_essence: 3 })
  })

  it('maps "gold" → denarius', async () => {
    mockGetCharacter.mockResolvedValue(fakeChar)
    const result = await executeTool('update_stat', { stat: 'gold', delta: 10 }, 'char-1')
    expect(result).toMatchObject({ denarius: 60 })
  })

  it('maps "skill_points" → unused_skill_points', async () => {
    mockGetCharacter.mockResolvedValue(fakeChar)
    const result = await executeTool('update_stat', { stat: 'skill_points', delta: 1 }, 'char-1')
    expect(result).toMatchObject({ unused_skill_points: 3 })
  })

  it('maps "willpower" → current_will', async () => {
    mockGetCharacter.mockResolvedValue(fakeChar)
    const result = await executeTool('update_stat', { stat: 'willpower', delta: -1 }, 'char-1')
    expect(result).toMatchObject({ current_will: 6 })
  })

  it('returns error for unknown stat alias', async () => {
    const result = await executeTool('update_stat', { stat: 'stamina', delta: 1 }, 'char-1')
    expect(result.error).toMatch(/Unknown stat/)
  })
})

describe('executeTool – character tools', () => {
  it('dispatches update_level', async () => {
    mockGetCharacter.mockResolvedValue(fakeChar)
    const result = await executeTool('update_level', { new_level: 5 }, 'char-1')
    expect(result).toMatchObject({ name: 'Aldric', level: 5 })
  })

  it('dispatches restore_pools', async () => {
    mockGetCharacter.mockResolvedValue(fakeChar)
    const result = await executeTool('restore_pools', {}, 'char-1')
    expect(result).toMatchObject({ current_health: 10, current_essence: 10, current_power: 10, current_will: 10 })
  })

  it('injects characterId into input', async () => {
    mockGetCharacter.mockResolvedValue(fakeChar)
    await executeTool('restore_pools', {}, 'char-1')
    expect(mockGetCharacter).toHaveBeenCalledWith('char-1')
  })
})

describe('executeTool – world tools', () => {
  it('search_world_entities returns results', async () => {
    mockSearchWorldEntities.mockResolvedValue([{ id: 'e1', name: 'Ironhold' }])
    const result = await executeTool('search_world_entities', { query: 'iron' })
    expect(result).toMatchObject({ results: [{ name: 'Ironhold' }] })
  })

  it('search_world_entities passes filter_type', async () => {
    mockSearchWorldEntities.mockResolvedValue([])
    await executeTool('search_world_entities', { query: 'castle', filter_type: 'place' })
    expect(mockSearchWorldEntities).toHaveBeenCalledWith('castle', 'place')
  })

  it('get_campaign_facts returns facts for active game', async () => {
    mockGetCampaignFacts.mockResolvedValue(['King is dead', 'Plague spreads'])
    const result = await executeTool('get_campaign_facts', {}, undefined, 'game-1')
    expect(result).toMatchObject({ facts: ['King is dead', 'Plague spreads'] })
  })

  it('get_campaign_facts errors without gameId', async () => {
    const result = await executeTool('get_campaign_facts', {})
    expect(result.error).toBe('No active game session')
  })
})

describe('executeTool – game tools', () => {
  it('get_ally_characters returns mapped ally data', async () => {
    mockGetGameAllyCharacters.mockResolvedValue([
      { name: 'Sable', level: 2, class_archetype: 'Rogue', current_health: 6, health_max: 8 },
    ])
    const result = await executeTool('get_ally_characters', {}, 'char-1', 'game-1')
    expect(result.allies).toHaveLength(1)
    expect((result.allies as { name: string }[])[0].name).toBe('Sable')
  })

  it('get_ally_characters errors without gameId', async () => {
    const result = await executeTool('get_ally_characters', {}, 'char-1')
    expect(result.error).toBe('No active game session')
  })

  it('get_active_encounter returns not-in-combat when no encounter', async () => {
    mockGetActiveEncounter.mockResolvedValue(null)
    const result = await executeTool('get_active_encounter', {}, undefined, 'game-1')
    expect(result).toMatchObject({ isInCombat: false })
  })

  it('get_active_encounter returns combat state with creatures', async () => {
    mockGetActiveEncounter.mockResolvedValue({
      creatures: [{ name: 'Goblin', current_health: 3, health_max: 5, is_alive: true }],
      turnOrder: ['char-1', 'goblin-1'],
      activeTurnIndex: 0,
    })
    const result = await executeTool('get_active_encounter', {}, undefined, 'game-1')
    expect(result).toMatchObject({ isInCombat: true, activeTurnIndex: 0 })
    expect((result.creatures as unknown[]).length).toBe(1)
  })

  it('get_active_encounter errors without gameId', async () => {
    const result = await executeTool('get_active_encounter', {})
    expect(result.error).toBe('No active game session')
  })
})

describe('executeTool – error handling', () => {
  it('returns error for unknown tool name', async () => {
    const result = await executeTool('cast_meteor', {})
    expect(result.error).toMatch(/Unknown tool/)
  })

  it('wraps thrown errors as string', async () => {
    mockGetCharacter.mockRejectedValue(new Error('Network timeout'))
    const result = await executeTool('restore_pools', {}, 'char-1')
    expect(result.error).toBe('Network timeout')
  })
})
