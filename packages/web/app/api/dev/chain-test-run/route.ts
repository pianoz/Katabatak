import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { AGENT_CONFIGS, type AgentSlug } from '@/lib/graders/agent-config'

const GM_SERVER = process.env.GM_SERVER_URL ?? 'http://localhost:3001'
const GM_API_KEY = process.env.GM_API_KEY

interface HydratedBlockResult {
  blockId: string
  status: string
  content: string | null
}

interface EvalResult {
  text: string
  usage: { input_tokens: number; output_tokens: number }
}

async function hydrateServerSide(characterId: string, tables: string[]): Promise<string | null> {
  if (!GM_API_KEY) return null
  try {
    const res = await fetch(`${GM_SERVER}/gm/hydrate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GM_API_KEY}` },
      body: JSON.stringify({ characterId, tables }),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { text?: string }
    return data.text?.trim() || null
  } catch {
    return null
  }
}

async function runEval(
  system: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  config: { model: string; maxTokens: number; temperature: number },
): Promise<EvalResult> {
  const res = await fetch(`${GM_SERVER}/eval`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ system, messages, model: config.model, maxTokens: config.maxTokens, temperature: config.temperature }),
  })
  const data = (await res.json()) as { text?: string; usage?: EvalResult['usage']; error?: string }
  if (!res.ok) throw new Error(data.error ?? 'Eval failed')
  return { text: data.text ?? '', usage: data.usage ?? { input_tokens: 0, output_tokens: 0 } }
}

async function getSystemPrompt(supabase: Awaited<ReturnType<typeof createClient>>, slug: string): Promise<string> {
  const { data } = await supabase
    .from('prompt_versions')
    .select('prompt')
    .eq('slug', slug)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle()

  const promptData = data?.prompt as { blocks?: Array<{ kind: string; content: string }> } | null
  const blocks = promptData?.blocks ?? []
  return blocks.filter((b) => b.kind === 'system').map((b) => b.content).join('\n\n').trim()
}

/**
 * POST /api/dev/chain-test-run
 * Body: { slug, playerInput, characterId? }
 * Runs the full agent chain up to slug and returns the final output + blocks used.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('is_dev').eq('id', user.id).single()
  if (!profile?.is_dev) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { slug, playerInput, characterId: reqCharId } = (await req.json()) as {
    slug?: string
    playerInput?: string
    characterId?: string
  }

  if (!slug || !playerInput?.trim()) {
    return NextResponse.json({ error: 'slug and playerInput required' }, { status: 400 })
  }

  const config = AGENT_CONFIGS[slug as AgentSlug]
  if (!config) return NextResponse.json({ error: `Unknown agent slug: ${slug}` }, { status: 400 })

  const characterId = reqCharId ?? process.env.TEST_CHARACTER_ID
  if (!characterId) {
    return NextResponse.json({ error: 'No characterId provided and TEST_CHARACTER_ID env var not set' }, { status: 500 })
  }

  const usageTotals = { input_tokens: 0, output_tokens: 0 }
  const blocks: HydratedBlockResult[] = []
  const chainOutputs: Record<string, string> = {}

  // ─── Step 1: Hydrate context blocks ────────────────────────────────────────

  for (const block of config.blocks) {
    if (block.kind === 'user-input') continue
    if (block.hydrateTables && block.hydrateTables.length > 0) {
      const text = await hydrateServerSide(characterId, block.hydrateTables)
      blocks.push({ blockId: block.id, status: text ? 'loaded' : (block.optional ? 'placeholder' : 'empty'), content: text })
    }
  }

  const contextText = blocks.filter((b) => b.status === 'loaded').map((b) => b.content!).join('\n\n')

  // ─── Step 2: Run upstream agents if needed ──────────────────────────────────

  const loreConfig = AGENT_CONFIGS['lore-engine']
  const architectConfig = AGENT_CONFIGS['architect']

  // Lore-engine is upstream for: architect, ledger
  if (slug === 'architect' || slug === 'ledger') {
    const loreSystem = await getSystemPrompt(supabase, 'lore-engine')
    const loreMessages = contextText
      ? [
          { role: 'user' as const, content: contextText },
          { role: 'user' as const, content: `=== RECENT HISTORY ===\n(no prior turns)\n\n=== PLAYER INPUT ===\n${playerInput}` },
        ]
      : [{ role: 'user' as const, content: playerInput }]

    const loreResult = await runEval(loreSystem, loreMessages, loreConfig)
    usageTotals.input_tokens += loreResult.usage.input_tokens
    usageTotals.output_tokens += loreResult.usage.output_tokens
    chainOutputs['lore-engine'] = loreResult.text
  }

  // Architect is upstream for: ledger
  if (slug === 'ledger') {
    const architectSystem = await getSystemPrompt(supabase, 'architect')
    const loreText = chainOutputs['lore-engine'] ?? ''

    let mechanicalContext = ''
    try {
      const loreJson = JSON.parse(loreText) as Record<string, unknown>
      mechanicalContext = `=== MECHANICAL CONTEXT ===\nAction type: ${loreJson.action_type ?? 'unknown'}\nCheck required: ${loreJson.requires_check ?? false}${loreJson.pool ? `\nPool: ${loreJson.pool}` : ''}`
    } catch {
      mechanicalContext = `=== MECHANICAL CONTEXT ===\n${loreText}`
    }

    const architectMessages = contextText
      ? [
          { role: 'user' as const, content: contextText },
          { role: 'user' as const, content: `${mechanicalContext}\n\n=== PLAYER INPUT ===\n${playerInput}` },
        ]
      : [{ role: 'user' as const, content: `${mechanicalContext}\n\n=== PLAYER INPUT ===\n${playerInput}` }]

    const architectResult = await runEval(architectSystem, architectMessages, architectConfig)
    usageTotals.input_tokens += architectResult.usage.input_tokens
    usageTotals.output_tokens += architectResult.usage.output_tokens
    chainOutputs['architect'] = architectResult.text
  }

  // ─── Step 3: Run the target agent ──────────────────────────────────────────

  const targetSystem = await getSystemPrompt(supabase, slug)
  let targetMessages: Array<{ role: 'user' | 'assistant'; content: string }>

  if (slug === 'ledger') {
    // Ledger takes the Architect narrative as its user input
    const architectNarrative = chainOutputs['architect'] ?? playerInput
    targetMessages = contextText
      ? [
          { role: 'user', content: `Character context:\n${contextText}\n\nGM Narrative:\n${architectNarrative}` },
        ]
      : [{ role: 'user', content: `GM Narrative:\n${architectNarrative}` }]
  } else if (slug === 'architect') {
    const loreText = chainOutputs['lore-engine'] ?? ''
    let mechanicalContext = ''
    try {
      const loreJson = JSON.parse(loreText) as Record<string, unknown>
      mechanicalContext = `=== MECHANICAL CONTEXT ===\nAction type: ${loreJson.action_type ?? 'unknown'}\nCheck required: ${loreJson.requires_check ?? false}${loreJson.pool ? `\nPool: ${loreJson.pool}` : ''}`
    } catch {
      mechanicalContext = `=== MECHANICAL CONTEXT ===\n${loreText}`
    }
    targetMessages = contextText
      ? [
          { role: 'user', content: contextText },
          { role: 'user', content: `${mechanicalContext}\n\n=== PLAYER INPUT ===\n${playerInput}` },
        ]
      : [{ role: 'user', content: `${mechanicalContext}\n\n=== PLAYER INPUT ===\n${playerInput}` }]
  } else {
    // lore-engine, scribe, character-builder: standard format
    targetMessages = contextText
      ? [
          { role: 'user', content: contextText },
          { role: 'user', content: `=== RECENT HISTORY ===\n(no prior turns)\n\n=== ${config.userInputLabel.toUpperCase()} ===\n${playerInput}` },
        ]
      : [{ role: 'user', content: playerInput }]
  }

  const targetResult = await runEval(targetSystem, targetMessages, config)
  usageTotals.input_tokens += targetResult.usage.input_tokens
  usageTotals.output_tokens += targetResult.usage.output_tokens

  return NextResponse.json({
    output: targetResult.text,
    blocks,
    chainOutputs,
    usage: usageTotals,
  })
}
