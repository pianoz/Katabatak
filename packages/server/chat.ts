#!/usr/bin/env node
import readline from 'readline'
import { handleGMMessage } from './gm/handler.js'
import type { CharacterRow } from './gm/types.js'
import { getFullCharacter } from './services/character-service.js'
import supabase from './gm/tools/db.js'

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

    process.stdout.write(`\n${magenta('The Architect')} > `)
    let fullReply = ''
    try {
      for await (const chunk of handleGMMessage({ message: msg, characterId })) {
        if (typeof chunk === 'string') {
          process.stdout.write(chunk)
          fullReply += chunk
        } else if (chunk.type === 'check_required') {
          process.stdout.write(`\n[CHECK REQUIRED] ${chunk.check_description} — Difficulty: ${chunk.difficulty} ${chunk.pool}\n`)
        }
      }
      process.stdout.write('\n\n')
    } catch (err) {
      console.error(red(`[Error] ${err instanceof Error ? err.message : String(err)}`))
    }

    ask()
  })
}

ask()
