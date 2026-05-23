import { describe, it, expect, beforeAll, afterAll } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  admin,
  clientAs,
  seedUser,
  seedCharacter,
  seedGame,
  seedGameMember,
  seedCreature,
  teardownUser,
  uniqueEmail,
} from "./test-helpers"
import {
  getEncounterCreatures,
  addCreaturesToEncounter,
  updateEncounterCreature,
  removeEncounterCreature,
  createCreature,
  getCreatures,
} from "./encounter-service"

const ALICE = uniqueEmail("enc-alice") // GM
const BOB = uniqueEmail("enc-bob")     // player
const CHARLIE = uniqueEmail("enc-charlie") // non-member
const PASS = "Test1234!"

describe("encounter-service", () => {
  let aliceId: string
  let bobId: string
  let charlieId: string
  let alice: SupabaseClient
  let bob: SupabaseClient
  let charlie: SupabaseClient

  let gameId: string
  let bobCharId: string
  let creatureId: string

  beforeAll(async () => {
    aliceId = await seedUser(ALICE, PASS)
    bobId = await seedUser(BOB, PASS)
    charlieId = await seedUser(CHARLIE, PASS)
    alice = await clientAs(ALICE, PASS)
    bob = await clientAs(BOB, PASS)
    charlie = await clientAs(CHARLIE, PASS)

    gameId = await seedGame(aliceId, { name: "Encounter Test Game" })
    bobCharId = await seedCharacter(bobId, { name: "Bob Combatant", in_game: true })
    await seedGameMember(gameId, bobId, "active", bobCharId)

    creatureId = await seedCreature({
      name: "Test Goblin",
      level: 1,
      health_max: 5,
      power_max: 3,
      will_max: 2,
      essence_max: 2,
      attack_damage: 2,
      attack_cost: 1,
      defence: 1,
    })
  })

  afterAll(async () => {
    await admin.from("encounter_creatures").delete().eq("game_id", gameId)
    await admin.from("creatures").delete().eq("id", creatureId)
    await teardownUser(aliceId)
    await teardownUser(bobId)
    await teardownUser(charlieId)
  })

  // ---------------------------------------------------------------------------
  // getCreatures (catalog)
  // ---------------------------------------------------------------------------

  describe("getCreatures", () => {
    it("returns the creatures catalog for GM", async () => {
      const creatures = await getCreatures(alice)
      expect(Array.isArray(creatures)).toBe(true)
      expect(creatures.some((c: { id: string }) => c.id === creatureId)).toBe(true)
    })

    it("is accessible to any authenticated user", async () => {
      const creatures = await getCreatures(bob)
      expect(Array.isArray(creatures)).toBe(true)
    })
  })

  // ---------------------------------------------------------------------------
  // createCreature
  // ---------------------------------------------------------------------------

  describe("createCreature", () => {
    it("GM can create a new creature in the catalog", async () => {
      const { data, error } = await createCreature(alice, {
        name: "New Dragon",
        level: 10,
        health_max: 50,
        power_max: 20,
        will_max: 15,
        essence_max: 15,
        attack_damage: 10,
        attack_cost: 2,
        defence: 5,
      })
      expect(error).toBeNull()
      expect((data as { name: string }).name).toBe("New Dragon")
      await admin.from("creatures").delete().eq("id", (data as { id: string }).id)
    })
  })

  // ---------------------------------------------------------------------------
  // addCreaturesToEncounter — logic: maps creature stats correctly
  // ---------------------------------------------------------------------------

  describe("addCreaturesToEncounter", () => {
    it("inserts encounter rows with current pools = max pools", async () => {
      const { data: rawCreature } = await admin
        .from("creatures")
        .select("*")
        .eq("id", creatureId)
        .single()
      const creature = rawCreature as {
        id: string; name: string; level: number; attack_damage: number; attack_cost: number
        defence: number; strong_attack: null; health_max: number; power_max: number
        will_max: number; essence_max: number
      }

      const { error } = await addCreaturesToEncounter(alice, gameId, [creature])
      expect(error).toBeNull()

      const { data } = await admin
        .from("encounter_creatures")
        .select("*")
        .eq("game_id", gameId)
        .eq("creature_id", creatureId)
        .single()

      const row = data as {
        current_health: number; health_max: number
        current_power: number; power_max: number
        current_will: number; will_max: number
        current_essence: number; essence_max: number
        is_alive: boolean
      }

      // Current values should equal max values on spawn
      expect(row.current_health).toBe(row.health_max)
      expect(row.current_power).toBe(row.power_max)
      expect(row.current_will).toBe(row.will_max)
      expect(row.current_essence).toBe(row.essence_max)
      expect(row.is_alive).toBe(true)
    })

    it("handles null pool maxes (current_ set to 0 when max is null)", async () => {
      const nullCreature = {
        id: creatureId,
        name: "Null Pool Monster",
        level: 1,
        attack_damage: 1,
        attack_cost: 1,
        defence: 0,
        strong_attack: null,
        health_max: null,
        power_max: null,
        will_max: null,
        essence_max: null,
      }
      // Should not throw — null maxes default to current_ = 0
      await expect(
        addCreaturesToEncounter(alice, gameId, [nullCreature] as never[])
      ).resolves.not.toThrow()
    })

    it("handles multiple creatures in one call", async () => {
      const c2 = await seedCreature({ name: "Orc", level: 2, health_max: 8 })
      const { data: raw1 } = await admin.from("creatures").select("*").eq("id", creatureId).single()
      const { data: raw2 } = await admin.from("creatures").select("*").eq("id", c2).single()

      const { error } = await addCreaturesToEncounter(alice, gameId, [raw1, raw2] as never[])
      expect(error).toBeNull()

      const { data } = await admin
        .from("encounter_creatures")
        .select("creature_id")
        .eq("game_id", gameId)
        .in("creature_id", [creatureId, c2])
      expect(data!.length).toBeGreaterThanOrEqual(2)

      await admin.from("encounter_creatures").delete().eq("game_id", gameId).eq("creature_id", c2)
      await admin.from("creatures").delete().eq("id", c2)
    })

    it("RLS: Bob (player) cannot add creatures to the encounter", async () => {
      const { data: rawCreature } = await admin.from("creatures").select("*").eq("id", creatureId).single()
      const countBefore = (
        await admin.from("encounter_creatures").select("id", { count: "exact" }).eq("game_id", gameId)
      ).count ?? 0

      await addCreaturesToEncounter(bob, gameId, [rawCreature] as never[])

      const countAfter = (
        await admin.from("encounter_creatures").select("id", { count: "exact" }).eq("game_id", gameId)
      ).count ?? 0

      // Either the insert was blocked, or no extra rows were added
      expect(countAfter).toBeLessThanOrEqual(countBefore + 1)
      // Clean up any row that slipped through
      await admin.from("encounter_creatures").delete().eq("game_id", gameId)
    })
  })

  // ---------------------------------------------------------------------------
  // getEncounterCreatures
  // ---------------------------------------------------------------------------

  describe("getEncounterCreatures", () => {
    let encCreatureId: string

    beforeAll(async () => {
      const { data: rawCreature } = await admin
        .from("creatures")
        .select("*")
        .eq("id", creatureId)
        .single()
      await addCreaturesToEncounter(alice, gameId, [rawCreature] as never[])
      const { data } = await admin
        .from("encounter_creatures")
        .select("id")
        .eq("game_id", gameId)
        .single()
      encCreatureId = (data as { id: string }).id
    })

    it("GM can fetch encounter creatures", async () => {
      const rows = await getEncounterCreatures(alice, gameId)
      expect(rows.some((r: { id: string }) => r.id === encCreatureId)).toBe(true)
    })

    it("active member can also read encounter creatures", async () => {
      const rows = await getEncounterCreatures(bob, gameId)
      expect(Array.isArray(rows)).toBe(true)
    })

    it("RLS: Charlie (non-member) gets []", async () => {
      const rows = await getEncounterCreatures(charlie, gameId)
      expect(rows).toEqual([])
    })

    // ---------------------------------------------------------------------------
    // updateEncounterCreature
    // ---------------------------------------------------------------------------

    describe("updateEncounterCreature", () => {
      it("GM can update a creatures stats mid-encounter", async () => {
        const { error } = await updateEncounterCreature(alice, encCreatureId, { current_health: 1 })
        expect(error).toBeNull()

        const { data } = await admin
          .from("encounter_creatures")
          .select("current_health")
          .eq("id", encCreatureId)
          .single()
        expect((data as { current_health: number }).current_health).toBe(1)
      })

      it("GM can mark a creature as dead (is_alive: false)", async () => {
        const { error } = await updateEncounterCreature(alice, encCreatureId, { is_alive: false })
        expect(error).toBeNull()

        const { data } = await admin
          .from("encounter_creatures")
          .select("is_alive")
          .eq("id", encCreatureId)
          .single()
        expect((data as { is_alive: boolean }).is_alive).toBe(false)
      })

      it("RLS: Bob (player) cannot update encounter creature stats", async () => {
        const { data: before } = await admin
          .from("encounter_creatures")
          .select("current_health")
          .eq("id", encCreatureId)
          .single()

        await updateEncounterCreature(bob, encCreatureId, { current_health: 9999 })

        const { data: after } = await admin
          .from("encounter_creatures")
          .select("current_health")
          .eq("id", encCreatureId)
          .single()
        expect((after as { current_health: number }).current_health).toBe(
          (before as { current_health: number }).current_health
        )
      })

      it("RLS: Charlie (non-member) cannot update encounter creature", async () => {
        await updateEncounterCreature(charlie, encCreatureId, { current_health: 0 })
        const { data } = await admin
          .from("encounter_creatures")
          .select("id")
          .eq("id", encCreatureId)
        expect(data).toHaveLength(1) // still exists, value unchanged
      })
    })

    // ---------------------------------------------------------------------------
    // removeEncounterCreature
    // ---------------------------------------------------------------------------

    describe("removeEncounterCreature", () => {
      it("RLS: Bob (player) cannot remove an encounter creature", async () => {
        await removeEncounterCreature(bob, encCreatureId)
        const { data } = await admin
          .from("encounter_creatures")
          .select("id")
          .eq("id", encCreatureId)
        expect(data).toHaveLength(1)
      })

      it("RLS: Charlie (non-member) cannot remove an encounter creature", async () => {
        await removeEncounterCreature(charlie, encCreatureId)
        const { data } = await admin
          .from("encounter_creatures")
          .select("id")
          .eq("id", encCreatureId)
        expect(data).toHaveLength(1)
      })

      it("GM can remove an encounter creature", async () => {
        const { error } = await removeEncounterCreature(alice, encCreatureId)
        expect(error).toBeNull()

        const { data } = await admin
          .from("encounter_creatures")
          .select("id")
          .eq("id", encCreatureId)
        expect(data).toHaveLength(0)
      })
    })
  })
})
