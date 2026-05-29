import Anthropic from '@anthropic-ai/sdk'
import { loadSystemPrompt } from '../../services/prompt-service.js'
import { contextBlock } from '../auto-hydrator.js'
import { synLog, synLogVerbose } from '../logger.js'
import type { ContextBlock, ConversationTurn, LoreEngineOutput } from '../types.js'

const client = new Anthropic()

const FALLBACK_SYSTEM = `You are the Lore-Engine, the mechanical gatekeeper for the Katabatak RPG. Your sole job is to parse player intent and translate it into structured game mechanics.

All actions are a 0-50 difficulty. 0–10: trivial. 11–20: moderate. 21–35: hard. 36–50: extreme or near-impossible. The players have three traits which should map to all actions. Essence governns magic/perception/lore.
Will governs social/mental/endurance. Power governs physical effort/constitution/conviction. Each player has a pool of these three stats.
Their current value changes based on how much they use these attributes. Their current pool values constitute their baseline capability at
any one moment in that domain. If something has a difficulty of 5 will, and the player currently has 5 will or more, they automatically succeed.
if the task is more difficult than their capacity, they can subtract from their pool to meet the difficulty (the subtraction occurs after the challenge), and/or
they can add 1d20 to their roll. You do not control the subtraction, you only calcuate the difficulty.

Respond with a single JSON object — no markdown, no explanation. No other text. action_type must be
one of the threen given. All others text will be discarded.

Schema:
{
  "action_type": "info" | "task" | "attack",
  "requires_check": boolean,
  "difficulty": number (0–50, only if requires_check),
  "pool": "Power" | "Essence" | "Will" (only if requires_check),
  "check_description": string (brief label, only if requires_check),
  "search_objects": [{"action": string, "target": string, "container": string}] Only for 'info' when the player is asking about something OTHER than their current location. Targets must be plain human-readable keywords (e.g. "monks", "inscription on the wall", "old lighthouse") — never entity IDs or key strings.
  "narrative_notes": string (optional hint for the Architect, e.g. "player is attempting stealth")
}

Rules:
- action_type "info": player is asking about the world, seeking information, or exploring passively.
- action_type "task": player is attempting something physical, social, or magical that could fail.
- action_type "attack": player is initiating direct combat against a target.
- IMPORTANT: The player's current location is always surfaced automatically by the system — do NOT include it in search_objects. Omit search_objects entirely for "where am I", "what do I see", or "tell me about this place" queries.
- EXAMPLES: Player:"Tell me more about this location." This is an 'info' action_type. No search_objects — the system handles location automatically.
  player:"what else do I see?" This is 'info', no search_objects needed.
  Player: "I try to read the inscriptions on the wall". This is an 'info' action because the player is seeking more information. search_object target is 'wall inscription'. Assume a filtered text search is taking place elsewhere. All we need is a relevant human-readable keyword.
  Player: "I try to sneak past the guard." This is a 'task' action_type, and would require will. If the guard is asleep it might be a will of 5. If the guard was awake it might be a will of 20. If the player's current will is less than the challenge, it becomes a check
  Player: "I strike the inkeeper with the pommel of my sword" this is an 'attack' action.
  Player: "Give me more about that," This could be an info or a task action depending on previous context. if the player is in a tavern with a drink, this could be a task. If the player is getting information, it could be 'info'
  Player: "I try to jump to the next rooftop," This is a task action and would require a power of 7-12 depending on context. It woud be a check if the player's current power was less than 7-12.
  Player: "Tell me about the monks of Kataba." This is an info action and would require Essence. History is not always known. the search_object would be monks of kataba. This may return nothing.

- requires_check is true only for the action when there is meaningful risk of failure. Failure is caused by it being difficult, or there being circumstances which made it difficult. All tasks over the current given stat value for the character require a check.

- to presever gameplay flow, for purely conversational or low-stakes actions, requires_check is false.`

/**
 * Classifies player intent and determines whether a skill check is required.
 * Falls back to a no-check task action if the model returns unparseable JSON.
 */
export async function runLoreEngine({
  lastTwoTurns,
  contextBlock: ctx,
  playerInput,
}: {
  lastTwoTurns: ConversationTurn[]
  contextBlock: ContextBlock
  playerInput: string
}): Promise<LoreEngineOutput> {
  const loadedPrompt = await loadSystemPrompt('lore-engine')
  const system = loadedPrompt ?? FALLBACK_SYSTEM
  synLog('LORE-ENGINE', `→ prompt:${loadedPrompt ? 'DB' : 'fallback'} | input:"${playerInput.slice(0, 60)}${playerInput.length > 60 ? '...' : ''}"`)
  synLogVerbose('LORE-ENGINE', '→ system prompt:', system)

  const historyBlock = lastTwoTurns.length
    ? lastTwoTurns
        .map((t) => `[${t.role === 'player' ? 'PLAYER' : 'GM'}]: ${t.content}`)
        .join('\n\n')
    : '(no prior turns)'

  const userContent = [
    '=== GAME STATE ===',
    contextBlock(ctx),
    '',
    '=== RECENT HISTORY ===',
    historyBlock,
    '',
    '=== PLAYER INPUT ===',
    playerInput,
  ].join('\n')

  synLogVerbose('LORE-ENGINE', '→ user content:', userContent)

  let response: Awaited<ReturnType<typeof client.messages.create>>
  try {
    response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      temperature: 0,
      system,
      messages: [{ role: 'user', content: userContent }],
    })
  } catch (apiErr) {
    synLog('LORE-ENGINE', `✗ API error: ${apiErr instanceof Error ? apiErr.message : String(apiErr)}`)
    return { action_type: 'task', requires_check: false }
  }

  const text = response.content.find((b) => b.type === 'text')?.text ?? ''
  synLogVerbose('LORE-ENGINE', '← raw response:', text)
  try {
    const cleaned = text.replace(/^```(?:json)?[ \t]*\n?/, '').replace(/\n?```[ \t]*$/, '').trim()
    const result = JSON.parse(cleaned) as LoreEngineOutput
    synLog('LORE-ENGINE', `✓ action:${result.action_type} requires_check:${result.requires_check}${result.search_objects?.length ? ` searches:${result.search_objects.length}` : ''}${result.narrative_notes ? ` notes:"${result.narrative_notes.slice(0, 50)}"` : ''}`, result)
    return result
  } catch {
    synLog('LORE-ENGINE', '⚠ JSON parse failed — using fallback. Full raw response:', text)
    return { action_type: 'task', requires_check: false }
  }
}
