import { describe, it, expect, beforeAll, afterAll } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  admin,
  clientAs,
  seedUser,
  seedCharacter,
  teardownUser,
  uniqueEmail,
} from "./test-helpers"
import {
  createCharacterWithItems,
  getUserCharacters,
  getFullCharacter,
  deleteCharacter,
  updateCharacterPool,
  updateCharacterMoney,
  updateCharacterNotes,
  refreshCharacter,
  incrementCharacterStat,
  getAllCharacters,
  getCharacterSkillPoints,
  updateCharacter,
} from "./character-service"

// The two item UUIDs hardcoded in createCharacterWithItems — upsert them so
// the test works against a fresh local DB.
const STARTING_ITEM_IDS = [
  "f761376b-f5aa-4834-abdb-1f7e0acc1c29",
  "8200bd07-931c-433f-a92e-69472d213350",
]

// Emails are fixed at module load time so beforeAll and clientAs use the same string.
const ALICE = uniqueEmail("char-alice")
const BOB = uniqueEmail("char-bob")
const PASS = "Test1234!"

describe("character-service", () => {
  let aliceId: string
  let bobId: string
  let alice: SupabaseClient
  let bob: SupabaseClient
  let aliceCharId: string

  beforeAll(async () => {
    await admin.from("items").upsert(
      STARTING_ITEM_IDS.map((id) => ({ id, name: `Starter ${id.slice(0, 8)}`, type: "gear" })),
      { onConflict: "id" }
    )
    aliceId = await seedUser(ALICE, PASS)
    bobId = await seedUser(BOB, PASS)
    alice = await clientAs(ALICE, PASS)
    bob = await clientAs(BOB, PASS)
    aliceCharId = await seedCharacter(aliceId, {
      name: "Alice Hero",
      denarius: 50,
      unused_skill_points: 3,
      health_max: 20,
    })
  })

  afterAll(async () => {
    try { await teardownUser(aliceId) } catch {}
    try { await teardownUser(bobId) } catch {}
  })

  // ---------------------------------------------------------------------------
  // createCharacterWithItems
  // ---------------------------------------------------------------------------

  describe("createCharacterWithItems", () => {
    it("creates the character row and seeds both starting items", async () => {
      const result = await createCharacterWithItems(alice, {
        user_id: aliceId,
        name: "New Hero",
        class_archetype: "Mage",
        health_max: 8,
        power_max: 10,
        will_max: 6,
        essence_max: 6,
        current_health: 8,
        current_power: 10,
        current_will: 6,
        current_essence: 6,
        in_game: false,
      })

      expect(result).not.toBeNull()
      expect(result!.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      )

      const { data: inv } = await admin
        .from("character_inventory")
        .select("item_id")
        .eq("character_id", result!.id)
      expect(inv).toHaveLength(2)
      const gotIds = (inv as { item_id: string }[]).map((r) => r.item_id).sort()
      expect(gotIds).toEqual([...STARTING_ITEM_IDS].sort())

      await admin.from("characters").delete().eq("id", result!.id)
    })

    it("returns null when RLS blocks the insert (wrong user_id)", async () => {
      // Bob tries to create a character owned by Alice — RLS must reject
      const result = await createCharacterWithItems(bob, {
        user_id: aliceId,
        name: "Stolen Hero",
        health_max: 5,
        current_health: 5,
        in_game: false,
      })
      expect(result).toBeNull()
    })
  })

  // ---------------------------------------------------------------------------
  // getUserCharacters
  // ---------------------------------------------------------------------------

  describe("getUserCharacters", () => {
    it("returns all characters owned by the requesting user", async () => {
      const chars = await getUserCharacters(alice, aliceId)
      expect(chars.length).toBeGreaterThanOrEqual(1)
      expect(chars.every((c: { user_id: string }) => c.user_id === aliceId)).toBe(true)
    })

    it("returns [] for a user with no characters", async () => {
      const chars = await getUserCharacters(bob, bobId)
      expect(chars).toEqual([])
    })

    it("RLS: Bob passing Alices userId receives [] (her chars are not his)", async () => {
      const chars = await getUserCharacters(bob, aliceId)
      expect(chars).toEqual([])
    })
  })

  // ---------------------------------------------------------------------------
  // getFullCharacter
  // ---------------------------------------------------------------------------

  describe("getFullCharacter", () => {
    it("assembles all sub-collections for the owner", async () => {
      const result = await getFullCharacter(alice, aliceCharId)
      expect(result).not.toBeNull()
      expect(result!.character.id).toBe(aliceCharId)
      expect(Array.isArray(result!.flattenedItems)).toBe(true)
      expect(Array.isArray(result!.spells)).toBe(true)
      expect(Array.isArray(result!.activeSkills)).toBe(true)
      expect(Array.isArray(result!.actionSkills)).toBe(true)
      expect(typeof result!.level).toBe("number")
    })

    it("returns null for a non-existent character id", async () => {
      const result = await getFullCharacter(alice, "00000000-0000-0000-0000-000000000000")
      expect(result).toBeNull()
    })

    it("RLS: Bob cannot fetch Alices character", async () => {
      const result = await getFullCharacter(bob, aliceCharId)
      expect(result).toBeNull()
    })
  })

  // ---------------------------------------------------------------------------
  // deleteCharacter
  // ---------------------------------------------------------------------------

  describe("deleteCharacter", () => {
    it("owner can delete their own character", async () => {
      const id = await seedCharacter(aliceId, { name: "Delete Me" })
      const { error } = await deleteCharacter(alice, id)
      expect(error).toBeNull()

      const { data } = await admin.from("characters").select("id").eq("id", id)
      expect(data).toHaveLength(0)
    })

    it("RLS: Bob cannot delete Alices character — row survives", async () => {
      const id = await seedCharacter(aliceId, { name: "Protected Char" })
      await deleteCharacter(bob, id)

      const { data } = await admin.from("characters").select("id").eq("id", id)
      expect(data).toHaveLength(1)

      await admin.from("characters").delete().eq("id", id)
    })
  })

  // ---------------------------------------------------------------------------
  // updateCharacterPool
  // ---------------------------------------------------------------------------

  describe("updateCharacterPool", () => {
    it("owner can set a pool value", async () => {
      const { error } = await updateCharacterPool(alice, aliceCharId, "current_health", 7)
      expect(error).toBeNull()

      const { data } = await admin
        .from("characters")
        .select("current_health")
        .eq("id", aliceCharId)
        .single()
      expect((data as { current_health: number }).current_health).toBe(7)
    })

    it("RLS: Bob cannot update Alices pool — value unchanged", async () => {
      const { data: before } = await admin
        .from("characters")
        .select("current_health")
        .eq("id", aliceCharId)
        .single()
      const orig = (before as { current_health: number }).current_health

      await updateCharacterPool(bob, aliceCharId, "current_health", 1)

      const { data: after } = await admin
        .from("characters")
        .select("current_health")
        .eq("id", aliceCharId)
        .single()
      expect((after as { current_health: number }).current_health).toBe(orig)
    })
  })

  // ---------------------------------------------------------------------------
  // updateCharacterMoney
  // ---------------------------------------------------------------------------

  describe("updateCharacterMoney", () => {
    it("owner can update denarius", async () => {
      await updateCharacterMoney(alice, aliceCharId, 777)
      const { data } = await admin
        .from("characters")
        .select("denarius")
        .eq("id", aliceCharId)
        .single()
      expect((data as { denarius: number }).denarius).toBe(777)
    })

    it("RLS: Bob cannot change Alices denarius", async () => {
      const { data: before } = await admin
        .from("characters")
        .select("denarius")
        .eq("id", aliceCharId)
        .single()
      await updateCharacterMoney(bob, aliceCharId, 0)
      const { data: after } = await admin
        .from("characters")
        .select("denarius")
        .eq("id", aliceCharId)
        .single()
      expect((after as { denarius: number }).denarius).toBe(
        (before as { denarius: number }).denarius
      )
    })
  })

  // ---------------------------------------------------------------------------
  // updateCharacterNotes
  // ---------------------------------------------------------------------------

  describe("updateCharacterNotes", () => {
    it("owner can write notes", async () => {
      await updateCharacterNotes(alice, aliceCharId, "My session notes")
      const { data } = await admin
        .from("characters")
        .select("notes")
        .eq("id", aliceCharId)
        .single()
      expect((data as { notes: string }).notes).toBe("My session notes")
    })

    it("accepts empty string (clears notes)", async () => {
      await updateCharacterNotes(alice, aliceCharId, "")
      const { data } = await admin
        .from("characters")
        .select("notes")
        .eq("id", aliceCharId)
        .single()
      expect((data as { notes: string }).notes).toBe("")
    })
  })

  // ---------------------------------------------------------------------------
  // refreshCharacter
  // ---------------------------------------------------------------------------

  describe("refreshCharacter", () => {
    it("returns the latest character row for the owner", async () => {
      const data = await refreshCharacter(alice, aliceCharId)
      expect(data).not.toBeNull()
      expect((data as { id: string }).id).toBe(aliceCharId)
    })

    it("returns null for a non-existent id", async () => {
      const data = await refreshCharacter(alice, "00000000-0000-0000-0000-000000000000")
      expect(data).toBeNull()
    })
  })

  // ---------------------------------------------------------------------------
  // incrementCharacterStat
  // ---------------------------------------------------------------------------

  describe("incrementCharacterStat", () => {
    it("increments health_max by exactly 1", async () => {
      const { data: before } = await admin
        .from("characters")
        .select("health_max")
        .eq("id", aliceCharId)
        .single()
      const prev = (before as { health_max: number }).health_max

      await incrementCharacterStat(alice, aliceCharId, "health_max")

      const { data: after } = await admin
        .from("characters")
        .select("health_max")
        .eq("id", aliceCharId)
        .single()
      expect((after as { health_max: number }).health_max).toBe(prev + 1)
    })

    it("returns { error } for a non-existent character", async () => {
      const result = await incrementCharacterStat(
        alice,
        "00000000-0000-0000-0000-000000000000",
        "health_max"
      )
      expect(result).toHaveProperty("error")
    })

    it("increments other stat types (power_max, will_max, essence_max)", async () => {
      for (const stat of ["power_max", "will_max", "essence_max"] as const) {
        const { data: before } = await admin
          .from("characters")
          .select(stat)
          .eq("id", aliceCharId)
          .single()
        const prev = (before as Record<string, number>)[stat]

        await incrementCharacterStat(alice, aliceCharId, stat)

        const { data: after } = await admin
          .from("characters")
          .select(stat)
          .eq("id", aliceCharId)
          .single()
        expect((after as Record<string, number>)[stat]).toBe(prev + 1)
      }
    })
  })

  // ---------------------------------------------------------------------------
  // getCharacterSkillPoints
  // ---------------------------------------------------------------------------

  describe("getCharacterSkillPoints", () => {
    it("returns unused_skill_points for the owner", async () => {
      const pts = await getCharacterSkillPoints(alice, aliceCharId)
      expect(typeof pts).toBe("number")
      expect(pts).toBeGreaterThanOrEqual(0)
    })

    it("returns 0 (safe default) for a non-existent id", async () => {
      const pts = await getCharacterSkillPoints(
        alice,
        "00000000-0000-0000-0000-000000000000"
      )
      expect(pts).toBe(0)
    })
  })

  // ---------------------------------------------------------------------------
  // getAllCharacters
  // ---------------------------------------------------------------------------

  describe("getAllCharacters", () => {
    it("returns an array with id/name/level/class_archetype shape", async () => {
      const chars = await getAllCharacters(alice)
      expect(Array.isArray(chars)).toBe(true)
      if (chars.length > 0) {
        expect(chars[0]).toHaveProperty("id")
        expect(chars[0]).toHaveProperty("name")
      }
    })

    it("RLS: Bob cannot see Alices characters without a shared game", async () => {
      const chars = await getAllCharacters(bob)
      const exposed = chars.filter((c: { id: string }) => c.id === aliceCharId)
      expect(exposed).toHaveLength(0)
    })
  })

  // ---------------------------------------------------------------------------
  // updateCharacter
  // ---------------------------------------------------------------------------

  describe("updateCharacter", () => {
    it("owner can apply arbitrary field updates", async () => {
      const { error } = await updateCharacter(alice, aliceCharId, {
        class_archetype: "Ranger",
      })
      expect(error).toBeNull()

      const { data } = await admin
        .from("characters")
        .select("class_archetype")
        .eq("id", aliceCharId)
        .single()
      expect((data as { class_archetype: string }).class_archetype).toBe("Ranger")
    })

    it("RLS: Bob cannot update Alices character", async () => {
      const { data: before } = await admin
        .from("characters")
        .select("class_archetype")
        .eq("id", aliceCharId)
        .single()
      await updateCharacter(bob, aliceCharId, { class_archetype: "Hacked" })
      const { data: after } = await admin
        .from("characters")
        .select("class_archetype")
        .eq("id", aliceCharId)
        .single()
      expect((after as { class_archetype: string }).class_archetype).toBe(
        (before as { class_archetype: string }).class_archetype
      )
    })
  })
})
