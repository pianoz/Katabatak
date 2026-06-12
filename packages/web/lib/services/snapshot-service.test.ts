import { describe, it, expect, beforeAll, afterAll } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  admin,
  clientAs,
  seedUser,
  seedCharacter,
  seedSkill,
  seedItem,
  seedSpell,
  teardownUser,
  uniqueEmail,
} from "./test-helpers"
import { takeSnapshot, commitSnapshot } from "./snapshot-service"

const ALICE = uniqueEmail("snap-alice")
const BOB = uniqueEmail("snap-bob")
const PASS = "Test1234!"

describe("snapshot-service", () => {
  let aliceId: string
  let bobId: string
  let alice: SupabaseClient
  let bob: SupabaseClient
  let aliceCharId: string
  let skillId: string
  let itemId: string
  let spellId: number

  beforeAll(async () => {
    aliceId = await seedUser(ALICE, PASS)
    bobId = await seedUser(BOB, PASS)
    alice = await clientAs(ALICE, PASS)
    bob = await clientAs(BOB, PASS)

    aliceCharId = await seedCharacter(aliceId, {
      name: "Snap Tester",
      class_archetype: "Rogue",
      denarius: 42,
      unused_skill_points: 3,
      current_health: 8,
      health_max: 10,
    })

    skillId = await seedSkill({ name: "Snapshot Skill", is_passive: true, max_rank: 2 })
    itemId = await seedItem({ name: "Snapshot Sword", type: "weapon" })
    spellId = await seedSpell({ name: "Snapshot Bolt" })

    // Give Alice the skill, item, and spell
    await admin.from("character_skills").insert({
      character_id: aliceCharId,
      skill_id: skillId,
      current_rank: 2,
    })
    await admin.from("character_inventory").insert({
      character_id: aliceCharId,
      item_id: itemId,
      condition: 75,
      quantity: 1,
      is_equipped: true,
    })
    await admin.from("character_spells").insert({
      character_id: aliceCharId,
      spell_id: spellId,
    })
  })

  afterAll(async () => {
    try { await admin.from("character_snapshots").delete().eq("character_id", aliceCharId) } catch {}
    try { await admin.from("character_spells").delete().eq("character_id", aliceCharId) } catch {}
    try { await admin.from("character_inventory").delete().eq("character_id", aliceCharId) } catch {}
    try { await admin.from("character_skills").delete().eq("character_id", aliceCharId) } catch {}
    try { await admin.from("spells").delete().eq("id", spellId) } catch {}
    try { await admin.from("items").delete().eq("id", itemId) } catch {}
    try { await admin.from("skills").delete().eq("id", skillId) } catch {}
    try { await teardownUser(aliceId) } catch {}
    try { await teardownUser(bobId) } catch {}
  })

  // ---------------------------------------------------------------------------
  // takeSnapshot
  // ---------------------------------------------------------------------------

  describe("takeSnapshot", () => {
    it("returns a snapshot with correct character stats", async () => {
      const snap = await takeSnapshot(alice, aliceCharId)
      expect(snap).not.toBeNull()
      expect(snap!.character_id).toBe(aliceCharId)
      expect(snap!.name).toBe("Snap Tester")
      expect(snap!.class_archetype).toBe("Rogue")
      expect(snap!.denarius).toBe(42)
      expect(snap!.unused_skill_points).toBe(3)
      expect(snap!.current_health).toBe(8)
      expect(snap!.health_max).toBe(10)
    })

    it("includes inventory with item details", async () => {
      const snap = await takeSnapshot(alice, aliceCharId)
      const entry = snap!.inventory.find((i) => i.item_id === itemId)
      expect(entry).toBeDefined()
      expect(entry!.name).toBe("Snapshot Sword")
      expect(entry!.condition).toBe(75)
      expect(entry!.is_equipped).toBe(true)
    })

    it("includes unlocked skills with rank", async () => {
      const snap = await takeSnapshot(alice, aliceCharId)
      const entry = snap!.skills.find((s) => s.skill_id === skillId)
      expect(entry).toBeDefined()
      expect(entry!.name).toBe("Snapshot Skill")
      expect(entry!.current_rank).toBe(2)
      expect(entry!.max_rank).toBe(2)
    })

    it("includes known spells", async () => {
      const snap = await takeSnapshot(alice, aliceCharId)
      const entry = snap!.spells.find((s) => s.spell_id === spellId)
      expect(entry).toBeDefined()
      expect(entry!.name).toBe("Snapshot Bolt")
    })

    it("includes a taken_at ISO timestamp", async () => {
      const snap = await takeSnapshot(alice, aliceCharId)
      expect(snap!.taken_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    })

    it("returns null for a non-existent character", async () => {
      const snap = await takeSnapshot(alice, "00000000-0000-0000-0000-000000000000")
      expect(snap).toBeNull()
    })

    it("RLS: Bob cannot take a snapshot of Alices character", async () => {
      const snap = await takeSnapshot(bob, aliceCharId)
      expect(snap).toBeNull()
    })
  })

  // ---------------------------------------------------------------------------
  // commitSnapshot
  // ---------------------------------------------------------------------------

  describe("commitSnapshot", () => {
    it("saves the snapshot and returns an id", async () => {
      const snap = await takeSnapshot(alice, aliceCharId)
      expect(snap).not.toBeNull()

      const result = await commitSnapshot(alice, snap!)
      expect(result).not.toBeNull()
      expect(typeof result!.id).toBe("string")

      const { data } = await admin
        .from("character_snapshots")
        .select("id, character_id, label")
        .eq("id", result!.id)
        .single()
      expect((data as { character_id: string }).character_id).toBe(aliceCharId)
      expect((data as { label: string | null }).label).toBeNull()
    })

    it("stores the optional label when provided", async () => {
      const snap = await takeSnapshot(alice, aliceCharId)
      const result = await commitSnapshot(alice, snap!, "Before the heist")

      const { data } = await admin
        .from("character_snapshots")
        .select("label")
        .eq("id", result!.id)
        .single()
      expect((data as { label: string }).label).toBe("Before the heist")
    })

    it("RLS: Bob cannot commit a snapshot for Alices character", async () => {
      const snap = await takeSnapshot(alice, aliceCharId)
      // Manually set character_id to Alice's so Bob tries to insert for her
      const result = await commitSnapshot(bob, snap!)
      expect(result).toBeNull()
    })
  })
})
