import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.stubEnv('SUPABASE_URL', 'http://localhost:54321')
vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-key')

// ─── Supabase mock ────────────────────────────────────────────────────────────

const mockFrom = vi.fn()
vi.mock('../gm/tools/db.js', () => ({ default: { from: mockFrom } }))

// ─── Service mocks (needed by autoHydrate) ────────────────────────────────────

const mockGetFullCharacter = vi.fn()
const mockGetGameWithMembers = vi.fn()
const mockGetActiveEncounter = vi.fn()
const mockGetNpcsForGame = vi.fn()
const mockGetSyngemGame = vi.fn()

vi.mock('../services/character-service.js', () => ({ getFullCharacter: mockGetFullCharacter }))
vi.mock('../services/game-service.js', () => ({
  getGameWithMembers: mockGetGameWithMembers,
  getActiveEncounter: mockGetActiveEncounter,
}))
vi.mock('./tools/../../services/world-service.js', () => ({ getNpcsForGame: mockGetNpcsForGame }))
vi.mock('../services/syngem-game-service.js', () => ({ getSyngemGame: mockGetSyngemGame }))

const { resolveLocationEntities, autoHydrate } = await import('./auto-hydrator.js')

// ─── Chain builders ───────────────────────────────────────────────────────────

/** Builds a Supabase chain that resolves .single() with the given value. */
function singleChain(resolvedValue: unknown) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(resolvedValue),
  }
}

/** Builds a Supabase chain that resolves when awaited (for .in() queries). */
function arrayChain(data: unknown[]) {
  const chain: Record<string, unknown> = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockResolvedValue({ data, error: null }),
  }
  return chain
}

// ─── Fixture data ─────────────────────────────────────────────────────────────

const fakePlace = {
  id: 'loc_test_village',
  name: 'Test Village',
  parent_id: 'reg_test_valley',
  data: {
    short_description: 'A small village at a crossroads.',
    long_description: 'Test Village is a sleepy hamlet of timber-framed buildings huddled around a central well. Merchants pass through daily on their way to the capital.',
  },
}

const fakeRegion = {
  id: 'reg_test_valley',
  name: 'Test Valley',
  parent_id: 'nat_testland',
  data: {
    short_description: 'A fertile valley sheltered by grey cliffs.',
    long_description: 'The Test Valley stretches twenty leagues from east to west, fed by the River Arg and known for its amber harvests and stubborn folk.',
  },
}

const fakeNation = {
  id: 'nat_testland',
  name: 'Testland',
  parent_id: null,
  data: {
    short_description: 'An ancient land of stone roads and silent gods.',
    long_description: 'Testland has stood for three thousand years, its borders unchanged since the Compact of Ash. Its people are pragmatic, its winters brutal.',
  },
}

// ─── Realistic fixture: loc_karkill_settlements ───────────────────────────────
// Mirrors the actual entity hierarchy on the DB

const karPlace = {
  id: 'loc_karkill_settlements',
  name: 'Karkill Settlements',
  parent_id: 'reg_karkill_vale',
  data: {
    short_description: 'A scatter of fishing hamlets clinging to the Karkill coastline.',
    long_description: 'The Karkill Settlements are a loose chain of salt-bitten villages stretching along the rocky northern shore. Each hamlet maintains its own smokehouse, its own grudges, and its own interpretation of the old tide-laws. Strangers are noted but rarely welcomed.',
    population: 'sparse',
    primary_trade: 'fish, salted eel',
  },
}

const karRegion = {
  id: 'reg_karkill_vale',
  name: 'Karkill Vale',
  parent_id: 'nat_kataba',
  data: {
    short_description: 'A wind-scoured coastal vale hemmed by black basalt cliffs.',
    long_description: 'Karkill Vale runs north-to-south along the western coast of Kataba, a narrow corridor of cold sea-wind and grey stone. The Vale is sparsely populated and strategically unimportant except for the anchorage at Karkill Mouth, which every invading fleet in history has tried to take.',
    terrain: 'coastal cliffs, scrub moor',
  },
}

const katNation = {
  id: 'nat_kataba',
  name: 'Kataba',
  parent_id: null,
  data: {
    short_description: 'A wild, ancient land of fractured kingdoms and older silences.',
    long_description: 'Kataba is not a unified nation so much as a shared misery — a landmass too large to conquer and too ungovernable to hold. Its people share a language, a calendar, and a deep suspicion of anyone who claims authority over more than their own hearth. The Compact of Ash, signed after the last civil war, nominally binds the eight vale-lords to a common peace.',
    capital: 'None recognized',
  },
}

// ─── Realistic fixture: item_winds_revenge ────────────────────────────────────
// An item entity; parent_id is null (items exist independently in world_entities)

const windsRevenge = {
  id: 'item_winds_revenge',
  name: "Wind's Revenge",
  parent_id: null,
  data: {
    short_description: 'A recurve bow strung with silver-spun gut. The arrows whistle like a dying gale.',
    long_description: "Wind's Revenge was carved from the heartwood of a lightning-struck ashen tree on the night of the Gale Festival. Those who draw it claim to hear a low moan on release — not the string, but something older. It has never missed a target standing in open air.",
    type: 'weapon',
    subtype: 'bow',
    damage: '1d8+2',
    range_m: 80,
    weight_kg: 1.2,
    rarity: 'rare',
    magical: true,
    effects: ['wind_seek: arrows curve slightly toward the target in open terrain'],
  },
}

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
})

describe('resolveLocationEntities', () => {
  describe('general use', () => {
    it('walks up the full place→region→nation chain and returns all three entities', async () => {
      mockFrom
        .mockReturnValueOnce(singleChain({ data: fakePlace, error: null }))
        .mockReturnValueOnce(singleChain({ data: fakeRegion, error: null }))
        .mockReturnValueOnce(singleChain({ data: fakeNation, error: null }))
        .mockReturnValue(arrayChain([]))

      const result = await resolveLocationEntities('char-1', 'loc_test_village')

      expect(result).toHaveLength(3)
      expect(result[0].id).toBe('loc_test_village')
      expect(result[1].id).toBe('reg_test_valley')
      expect(result[2].id).toBe('nat_testland')
    })

    it('returns short_description and long_description for each entity in the chain', async () => {
      mockFrom
        .mockReturnValueOnce(singleChain({ data: fakePlace, error: null }))
        .mockReturnValueOnce(singleChain({ data: fakeRegion, error: null }))
        .mockReturnValueOnce(singleChain({ data: fakeNation, error: null }))
        .mockReturnValue(arrayChain([]))

      const result = await resolveLocationEntities('char-1', 'loc_test_village')

      expect(result[0].short_description).toBe('A small village at a crossroads.')
      expect(result[0].long_description).toContain('timber-framed buildings')
      expect(result[1].short_description).toContain('fertile valley')
      expect(result[1].long_description).toContain('River Arg')
      expect(result[2].short_description).toContain('ancient land')
      expect(result[2].long_description).toContain('three thousand years')
    })

    it('returns name for each entity', async () => {
      mockFrom
        .mockReturnValueOnce(singleChain({ data: fakePlace, error: null }))
        .mockReturnValueOnce(singleChain({ data: fakeRegion, error: null }))
        .mockReturnValueOnce(singleChain({ data: fakeNation, error: null }))
        .mockReturnValue(arrayChain([]))

      const result = await resolveLocationEntities('char-1', 'loc_test_village')

      expect(result.map((e) => e.name)).toEqual(['Test Village', 'Test Valley', 'Testland'])
    })

    it('applies player mutation overrides to short_description and long_description', async () => {
      const mutation = {
        entity_id: 'loc_test_village',
        mutations: {
          short_description: 'The village is in ruins — fire has gutted the inn.',
          long_description: 'What was once a peaceful crossroads is now ash and broken timber.',
        },
      }

      mockFrom
        .mockReturnValueOnce(singleChain({ data: fakePlace, error: null }))
        .mockReturnValueOnce(singleChain({ data: fakeRegion, error: null }))
        .mockReturnValueOnce(singleChain({ data: fakeNation, error: null }))
        .mockReturnValue(arrayChain([mutation]))

      const result = await resolveLocationEntities('char-1', 'loc_test_village')

      expect(result[0].short_description).toBe('The village is in ruins — fire has gutted the inn.')
      expect(result[0].long_description).toContain('ash and broken timber')
      // Region and nation are unaffected
      expect(result[1].short_description).toBe(fakeRegion.data.short_description)
    })
  })

  describe('edge cases', () => {
    it('returns [] when locationPlaceId is null', async () => {
      const result = await resolveLocationEntities('char-1', null)
      expect(result).toEqual([])
      expect(mockFrom).not.toHaveBeenCalled()
    })

    it('returns [] when the starting entity is not found in the DB', async () => {
      mockFrom.mockReturnValue(singleChain({ data: null, error: { message: 'not found' } }))

      const result = await resolveLocationEntities('char-1', 'loc_nonexistent')
      expect(result).toEqual([])
    })

    it('stops chain walk at first missing parent', async () => {
      mockFrom
        .mockReturnValueOnce(singleChain({ data: fakePlace, error: null }))
        .mockReturnValueOnce(singleChain({ data: null, error: { message: 'not found' } }))
        .mockReturnValue(arrayChain([]))

      const result = await resolveLocationEntities('char-1', 'loc_test_village')

      // Only the place was found; region fetch failed so chain stops
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('loc_test_village')
    })

    it('returns a single entity when place has no parent_id', async () => {
      const orphanPlace = { ...fakePlace, parent_id: null }
      mockFrom
        .mockReturnValueOnce(singleChain({ data: orphanPlace, error: null }))
        .mockReturnValue(arrayChain([]))

      const result = await resolveLocationEntities('char-1', 'loc_test_village')

      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('loc_test_village')
    })

    it('falls back to empty strings when entity data has no descriptions', async () => {
      const bare = { id: 'loc_bare', name: 'Bare Place', parent_id: null, data: {} }
      mockFrom
        .mockReturnValueOnce(singleChain({ data: bare, error: null }))
        .mockReturnValue(arrayChain([]))

      const result = await resolveLocationEntities('char-1', 'loc_bare')

      expect(result[0].short_description).toBe('')
      expect(result[0].long_description).toBe('')
    })
  })

  describe('real-data fixture: loc_karkill_settlements', () => {
    it('returns all three hierarchy levels with correct names', async () => {
      mockFrom
        .mockReturnValueOnce(singleChain({ data: karPlace, error: null }))
        .mockReturnValueOnce(singleChain({ data: karRegion, error: null }))
        .mockReturnValueOnce(singleChain({ data: katNation, error: null }))
        .mockReturnValue(arrayChain([]))

      const result = await resolveLocationEntities('char-1', 'loc_karkill_settlements')

      expect(result.map((e) => e.id)).toEqual([
        'loc_karkill_settlements',
        'reg_karkill_vale',
        'nat_kataba',
      ])
      expect(result.map((e) => e.name)).toEqual(['Karkill Settlements', 'Karkill Vale', 'Kataba'])
    })

    it('returns short_description for all three levels', async () => {
      mockFrom
        .mockReturnValueOnce(singleChain({ data: karPlace, error: null }))
        .mockReturnValueOnce(singleChain({ data: karRegion, error: null }))
        .mockReturnValueOnce(singleChain({ data: katNation, error: null }))
        .mockReturnValue(arrayChain([]))

      const result = await resolveLocationEntities('char-1', 'loc_karkill_settlements')

      expect(result[0].short_description).toContain('fishing hamlets')
      expect(result[1].short_description).toContain('basalt cliffs')
      expect(result[2].short_description).toContain('ancient land')
    })

    it('returns long_description for all three levels', async () => {
      mockFrom
        .mockReturnValueOnce(singleChain({ data: karPlace, error: null }))
        .mockReturnValueOnce(singleChain({ data: karRegion, error: null }))
        .mockReturnValueOnce(singleChain({ data: katNation, error: null }))
        .mockReturnValue(arrayChain([]))

      const result = await resolveLocationEntities('char-1', 'loc_karkill_settlements')

      expect(result[0].long_description).toContain('tide-laws')
      expect(result[1].long_description).toContain('Karkill Mouth')
      expect(result[2].long_description).toContain('Compact of Ash')
    })
  })

  describe('real-data fixture: item_winds_revenge', () => {
    // Wind's Revenge is an item entity with no parent. Passing it as the starting
    // entity ID verifies that data extraction works correctly for non-location types.
    it('returns the item entity with its descriptions intact', async () => {
      mockFrom
        .mockReturnValueOnce(singleChain({ data: windsRevenge, error: null }))
        .mockReturnValue(arrayChain([]))

      const result = await resolveLocationEntities('char-1', 'item_winds_revenge')

      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('item_winds_revenge')
      expect(result[0].name).toBe("Wind's Revenge")
    })

    it('returns short_description for the item', async () => {
      mockFrom
        .mockReturnValueOnce(singleChain({ data: windsRevenge, error: null }))
        .mockReturnValue(arrayChain([]))

      const result = await resolveLocationEntities('char-1', 'item_winds_revenge')

      expect(result[0].short_description).toContain('recurve bow')
      expect(result[0].short_description).toContain('silver-spun gut')
    })

    it('returns long_description for the item', async () => {
      mockFrom
        .mockReturnValueOnce(singleChain({ data: windsRevenge, error: null }))
        .mockReturnValue(arrayChain([]))

      const result = await resolveLocationEntities('char-1', 'item_winds_revenge')

      expect(result[0].long_description).toContain("Wind's Revenge")
      expect(result[0].long_description).toContain('lightning-struck')
    })

    it('applies player mutation override to item descriptions', async () => {
      const mutation = {
        entity_id: 'item_winds_revenge',
        mutations: {
          short_description: "Wind's Revenge — cracked and unstrung, the string snapped in the last battle.",
        },
      }

      mockFrom
        .mockReturnValueOnce(singleChain({ data: windsRevenge, error: null }))
        .mockReturnValue(arrayChain([mutation]))

      const result = await resolveLocationEntities('char-1', 'item_winds_revenge')

      expect(result[0].short_description).toContain('cracked and unstrung')
      // long_description falls back to base data when not in mutation
      expect(result[0].long_description).toContain('lightning-struck')
    })
  })
})

describe('autoHydrate', () => {
  const fakeFullCharacter = {
    character: {
      id: 'char-1',
      name: 'Aldric',
      level: 3,
      class_archetype: 'Ranger',
      location_place: 'loc_test_village',
      current_health: 8,
      health_max: 10,
      current_essence: 5,
      essence_max: 10,
      current_power: 6,
      power_max: 10,
      current_will: 7,
      will_max: 10,
      carrying_capacity: 10,
    },
    inventory: [],
    skills: [],
    spells: [],
    actionSkillIds: [],
  }

  it('returns null when character is not found', async () => {
    mockGetFullCharacter.mockResolvedValue(null)

    const result = await autoHydrate('missing-char')
    expect(result).toBeNull()
  })

  it('returns a ContextBlock with locationEntities resolved from the character location', async () => {
    mockGetFullCharacter.mockResolvedValue(fakeFullCharacter)
    mockGetSyngemGame.mockResolvedValue(null)
    mockFrom
      .mockReturnValueOnce(singleChain({ data: fakePlace, error: null }))
      .mockReturnValueOnce(singleChain({ data: fakeRegion, error: null }))
      .mockReturnValueOnce(singleChain({ data: fakeNation, error: null }))
      .mockReturnValue(arrayChain([]))

    const result = await autoHydrate('char-1')

    expect(result).not.toBeNull()
    expect(result?.locationEntities).toHaveLength(3)
    expect(result?.locationEntities[0].id).toBe('loc_test_village')
  })

  it('returns pool text labels derived from character stats', async () => {
    const noLocChar = {
      ...fakeFullCharacter,
      character: { ...fakeFullCharacter.character, location_place: null },
    }
    mockGetFullCharacter.mockResolvedValue(noLocChar)
    mockGetSyngemGame.mockResolvedValue(null)

    const result = await autoHydrate('char-1')

    // 8/10 = 0.8 → Full; 5/10 = 0.5 → Low (boundary); 6/10 → Moderate; 7/10 → Moderate
    expect(result?.healthText).toBe('Full')
    expect(result?.essenceText).toBe('Low')
    expect(result?.powerText).toBe('Moderate')
    expect(result?.willText).toBe('Moderate')
  })

  it('returns empty locationEntities when character has no location_place', async () => {
    const noLocChar = {
      ...fakeFullCharacter,
      character: { ...fakeFullCharacter.character, location_place: null },
    }
    mockGetFullCharacter.mockResolvedValue(noLocChar)
    mockGetSyngemGame.mockResolvedValue(null)

    const result = await autoHydrate('char-1')

    expect(result?.locationEntities).toEqual([])
    expect(mockFrom).not.toHaveBeenCalled()
  })
})
