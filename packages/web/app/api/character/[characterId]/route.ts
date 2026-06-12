import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const CLEANUP_TABLES = [
  'character_spells',
  'character_entity_mutations',
  'npcs',
  'character_inventory',
  'character_skills',
  'conversation_turns',
  'improvised_entities',
  'pending_offers',
  'syngem_game',
  'roll_events',
] as const

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ characterId: string }> },
) {
  const { characterId } = await params

  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: character } = await supabase
    .from('characters')
    .select('id, user_id')
    .eq('id', characterId)
    .single()

  if (!character || character.user_id !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 403 })
  }

  const serviceRoleKey = process.env.SUPABASE_SECRET_KEY
  if (!serviceRoleKey) {
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }

  const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const cleaned: Record<string, number | string> = {}

  for (const table of CLEANUP_TABLES) {
    try {
      const { count, error } = await admin
        .from(table)
        .delete({ count: 'exact' })
        .eq('character_id', characterId)
      if (error) {
        cleaned[table] = `error: ${error.message}`
        console.error(`[delete-character] ${table} cleanup failed:`, error.message)
      } else {
        cleaned[table] = count ?? 0
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      cleaned[table] = `error: ${msg}`
      console.error(`[delete-character] ${table} cleanup threw:`, msg)
    }
  }

  const { error: deleteError } = await admin
    .from('characters')
    .delete()
    .eq('id', characterId)

  if (deleteError) {
    console.error('[delete-character] character delete failed:', deleteError.message)
    return NextResponse.json(
      { error: deleteError.message, partialCleanup: cleaned },
      { status: 500 },
    )
  }

  console.log(`[delete-character] deleted character ${characterId}`, cleaned)
  return NextResponse.json({ success: true, cleaned })
}
