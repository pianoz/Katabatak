import type { AgentConfig } from '../graders/agent-config'

export interface EvalMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface EvalResult {
  text: string
  usage: { input_tokens: number; output_tokens: number }
}

export interface ModelGradeResult {
  score: number
  review: string
  usage: { input_tokens: number; output_tokens: number }
}

// ─── Grader system prompts (agent-aware, read-only) ───────────────────────────

// Fallback grader prompts used when no DB evaluator version exists for the agent.
// Stat pools: Power (strength/conviction), Essence (magic/perception), Will (social/dex/mental endurance)
const GRADER_PROMPTS: Record<string, string> = {
  'lore-engine': `You are grading the Lore-Engine, the mechanical intent parser for the Katabatak RPG. It classifies player actions into action_type (info/task/attack), determines if a skill check is needed, and selects the governing stat pool.

The three stat pools: Power (physical effort, strength, conviction), Essence (magic, perception, lore), Will (social manipulation, dexterity, mental endurance).

Grade on: correct action_type, accurate check requirement, correct pool selection, appropriate difficulty (0–50), and output schema compliance.

Respond with ONLY: a score (0–100) on the first line, then one or two sentences of review. Nothing else.`,

  architect: `You are grading the Architect, the narrative GM for the Katabatak dark fantasy RPG. It produces atmospheric prose that responds to player actions, respects character state, and drives the story forward.

The three stat pools shaping character capability: Power (strength/conviction), Essence (magic/perception), Will (social/dex/endurance).

Grade on: narrative quality and tone (brutalist dark fantasy), responsiveness to the player's action, factual grounding in game state and pool values, no hallucinated context.

Respond with ONLY: a score (0–100) on the first line, then one or two sentences of review. Nothing else.`,

  ledger: `You are grading the Ledger, the state-change parser for the Katabatak RPG. It reads GM narrative and outputs structured JSON actions (move_character, grant_item, long_rest, update_npc, etc.) applied to the game world.

Pools relevant to state changes: Power (physical stamina), Essence (magic energy), Will (mental endurance) — all three may be affected by long_rest.

Grade on: all implied state changes captured, valid action types, correct pool targeting, required fields present, no hallucinated changes.

Respond with ONLY: a score (0–100) on the first line, then one or two sentences of review. Nothing else.`,

  scribe: `You are grading the Scribe, the session summarizer for the Katabatak RPG. It compresses conversation history into a running narrative summary and updates quest objective statuses.

Pools to track: Power (exertion), Essence (spell use), Will (social/mental strain) — significant expenditures should be noted.

Grade on: accuracy relative to the provided turns, correct quest status updates, conciseness, preservation of pool-affecting events, and valid JSON structure.

Respond with ONLY: a score (0–100) on the first line, then one or two sentences of review. Nothing else.`,

  'character-builder': `You are grading the Character Creator, the onboarding AI for the Katabatak dark fantasy RPG. It generates a character's background, description, backstory, story hook, and initial quest from Q&A responses.

The three pools that define a character's strengths: Power (strength/conviction), Essence (magic/perception), Will (social/dex/mental endurance).

Grade on: coherence, thematic fit with dark fantasy, completeness of all required fields, natural pool identity implied by the archetype, and JSON validity.

Respond with ONLY: a score (0–100) on the first line, then one or two sentences of review. Nothing else.`,
}

const FALLBACK_GRADER_PROMPT = `You are grading an AI agent response for a dark fantasy RPG system.

Grade on: relevance, correctness, and quality relative to the user's input.

Respond with ONLY: a score (0–100) on the first line, then one or two sentences of review. Nothing else.`

// ─── API wrappers ─────────────────────────────────────────────────────────────

/** Fetches hydrated context text for a character. Returns null if response is empty. */
export async function hydrateBlock(characterId: string, tables: string[]): Promise<string | null> {
  const res = await fetch('/api/gm/hydrate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ characterId, tables }),
  })
  if (!res.ok) return null
  const data = (await res.json()) as { text?: string; error?: string }
  const text = data.text?.trim() ?? ''
  return text.length > 0 ? text : null
}

/** Runs a prompt through the agent model, using the agent's locked config. */
export async function runAgentEval(
  system: string,
  messages: EvalMessage[],
  config: AgentConfig,
): Promise<EvalResult> {
  const res = await fetch('/api/gm/eval', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system,
      messages,
      model: config.model,
      maxTokens: config.maxTokens,
      temperature: config.temperature,
    }),
  })
  const data = (await res.json()) as { text?: string; usage?: EvalResult['usage']; error?: string }
  if (!res.ok) throw new Error(data.error ?? 'Agent eval failed')
  return {
    text: data.text ?? '',
    usage: data.usage ?? { input_tokens: 0, output_tokens: 0 },
  }
}

/** Runs the model grader (Haiku, 200 tokens max) for a given agent's response. */
export async function runModelGrader(
  agentSlug: string,
  userInput: string,
  modelResponse: string,
  evaluatorPrompt?: string | null,
): Promise<ModelGradeResult> {
  const graderSystem = evaluatorPrompt?.trim() || (GRADER_PROMPTS[agentSlug] ?? FALLBACK_GRADER_PROMPT)

  const res = await fetch('/api/gm/eval', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system: graderSystem,
      messages: [
        {
          role: 'user',
          content: `<user_input>\n${userInput}\n</user_input>\n\n<agent_response>\n${modelResponse}\n</agent_response>`,
        },
      ],
      model: 'claude-haiku-4-5-20251001',
      maxTokens: 200,
      temperature: 0,
    }),
  })

  const data = (await res.json()) as { text?: string; usage?: EvalResult['usage']; error?: string }
  if (!res.ok) throw new Error(data.error ?? 'Grader call failed')

  const text = (data.text ?? '').trim()
  // Parse: first line is score, rest is review
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  const scoreMatch = lines[0]?.match(/(\d{1,3})/)
  const score = scoreMatch ? Math.min(100, Math.max(0, parseInt(scoreMatch[1], 10))) : 0
  const review = lines.slice(1).join(' ').trim() || lines[0] || text

  return {
    score,
    review,
    usage: data.usage ?? { input_tokens: 0, output_tokens: 0 },
  }
}
