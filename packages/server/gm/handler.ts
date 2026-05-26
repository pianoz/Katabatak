import { autoHydrate } from './auto-hydrator.js'
import { pickStyleText } from './style-modulator.js'
import { runLoreEngine } from './agents/lore-engine.js'
import { streamArchitect } from './agents/architect.js'
import { runLedger } from './agents/ledger.js'
import { executeStateChanges } from './state-executor.js'
import { runScribe } from './agents/summary.js'
import { searchWorldEntities } from '../services/world-service.js'
import {
  saveTurn,
  getRecentTurns,
  getTurnCount,
} from '../services/conversation-service.js'
import { characterBelongsToUser } from '../services/character-service.js'
import type { GMMessageInput, CheckRequired } from './types.js'

export type { GMMessageInput }

export async function* handleGMMessage({
  message,
  characterId,
  userId,
  gameId,
  checkResolution,
}: GMMessageInput): AsyncGenerator<string | CheckRequired> {
  // 1. Verify character ownership
  const isOwner = await characterBelongsToUser(characterId, userId)
  if (!isOwner) {
    yield '[GM Error: character not found]'
    return
  }

  // 3. Persist the player turn
  const { turnNumber } = await saveTurn(characterId, gameId, 'player', message)

  // 4. Build context block
  const contextBlock = await autoHydrate(characterId, gameId)
  if (!contextBlock) {
    yield '[GM Error: character not found]'
    return
  }

  // 3. Fetch last 2 turns for Lore-Engine
  const lastTwoTurns = await getRecentTurns(characterId, 2)

  // 4. Run Lore-Engine (skip if a check was already resolved by the player)
  let loreResult = checkResolution
    ? { action_type: 'task' as const, requires_check: false }
    : await runLoreEngine({ lastTwoTurns, contextBlock, playerInput: message })

  // 5. If check required and not yet resolved, halt and return the check prompt
  if (loreResult.requires_check && !checkResolution) {
    const checkRequired: CheckRequired = {
      type: 'check_required',
      difficulty: loreResult.difficulty ?? 10,
      pool: loreResult.pool ?? 'Power',
      check_description: loreResult.check_description ?? 'Attempting a difficult task',
    }
    yield checkRequired
    return
  }

  // 6. Execute world entity searches if Lore-Engine found info queries
  let searchResults: string | null = null
  if (loreResult.search_objects?.length) {
    const results = await Promise.all(
      loreResult.search_objects.map(async (s) => {
        const entities = await searchWorldEntities(s.target)
        if (!entities.length) return null
        return entities
          .slice(0, 3)
          .map((e) => {
            const data = e.data as Record<string, unknown>
            const desc = (data?.['short_description'] as string | undefined) ?? e.name
            return `${e.name}: ${desc}`
          })
          .join('\n')
      }),
    )
    const filtered = results.filter(Boolean)
    if (filtered.length) searchResults = filtered.join('\n\n')
  }

  // 7. Pick style text
  const styleText = pickStyleText()

  // 8. Fetch character's scribe data
  const { character: { character } } = contextBlock
  const scribeSummary = (character as Record<string, unknown>)['scribe_summary'] as string | null ?? null
  const questObjectives = (character as Record<string, unknown>)['quest_objectives'] ?? null

  // 9. Fetch last 4 turns for Architect
  const lastFourTurns = await getRecentTurns(characterId, 4)

  // 10. Stream Architect response
  let fullResponse = ''
  for await (const chunk of streamArchitect({
    styleText,
    contextBlock,
    scribeSummary,
    questObjectives,
    loreResult,
    checkResolution,
    lastFourTurns,
    searchResults,
    playerInput: message,
  })) {
    fullResponse += chunk
    yield chunk
  }

  // 11. Persist assistant turn
  await saveTurn(characterId, gameId, 'assistant', fullResponse)

  // 12. Fire Ledger + State Executor asynchronously
  runLedger({ narrativeText: fullResponse, characterId })
    .then((ledgerOutputs) => {
      if (ledgerOutputs.length) {
        return executeStateChanges(characterId, ledgerOutputs)
      }
    })
    .catch((err) => console.error('[Ledger/StateExecutor] async error:', err))

  // 13. Fire Scribe every 4 turns (server-side, async)
  if (turnNumber % 4 === 0) {
    const recentEight = await getRecentTurns(characterId, 8)
    runScribe(characterId, recentEight).catch((err) =>
      console.error('[Scribe] async error:', err),
    )
  }
}

/** Exposed for the /gm/summarize endpoint (manual trigger). */
export { runScribe, getTurnCount, getRecentTurns }
