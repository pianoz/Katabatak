import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Json } from '@/components/types/supabase'

async function assertDev() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase: null, user: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  const { data: profile } = await supabase.from('profiles').select('is_dev').eq('id', user.id).single()
  if (!profile?.is_dev) return { supabase: null, user: null, error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

  return { supabase, user, error: null }
}

/** GET /api/dev/test-cases?slug=lore-engine&default=true */
export async function GET(req: NextRequest) {
  const { supabase, error } = await assertDev()
  if (error) return error

  const { searchParams } = new URL(req.url)
  const slug = searchParams.get('slug')
  const defaultOnly = searchParams.get('default') === 'true'

  if (!slug) return NextResponse.json({ error: 'slug required' }, { status: 400 })

  let query = supabase!.from('prompt_test_cases').select('*').eq('slug', slug).order('generated_at', { ascending: false })
  if (defaultOnly) query = query.eq('is_default', true)

  const { data, error: dbErr } = await query
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

  return NextResponse.json(data ?? [])
}

interface SaveTestCasesBody {
  slug: string
  slugVersion: number
  blocks: unknown[]
  testCases: Array<{
    label: string
    playerInput: string
    expectedOutput: unknown
    testType: 'static' | 'chain'
  }>
}

/** POST /api/dev/test-cases — replaces all is_default records for the slug */
export async function POST(req: NextRequest) {
  const { supabase, user, error } = await assertDev()
  if (error) return error

  const body: SaveTestCasesBody = await req.json()
  const { slug, slugVersion, blocks, testCases } = body

  if (!slug || !testCases?.length) return NextResponse.json({ error: 'slug and testCases required' }, { status: 400 })

  // Delete existing defaults for this slug
  const { error: delErr } = await supabase!
    .from('prompt_test_cases')
    .delete()
    .eq('slug', slug)
    .eq('is_default', true)

  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })

  // Insert new defaults
  const rows = testCases.map((tc, i) => ({
    slug,
    slug_version: slugVersion,
    test_type: tc.testType,
    label: tc.label || `Test ${i + 1}`,
    blocks: blocks as Json,
    player_input: tc.playerInput,
    expected_output: (tc.expectedOutput ?? null) as Json | null,
    is_default: true,
    generated_at: new Date().toISOString(),
    generated_by: user!.id,
  }))

  const { data, error: insErr } = await supabase!
    .from('prompt_test_cases')
    .insert(rows)
    .select()

  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })

  return NextResponse.json(data)
}
