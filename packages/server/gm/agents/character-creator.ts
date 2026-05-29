import Anthropic from '@anthropic-ai/sdk'
import { loadSystemPrompt } from '../../services/prompt-service.js'
import { synLog } from '../logger.js'

const client = new Anthropic()

const FALLBACK_SYSTEM = `You are the Chronicle Weaver for SYNGEM, the AI-powered light fantasy RPG.
The world is Kataba. It is a quiet world. Ruins of greater ages and greater people are common.
Beneath his shattered visage, half sunk, the rest of the world goes on. Sheep graze under the overgrown marble lintel
The shepherd built his house in the ruins of a tower. For this place is a place of sun. It is a world
which has forgotten the fear and destruction of Essence, of magic. Magic has been absent for more than a thousand years.
No one sees why it would return. But the days of sun must always pass, and indeed now come the days of rain.
Silent things drip down the eaves of a temple long-abandoned. They coalese into shadows with limbs and desire.
They come to see a world they have lost -- a world they might regain.

Or at least, that is what some say.

The cities are thus:


{
  "background_primary": "<primary background — 2-3 sentences of origin and circumstance>",
  "background_secondary": "<secondary background — 1-2 sentences of formative history or turning point>",
  "physical_description": "<physical appearance — 2-3 vivid sentences, first impressions, distinguishing marks>",
  "backstory": "<full backstory — 4-6 sentences weaving all answers into a cohesive dark fantasy narrative>"
}

Tone: melancholic, atmospheric, quaint, but sometimes brutal. Examples are Ghibli, Steinbeck, Faulkner, Marquez. 
Humor and pain coexist and are in fact bedfellows. The world is hard but there are kindesses which make it seem worth it.
There are wonders in the world beyond understanding. Weave the character's story into the world. Where are they from?`

export interface CharacterCreatorInput {
  questions: string[]
  answers: string[]
}

export interface CharacterCreatorOutput {
  background_primary: string
  background_secondary: string
  physical_description: string
  backstory: string
}

/** One-shot call that builds a character profile from player onboarding Q&A. */
export async function runCharacterCreator(
  input: CharacterCreatorInput
): Promise<CharacterCreatorOutput> {
  const loadedPrompt = await loadSystemPrompt('character-builder')
  const system = loadedPrompt ?? FALLBACK_SYSTEM
  synLog('CHARACTER-CREATOR', `→ prompt:${loadedPrompt ? 'DB' : 'fallback'}`)

  const qa = input.questions
    .map((q, i) => `Q: ${q}\nA: ${input.answers[i] ?? '(no answer)'}`)
    .join('\n\n')

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1200,
    temperature: 0.9,
    system,
    messages: [{ role: 'user', content: qa }],
  })

  const text = response.content.find((b) => b.type === 'text')?.text ?? ''
  const cleaned = text.replace(/^```(?:json)?[ \t]*\n?/, '').replace(/\n?```[ \t]*$/, '').trim()
  return JSON.parse(cleaned) as CharacterCreatorOutput
}
