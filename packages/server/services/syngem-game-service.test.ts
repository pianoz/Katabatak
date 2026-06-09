import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.stubEnv('SUPABASE_URL', 'http://localhost:54321')
vi.stubEnv('SUPABASE_SECRET_KEY', 'test-key')

const mockFrom = vi.fn()
vi.mock('../gm/tools/db.js', () => ({
  default: { from: mockFrom },
}))

const { advanceLongRestTime, advanceGameTime } = await import('./syngem-game-service.js')

function selectChain(data: unknown) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error: null }),
  }
}

function updateChain() {
  const eqFn = vi.fn().mockResolvedValue({ error: null })
  const updateFn = vi.fn().mockReturnValue({ eq: eqFn })
  return { update: updateFn, _eqFn: eqFn }
}

beforeEach(() => vi.clearAllMocks())

describe('advanceLongRestTime', () => {
  it('advances by 480 min without crossing midnight (14:00 → 22:00, same day)', async () => {
    const game = { game_time_minutes: 840, game_date_days: 5 }
    const { update, _eqFn } = updateChain()
    mockFrom.mockReturnValueOnce(selectChain(game)).mockReturnValueOnce({ update })

    await advanceLongRestTime('char-1')

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ game_time_minutes: 1320, game_date_days: 5 }),
    )
  })

  it('crosses midnight and increments day (23:00 → 07:00, +1 day)', async () => {
    const game = { game_time_minutes: 1380, game_date_days: 5 }
    const { update } = updateChain()
    mockFrom.mockReturnValueOnce(selectChain(game)).mockReturnValueOnce({ update })

    await advanceLongRestTime('char-1')

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ game_time_minutes: 420, game_date_days: 6 }),
    )
  })

  it('does nothing when syngem_game row is missing', async () => {
    mockFrom.mockReturnValue(selectChain(null))

    await advanceLongRestTime('char-1')

    const updateCalled = mockFrom.mock.results.some(
      (r) => r.value && 'update' in r.value,
    )
    expect(updateCalled).toBe(false)
  })
})

describe('advanceGameTime', () => {
  it('advances by 10 min without crossing midnight', async () => {
    const game = { game_time_minutes: 100, game_date_days: 3 }
    const { update } = updateChain()
    mockFrom.mockReturnValueOnce(selectChain(game)).mockReturnValueOnce({ update })

    await advanceGameTime('char-1')

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ game_time_minutes: 110, game_date_days: 3 }),
    )
  })

  it('rolls over at midnight and increments day', async () => {
    const game = { game_time_minutes: 1435, game_date_days: 3 }
    const { update } = updateChain()
    mockFrom.mockReturnValueOnce(selectChain(game)).mockReturnValueOnce({ update })

    await advanceGameTime('char-1')

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ game_time_minutes: 5, game_date_days: 4 }),
    )
  })
})
