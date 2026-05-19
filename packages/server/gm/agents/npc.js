import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

const SYSTEM = `You are a dialogue engine for Katabatak, a fantasy tabletop RPG. Your only job is to voice NPCs.

Write the NPC's response as they would actually say it. Stay true to the personality given. Do not editorialize or describe actions — dialogue only.

Respond with only a JSON object — no explanation, no markdown:
{"dialogue":"<what the NPC says>","mood":"<one word: e.g. suspicious|warm|fearful|cold|evasive|hostile|amused>"}`

export async function getNpcResponse({ npc_name, personality, situation, player_input }) {
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 200,
    system: SYSTEM,
    messages: [{
      role: 'user',
      content: `NPC: ${npc_name}\nPersonality: ${personality}\nSituation: ${situation}\nPlayer said or did: ${player_input}`,
    }],
  })

  const text = response.content.find(b => b.type === 'text')?.text ?? ''
  try {
    return JSON.parse(text)
  } catch {
    return { error: 'Could not parse NPC response', raw: text }
  }
}