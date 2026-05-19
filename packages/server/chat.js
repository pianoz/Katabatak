#!/usr/bin/env node
// Interactive GM chat REPL — usage: npm run chat <character_id>
import readline from 'readline'
import supabase from './gm/tools/db.js'
import { handleGMMessage } from './gm/handler.js'

const characterId = process.argv[2]
if (!characterId) {
  console.error('Usage: npm run chat -- <character_id>')
  process.exit(1)
}

const { data: char, error } = await supabase
  .from('characters')
  .select('*')
  .eq('id', characterId)
  .single()

if (error || !char) {
  console.error('Character not found:', error?.message ?? 'no data')
  process.exit(1)
}

const dim = (s) => `\x1b[90m${s}\x1b[0m`
const bold = (s) => `\x1b[1m${s}\x1b[0m`
const cyan = (s) => `\x1b[36m${s}\x1b[0m`
const magenta = (s) => `\x1b[35m${s}\x1b[0m`
const yellow = (s) => `\x1b[33m${s}\x1b[0m`
const red = (s) => `\x1b[31m${s}\x1b[0m`

function statLine(c) {
  return `HP ${c.current_health}/${c.health_max}  Essence ${c.current_essence}/${c.essence_max}  Power ${c.current_power}/${c.power_max}  Will ${c.current_will}/${c.will_max}  Denarius ${c.denarius}`
}

async function fetchStats() {
  const { data } = await supabase.from('characters').select('*').eq('id', characterId).single()
  return data
}

console.log(`\n${bold(yellow(char.name))}  Lv.${char.level}  ${char.class_archetype ?? ''}`)
console.log(dim(statLine(char)))
console.log(dim('─'.repeat(60)))
console.log(dim('Commands: /stats  /quit'))
console.log()

const history = []

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })

function ask() {
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

    const toolCalls = []

    let reply
    try {
      reply = await handleGMMessage({
        message: msg,
        conversationHistory: history,
        characterContext: char,
        onToolCall: (name, input, result) => toolCalls.push({ name, input, result }),
      })
    } catch (err) {
      console.error(red(`[Error] ${err.message}`))
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
