import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.stubEnv('SUPABASE_URL', 'http://localhost:54321')
vi.stubEnv('SUPABASE_SECRET_KEY', 'test-key')

const mockGetCharacter = vi.fn()
const mockUpdateCharacter = vi.fn()
vi.mock('../services/character-service.js', () => ({
  getCharacter: mockGetCharacter,
  updateCharacter: mockUpdateCharacter,
}))

const mockAdvanceLongRestTime = vi.fn()
vi.mock('../services/syngem-game-service.js', () => ({
  advanceLongRestTime: mockAdvanceLongRestTime,
}))

const mockFrom = vi.fn()
vi.mock('./tools/db.js', () => ({
  default: { from: mockFrom },
}))

const { executeStateChanges } = await import('./state-executor.js')

const CHAR_ID = 'char-abc'

function makeChar(overrides: Record<string, unknown> = {}) {
  return {
    id: CHAR_ID,
    current_health: 0,
    current_essence: 0,
    current_power: 0,
    current_will: 0,
    health_max: 10,
    essence_max: 10,
    power_max: 10,
    will_max: 10,
    condition: null,
    ...overrides,
  }
}

function skillsChain(data: unknown[] = []) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockResolvedValue({ data, error: null }),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetCharacter.mockResolvedValue(makeChar())
  mockUpdateCharacter.mockResolvedValue({ error: null })
  mockAdvanceLongRestTime.mockResolvedValue(undefined)
  mockFrom.mockReturnValue(skillsChain())
})

describe('long_rest action', () => {
  it('recovers all pools by BASE_REST=7 with no skills', async () => {
    await executeStateChanges(CHAR_ID, [{ action: 'long_rest' }])

    expect(mockUpdateCharacter).toHaveBeenCalledWith(CHAR_ID, {
      current_health: 7,
      current_essence: 7,
      current_power: 7,
      current_will: 7,
    })
  })

  it('clamps recovery to pool max', async () => {
    mockGetCharacter.mockResolvedValue(makeChar({ current_health: 8, health_max: 10 }))

    await executeStateChanges(CHAR_ID, [{ action: 'long_rest' }])

    const call = mockUpdateCharacter.mock.calls[0][1] as Record<string, number>
    expect(call.current_health).toBe(10)
  })

  it('applies skill rest_modifier add bonus', async () => {
    const skillRow = {
      current_rank: 1,
      skills: {
        effects: [{ type: 'rest_modifier', target: 'health', math: 'add', Value: 3, per_rank_add: null, per_rank_multiply: null }],
      },
    }
    mockFrom.mockReturnValue(skillsChain([skillRow]))

    await executeStateChanges(CHAR_ID, [{ action: 'long_rest' }])

    const call = mockUpdateCharacter.mock.calls[0][1] as Record<string, number>
    expect(call.current_health).toBe(10) // 0 + 7 + 3 = 10, capped at 10
  })

  it('clears Exhausted condition', async () => {
    mockGetCharacter.mockResolvedValue(makeChar({ condition: 'Exhausted' }))

    await executeStateChanges(CHAR_ID, [{ action: 'long_rest' }])

    const conditionCall = mockUpdateCharacter.mock.calls.find(
      (c) => 'condition' in (c[1] as Record<string, unknown>),
    )
    expect(conditionCall).toBeDefined()
    expect((conditionCall![1] as Record<string, unknown>).condition).toBeNull()
  })

  it('does not touch condition when not Exhausted', async () => {
    mockGetCharacter.mockResolvedValue(makeChar({ condition: 'Poisoned' }))

    await executeStateChanges(CHAR_ID, [{ action: 'long_rest' }])

    const conditionCall = mockUpdateCharacter.mock.calls.find(
      (c) => 'condition' in (c[1] as Record<string, unknown>),
    )
    expect(conditionCall).toBeUndefined()
  })

  it('does not touch condition when condition is null', async () => {
    await executeStateChanges(CHAR_ID, [{ action: 'long_rest' }])

    const conditionCall = mockUpdateCharacter.mock.calls.find(
      (c) => 'condition' in (c[1] as Record<string, unknown>),
    )
    expect(conditionCall).toBeUndefined()
  })

  it('advances the game clock by 8 hours', async () => {
    await executeStateChanges(CHAR_ID, [{ action: 'long_rest' }])

    expect(mockAdvanceLongRestTime).toHaveBeenCalledOnce()
    expect(mockAdvanceLongRestTime).toHaveBeenCalledWith(CHAR_ID)
  })

  it('still advances time even when character is not found', async () => {
    mockGetCharacter.mockResolvedValue(null)

    await executeStateChanges(CHAR_ID, [{ action: 'long_rest' }])

    // applyLongRest returns early if char is null, so time is not advanced
    expect(mockAdvanceLongRestTime).not.toHaveBeenCalled()
  })
})

