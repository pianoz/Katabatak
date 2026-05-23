import type { Database } from '@db-types'
import supabase from '../gm/tools/db.js'

export type CharacterRow = Database['public']['Tables']['characters']['Row']
type CharacterUpdate = Database['public']['Tables']['characters']['Update']

export async function getCharacter(id: string): Promise<CharacterRow | null> {
  const { data, error } = await supabase
    .from('characters')
    .select('*')
    .eq('id', id)
    .single()
  if (error) return null
  return data
}

export async function updateCharacter(
  id: string,
  updates: CharacterUpdate,
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('characters').update(updates).eq('id', id)
  return { error: error?.message ?? null }
}
