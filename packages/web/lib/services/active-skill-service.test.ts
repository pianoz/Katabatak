import { describe, it, expect, beforeAll, afterAll } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  admin,
  clientAs,
  seedUser,
  seedCharacter,
  seedActiveSkill,
  teardownUser,
  uniqueEmail,
} from "./test-helpers"
import {
  getAllActiveSkills,
  getActiveSkillById,
  createActiveSkill,
  updateActiveSkill,
  deleteActiveSkill,
  getActiveSkillsCatalog,
  getCharacterActiveSkills,
  addActiveSkillToCharacter,
  removeActiveSkillFromCharacter,
} from "./active-skill-service"

const ALICE = uniqueEmail("askill-alice")
const BOB = uniqueEmail("askill-bob")
const PASS = "Test1234!"

describe("active-skill-service", () => {
  let aliceId: string
  let bobId: string
  let alice: SupabaseClient
  let bob: SupabaseClient
  let aliceCharId: string
  let activeSkillId: string

  beforeAll(async () => {
    aliceId = await seedUser(ALICE, PASS)
    bobId = await seedUser(BOB, PASS)
    // alice is a dev so she can write to catalog tables (active_skills is dev-only)
    await admin.from("profiles").update({ is_dev: true }).eq("id", aliceId)
    alice = await clientAs(ALICE, PASS)
    bob = await clientAs(BOB, PASS)
    aliceCharId = await seedCharacter(aliceId, { name: "Alice ASkill Tester" })
    activeSkillId = await seedActiveSkill({ name: "Seeded Active Skill", cooldown: 3 })
  })

  afterAll(async () => {
    try { await admin.from("character_active_skills").delete().eq("character_id", aliceCharId) } catch {}
    try { await admin.from("active_skills").delete().eq("id", activeSkillId) } catch {}
    try { await teardownUser(aliceId) } catch {}
    try { await teardownUser(bobId) } catch {}
  })

  // ---------------------------------------------------------------------------
  // getAllActiveSkills
  // ---------------------------------------------------------------------------

  describe("getAllActiveSkills", () => {
    it("returns an array including the seeded skill", async () => {
      const skills = await getAllActiveSkills(alice)
      expect(Array.isArray(skills)).toBe(true)
      expect(skills.some((s) => s.id === activeSkillId)).toBe(true)
    })

    it("is accessible to any authenticated user", async () => {
      const skills = await getAllActiveSkills(bob)
      expect(Array.isArray(skills)).toBe(true)
    })

    it("parses effects as an array", async () => {
      const skills = await getAllActiveSkills(alice)
      const found = skills.find((s) => s.id === activeSkillId)
      expect(Array.isArray(found?.effects)).toBe(true)
    })
  })

  // ---------------------------------------------------------------------------
  // getActiveSkillsCatalog
  // ---------------------------------------------------------------------------

  describe("getActiveSkillsCatalog", () => {
    it("returns id and name only", async () => {
      const catalog = await getActiveSkillsCatalog(alice)
      expect(Array.isArray(catalog)).toBe(true)
      const found = catalog.find((s) => s.id === activeSkillId)
      expect(found).toBeDefined()
      expect(found).toHaveProperty("id")
      expect(found).toHaveProperty("name")
    })
  })

  // ---------------------------------------------------------------------------
  // getActiveSkillById
  // ---------------------------------------------------------------------------

  describe("getActiveSkillById", () => {
    it("returns the skill for a valid id", async () => {
      const skill = await getActiveSkillById(alice, activeSkillId)
      expect(skill).not.toBeNull()
      expect(skill?.name).toBe("Seeded Active Skill")
      expect(skill?.cooldown).toBe(3)
    })

    it("returns null for an unknown id", async () => {
      const skill = await getActiveSkillById(alice, "00000000-0000-0000-0000-000000000000")
      expect(skill).toBeNull()
    })
  })

  // ---------------------------------------------------------------------------
  // createActiveSkill
  // ---------------------------------------------------------------------------

  describe("createActiveSkill", () => {
    it("inserts and returns the new skill", async () => {
      const { data, error } = await createActiveSkill(alice, {
        name: "Created Skill",
        description: "A test skill",
        cooldown: 2,
        effects: [],
      })
      expect(error).toBeNull()
      expect((data as { name: string }).name).toBe("Created Skill")
      expect((data as { cooldown: number }).cooldown).toBe(2)
      await admin.from("active_skills").delete().eq("id", (data as { id: string }).id)
    })

    it("allows null description and cooldown", async () => {
      const { data, error } = await createActiveSkill(alice, { name: "Minimal Skill" })
      expect(error).toBeNull()
      expect((data as { description: unknown }).description).toBeNull()
      expect((data as { cooldown: unknown }).cooldown).toBeNull()
      await admin.from("active_skills").delete().eq("id", (data as { id: string }).id)
    })
  })

  // ---------------------------------------------------------------------------
  // updateActiveSkill
  // ---------------------------------------------------------------------------

  describe("updateActiveSkill", () => {
    it("updates name and cooldown", async () => {
      const id = await seedActiveSkill({ name: "Before Update", cooldown: 1 })
      await updateActiveSkill(alice, id, { name: "After Update", cooldown: 5 })

      const { data } = await admin.from("active_skills").select("name, cooldown").eq("id", id).single()
      expect((data as { name: string }).name).toBe("After Update")
      expect((data as { cooldown: number }).cooldown).toBe(5)
      await admin.from("active_skills").delete().eq("id", id)
    })
  })

  // ---------------------------------------------------------------------------
  // deleteActiveSkill
  // ---------------------------------------------------------------------------

  describe("deleteActiveSkill", () => {
    it("removes the skill from the table", async () => {
      const id = await seedActiveSkill({ name: "To Delete" })
      await deleteActiveSkill(alice, id)
      const { data } = await admin.from("active_skills").select("id").eq("id", id)
      expect(data).toHaveLength(0)
    })
  })

  // ---------------------------------------------------------------------------
  // addActiveSkillToCharacter / removeActiveSkillFromCharacter
  // ---------------------------------------------------------------------------

  describe("addActiveSkillToCharacter", () => {
    it("links the skill to the character", async () => {
      const { error } = await addActiveSkillToCharacter(alice, aliceCharId, activeSkillId)
      expect(error).toBeNull()

      const { data } = await admin
        .from("character_active_skills")
        .select("active_skill_id")
        .eq("character_id", aliceCharId)
        .eq("active_skill_id", activeSkillId)
      expect(data).toHaveLength(1)
    })

    it("RLS: Bob cannot add skills to Alices character", async () => {
      const otherId = await seedActiveSkill({ name: "Bob Injection Skill" })
      await addActiveSkillToCharacter(bob, aliceCharId, otherId)

      const { data } = await admin
        .from("character_active_skills")
        .select("active_skill_id")
        .eq("character_id", aliceCharId)
        .eq("active_skill_id", otherId)
      expect(data).toHaveLength(0)
      await admin.from("active_skills").delete().eq("id", otherId)
    })
  })

  // ---------------------------------------------------------------------------
  // getCharacterActiveSkills
  // ---------------------------------------------------------------------------

  describe("getCharacterActiveSkills", () => {
    it("returns skills linked to the character with parsed effects", async () => {
      // Ensure the skill is linked (may already be from previous test)
      await admin
        .from("character_active_skills")
        .upsert({ character_id: aliceCharId, active_skill_id: activeSkillId }, { onConflict: "character_id,active_skill_id" })

      const skills = await getCharacterActiveSkills(alice, aliceCharId)
      expect(skills.some((s) => s.id === activeSkillId)).toBe(true)
      const found = skills.find((s) => s.id === activeSkillId)
      expect(Array.isArray(found?.effects)).toBe(true)
    })

    it("returns [] for a character with no active skills", async () => {
      const cleanCharId = await seedCharacter(aliceId, { name: "Clean Char" })
      const skills = await getCharacterActiveSkills(alice, cleanCharId)
      expect(skills).toEqual([])
      await admin.from("characters").delete().eq("id", cleanCharId)
    })

    it("RLS: Bob cannot read Alices character active skills", async () => {
      const skills = await getCharacterActiveSkills(bob, aliceCharId)
      expect(skills).toEqual([])
    })
  })

  // ---------------------------------------------------------------------------
  // removeActiveSkillFromCharacter
  // ---------------------------------------------------------------------------

  describe("removeActiveSkillFromCharacter", () => {
    it("unlinks the skill from the character", async () => {
      await admin
        .from("character_active_skills")
        .upsert({ character_id: aliceCharId, active_skill_id: activeSkillId }, { onConflict: "character_id,active_skill_id" })

      const { error } = await removeActiveSkillFromCharacter(alice, aliceCharId, activeSkillId)
      expect(error).toBeNull()

      const { data } = await admin
        .from("character_active_skills")
        .select("active_skill_id")
        .eq("character_id", aliceCharId)
        .eq("active_skill_id", activeSkillId)
      expect(data).toHaveLength(0)
    })

    it("RLS: Bob cannot remove Alices active skill", async () => {
      await admin
        .from("character_active_skills")
        .upsert({ character_id: aliceCharId, active_skill_id: activeSkillId }, { onConflict: "character_id,active_skill_id" })

      await removeActiveSkillFromCharacter(bob, aliceCharId, activeSkillId)

      const { data } = await admin
        .from("character_active_skills")
        .select("active_skill_id")
        .eq("character_id", aliceCharId)
        .eq("active_skill_id", activeSkillId)
      expect(data).toHaveLength(1)
    })
  })
})
