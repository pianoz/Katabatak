import { SupabaseClient } from '@supabase/supabase-js'

export interface SavedPromptBlock {
  kind: 'system' | 'user' | 'assistant'
  label: string
  content: string
}

export interface SavedPrompt {
  blocks: SavedPromptBlock[]
  model: string
  maxTokens: number
  temperature: number
}

export interface PromptVersionRow {
  id: string
  name: string
  slug: string
  version: number
  prompt: SavedPrompt
  created_at: string
  created_by: string
}

/** Returns distinct slugs for the current user, sorted alphabetically. */
export async function getPromptSlugs(supabase: SupabaseClient): Promise<string[]> {
  const { data, error } = await supabase
    .from('prompt_versions')
    .select('slug')
    .order('slug', { ascending: true })

  if (error) throw new Error(error.message)

  const seen = new Set<string>()
  const slugs: string[] = []
  for (const row of data ?? []) {
    if (!seen.has(row.slug)) {
      seen.add(row.slug)
      slugs.push(row.slug)
    }
  }
  return slugs
}

/** Returns the highest-version row for the given slug, or null if none. */
export async function getLatestPrompt(
  supabase: SupabaseClient,
  slug: string
): Promise<PromptVersionRow | null> {
  const { data, error } = await supabase
    .from('prompt_versions')
    .select('*')
    .eq('slug', slug)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data as PromptVersionRow | null
}

export interface VersionMetaRow {
  id: string
  version: number
  name: string
}

/** Returns all version metadata for a slug, newest first. */
export async function getPromptVersions(
  supabase: SupabaseClient,
  slug: string
): Promise<VersionMetaRow[]> {
  const { data, error } = await supabase
    .from('prompt_versions')
    .select('id, version, name')
    .eq('slug', slug)
    .order('version', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as VersionMetaRow[]
}

/** Returns the full row for a specific slug + version, or null. */
export async function getPromptByVersion(
  supabase: SupabaseClient,
  slug: string,
  version: number
): Promise<PromptVersionRow | null> {
  const { data, error } = await supabase
    .from('prompt_versions')
    .select('*')
    .eq('slug', slug)
    .eq('version', version)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data as PromptVersionRow | null
}

/** Inserts a new version row (auto-increments version per slug per user). */
export async function savePrompt(
  supabase: SupabaseClient,
  { name, slug, prompt }: { name: string; slug: string; prompt: SavedPrompt }
): Promise<PromptVersionRow> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const latest = await getLatestPrompt(supabase, slug)
  const nextVersion = (latest?.version ?? 0) + 1

  const { data, error } = await supabase
    .from('prompt_versions')
    .insert({ name, slug, version: nextVersion, prompt, created_by: user.id })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as PromptVersionRow
}
