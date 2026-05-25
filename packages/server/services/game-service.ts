import supabase from '../gm/tools/db.js'
import type { Database } from '@db-types'

type GameRow = Database['public']['Tables']['games']['Row']
type GameMemberRow = Database['public']['Tables']['game_members']['Row']
type CharacterRow = Database['public']['Tables']['characters']['Row']
type EncounterCreatureRow = Database['public']['Tables']['encounter_creatures']['Row']

export interface GameWithMembers {
  game: GameRow
  members: GameMemberRow[]
}

export interface EncounterWithCreatures {
  gameId: string
  isInCombat: boolean
  creatures: EncounterCreatureRow[]
  turnOrder: string[]
  activeTurnIndex: number | null
}

export async function getGameWithMembers(gameId: string): Promise<GameWithMembers | null> {
  const [gameResult, membersResult] = await Promise.all([
    supabase.from('games').select('*').eq('id', gameId).single(),
    supabase.from('game_members').select('*').eq('game_id', gameId),
  ])
  if (gameResult.error || !gameResult.data) return null
  return {
    game: gameResult.data,
    members: membersResult.data ?? [],
  }
}

export async function getGameAllyCharacters(
  gameId: string,
  excludeCharacterId: string,
): Promise<CharacterRow[]> {
  const { data: members } = await supabase
    .from('game_members')
    .select('character_id')
    .eq('game_id', gameId)
    .eq('member_status', 'active')
    .neq('character_id', excludeCharacterId)

  if (!members?.length) return []
  const characterIds = members.map((m) => m.character_id).filter(Boolean) as string[]
  if (!characterIds.length) return []

  const { data } = await supabase.from('characters').select('*').in('id', characterIds)
  return data ?? []
}

export async function getActiveEncounter(gameId: string): Promise<EncounterWithCreatures | null> {
  const { data: game } = await supabase
    .from('games')
    .select('is_in_combat, current_turn_order, active_turn_index')
    .eq('id', gameId)
    .single()

  if (!game?.is_in_combat) return null

  const { data: creatures } = await supabase
    .from('encounter_creatures')
    .select('*')
    .eq('game_id', gameId)
    .eq('is_alive', true)

  return {
    gameId,
    isInCombat: true,
    creatures: creatures ?? [],
    turnOrder: game.current_turn_order ?? [],
    activeTurnIndex: game.active_turn_index,
  }
}
