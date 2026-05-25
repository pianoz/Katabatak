import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.stubEnv('SUPABASE_URL', 'http://localhost:54321')
vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-key')

const mockFrom = vi.fn()

vi.mock('../gm/tools/db.js', () => ({
  default: { from: mockFrom },
}))

const { getGameWithMembers, getGameAllyCharacters, getActiveEncounter } = await import(
  './game-service.js'
)

const fakeGame = {
  id: 'g1',
  name: 'Test Game',
  gm_id: 'user-1',
  is_in_combat: false,
  current_turn_order: [],
  active_turn_index: null,
  archived: false,
  is_in_session: true,
  starting_level: 1,
}

const fakeMember = { id: 'm1', game_id: 'g1', character_id: 'char-2', profile_id: 'p2', role: 'player', member_status: 'active' }
const fakeChar = { id: 'char-2', name: 'Sable', level: 2, class_archetype: 'Rogue', current_health: 6, health_max: 8 }

function singleChain(data: unknown) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    in: vi.fn().mockResolvedValue({ data, error: null }),
    single: vi.fn().mockResolvedValue({ data, error: null }),
    then: (resolve: (v: unknown) => unknown) => Promise.resolve({ data, error: null }).then(resolve),
    catch: (reject: (v: unknown) => unknown) => Promise.resolve({ data, error: null }).catch(reject),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getGameWithMembers', () => {
  it('returns game and members on success', async () => {
    const gameChain = singleChain(fakeGame)
    const membersChain = singleChain([fakeMember])
    mockFrom.mockReturnValueOnce(gameChain).mockReturnValueOnce(membersChain)

    const result = await getGameWithMembers('g1')
    expect(result?.game.name).toBe('Test Game')
    expect(result?.members).toEqual([fakeMember])
  })

  it('returns null when game is not found', async () => {
    const gameChain = singleChain(null)
    ;(gameChain.single as ReturnType<typeof vi.fn>).mockResolvedValue({ data: null, error: { message: 'not found' } })
    mockFrom.mockReturnValue(gameChain)

    const result = await getGameWithMembers('missing')
    expect(result).toBeNull()
  })
})

describe('getGameAllyCharacters', () => {
  it('returns ally characters excluding the given character', async () => {
    const membersChain = singleChain([{ character_id: 'char-2' }])
    const charsChain = singleChain([fakeChar])
    mockFrom.mockReturnValueOnce(membersChain).mockReturnValueOnce(charsChain)

    const allies = await getGameAllyCharacters('g1', 'char-1')
    expect(allies).toEqual([fakeChar])
  })

  it('returns empty array when no other active members', async () => {
    const membersChain = singleChain([])
    mockFrom.mockReturnValue(membersChain)

    const allies = await getGameAllyCharacters('g1', 'char-1')
    expect(allies).toEqual([])
  })
})

describe('getActiveEncounter', () => {
  it('returns null when game is not in combat', async () => {
    const chain = singleChain({ is_in_combat: false, current_turn_order: [], active_turn_index: null })
    mockFrom.mockReturnValue(chain)

    const encounter = await getActiveEncounter('g1')
    expect(encounter).toBeNull()
  })

  it('returns encounter data when in combat', async () => {
    const gameChain = singleChain({ is_in_combat: true, current_turn_order: ['char-1', 'char-2'], active_turn_index: 0 })
    const creaturesChain = singleChain([{ id: 'c1', name: 'Goblin', current_health: 3, health_max: 5, is_alive: true }])
    mockFrom.mockReturnValueOnce(gameChain).mockReturnValueOnce(creaturesChain)

    const encounter = await getActiveEncounter('g1')
    expect(encounter?.isInCombat).toBe(true)
    expect(encounter?.turnOrder).toEqual(['char-1', 'char-2'])
    expect(encounter?.creatures).toHaveLength(1)
  })
})
