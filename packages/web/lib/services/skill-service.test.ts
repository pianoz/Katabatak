import { describe, it, expect, beforeAll, afterAll } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  admin,
  clientAs,
  seedUser,
  seedCharacter,
  seedSkill,
  teardownUser,
  uniqueEmail,
} from "./test-helpers"
import {
  fetchSkillTree,
  fetchCharacterSkillData,
  addSkill,
  updateSkill,
  deleteSkill,
  addSkillEdge,
  deleteSkillEdge,
  unlockSkill,
  updateSkillRank,
  removeCharacterSkill,
  updateCharacterSkillPoints,
  getSkillsCatalog,
  batchSetDev,
  batchDeleteSkills,
  addSpellsToCharacter,
} from "./skill-service"

const ALICE = uniqueEmail("skill-alice")
const BOB = uniqueEmail("skill-bob")
const PASS = "Test1234!"

describe("skill-service", () => {
  let aliceId: string
  let bobId: string
  let alice: SupabaseClient
  let bob: SupabaseClient
  let aliceCharId: string
  let skillId: string

  beforeAll(async () => {
    aliceId = await seedUser(ALICE, PASS)
    bobId = await seedUser(BOB, PASS)
    alice = await clientAs(ALICE, PASS)
    bob = await clientAs(BOB, PASS)
    aliceCharId = await seedCharacter(aliceId, { name: "Alice Skill Tester", unused_skill_points: 10 })
    skillId = await seedSkill({ name: "Test Passive Skill", is_passive: true, max_rank: 3, min_level: 0 })
  })

  afterAll(async () => {
    await admin.from("character_skills").delete().eq("character_id", aliceCharId)
    await admin.from("skill_edges").delete().or(`parent_skill_id.eq.${skillId},child_skill_id.eq.${skillId}`)
    await admin.from("skills").delete().eq("id", skillId)
    await teardownUser(aliceId)
    await teardownUser(bobId)
  })

  // ---------------------------------------------------------------------------
  // fetchSkillTree
  // ---------------------------------------------------------------------------

  describe("fetchSkillTree", () => {
    it("returns { skills, edges } arrays", async () => {
      const { skills, edges } = await fetchSkillTree(alice)
      expect(Array.isArray(skills)).toBe(true)
      expect(Array.isArray(edges)).toBe(true)
      expect(skills.some((s) => s.id === skillId)).toBe(true)
    })

    it("is accessible to any authenticated user", async () => {
      const { skills } = await fetchSkillTree(bob)
      expect(Array.isArray(skills)).toBe(true)
    })
  })

  // ---------------------------------------------------------------------------
  // getSkillsCatalog
  // ---------------------------------------------------------------------------

  describe("getSkillsCatalog", () => {
    it("returns id and name for all skills", async () => {
      const catalog = await getSkillsCatalog(alice)
      expect(Array.isArray(catalog)).toBe(true)
      expect(catalog.some((s: { id: string }) => s.id === skillId)).toBe(true)
      if (catalog.length > 0) {
        expect(catalog[0]).toHaveProperty("id")
        expect(catalog[0]).toHaveProperty("name")
      }
    })
  })

  // ---------------------------------------------------------------------------
  // addSkill / updateSkill / deleteSkill (admin/catalog mutations)
  // ---------------------------------------------------------------------------

  describe("addSkill", () => {
    it("creates a new skill and returns the row", async () => {
      const { data, error } = await addSkill(alice, {
        name: "New Ability",
        is_passive: false,
        in_development: false,
        max_rank: 1,
        min_level: 0,
      })
      expect(error).toBeNull()
      expect((data as { name: string }).name).toBe("New Ability")
      await admin.from("skills").delete().eq("id", (data as { id: string }).id)
    })

    it("defaults in_development to false when omitted", async () => {
      const { data } = await addSkill(alice, { name: "Default Dev Skill" })
      expect((data as { in_development: boolean }).in_development).toBe(false)
      await admin.from("skills").delete().eq("id", (data as { id: string }).id)
    })
  })

  describe("updateSkill", () => {
    it("updates skill fields", async () => {
      const id = await seedSkill({ name: "Before Update" })
      await updateSkill(alice, id, { name: "After Update", is_passive: true })

      const { data } = await admin.from("skills").select("name, is_passive").eq("id", id).single()
      expect((data as { name: string }).name).toBe("After Update")
      expect((data as { is_passive: boolean }).is_passive).toBe(true)
      await admin.from("skills").delete().eq("id", id)
    })
  })

  describe("deleteSkill", () => {
    it("deletes the skill and its edges", async () => {
      const parentId = await seedSkill({ name: "Parent" })
      const childId = await seedSkill({ name: "Child" })
      await admin.from("skill_edges").insert({
        parent_skill_id: parentId,
        child_skill_id: childId,
        edge_type: "unlock",
      })

      await deleteSkill(alice, parentId)

      const { data: edges } = await admin
        .from("skill_edges")
        .select("id")
        .eq("parent_skill_id", parentId)
      expect(edges).toHaveLength(0)

      const { data: skill } = await admin.from("skills").select("id").eq("id", parentId)
      expect(skill).toHaveLength(0)

      await admin.from("skills").delete().eq("id", childId)
    })
  })

  // ---------------------------------------------------------------------------
  // addSkillEdge / deleteSkillEdge
  // ---------------------------------------------------------------------------

  describe("addSkillEdge / deleteSkillEdge", () => {
    it("creates and removes a skill edge", async () => {
      const parent = await seedSkill({ name: "Edge Parent" })
      const child = await seedSkill({ name: "Edge Child" })

      await addSkillEdge(alice, parent, child, "unlock")
      const { data: edge } = await admin
        .from("skill_edges")
        .select("id")
        .eq("parent_skill_id", parent)
        .eq("child_skill_id", child)
      expect(edge!.length).toBeGreaterThan(0)

      await deleteSkillEdge(alice, parent, child)
      const { data: gone } = await admin
        .from("skill_edges")
        .select("id")
        .eq("parent_skill_id", parent)
        .eq("child_skill_id", child)
      expect(gone).toHaveLength(0)

      await admin.from("skills").delete().in("id", [parent, child])
    })
  })

  // ---------------------------------------------------------------------------
  // fetchCharacterSkillData
  // ---------------------------------------------------------------------------

  describe("fetchCharacterSkillData", () => {
    it("returns skill rows for the owning character", async () => {
      await admin.from("character_skills").insert({
        character_id: aliceCharId,
        skill_id: skillId,
        current_rank: 1,
      })

      const rows = await fetchCharacterSkillData(alice, aliceCharId)
      expect(rows.some((r: { skill_id: string }) => r.skill_id === skillId)).toBe(true)

      await admin.from("character_skills").delete().eq("character_id", aliceCharId).eq("skill_id", skillId)
    })

    it("returns [] for a character with no skills", async () => {
      const cleanCharId = await seedCharacter(aliceId, { name: "Clean Char" })
      const rows = await fetchCharacterSkillData(alice, cleanCharId)
      expect(rows).toEqual([])
      await admin.from("characters").delete().eq("id", cleanCharId)
    })

    it("RLS: Bob cannot read Alices character skills", async () => {
      await admin.from("character_skills").insert({
        character_id: aliceCharId,
        skill_id: skillId,
        current_rank: 2,
      })

      const rows = await fetchCharacterSkillData(bob, aliceCharId)
      expect(rows).toEqual([])

      await admin.from("character_skills").delete().eq("character_id", aliceCharId).eq("skill_id", skillId)
    })
  })

  // ---------------------------------------------------------------------------
  // unlockSkill
  // ---------------------------------------------------------------------------

  describe("unlockSkill", () => {
    it("inserts a character_skills row at the given initial rank", async () => {
      const { error } = await unlockSkill(alice, aliceCharId, skillId, 1)
      expect(error).toBeNull()

      const { data } = await admin
        .from("character_skills")
        .select("current_rank")
        .eq("character_id", aliceCharId)
        .eq("skill_id", skillId)
        .single()
      expect((data as { current_rank: number }).current_rank).toBe(1)
    })

    it("RLS: Bob cannot unlock a skill for Alices character", async () => {
      const otherSkill = await seedSkill({ name: "Bob Attack Skill" })
      await unlockSkill(bob, aliceCharId, otherSkill, 1)

      const { data } = await admin
        .from("character_skills")
        .select("character_id")
        .eq("character_id", aliceCharId)
        .eq("skill_id", otherSkill)
      expect(data).toHaveLength(0)

      await admin.from("skills").delete().eq("id", otherSkill)
    })
  })

  // ---------------------------------------------------------------------------
  // updateSkillRank
  // ---------------------------------------------------------------------------

  describe("updateSkillRank", () => {
    it("updates the rank for an unlocked skill", async () => {
      // Ensure the skill is already unlocked (from previous test or seed)
      await admin
        .from("character_skills")
        .upsert({ character_id: aliceCharId, skill_id: skillId, current_rank: 1 }, { onConflict: "character_id,skill_id" })

      const { error } = await updateSkillRank(alice, aliceCharId, skillId, 3)
      expect(error).toBeNull()

      const { data } = await admin
        .from("character_skills")
        .select("current_rank")
        .eq("character_id", aliceCharId)
        .eq("skill_id", skillId)
        .single()
      expect((data as { current_rank: number }).current_rank).toBe(3)
    })

    it("RLS: Bob cannot update rank on Alices skill", async () => {
      const { data: before } = await admin
        .from("character_skills")
        .select("current_rank")
        .eq("character_id", aliceCharId)
        .eq("skill_id", skillId)
        .single()

      await updateSkillRank(bob, aliceCharId, skillId, 1)

      const { data: after } = await admin
        .from("character_skills")
        .select("current_rank")
        .eq("character_id", aliceCharId)
        .eq("skill_id", skillId)
        .single()
      expect((after as { current_rank: number }).current_rank).toBe(
        (before as { current_rank: number }).current_rank
      )
    })
  })

  // ---------------------------------------------------------------------------
  // removeCharacterSkill
  // ---------------------------------------------------------------------------

  describe("removeCharacterSkill", () => {
    it("removes a character_skills row", async () => {
      await admin
        .from("character_skills")
        .upsert({ character_id: aliceCharId, skill_id: skillId, current_rank: 1 }, { onConflict: "character_id,skill_id" })

      const { error } = await removeCharacterSkill(alice, aliceCharId, skillId)
      expect(error).toBeNull()

      const { data } = await admin
        .from("character_skills")
        .select("character_id")
        .eq("character_id", aliceCharId)
        .eq("skill_id", skillId)
      expect(data).toHaveLength(0)
    })

    it("RLS: Bob cannot remove Alices skill", async () => {
      await admin.from("character_skills").upsert(
        { character_id: aliceCharId, skill_id: skillId, current_rank: 2 },
        { onConflict: "character_id,skill_id" }
      )

      await removeCharacterSkill(bob, aliceCharId, skillId)

      const { data } = await admin
        .from("character_skills")
        .select("character_id")
        .eq("character_id", aliceCharId)
        .eq("skill_id", skillId)
      expect(data).toHaveLength(1)
      await admin.from("character_skills").delete().eq("character_id", aliceCharId).eq("skill_id", skillId)
    })
  })

  // ---------------------------------------------------------------------------
  // updateCharacterSkillPoints
  // ---------------------------------------------------------------------------

  describe("updateCharacterSkillPoints", () => {
    it("sets unused_skill_points on the character", async () => {
      const { error } = await updateCharacterSkillPoints(alice, aliceCharId, 7)
      expect(error).toBeNull()

      const { data } = await admin
        .from("characters")
        .select("unused_skill_points")
        .eq("id", aliceCharId)
        .single()
      expect((data as { unused_skill_points: number }).unused_skill_points).toBe(7)
    })

    it("RLS: Bob cannot update Alices skill points", async () => {
      const { data: before } = await admin
        .from("characters")
        .select("unused_skill_points")
        .eq("id", aliceCharId)
        .single()

      await updateCharacterSkillPoints(bob, aliceCharId, 0)

      const { data: after } = await admin
        .from("characters")
        .select("unused_skill_points")
        .eq("id", aliceCharId)
        .single()
      expect((after as { unused_skill_points: number }).unused_skill_points).toBe(
        (before as { unused_skill_points: number }).unused_skill_points
      )
    })
  })

  // ---------------------------------------------------------------------------
  // batchSetDev
  // ---------------------------------------------------------------------------

  describe("batchSetDev", () => {
    it("marks multiple skills in_development", async () => {
      const id1 = await seedSkill({ name: "Batch Dev 1", in_development: false })
      const id2 = await seedSkill({ name: "Batch Dev 2", in_development: false })

      await batchSetDev(alice, [id1, id2], true)

      const { data } = await admin
        .from("skills")
        .select("in_development")
        .in("id", [id1, id2])
      expect(data!.every((s: { in_development: boolean }) => s.in_development === true)).toBe(true)

      await admin.from("skills").delete().in("id", [id1, id2])
    })
  })

  // ---------------------------------------------------------------------------
  // batchDeleteSkills
  // ---------------------------------------------------------------------------

  describe("batchDeleteSkills", () => {
    it("deletes all listed skills and their edges", async () => {
      const p = await seedSkill({ name: "BatchDel Parent" })
      const c = await seedSkill({ name: "BatchDel Child" })
      await admin.from("skill_edges").insert({ parent_skill_id: p, child_skill_id: c, edge_type: "unlock" })

      await batchDeleteSkills(alice, [p, c])

      const { data: skills } = await admin.from("skills").select("id").in("id", [p, c])
      expect(skills).toHaveLength(0)

      const { data: edges } = await admin
        .from("skill_edges")
        .select("id")
        .or(`parent_skill_id.eq.${p},child_skill_id.eq.${p},parent_skill_id.eq.${c},child_skill_id.eq.${c}`)
      expect(edges).toHaveLength(0)
    })
  })

  // ---------------------------------------------------------------------------
  // addSpellsToCharacter (bulk)
  // ---------------------------------------------------------------------------

  describe("addSpellsToCharacter", () => {
    it("bulk-inserts character_spells rows", async () => {
      const { data: spell1 } = await admin.from("spells").insert({ name: "Skill Spell 1" }).select().single()
      const { data: spell2 } = await admin.from("spells").insert({ name: "Skill Spell 2" }).select().single()
      const s1 = (spell1 as { id: number }).id
      const s2 = (spell2 as { id: number }).id

      const { error } = await addSpellsToCharacter(alice, [
        { character_id: aliceCharId, spell_id: s1 },
        { character_id: aliceCharId, spell_id: s2 },
      ])
      expect(error).toBeNull()

      const { data } = await admin
        .from("character_spells")
        .select("spell_id")
        .eq("character_id", aliceCharId)
        .in("spell_id", [s1, s2])
      expect(data).toHaveLength(2)

      await admin.from("character_spells").delete().eq("character_id", aliceCharId).in("spell_id", [s1, s2])
      await admin.from("spells").delete().in("id", [s1, s2])
    })

    it("RLS: Bob cannot add spells to Alices character", async () => {
      const { data: spell } = await admin.from("spells").insert({ name: "Injected Spell" }).select().single()
      const spellId = (spell as { id: number }).id

      const { error } = await addSpellsToCharacter(bob, [
        { character_id: aliceCharId, spell_id: spellId },
      ])

      const { data } = await admin
        .from("character_spells")
        .select("id")
        .eq("character_id", aliceCharId)
        .eq("spell_id", spellId)
      if (!error) {
        expect(data).toHaveLength(0)
      } else {
        expect(error).toBeTruthy()
      }

      await admin.from("spells").delete().eq("id", spellId)
    })
  })
})
