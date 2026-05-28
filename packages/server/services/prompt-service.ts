import supabase from '../gm/tools/db.js'

interface PromptBlock {
  kind: 'system' | 'user' | 'assistant'
  content: string
}

interface SavedPrompt {
  blocks: PromptBlock[]
}

const CACHE_TTL_MS = 60_000
const cache = new Map<string, { value: string | null; expiresAt: number }>()

/**
 * Fetches the latest system prompt for a given slug from prompt_versions.
 * Results are cached for 60 seconds. Returns null if no DB version exists.
 */
export async function loadSystemPrompt(slug: string): Promise<string | null> {
  const now = Date.now()
  const cached = cache.get(slug)
  if (cached && cached.expiresAt > now) return cached.value

  const { data } = await supabase
    .from('prompt_versions')
    .select('prompt')
    .eq('slug', slug)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle()

  const saved = data?.prompt as unknown as SavedPrompt | undefined
  const systemBlocks = (saved?.blocks ?? []).filter((b) => b.kind === 'system')
  const value = systemBlocks.length ? systemBlocks.map((b) => b.content).join('\n\n') : null

  cache.set(slug, { value, expiresAt: now + CACHE_TTL_MS })
  return value
}

export async function loadArchitectPrompt(): Promise<string | null> {
  return loadSystemPrompt('architect1')
}

/** Clears the prompt cache for a specific slug (or all slugs if omitted). */
export function invalidatePromptCache(slug?: string): void {
  if (slug) cache.delete(slug)
  else cache.clear()
}
