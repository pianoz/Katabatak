#!/usr/bin/env node
import readline from 'readline'
import supabase from './gm/tools/db.js'
import { handleGMMessage } from './gm/handler.js'
import type { CharacterRow, ConversationTurn, ToolResult } from './gm/types.js'
import { getFullCharacter } from './services/character-service.js'

const characterId = process.argv[2]
if (!characterId) {
  console.error('Usage: npm run chat -- <character_id>')
  process.exit(1)
}

const fullCharacter = await getFullCharacter(characterId)
if (!fullCharacter) {
  console.error('Character not found')
  process.exit(1)
}
const char = fullCharacter.character

const dim = (s: string) => `\x1b[90m${s}\x1b[0m`
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`
const cyan = (s: string) => `\x1b[36m${s}\x1b[0m`
const magenta = (s: string) => `\x1b[35m${s}\x1b[0m`
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`
const red = (s: string) => `\x1b[31m${s}\x1b[0m`

function statLine(c: CharacterRow): string {
  return `HP ${c.current_health ?? '?'}/${c.health_max ?? '?'}  Essence ${c.current_essence ?? '?'}/${c.essence_max ?? '?'}  Power ${c.current_power ?? '?'}/${c.power_max ?? '?'}  Will ${c.current_will ?? '?'}/${c.will_max ?? '?'}  Denarius ${c.denarius ?? '?'}`
}

async function fetchStats(): Promise<CharacterRow | null> {
  const { data } = await supabase.from('characters').select('*').eq('id', characterId).single()
  return data
}

console.log(`\n${bold(yellow(char.name))}  Lv.${char.level}  ${char.class_archetype ?? ''}`)
console.log(dim(statLine(char)))
console.log(dim('─'.repeat(60)))
console.log(dim('Commands: /stats  /quit'))
console.log()

const history: ConversationTurn[] = []

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })

function ask(): void {
  rl.question(`${cyan('You')} > `, async (line) => {
    const msg = line.trim()
    if (!msg) return ask()

    if (msg === '/quit' || msg === '/exit') {
      console.log('\nSession ended.')
      rl.close()
      process.exit(0)
    }

    if (msg === '/stats') {
      const fresh = await fetchStats()
      if (fresh) console.log('\n' + dim(statLine(fresh)) + '\n')
      return ask()
    }

    const toolCalls: Array<{ name: string; input: Record<string, unknown>; result: ToolResult }> = []

    let reply: string
    try {
      reply = await handleGMMessage({
        message: msg,
        conversationHistory: history,
        characterId,
        onToolCall: (name, input, result) => toolCalls.push({ name, input, result }),
      })
    } catch (err) {
      console.error(red(`[Error] ${err instanceof Error ? err.message : String(err)}`))
      return ask()
    }

    history.push({ role: 'player', content: msg })
    history.push({ role: 'assistant', content: reply })

    if (toolCalls.length > 0) {
      console.log()
      for (const tc of toolCalls) {
        const summary = tc.result.error
          ? red(`ERROR: ${tc.result.error}`)
          : dim(JSON.stringify(tc.result))
        console.log(dim(`  [${tc.name}]`) + ' ' + summary)
      }
    }

    console.log(`\n${magenta('The Architect')} > ${reply}\n`)
    ask()
  })
}

ask()
