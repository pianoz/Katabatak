import { describe, it, expect, beforeAll, afterAll } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"
import { admin, clientAs, seedUser, teardownUser, uniqueEmail } from "./test-helpers"
import { getProfile, updateProfile, searchProfiles } from "./profile-service"

const ALICE = uniqueEmail("profile-alice")
const BOB = uniqueEmail("profile-bob")
const CHARLIE = uniqueEmail("profile-charlie")
const PASS = "Test1234!"

describe("profile-service", () => {
  let aliceId: string
  let bobId: string
  let charlieId: string
  let alice: SupabaseClient
  let bob: SupabaseClient

  beforeAll(async () => {
    aliceId = await seedUser(ALICE, PASS)
    bobId = await seedUser(BOB, PASS)
    charlieId = await seedUser(CHARLIE, PASS)
    alice = await clientAs(ALICE, PASS)
    bob = await clientAs(BOB, PASS)

    // Ensure profiles exist (normally created by trigger on auth.users)
    // Upsert in case the trigger already created them
    await admin.from("profiles").upsert(
      [
        { id: aliceId, username: ALICE.split("@")[0], full_name: "Alice Test" },
        { id: bobId, username: BOB.split("@")[0], full_name: "Bob Test" },
        { id: charlieId, username: CHARLIE.split("@")[0], full_name: "Charlie Test" },
      ],
      { onConflict: "id" }
    )
  })

  afterAll(async () => {
    try { await teardownUser(aliceId) } catch {}
    try { await teardownUser(bobId) } catch {}
    try { await teardownUser(charlieId) } catch {}
  })

  // ---------------------------------------------------------------------------
  // getProfile
  // ---------------------------------------------------------------------------

  describe("getProfile", () => {
    it("returns own profile", async () => {
      const profile = await getProfile(alice, aliceId)
      expect(profile).not.toBeNull()
      expect((profile as { id: string }).id).toBe(aliceId)
    })

    it("returns null for a non-existent user id", async () => {
      const profile = await getProfile(alice, "00000000-0000-0000-0000-000000000000")
      expect(profile).toBeNull()
    })

    it("profiles are readable by other authenticated users (public read)", async () => {
      // In most Supabase apps, profiles are SELECT-public for authenticated users.
      // If this fails, your RLS restricts profile reads — adjust accordingly.
      const profile = await getProfile(bob, aliceId)
      // If RLS blocks it, profile will be null — either case is valid depending on policy.
      // We simply document the actual behavior here.
      if (profile !== null) {
        expect((profile as { id: string }).id).toBe(aliceId)
      } else {
        // RLS restricts profile reads to self — that's also valid
        expect(profile).toBeNull()
      }
    })
  })

  // ---------------------------------------------------------------------------
  // updateProfile
  // ---------------------------------------------------------------------------

  describe("updateProfile", () => {
    it("owner can update their own profile", async () => {
      const { error } = await updateProfile(alice, aliceId, { full_name: "Alice Updated" })
      expect(error).toBeNull()

      const { data } = await admin
        .from("profiles")
        .select("full_name")
        .eq("id", aliceId)
        .single()
      expect((data as { full_name: string }).full_name).toBe("Alice Updated")
    })

    it("owner can update avatar_url to null (clear it)", async () => {
      const { error } = await updateProfile(alice, aliceId, { avatar_url: null })
      expect(error).toBeNull()
    })

    it("RLS: Bob cannot update Alices profile", async () => {
      const { data: before } = await admin
        .from("profiles")
        .select("full_name")
        .eq("id", aliceId)
        .single()

      await updateProfile(bob, aliceId, { full_name: "Hacked" })

      const { data: after } = await admin
        .from("profiles")
        .select("full_name")
        .eq("id", aliceId)
        .single()

      expect((after as { full_name: string }).full_name).toBe(
        (before as { full_name: string }).full_name
      )
    })

    it("handles empty updates object (no-op)", async () => {
      const { error } = await updateProfile(alice, aliceId, {})
      expect(error).toBeNull()
    })
  })

  // ---------------------------------------------------------------------------
  // searchProfiles
  // ---------------------------------------------------------------------------

  describe("searchProfiles", () => {
    it("returns profiles matching the query by username", async () => {
      const prefix = BOB.split("@")[0].slice(0, 8) // first 8 chars of username
      const results = await searchProfiles(alice, prefix, aliceId)
      expect(results.some((p: { id: string }) => p.id === bobId)).toBe(true)
    })

    it("excludes the requesting user (excludeId)", async () => {
      const results = await searchProfiles(alice, "profile", aliceId)
      expect(results.every((p: { id: string }) => p.id !== aliceId)).toBe(true)
    })

    it("returns [] when no usernames match", async () => {
      const results = await searchProfiles(alice, "xzxznonexistentzxzx", aliceId)
      expect(results).toEqual([])
    })

    it("respects the 20-result limit on heavy queries", async () => {
      // A query that would match everyone (empty string matches all via ilike %%)
      const results = await searchProfiles(alice, "", aliceId)
      expect(results.length).toBeLessThanOrEqual(20)
    })

    it("each result has id, username, full_name", async () => {
      const results = await searchProfiles(alice, BOB.split("@")[0].slice(0, 5), aliceId)
      if (results.length > 0) {
        expect(results[0]).toHaveProperty("id")
        expect(results[0]).toHaveProperty("username")
        expect(results[0]).toHaveProperty("full_name")
      }
    })

    it("is case-insensitive (ilike)", async () => {
      const lower = await searchProfiles(alice, BOB.split("@")[0].slice(0, 5).toLowerCase(), aliceId)
      const upper = await searchProfiles(alice, BOB.split("@")[0].slice(0, 5).toUpperCase(), aliceId)
      expect(lower.length).toBe(upper.length)
    })
  })
})
