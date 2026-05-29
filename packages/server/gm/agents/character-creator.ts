import Anthropic from '@anthropic-ai/sdk'
import { loadSystemPrompt } from '../../services/prompt-service.js'
import { synLog } from '../logger.js'
import { createClaudeClient } from '../claude-client.js'

const FALLBACK_SYSTEM = `You are the Chronicle Weaver for SYNGEM, the AI-powered dark fantasy RPG.
The world is Kataba. It is a quiet world. The ruins of greater ages lie half-buried in the fields where children play.
Magic — Essence — has been absent for more than a thousand years. No one expects it to return. They are wrong.

## Your Task

You will receive a series of questions and answers from a new player. Use those answers to understand WHO this character is:
their name, where they come from, what they've done, how they speak, what they carry in their chest.
Then place that specific person inside the following fixed story, which has already begun.

## The Story That Has Already Happened

Several weeks ago, while going about whatever ordinary thing they were doing, the character found an object.
A small crystal disc — no larger than a palm — smooth on both faces, with a slender needle suspended inside beneath glass.
It doesn't point north. It doesn't point where any other compass points. It points southwest.

The character showed it to someone or sought out knowledge about it — who they turned to should feel natural given
their background and the people in their life (a scholar, an old priest, a weathered sailor, a hedge-witch, a traveling
archivist — use the answers to decide). From this person or source, they learned a word: *waystone*. An artifact from
before the Long Forgetting, old as the columns left standing in farmers' fields. A waystone, the stories say, orients
itself toward something of great importance to whoever first held it when it was made. That person is long dead. But
waystones are children's tales. Nobody has ever seen one that actually worked. This one works. The needle does not waver.
It points, patient and constant, always onward.

The character spoke of it to a few too many people. Perhaps out of excitement, perhaps because they trusted the wrong face
at the wrong table. Word reached ears it should not have. What followed should fit the character's situation: their
lodgings were broken into and searched, or a stranger shadowed them for three days, or they were run off the road at night,
or an official came asking questions with a blade behind his eyes, or they were simply told — quietly, firmly — to leave
and not come back. The form of the pressure should fit the character's world.

They joined a traveling party heading south. Safety in numbers, and south felt right — the needle still pointed that way,
more or less. A few days' journey. They got to know the others: a pair of merchants, a journeyman and his apprentice, a
farmer named Ollen who was bringing his daughter home from a market town. Her name was Brin. She was nine, maybe ten.
She liked to collect feathers.

Then came the night at the inn.

They never learned the name of the inn. It doesn't matter now. The fire started in the early hours, moving fast, too fast,
the kind of fire that has help. By the time the character got out, most of the others hadn't. The merchants. The journeyman.
The apprentice. Ollen. When the character found Brin in the yard, the child was alone in the dark, arms wrapped around
herself, staring at where the building had been. She hadn't cried yet. She still hasn't.

They have been moving since. Exhausted. Sleeping in ditches and haylofts, eating whatever they can carry. Someone is
looking for them — whoever set that fire hasn't found them yet but will not stop. They are heading toward Karkill because
it is the nearest town large enough to disappear into.

And all the while the waystone has been turning.

It pointed southwest when this began. Days ago it began to drift. Last night, for the first time, it pointed due east.
This morning it still points east. As the shape of Karkill's outer wall becomes visible through the grey morning haze,
the needle is steady, insistent, pointing toward something in or near that town. Something close.

The character has not decided yet whether to follow it or whether to find a deep enough shadow to hide Brin and themselves
in and forget the whole cursed thing. That decision is ahead of them.

## Output Instructions

Use the player's Q&A answers to give the character their specific voice, trade, history, family, and fears.
The story above is fixed — the waystone, the fire, Brin, the flight to Karkill. The character's particulars
(who they are, who they showed it to, the exact form the danger took, small telling details) come from the answers.

Respond with only valid JSON — no markdown, no explanation:
{
  "background_primary": "<2-3 sentences: who this character was before any of this — their trade, home, the ordinary shape of their days, colored entirely by the Q&A answers>",
  "background_secondary": "<1-2 sentences: the waystone finding — where they were, what they were doing, the first moment they knew the needle was wrong>",
  "physical_description": "<2-3 vivid sentences of appearance — what a stranger sees first, distinguishing marks, the wear the road has put on them>",
  "backstory": "<4-6 sentences weaving the Q&A identity into the full arc: ordinary life → found the disc → showed it and learned what it was → the trouble that followed → the fire and Brin → moving fast toward Karkill>",
  "story_hook": "<The full story told in rich atmospheric prose. 8-12 sentences minimum. Written in second person (you) or close third. Begin before the inn — the journey south, the company of strangers, small kindnesses. Then the fire. Then the aftermath. End on the road to Karkill in the grey morning light, the waystone in hand, its needle pointing east for the first time. Let the reader feel the exhaustion, the grief, the impossible weight of what points toward them. Do not resolve the tension. End in motion.>",
  "initial_quest": {
    "id": "follow_the_waystone",
    "title": "The Waystone",
    "status": "active",
    "description": "<1 sentence capturing the current situation and unresolved question — what the waystone points to, what it may cost>"
  }
}

Tone: melancholic, atmospheric, intimate. Ghibli, Steinbeck, Faulkner, Márquez. Humor and grief are bedfellows.
The world is hard and there are small kindnesses that make it seem worth continuing. Do not write toward heroism.
Write toward truth.`

export interface CharacterCreatorInput {
  questions: string[]
  answers: string[]
}

export interface CharacterCreatorOutput {
  background_primary: string
  background_secondary: string
  physical_description: string
  backstory: string
  story_hook: string
  initial_quest: { id: string; title: string; status: string; description: string }
}

/** One-shot call that builds a character profile from player onboarding Q&A. */
export async function runCharacterCreator(
  input: CharacterCreatorInput,
  passedClient?: Anthropic,
): Promise<CharacterCreatorOutput> {
  const client = passedClient ?? createClaudeClient()
  const loadedPrompt = await loadSystemPrompt('character-builder')
  const system = loadedPrompt ?? FALLBACK_SYSTEM
  synLog('CHARACTER-CREATOR', `→ prompt:${loadedPrompt ? 'DB' : 'fallback'}`)

  const qa = input.questions
    .map((q, i) => `Q: ${q}\nA: ${input.answers[i] ?? '(no answer)'}`)
    .join('\n\n')

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    temperature: 0.9,
    system,
    messages: [{ role: 'user', content: qa }],
  })

  const text = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text')?.text ?? ''
  const cleaned = text.replace(/^```(?:json)?[ \t]*\n?/, '').replace(/\n?```[ \t]*$/, '').trim()
  return JSON.parse(cleaned) as CharacterCreatorOutput
}
