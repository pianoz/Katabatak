/**
 * Shared integration test helpers.
 *
 * Expects a local Supabase instance running at SUPABASE_TEST_URL (default: http://localhost:54321).
 * The default key values are the standard `supabase start` demo credentials and work out of the box.
 *
 * Override via env vars:
 *   SUPABASE_TEST_URL
 *   SUPABASE_TEST_PUBLISHABLE_KEY
 *   SUPABASE_TEST_SECRET_KEY
 */

import { createClient } from "@supabase/supabase-js"
import type { SupabaseClient } from "@supabase/supabase-js"

export const TEST_URL =
  process.env.SUPABASE_TEST_URL ?? "http://localhost:54321"

// Default keys that ship with every `supabase start` local instance
export const TEST_ANON_KEY =
  process.env.SUPABASE_TEST_PUBLISHABLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"

export const TEST_SERVICE_KEY =
  process.env.SUPABASE_TEST_SECRET_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"

/** Admin client — bypasses RLS. Use only for seeding / teardown. */
export const admin = createClient(TEST_URL, TEST_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

/** Returns a Supabase client authenticated as the given user. */
export async function clientAs(email: string, password = "Test1234!"): Promise<SupabaseClient> {
  const client = createClient(TEST_URL, TEST_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`clientAs sign-in failed for ${email}: ${error.message}`)
  return client
}

// ---------------------------------------------------------------------------
// User seeding
// ---------------------------------------------------------------------------

/** Creates a confirmed test user and returns their UUID. */
export async function seedUser(email: string, password = "Test1234!"): Promise<string> {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username: email.split("@")[0] },
  })
  if (error) throw new Error(`seedUser failed for ${email}: ${error.message}`)
  return data.user.id
}

/** Deletes a test user (cascades via auth). */
export async function teardownUser(userId: string): Promise<void> {
  await admin.auth.admin.deleteUser(userId)
}

// ---------------------------------------------------------------------------
// Record seeding — all use the admin client to bypass RLS
// ---------------------------------------------------------------------------

export async function seedCharacter(
  userId: string,
  overrides: Record<string, unknown> = {}
): Promise<string> {
  const { data, error } = await admin
    .from("characters")
    .insert({
      user_id: userId,
      name: "Test Character",
      class_archetype: "Warrior",
      health_max: 10,
      power_max: 10,
      will_max: 10,
      essence_max: 10,
      current_health: 10,
      current_power: 10,
      current_will: 10,
      current_essence: 10,
      denarius: 0,
      unused_skill_points: 0,
      in_game: false,
      ...overrides,
    })
    .select()
    .single()
  if (error) throw new Error(`seedCharacter failed: ${error.message}`)
  return (data as { id: string }).id
}

export async function seedGame(
  gmId: string,
  overrides: Record<string, unknown> = {}
): Promise<string> {
  const { data, error } = await admin
    .from("games")
    .insert({
      gm_id: gmId,
      name: "Test Game",
      starting_level: 0,
      archived: false,
      ...overrides,
    })
    .select()
    .single()
  if (error) throw new Error(`seedGame failed: ${error.message}`)
  return (data as { id: string }).id
}

export async function seedGameMember(
  gameId: string,
  profileId: string,
  status = "active",
  characterId: string | null = null
): Promise<string> {
  const { data, error } = await admin
    .from("game_members")
    .insert({
      game_id: gameId,
      profile_id: profileId,
      character_id: characterId,
      role: "player",
      member_status: status,
    })
    .select()
    .single()
  if (error) throw new Error(`seedGameMember failed: ${error.message}`)
  return (data as { id: string }).id
}

export async function seedFriendship(
  userId1: string,
  userId2: string,
  status: "pending" | "friend" = "friend"
): Promise<string> {
  const { data, error } = await admin
    .from("friends")
    .insert({ friend_1: userId1, friend_2: userId2, status })
    .select()
    .single()
  if (error) throw new Error(`seedFriendship failed: ${error.message}`)
  return (data as { id: string }).id
}

export async function seedSkill(overrides: Record<string, unknown> = {}): Promise<string> {
  const { data, error } = await admin
    .from("skills")
    .insert({
      name: `Test Skill ${Date.now()}`,
      is_passive: true,
      in_development: false,
      min_level: 0,
      ...overrides,
    })
    .select()
    .single()
  if (error) throw new Error(`seedSkill failed: ${error.message}`)
  return (data as { id: string }).id
}

export async function seedSpell(overrides: Record<string, unknown> = {}): Promise<number> {
  const { data, error } = await admin
    .from("spells")
    .insert({ name: `Test Spell ${Date.now()}`, ...overrides })
    .select()
    .single()
  if (error) throw new Error(`seedSpell failed: ${error.message}`)
  return (data as { id: number }).id
}

export async function seedItem(overrides: Record<string, unknown> = {}): Promise<string> {
  const { data, error } = await admin
    .from("items")
    .insert({ name: `Test Item ${Date.now()}`, type: "weapon", ...overrides })
    .select()
    .single()
  if (error) throw new Error(`seedItem failed: ${error.message}`)
  return (data as { id: string }).id
}

export async function seedCreature(overrides: Record<string, unknown> = {}): Promise<string> {
  const { data, error } = await admin
    .from("creatures")
    .insert({
      name: `Test Creature ${Date.now()}`,
      level: 1,
      health_max: 10,
      power_max: 5,
      will_max: 5,
      essence_max: 5,
      attack_damage: 3,
      attack_cost: 1,
      defence: 2,
      strong_attack: null,
      ...overrides,
    })
    .select()
    .single()
  if (error) throw new Error(`seedCreature failed: ${error.message}`)
  return (data as { id: string }).id
}

export async function seedActiveSkill(overrides: Record<string, unknown> = {}): Promise<string> {
  const { data, error } = await admin
    .from("active_skills")
    .insert({
      name: `Test Active Skill ${Date.now()}`,
      description: null,
      cooldown: null,
      effects: [],
      ...overrides,
    })
    .select()
    .single()
  if (error) throw new Error(`seedActiveSkill failed: ${error.message}`)
  return (data as { id: string }).id
}

/** Convenience — unique email per test run to avoid collisions. */
export function uniqueEmail(label: string): string {
  return `${label}+${Date.now()}@test.local`
}
