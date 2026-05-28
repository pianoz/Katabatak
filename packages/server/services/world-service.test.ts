import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.stubEnv('SUPABASE_URL', 'http://localhost:54321')
vi.stubEnv('SUPABASE_SECRET_KEY', 'test-key')

const mockFrom = vi.fn()
const mockRpc = vi.fn()

vi.mock('../gm/tools/db.js', () => ({
  default: { from: mockFrom, rpc: mockRpc },
}))

const { searchWorldEntities, getCampaignFacts, getNpc, getNpcsForGame } = await import(
  './world-service.js'
)

const fakeLoreRow = { id: 1, name: 'Kataba', category: 'nation', short_desc: 'A quiet land', long_desc: 'A rural world.' }
const fakeFactRow = { id: 'f1', game_id: 'g1', fact_summary: 'A dragon was seen.', subject_entity: 'dragon', visibility: 'player' }
const fakeGmFactRow = { ...fakeFactRow, id: 'f2', visibility: 'gm_only', fact_summary: 'The king is dying.' }
const fakeNpc = { id: 'npc-1', name: 'Mira', game_id: 'g1', faction: 'Merchants', personality_profile: {}, attribute_modifiers: {}, current_location_id: 'loc-1' }

function chainFor(data: unknown) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error: null }),
    then: undefined as unknown,
  }
}

// Chainable that resolves when awaited
function awaitableChain(data: unknown) {
  const chain: Record<string, unknown> = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error: null }),
  }
  // Make the chain itself thenable (resolves with { data, error: null })
  Object.defineProperty(chain, Symbol.toStringTag, { value: 'Promise' })
  chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve({ data, error: null }).then(resolve)
  chain.catch = (reject: (v: unknown) => unknown) => Promise.resolve({ data, error: null }).catch(reject)
  return chain
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('searchWorldEntities', () => {
  it('returns matching entity rows', async () => {
    mockRpc.mockResolvedValue({ data: [fakeLoreRow], error: null })
    const results = await searchWorldEntities('Kataba')
    expect(results).toHaveLength(1)
    expect(results[0].name).toBe('Kataba')
  })

  it('returns empty array on rpc error', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'error' } })
    const results = await searchWorldEntities('anything')
    expect(results).toEqual([])
  })
})

describe('getCampaignFacts', () => {
  it('excludes gm_only facts when gmOnly is false', async () => {
    const chain = awaitableChain([fakeFactRow])
    mockFrom.mockReturnValue(chain)
    const facts = await getCampaignFacts('g1', false)
    // chain.neq should have been called to filter out gm_only
    expect((chain.neq as ReturnType<typeof vi.fn>).mock.calls[0]).toEqual(['visibility', 'gm_only'])
    expect(facts).toEqual([fakeFactRow])
  })

  it('includes all facts when gmOnly is true', async () => {
    const chain = awaitableChain([fakeFactRow, fakeGmFactRow])
    mockFrom.mockReturnValue(chain)
    const facts = await getCampaignFacts('g1', true)
    expect((chain.neq as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled()
    expect(facts).toHaveLength(2)
  })
})

describe('getNpc', () => {
  it('returns npc row on success', async () => {
    const chain = chainFor(fakeNpc)
    mockFrom.mockReturnValue(chain)
    const npc = await getNpc('npc-1')
    expect(npc?.name).toBe('Mira')
  })

  it('returns null for unknown id', async () => {
    const chain = chainFor(null)
    mockFrom.mockReturnValue(chain)
    const npc = await getNpc('unknown')
    expect(npc).toBeNull()
  })
})

describe('getNpcsForGame', () => {
  it('returns all npcs for a game', async () => {
    const chain = awaitableChain([fakeNpc])
    mockFrom.mockReturnValue(chain)
    const npcs = await getNpcsForGame('g1')
    expect(npcs).toEqual([fakeNpc])
  })
})
