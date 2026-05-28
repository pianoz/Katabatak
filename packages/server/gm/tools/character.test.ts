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

const { update_stat, update_level, restore_pools } = await import('./character.js')

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

describe('update_stat', () => {
  describe('pool stats', () => {
    it('reduces current_health by delta', async () => {
      mockGetCharacter.mockResolvedValue(fakeChar)
      const result = await update_stat({ character_id: 'char-1', stat: 'current_health', delta: -3 })
      expect(result).toMatchObject({ name: 'Aldric', current_health: 5, health_max: 10 })
    })

    it('clamps health to 0 on overkill', async () => {
      mockGetCharacter.mockResolvedValue(fakeChar)
      const result = await update_stat({ character_id: 'char-1', stat: 'current_health', delta: -100 })
      expect(result).toMatchObject({ current_health: 0 })
    })

    it('clamps health to max on overheal', async () => {
      mockGetCharacter.mockResolvedValue(fakeChar)
      const result = await update_stat({ character_id: 'char-1', stat: 'current_health', delta: 100 })
      expect(result).toMatchObject({ current_health: 10 })
    })

    it('adjusts current_essence', async () => {
      mockGetCharacter.mockResolvedValue(fakeChar)
      const result = await update_stat({ character_id: 'char-1', stat: 'current_essence', delta: 3 })
      expect(result).toMatchObject({ current_essence: 8, essence_max: 10 })
    })

    it('adjusts current_power', async () => {
      mockGetCharacter.mockResolvedValue(fakeChar)
      const result = await update_stat({ character_id: 'char-1', stat: 'current_power', delta: -2 })
      expect(result).toMatchObject({ current_power: 4 })
    })

    it('adjusts current_will', async () => {
      mockGetCharacter.mockResolvedValue(fakeChar)
      const result = await update_stat({ character_id: 'char-1', stat: 'current_will', delta: 2 })
      expect(result).toMatchObject({ current_will: 9, will_max: 10 })
    })
  })

  describe('simple fields', () => {
    it('increases denarius', async () => {
      mockGetCharacter.mockResolvedValue(fakeChar)
      const result = await update_stat({ character_id: 'char-1', stat: 'denarius', delta: 20 })
      expect(result).toMatchObject({ name: 'Aldric', denarius: 70 })
    })

    it('clamps denarius to 0 on overspend', async () => {
      mockGetCharacter.mockResolvedValue(fakeChar)
      const result = await update_stat({ character_id: 'char-1', stat: 'denarius', delta: -200 })
      expect(result).toMatchObject({ denarius: 0 })
    })

    it('adjusts unused_skill_points', async () => {
      mockGetCharacter.mockResolvedValue(fakeChar)
      const result = await update_stat({ character_id: 'char-1', stat: 'unused_skill_points', delta: 3 })
      expect(result).toMatchObject({ unused_skill_points: 5 })
    })

    it('adjusts speed', async () => {
      mockGetCharacter.mockResolvedValue(fakeChar)
      const result = await update_stat({ character_id: 'char-1', stat: 'speed', delta: 5 })
      expect(result).toMatchObject({ speed: 35 })
    })
  })

  it('returns error for unknown stat', async () => {
    const result = await update_stat({ character_id: 'char-1', stat: 'bogus_stat', delta: 1 })
    expect(result.error).toMatch(/Unknown stat/)
  })

  it('returns error when character not found', async () => {
    mockGetCharacter.mockResolvedValue(null)
    const result = await update_stat({ character_id: 'missing', stat: 'current_health', delta: -1 })
    expect(result.error).toBe('Character not found')
  })

  it('returns error when updateCharacter fails', async () => {
    mockGetCharacter.mockResolvedValue(fakeChar)
    mockUpdateCharacter.mockResolvedValue({ error: 'DB write failed' })
    const result = await update_stat({ character_id: 'char-1', stat: 'current_health', delta: -1 })
    expect(result.error).toBe('DB write failed')
  })
})

describe('update_level', () => {
  it('sets level and adds awarded skill points to existing', async () => {
    mockGetCharacter.mockResolvedValue(fakeChar)
    const result = await update_level({ character_id: 'char-1', new_level: 4, skill_points_to_award: 3 })
    expect(result).toMatchObject({ name: 'Aldric', level: 4, unused_skill_points: 5 })
  })

  it('defaults skill_points_to_award to 0', async () => {
    mockGetCharacter.mockResolvedValue(fakeChar)
    const result = await update_level({ character_id: 'char-1', new_level: 4 })
    expect(result).toMatchObject({ level: 4, unused_skill_points: 2 })
  })

  it('returns error when character not found', async () => {
    mockGetCharacter.mockResolvedValue(null)
    const result = await update_level({ character_id: 'missing', new_level: 5 })
    expect(result.error).toBe('Character not found')
  })

  it('returns error when updateCharacter fails', async () => {
    mockGetCharacter.mockResolvedValue(fakeChar)
    mockUpdateCharacter.mockResolvedValue({ error: 'DB error' })
    const result = await update_level({ character_id: 'char-1', new_level: 5 })
    expect(result.error).toBe('DB error')
  })
})

describe('restore_pools', () => {
  it('sets all pools to their max values', async () => {
    mockGetCharacter.mockResolvedValue(fakeChar)
    const result = await restore_pools({ character_id: 'char-1' })
    expect(result).toMatchObject({
      name: 'Aldric',
      current_health: 10,
      current_essence: 10,
      current_power: 10,
      current_will: 10,
    })
  })

  it('returns error when character not found', async () => {
    mockGetCharacter.mockResolvedValue(null)
    const result = await restore_pools({ character_id: 'missing' })
    expect(result.error).toBe('Character not found')
  })

  it('returns error when updateCharacter fails', async () => {
    mockGetCharacter.mockResolvedValue(fakeChar)
    mockUpdateCharacter.mockResolvedValue({ error: 'DB error' })
    const result = await restore_pools({ character_id: 'char-1' })
    expect(result.error).toBe('DB error')
  })
})
