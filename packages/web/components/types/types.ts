import type { Tables } from './supabase'

export type Character = Tables<'characters'>
export type Spell = Tables<'spells'>
export type Item = Tables<'items'>
export type Skill = Tables<'skills'>
export type CharacterInventory = Tables<'character_inventory'>
export type Game = Tables<'games'>
export type GameMember = Tables<'game_members'>
