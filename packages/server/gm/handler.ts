import { autoHydrate } from './auto-hydrator.js'
import { runLoreEngine } from './agents/lore-engine.js'
import { streamArchitect } from './agents/architect.js'
import { runLedger } from './agents/ledger.js'
import { executeStateChanges } from './state-executor.js'
import { runScribe } from './agents/summary.js'
import { searchWorldEntities, gatherInfoLore } from '../services/world-service.js'
import {
  saveTurn,
  getRecentTurns,
  getTurnCount,
} from '../services/conversation-service.js'
import { characterBelongsToUser } from '../services/character-service.js'
import { advanceGameTime } from '../services/syngem-game-service.js'
import { applyQuestCompletionGrants } from '../services/quest-engine.js'
import { synLog } from './logger.js'
import { createClaudeClient } from './claude-client.js'
import { checkBudget } from './budget-guard.js'
import type { GMMessageInput, CheckRequired } from './types.js'

export type { GMMessageInput }

let ledgerNeutered = false
export function setLedgerNeutered(v: boolean): void { ledgerNeutered = v }
export function isLedgerNeutered(): boolean { return ledgerNeutered }

/**
 * Main SYNGEM pipeline orchestrator. Streams narrative text chunks for a player message.
 * Yields a `CheckRequired` object mid-pipeline if a skill check must be resolved before continuing.
 * Ledger, StateExecutor, and (every 4 turns) Scribe fire asynchronously after the stream closes.
 */
export async function* handleGMMessage({
  message,
  characterId,
  userId,
  gameId,
  checkResolution,
  anthropicApiKey,
  requestId,
  _timingOut,
}: GMMessageInput): AsyncGenerator<string | CheckRequired> {
  synLog('HANDLER', `→ request | char:${characterId.slice(-8)} "${message.slice(0, 60)}${message.length > 60 ? '...' : ''}"${checkResolution ? ` [resolving:${checkResolution.choice}]` : ''}${anthropicApiKey ? ' [byok]' : ''}`, undefined, requestId)

  const client = createClaudeClient(anthropicApiKey)

  // 1. Verify character ownership (skipped when userId absent — CLI / trusted contexts)
  if (userId) {
    const isOwner = await characterBelongsToUser(characterId, userId)
    if (!isOwner) {
      yield '[GM Error: character not found]'
      return
    }

    // 2. Enforce token budget cap
    const budget = await checkBudget(userId)
    if (!budget.allowed) {
      yield `[GM Error: token budget exceeded (${budget.currentUsage.toLocaleString()} / ${budget.budgetCap?.toLocaleString()} tokens). Update your cap in settings.]`
      return
    }
  }

  // 3. Persist the player turn
  const { turnNumber } = await saveTurn(characterId, gameId, 'player', message)
  synLog('HANDLER', `✓ turn saved — #${turnNumber}`, undefined, requestId)

  // 4. Build context block
  const t0 = Date.now()
  const contextBlock = await autoHydrate(characterId, gameId, requestId)
  const hydratorMs = Date.now() - t0
  if (!contextBlock) {
    yield '[GM Error: character not found]'
    return
  }

  // 3. Fetch last 2 turns for Lore-Engine
  const lastTwoTurns = await getRecentTurns(characterId, 2)

  // 4. Run Lore-Engine (skip if a check was already resolved by the player)
  const t1 = Date.now()
  let loreResult = checkResolution
    ? { action_type: 'task' as const, requires_check: false }
    : await runLoreEngine({ lastTwoTurns, contextBlock, playerInput: message, client, userId, characterId, requestId })
  const loreMs = Date.now() - t1

  // 5. If check required and not yet resolved, halt and return the check prompt
  if (loreResult.requires_check && !checkResolution) {
    const checkRequired: CheckRequired = {
      type: 'check_required',
      difficulty: loreResult.difficulty ?? 10,
      pool: loreResult.pool ?? 'Power',
      check_description: loreResult.check_description ?? 'Attempting a difficult task',
    }
    synLog('HANDLER', `⚑ check required — pool:${checkRequired.pool} diff:${checkRequired.difficulty} — halting pipeline`, undefined, requestId)
    yield checkRequired
    return
  }

  // 6. Gather lore context for info actions, or run flat search for task/attack
  const locationId = (contextBlock.character.character as Record<string, unknown>)['location_place'] as string | null ?? null

  // locationEntities is ordered place→region→nation
  const locationContext = {
    locationPlaceId: locationId,
    placeContext: contextBlock.locationEntities[0]?.name ?? null,
    regionContext: contextBlock.locationEntities[1]?.name ?? null,
    nationContext: contextBlock.locationEntities[2]?.name ?? null,
  }
  let searchResults: string | null = null
  if (loreResult.action_type === 'info' && locationId) {
    const keywords = (loreResult.search_objects ?? [])
      .map((s) => (typeof s === 'string' ? s : s.target))
      .filter((k): k is string => typeof k === 'string' && k.length > 0)
    synLog('HANDLER', `→ lore gather | location:${locationId} keywords:[${keywords.join(', ')}]`, undefined, requestId)
    searchResults = await gatherInfoLore(locationId, keywords)
    synLog('HANDLER', `✓ lore gather — ${searchResults.length} chars`, undefined, requestId)
  } else if (loreResult.search_objects?.length) {
    const targets = loreResult.search_objects.map((s) => s.target).join(', ')
    synLog('HANDLER', `→ world search | targets: ${targets}`, undefined, requestId)
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
    synLog('HANDLER', `✓ world search — ${filtered.length}/${loreResult.search_objects.length} results`, undefined, requestId)
    if (filtered.length) searchResults = filtered.join('\n\n')
  }

  // 7. Fetch scribe data — summary lives on syngem_game, quest objectives on characters
  const { character: { character } } = contextBlock
  const scribeSummary = contextBlock.syngemGame?.summary ?? null
  const questObjectives = (character as Record<string, unknown>)['quest_objectives'] ?? null

  // 9. Fetch last 4 turns for Architect
  const lastFourTurns = await getRecentTurns(characterId, 4)

  // 10. Stream Architect response
  synLog('HANDLER', '→ architect streaming...', undefined, requestId)
  const t2 = Date.now()
  let fullResponse = ''
  for await (const chunk of streamArchitect({
    contextBlock,
    scribeSummary,
    questObjectives,
    loreResult,
    checkResolution,
    lastFourTurns,
    searchResults,
    playerInput: message,
    client,
    userId,
    characterId,
    requestId,
  })) {
    fullResponse += chunk
    yield chunk
  }
  const architectMs = Date.now() - t2
  synLog('HANDLER', `✓ architect complete — ${fullResponse.length} chars`, undefined, requestId)
  if (_timingOut) Object.assign(_timingOut, { hydratorMs, loreMs, architectMs })

  // 11. Persist assistant turn
  await saveTurn(characterId, gameId, 'assistant', fullResponse)
  synLog('HANDLER', '✓ assistant turn saved', undefined, requestId)

  // 12. Advance fantasy game time by 10 minutes (async, non-blocking)
  advanceGameTime(characterId).catch((err) =>
    synLog('HANDLER', `✗ [GameTime] async error: ${err instanceof Error ? err.message : String(err)}`, undefined, requestId),
  )

  // 13. Fire Ledger + State Executor asynchronously
  if (ledgerNeutered) {
    synLog('HANDLER', '⚠ ledger neutered — skipping DB write', undefined, requestId)
  } else {
    synLog('HANDLER', '→ ledger + state-executor fired (async)', undefined, requestId)
    runLedger({ narrativeText: fullResponse, characterId, locationContext, client, userId, requestId })
      .then((ledgerOutputs) => {
        if (ledgerOutputs.length) {
          return executeStateChanges(characterId, ledgerOutputs, locationContext, requestId)
        }
      })
      .catch((err) => synLog('HANDLER', `✗ [Ledger/StateExecutor] async error: ${err instanceof Error ? err.message : String(err)}`, undefined, requestId))
  }

  // 14. Fire Scribe every 4 turns (server-side, async)
  if (turnNumber % 4 === 0) {
    synLog('HANDLER', `→ scribe triggered (turn ${turnNumber})`, undefined, requestId)
    const recentEight = await getRecentTurns(characterId, 8)
    runScribe(characterId, recentEight, client, userId, requestId)
      .then(({ completedQuestIds }) => {
        if (completedQuestIds.length) {
          synLog('HANDLER', `→ quest completion grants firing for: ${completedQuestIds.join(', ')}`, undefined, requestId)
          return Promise.all(
            completedQuestIds.map((questId) =>
              applyQuestCompletionGrants(characterId, questId).catch((err) =>
                synLog('HANDLER', `✗ [QuestEngine] grant error for ${questId}: ${err instanceof Error ? err.message : String(err)}`, undefined, requestId),
              ),
            ),
          )
        }
      })
      .catch((err) => synLog('HANDLER', `✗ [Scribe] async error: ${err instanceof Error ? err.message : String(err)}`, undefined, requestId))
  }
}

/** Exposed for the /gm/summarize endpoint (manual trigger). */
export { runScribe, getTurnCount, getRecentTurns }
