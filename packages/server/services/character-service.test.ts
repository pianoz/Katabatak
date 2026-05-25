import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the Supabase singleton before importing anything that uses it
const mockSingle = vi.fn()
const mockUpdate = vi.fn()
const mockEq = vi.fn()
const mockSelect = vi.fn()
const mockFrom = vi.fn()

vi.mock('../gm/tools/db.js', () => ({
  default: {
    from: mockFrom,
  },
}))

// Also mock env so db.ts doesn't throw on import
vi.stubEnv('SUPABASE_URL', 'http://localhost:54321')
vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-key')

const { getCharacter, getFullCharacter, updateCharacter } = await import('./character-service.js')

const fakeChar = {
  id: 'char-1',
  name: 'Aldric',
  level: 3,
  class_archetype: 'Ranger',
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

function buildChain(resolvedValue: unknown) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(resolvedValue),
    update: vi.fn().mockReturnThis(),
    in: vi.fn().mockResolvedValue({ data: [], error: null }),
  }
  return chain
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getCharacter', () => {
  it('returns a character row on success', async () => {
    const chain = buildChain({ data: fakeChar, error: null })
    mockFrom.mockReturnValue(chain)

    const result = await getCharacter('char-1')
    expect(result).toMatchObject({ id: 'char-1', name: 'Aldric' })
  })

  it('returns null when Supabase returns an error', async () => {
    const chain = buildChain({ data: null, error: { message: 'not found' } })
    mockFrom.mockReturnValue(chain)

    const result = await getCharacter('missing-id')
    expect(result).toBeNull()
  })
})

describe('getFullCharacter', () => {
  it('returns null when character is not found', async () => {
    // First from() call is for characters table — return error
    const errorChain = buildChain({ data: null, error: { message: 'not found' } })
    // Subsequent from() calls for joins return empty
    const emptyChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: [], error: null }),
    }
    mockFrom
      .mockReturnValueOnce(errorChain)
      .mockReturnValue(emptyChain)

    const result = await getFullCharacter('missing-id')
    expect(result).toBeNull()
  })

  it('returns FullCharacter with all sub-collections on success', async () => {
    const charChain = buildChain({ data: fakeChar, error: null })
    const emptyChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: [], error: null }),
    }
    mockFrom
      .mockReturnValueOnce(charChain)
      .mockReturnValue(emptyChain)

    const result = await getFullCharacter('char-1')
    expect(result).not.toBeNull()
    expect(result?.character.name).toBe('Aldric')
    expect(Array.isArray(result?.inventory)).toBe(true)
    expect(Array.isArray(result?.skills)).toBe(true)
    expect(Array.isArray(result?.spells)).toBe(true)
  })
})

describe('updateCharacter', () => {
  it('returns { error: null } on success', async () => {
    const chain = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    }
    mockFrom.mockReturnValue(chain)

    const result = await updateCharacter('char-1', { current_health: 5 })
    expect(result.error).toBeNull()
  })

  it('returns { error: string } on failure', async () => {
    const chain = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: { message: 'DB error' } }),
    }
    mockFrom.mockReturnValue(chain)

    const result = await updateCharacter('bad-id', { current_health: 5 })
    expect(result.error).toBe('DB error')
  })
})
