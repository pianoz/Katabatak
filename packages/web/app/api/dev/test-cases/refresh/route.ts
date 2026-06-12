import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { AGENT_CONFIGS, type AgentSlug } from '@/lib/graders/agent-config'

const GM_SERVER = process.env.GM_SERVER_URL ?? 'http://localhost:3001'
const GM_API_KEY = process.env.GM_API_KEY

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

/** POST /api/dev/test-cases/refresh — re-hydrates context blocks for all default tests of a slug */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('is_dev').eq('id', user.id).single()
  if (!profile?.is_dev) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { slug } = (await req.json()) as { slug?: string }
  if (!slug) return NextResponse.json({ error: 'slug required' }, { status: 400 })

  const testCharacterId = process.env.TEST_CHARACTER_ID
  if (!testCharacterId) {
    return NextResponse.json({ error: 'TEST_CHARACTER_ID env var not set' }, { status: 500 })
  }

  const config = AGENT_CONFIGS[slug as AgentSlug]
  if (!config) return NextResponse.json({ error: `Unknown agent slug: ${slug}` }, { status: 400 })

  // Check that there are existing default test cases to refresh
  const { data: existing } = await supabase
    .from('prompt_test_cases')
    .select('id')
    .eq('slug', slug)
    .eq('is_default', true)
    .limit(1)

  if (!existing?.length) {
    return NextResponse.json({ error: 'No default test cases defined for this slug. Create them in the grader first.' }, { status: 422 })
  }

  // Get the current prompt version for this slug
  const { data: promptRow } = await supabase
    .from('prompt_versions')
    .select('version, prompt')
    .eq('slug', slug)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle()

  const currentVersion = promptRow?.version ?? 0
  const promptData = promptRow?.prompt as { blocks?: Array<{ kind: string; content: string }> } | null

  // Build HydratedBlock[] for each block in the agent config
  const newBlocks: Array<{ blockId: string; status: string; content: string | null }> = []

  for (const block of config.blocks) {
    if (block.kind === 'user-input') {
      // user-input is not stored in the snapshot — it comes from each test case's player_input
      continue
    }

    if (block.hydrateTables && block.hydrateTables.length > 0) {
      const text = await hydrateServerSide(testCharacterId, block.hydrateTables)
      newBlocks.push({
        blockId: block.id,
        status: text ? 'loaded' : (block.optional ? 'placeholder' : 'empty'),
        content: text,
      })
    } else if (block.kind === 'system') {
      // System blocks without hydrateTables: extract from the loaded prompt_versions row
      const savedBlocks = promptData?.blocks ?? []
      const systemContent = savedBlocks
        .filter((b) => b.kind === 'system')
        .map((b) => b.content)
        .join('\n\n')
        .trim()
      newBlocks.push({
        blockId: block.id,
        status: systemContent ? 'loaded' : 'empty',
        content: systemContent || null,
      })
    }
  }

  // Update all default test cases for this slug
  const { error: updateErr } = await supabase
    .from('prompt_test_cases')
    .update({
      blocks: newBlocks,
      slug_version: currentVersion,
      generated_at: new Date().toISOString(),
    })
    .eq('slug', slug)
    .eq('is_default', true)

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  return NextResponse.json({ slug, slug_version: currentVersion, blocks_count: newBlocks.length })
}
