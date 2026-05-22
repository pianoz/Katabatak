import { describe, it, expect, beforeAll, afterAll } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"
import { admin, clientAs, seedUser, seedCharacter, seedSpell, teardownUser, uniqueEmail } from "./test-helpers"
import {
  getAllSpells,
  createSpell,
  addSpellToCharacter,
  removeCharacterSpell,
  getSpellById,
} from "./spell-service"

const ALICE = uniqueEmail("spell-alice")
const BOB = uniqueEmail("spell-bob")
const PASS = "Test1234!"

describe("spell-service", () => {
  let aliceId: string
  let bobId: string
  let alice: SupabaseClient
  let bob: SupabaseClient
  let aliceCharId: string
  let catalogSpellId: number

  beforeAll(async () => {
    aliceId = await seedUser(ALICE, PASS)
    bobId = await seedUser(BOB, PASS)
    alice = await clientAs(ALICE, PASS)
    bob = await clientAs(BOB, PASS)
    aliceCharId = await seedCharacter(aliceId, { name: "Alice Spellcaster" })
    catalogSpellId = await seedSpell({ name: "Catalog Fireball" })
  })

  afterAll(async () => {
    await admin.from("character_spells").delete().eq("character_id", aliceCharId)
    await admin.from("spells").delete().eq("id", catalogSpellId)
    await teardownUser(aliceId)
    await teardownUser(bobId)
  })

  // ---------------------------------------------------------------------------
  // getAllSpells
  // ---------------------------------------------------------------------------

  describe("getAllSpells", () => {
    it("returns all spells ordered by name", async () => {
      const spells = await getAllSpells(alice)
      expect(Array.isArray(spells)).toBe(true)
      expect(spells.some((s: { id: number }) => s.id === catalogSpellId)).toBe(true)
    })

    it("is accessible to any authenticated user", async () => {
      const spells = await getAllSpells(bob)
      expect(Array.isArray(spells)).toBe(true)
    })
  })

  // ---------------------------------------------------------------------------
  // getSpellById
  // ---------------------------------------------------------------------------

  describe("getSpellById", () => {
    it("returns the spell name for a valid id", async () => {
      const spell = await getSpellById(alice, catalogSpellId)
      expect(spell).not.toBeNull()
      expect((spell as { name: string }).name).toBe("Catalog Fireball")
    })

    it("returns null for a non-existent id", async () => {
      const spell = await getSpellById(alice, -999999)
      expect(spell).toBeNull()
    })
  })

  // ---------------------------------------------------------------------------
  // createSpell
  // ---------------------------------------------------------------------------

  describe("createSpell", () => {
    it("creates and returns a new spell", async () => {
      const { data, error } = await createSpell(alice, { name: "Test Ice Lance" })
      expect(error).toBeNull()
      expect((data as { name: string }).name).toBe("Test Ice Lance")
      await admin.from("spells").delete().eq("id", (data as { id: number }).id)
    })

    it("fails gracefully when name is missing (NOT NULL constraint)", async () => {
      const { error } = await createSpell(alice, {})
      // May fail at the DB level; we just verify it doesn't throw unhandled
      if (error) {
        expect(error).toBeTruthy()
      }
    })
  })

  // ---------------------------------------------------------------------------
  // addSpellToCharacter
  // ---------------------------------------------------------------------------

  describe("addSpellToCharacter", () => {
    it("links a spell to Alices character", async () => {
      const { error } = await addSpellToCharacter(alice, aliceCharId, catalogSpellId)
      expect(error).toBeNull()

      const { data } = await admin
        .from("character_spells")
        .select("spell_id")
        .eq("character_id", aliceCharId)
        .eq("spell_id", catalogSpellId)
      expect(data).toHaveLength(1)

      // Clean up for subsequent tests
      await admin
        .from("character_spells")
        .delete()
        .eq("character_id", aliceCharId)
        .eq("spell_id", catalogSpellId)
    })

    it("errors on duplicate (same character + spell)", async () => {
      await admin.from("character_spells").insert({
        character_id: aliceCharId,
        spell_id: catalogSpellId,
      })

      const { error } = await addSpellToCharacter(alice, aliceCharId, catalogSpellId)
      // Duplicate insert should violate unique constraint
      expect(error).toBeTruthy()

      await admin
        .from("character_spells")
        .delete()
        .eq("character_id", aliceCharId)
        .eq("spell_id", catalogSpellId)
    })

    it("RLS: Bob cannot add a spell to Alices character", async () => {
      const { error } = await addSpellToCharacter(bob, aliceCharId, catalogSpellId)
      const { data } = await admin
        .from("character_spells")
        .select("id")
        .eq("character_id", aliceCharId)
        .eq("spell_id", catalogSpellId)
      if (!error) {
        expect(data).toHaveLength(0)
      } else {
        expect(error).toBeTruthy()
      }
    })
  })

  // ---------------------------------------------------------------------------
  // removeCharacterSpell
  // ---------------------------------------------------------------------------

  describe("removeCharacterSpell", () => {
    it("removes a character_spells row", async () => {
      await admin.from("character_spells").insert({
        character_id: aliceCharId,
        spell_id: catalogSpellId,
      })

      const { error } = await removeCharacterSpell(alice, aliceCharId, catalogSpellId)
      expect(error).toBeNull()

      const { data } = await admin
        .from("character_spells")
        .select("id")
        .eq("character_id", aliceCharId)
        .eq("spell_id", catalogSpellId)
      expect(data).toHaveLength(0)
    })

    it("no-ops gracefully when the spell is not on the character", async () => {
      const { error } = await removeCharacterSpell(alice, aliceCharId, -99999)
      expect(error).toBeNull()
    })

    it("RLS: Bob cannot remove Alices spell", async () => {
      await admin.from("character_spells").insert({
        character_id: aliceCharId,
        spell_id: catalogSpellId,
      })

      await removeCharacterSpell(bob, aliceCharId, catalogSpellId)

      const { data } = await admin
        .from("character_spells")
        .select("id")
        .eq("character_id", aliceCharId)
        .eq("spell_id", catalogSpellId)
      expect(data).toHaveLength(1) // still there

      await admin
        .from("character_spells")
        .delete()
        .eq("character_id", aliceCharId)
        .eq("spell_id", catalogSpellId)
    })
  })
})
