#!/usr/bin/env node
// Tool smoke-test — usage: npm run test:tools -- <character_id>
// Exercises every tool against a real character and restores the original state when done.
import supabase from './gm/tools/db.js'
import { executeTool } from './gm/tools/index.js'

const characterId = process.argv[2]
if (!characterId) {
  console.error('Usage: npm run test:tools -- <character_id>')
  process.exit(1)
}

const { data: orig, error } = await supabase
  .from('characters')
  .select('*')
  .eq('id', characterId)
  .single()

if (error || !orig) {
  console.error('Character not found:', error?.message ?? 'no data')
  process.exit(1)
}

console.log(`\nTesting tools on: ${orig.name} (${characterId})\n`)

let passed = 0
let failed = 0

async function run(label, toolName, input, check) {
  const result = await executeTool(toolName, { character_id: characterId, ...input })
  const ok = !result.error && (!check || check(result))
  const icon = ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'
  const detail = result.error ? `\x1b[31m${result.error}\x1b[0m` : JSON.stringify(result)
  console.log(`  ${icon}  ${label}: ${detail}`)
  ok ? passed++ : failed++
}

// ── Vital pools ────────────────────────────────────────────────
console.log('Vital pools:')
await run('update_health -5', 'update_health', { delta: -5 },
  r => r.current_health === Math.max(0, orig.current_health - 5))

await run('update_health +9999 clamps at max', 'update_health', { delta: 9999 },
  r => r.current_health === r.health_max)

await run('update_essence -3', 'update_essence', { delta: -3 },
  r => r.current_essence === Math.max(0, orig.essence_max - 3))  // after clamp-to-max above

await run('update_power -2', 'update_power', { delta: -2 })
await run('update_will -1', 'update_will', { delta: -1 })

await run('restore_pools sets all to max', 'restore_pools', {},
  r => r.current_health === r.health_max &&
       r.current_essence === r.essence_max &&
       r.current_power === r.power_max &&
       r.current_will === r.will_max)

// ── Currency ───────────────────────────────────────────────────
console.log('\nCurrency:')
await run('update_denarius +50', 'update_denarius', { delta: 50 },
  r => r.denarius === orig.denarius + 50)

await run('update_denarius -9999 clamps at 0', 'update_denarius', { delta: -9999 },
  r => r.denarius === 0)

// ── Progression ────────────────────────────────────────────────
console.log('\nProgression:')
await run('update_skill_points +3', 'update_skill_points', { delta: 3 },
  r => r.unused_skill_points === orig.unused_skill_points + 3)

await run('update_skill_points -9999 clamps at 0', 'update_skill_points', { delta: -9999 },
  r => r.unused_skill_points === 0)

await run(`update_level to ${orig.level + 1} + 2 points`, 'update_level',
  { new_level: orig.level + 1, skill_points_to_award: 2 },
  r => r.level === orig.level + 1 && r.unused_skill_points === 2)

// ── Movement ───────────────────────────────────────────────────
console.log('\nMovement:')
await run('update_speed -1', 'update_speed', { delta: -1 },
  r => r.speed === Math.max(0, orig.speed - 1))

await run('update_speed +1', 'update_speed', { delta: 1 })

// ── Restore original state ─────────────────────────────────────
console.log('\nRestoring original character state...')
const { error: restoreErr } = await supabase
  .from('characters')
  .update({
    current_health: orig.current_health,
    current_essence: orig.current_essence,
    current_power: orig.current_power,
    current_will: orig.current_will,
    denarius: orig.denarius,
    unused_skill_points: orig.unused_skill_points,
    level: orig.level,
    speed: orig.speed,
  })
  .eq('id', characterId)

console.log(restoreErr ? `  \x1b[31m✗ Restore failed: ${restoreErr.message}\x1b[0m` : '  \x1b[32m✓ Restored\x1b[0m')

console.log(`\n${passed} passed, ${failed} failed\n`)
process.exit(failed > 0 ? 1 : 0)
