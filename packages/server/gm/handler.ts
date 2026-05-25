import Anthropic from '@anthropic-ai/sdk'
import { tools, executeTool } from './tools/index.js'
import { getFullCharacter, type FullCharacter } from '../services/character-service.js'
import type { GMMessageInput } from './types.js'

const client = new Anthropic()

function logAPICall(
  label: string,
  system: string,
  messages: Anthropic.Messages.MessageParam[],
  toolNames: string[],
): void {
  console.log(`\n${'─'.repeat(60)}`)
  console.log(`[GM API] ${label}`)
  console.log('─'.repeat(60))
  console.log('[SYSTEM PROMPT]')
  console.log(system)
  console.log('\n[MESSAGES]')
  for (const msg of messages) {
    const content = Array.isArray(msg.content)
      ? JSON.stringify(msg.content, null, 2)
      : msg.content
    console.log(`  [${msg.role.toUpperCase()}]: ${content}`)
  }
  console.log('\n[TOOLS AVAILABLE]', toolNames.join(', '))
  console.log('─'.repeat(60))
}

function logAPIResponse(label: string, response: Anthropic.Messages.Message): void {
  console.log(`\n[GM RESPONSE] ${label} — stop_reason: ${response.stop_reason}`)
  for (const block of response.content) {
    if (block.type === 'text')
      console.log(`  [TEXT]: ${block.text.slice(0, 200)}${block.text.length > 200 ? '…' : ''}`)
    if (block.type === 'tool_use') console.log(`  [TOOL_USE]: ${block.name}`, block.input)
  }
  console.log('─'.repeat(60))
}

function logToolResult(name: string, result: Record<string, unknown>): void {
  console.log(`\n[TOOL RESULT] ${name}`)
  if (result.error) {
    console.log(`  ERROR: ${result.error}`)
  } else {
    for (const [key, val] of Object.entries(result)) {
      console.log(`  ${key}: ${val}`)
    }
  }
  console.log('─'.repeat(60))
}

export async function handleGMMessage({
  message,
  conversationHistory = [],
  characterId,
  gameId,
  onToolCall,
}: GMMessageInput): Promise<string> {
  const fullCharacter = await getFullCharacter(characterId)
  if (!fullCharacter) {
    return `[GM Error: character ${characterId} not found]`
  }

  const system = buildSystemPrompt(fullCharacter)
  const messages = buildMessages(conversationHistory, message)
  const toolNames = tools.map((t) => t.name)

  logAPICall('Initial request', system, messages, toolNames)
  let response = await client.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 1024,
    system,
    tools,
    messages,
  })
  logAPIResponse('Initial response', response)

  let toolRound = 0
  while (response.stop_reason === 'tool_use') {
    toolRound++
    const toolUseBlocks = response.content.filter(
      (b): b is Anthropic.Messages.ToolUseBlock => b.type === 'tool_use',
    )

    const toolResults = await Promise.all(
      toolUseBlocks.map(async (block) => {
        const result = await executeTool(
          block.name,
          block.input as Record<string, unknown>,
          characterId,
          gameId,
        )
        logToolResult(block.name, result)
        onToolCall?.(block.name, block.input as Record<string, unknown>, result)
        return {
          type: 'tool_result' as const,
          tool_use_id: block.id,
          content: JSON.stringify(result),
        }
      }),
    )

    messages.push({ role: 'assistant', content: response.content })
    messages.push({ role: 'user', content: toolResults })

    logAPICall(`Tool round ${toolRound}`, system, messages, toolNames)
    response = await client.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 1024,
      system,
      tools,
      messages,
    })
    logAPIResponse(`Tool round ${toolRound} response`, response)
  }

  const textBlock = response.content.find((b) => b.type === 'text')
  return textBlock?.type === 'text' ? textBlock.text : ''
}

function buildMessages(
  history: GMMessageInput['conversationHistory'],
  message: string,
): Anthropic.Messages.MessageParam[] {
  const mapped = (history ?? []).map((msg) => ({
    role: msg.role === 'player' ? ('user' as const) : ('assistant' as const),
    content: msg.content,
  }))
  return [...mapped, { role: 'user' as const, content: message }]
}

const DEBUG_MODE = false

function buildSystemPrompt({ character, inventory, skills, spells }: FullCharacter): string {
  if (DEBUG_MODE) {
    return `You are a debug breakpoint. Return all character info passed to you verbatim.`
  }

  let prompt = `You are the spirit guiding a player through a medieval world named Kataba.
The world is quiet, rural, developing, steeped in natural beauty.
Responses will be short. Ground in the senses and natural beauty.
You write like John Steinbeck. the mood is wisful melancholy. Ghibli or Faulkner.
Do not end your response with an open-ended question. Restrict the player.
Say no to the player occasionally. Make them work to succeed.

## Tools
All tools are pre-wired to the current character. Never pass an ID.

update_stat — use this for ANY stat change.
  stat: plain name — "health", "essence", "power", "will", "denarius", "speed", or "skill_points".
  delta: signed integer. Negative = damage/cost/spend. Positive = heal/restore/gain.
  ALWAYS call this tool when the player gains or loses any stat. Do not just describe it in words.

restore_pools — no parameters. Use after full rest or major healing.

update_level
  new_level: integer. skill_points_to_award: integer (optional).

resolve_difficulty
  Call whenever the player attempts something that might fail.
  action: what they are attempting. context: location and relevant conditions.
  After the call, present: difficulty/20, which pool, and their three options —
    (1) sacrifice the full difficulty from that pool to auto-succeed,
    (2) sacrifice some + roll d10 (total must meet difficulty),
    (3) roll d10 alone.

get_npc_response
  npc_name, personality, situation, player_input.
  Weave the returned dialogue into your narration — do not quote it as a block.

search_world_lore
  query: search string. Use to look up locations, factions, items, NPCs, or world facts.

get_campaign_facts
  Retrieve known facts for the current game session.

get_ally_characters
  List other active player characters in the same game.

get_active_encounter
  Get current combat state (if in combat).`

  prompt += `\n\nPlayer Character:
- Name: ${character.name}
- Level: ${character.level ?? '?'}
- Class/Archetype: ${character.class_archetype ?? 'Unknown'}
- Health: ${character.current_health ?? '?'} / ${character.health_max ?? '?'}
- Essence: ${character.current_essence ?? '?'} / ${character.essence_max ?? '?'}
- Power: ${character.current_power ?? '?'} / ${character.power_max ?? '?'}
- Will: ${character.current_will ?? '?'} / ${character.will_max ?? '?'}`

  if (character.current_location_text) {
    prompt += `\n- Location: ${character.current_location_text}`
  }
  if (character.condition_text) {
    prompt += `\n- Condition: ${character.condition_text}`
  }
  if (character.notes) {
    prompt += `\n- Notes: ${character.notes}`
  }

  if (inventory.length > 0) {
    const equipped = inventory.filter((i) => i.is_equipped).map((i) => i.items?.name ?? '?')
    const carried = inventory.filter((i) => !i.is_equipped).map((i) => i.items?.name ?? '?')
    if (equipped.length) prompt += `\n- Equipped: ${equipped.join(', ')}`
    if (carried) prompt += `\n- Carrying: ${carried.join(', ')}`
  }

  if (skills.length > 0) {
    const skillList = skills.map((s) => `${s.skills?.name ?? '?'} (rank ${s.current_rank ?? 1})`).join(', ')
    prompt += `\n- Skills: ${skillList}`
  }

  if (spells.length > 0) {
    const spellList = spells.map((s) => s.spells?.name ?? '?').join(', ')
    prompt += `\n- Spells: ${spellList}`
  }

  return prompt
}
