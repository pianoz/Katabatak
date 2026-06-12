/**
 * pending-offer-service integration tests.
 *
 * stagePendingOffer and resolvePendingOffer create their own Supabase client
 * internally via createClient() from @/lib/supabase/client (createBrowserClient).
 * We vi.mock that module to inject a real test client, allowing us to control
 * which user is authenticated and test RLS.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest"
import { createClient } from "@supabase/supabase-js"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  admin,
  clientAs,
  seedUser,
  seedCharacter,
  seedGame,
  seedGameMember,
  seedItem,
  seedSpell,
  teardownUser,
  uniqueEmail,
  TEST_URL,
  TEST_ANON_KEY,
} from "./test-helpers"
import { getPendingOffersByCharacter } from "./pending-offer-service"

// Injected client that stagePendingOffer / resolvePendingOffer will pick up
let _mockClient: SupabaseClient

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => _mockClient,
}))

// Import after mock is registered so the module captures the mock
const { stagePendingOffer, resolvePendingOffer } = await import("./pending-offer-service")

const ALICE = uniqueEmail("offer-alice") // GM / offer giver
const BOB = uniqueEmail("offer-bob")     // player / offer recipient
const CHARLIE = uniqueEmail("offer-charlie") // stranger
const PASS = "Test1234!"

describe("pending-offer-service", () => {
  let aliceId: string
  let bobId: string
  let charlieId: string
  let alice: SupabaseClient
  let bob: SupabaseClient
  let charlie: SupabaseClient

  let gameId: string
  let aliceCharId: string
  let bobCharId: string
  let catalogItemId: string
  let catalogSpellId: number

  beforeAll(async () => {
    aliceId = await seedUser(ALICE, PASS)
    bobId = await seedUser(BOB, PASS)
    charlieId = await seedUser(CHARLIE, PASS)
    alice = await clientAs(ALICE, PASS)
    bob = await clientAs(BOB, PASS)
    charlie = await clientAs(CHARLIE, PASS)

    aliceCharId = await seedCharacter(aliceId, { name: "Alice Offer", denarius: 100, unused_skill_points: 5, in_game: true })
    bobCharId = await seedCharacter(bobId, { name: "Bob Offer", denarius: 10, unused_skill_points: 0, in_game: true })

    gameId = await seedGame(aliceId, { name: "Offer Game" })
    await seedGameMember(gameId, aliceId, "active", aliceCharId)
    await seedGameMember(gameId, bobId, "active", bobCharId)

    catalogItemId = await seedItem({ name: "Offer Sword", type: "weapon" })
    catalogSpellId = await seedSpell({ name: "Offer Fireball" })
  })

  afterAll(async () => {
    try { await admin.from("pending_offers").delete().eq("game_id", gameId) } catch {}
    try { await teardownUser(aliceId) } catch {}
    try { await teardownUser(bobId) } catch {}
    try { await teardownUser(charlieId) } catch {}
    try { await admin.from("items").delete().eq("id", catalogItemId) } catch {}
    try { await admin.from("spells").delete().eq("id", catalogSpellId) } catch {}
  })

  // ---------------------------------------------------------------------------
  // getPendingOffersByCharacter
  // ---------------------------------------------------------------------------

  describe("getPendingOffersByCharacter", () => {
    it("returns offers for the owning character", async () => {
      await admin.from("pending_offers").insert({
        game_id: gameId,
        character_id: bobCharId,
        type: "denarius",
        source_id: null,
        quantity: 5,
      })

      const offers = await getPendingOffersByCharacter(bob, bobCharId)
      expect(offers.length).toBeGreaterThanOrEqual(1)
      expect(offers.every((o: { character_id: string }) => o.character_id === bobCharId)).toBe(true)

      await admin.from("pending_offers").delete().eq("character_id", bobCharId)
    })

    it("returns [] when character has no pending offers", async () => {
      const offers = await getPendingOffersByCharacter(alice, aliceCharId)
      expect(offers).toEqual([])
    })

    it("RLS: Bob cannot see Alices pending offers", async () => {
      await admin.from("pending_offers").insert({
        game_id: gameId,
        character_id: aliceCharId,
        type: "denarius",
        source_id: null,
        quantity: 10,
      })

      const offers = await getPendingOffersByCharacter(bob, aliceCharId)
      expect(offers).toEqual([])

      await admin.from("pending_offers").delete().eq("character_id", aliceCharId)
    })
  })

  // ---------------------------------------------------------------------------
  // stagePendingOffer
  // ---------------------------------------------------------------------------

  describe("stagePendingOffer", () => {
    it("creates a pending_offers row (denarius offer)", async () => {
      _mockClient = alice
      await stagePendingOffer(gameId, bobCharId, "denarius", null, 25)

      const { data } = await admin
        .from("pending_offers")
        .select("*")
        .eq("character_id", bobCharId)
        .eq("type", "denarius")
        .single()
      expect((data as { quantity: number }).quantity).toBe(25)

      await admin.from("pending_offers").delete().eq("character_id", bobCharId).eq("type", "denarius")
    })

    it("creates a pending_offers row with item data", async () => {
      _mockClient = alice
      await stagePendingOffer(gameId, bobCharId, "item", catalogItemId, 1, 80, null)

      const { data } = await admin
        .from("pending_offers")
        .select("source_id, condition, quantity")
        .eq("character_id", bobCharId)
        .eq("type", "item")
        .single()
      expect((data as { source_id: string }).source_id).toBe(catalogItemId)
      expect((data as { condition: number }).condition).toBe(80)

      await admin.from("pending_offers").delete().eq("character_id", bobCharId).eq("type", "item")
    })

    it("throws when the DB insert fails (e.g. invalid game_id)", async () => {
      _mockClient = alice
      await expect(
        stagePendingOffer("00000000-0000-0000-0000-000000000000", bobCharId, "denarius", null, 1)
      ).rejects.toThrow()
    })
  })

  // ---------------------------------------------------------------------------
  // resolvePendingOffer — decline (accept = false)
  // ---------------------------------------------------------------------------

  describe("resolvePendingOffer — decline", () => {
    it("deletes the offer row on decline", async () => {
      const { data: row } = await admin
        .from("pending_offers")
        .insert({ game_id: gameId, character_id: bobCharId, type: "denarius", source_id: null, quantity: 5 })
        .select()
        .single()
      const offerId = (row as { id: string }).id

      _mockClient = bob
      await resolvePendingOffer(offerId, false)

      const { data } = await admin.from("pending_offers").select("id").eq("id", offerId)
      expect(data).toHaveLength(0)
    })

    it("RLS: Charlie cannot decline Bobs offer", async () => {
      const { data: row } = await admin
        .from("pending_offers")
        .insert({ game_id: gameId, character_id: bobCharId, type: "denarius", source_id: null, quantity: 5 })
        .select()
        .single()
      const offerId = (row as { id: string }).id

      _mockClient = charlie
      await resolvePendingOffer(offerId, false).catch(() => {/* RLS throws */})

      const { data } = await admin.from("pending_offers").select("id").eq("id", offerId)
      expect(data).toHaveLength(1) // still present
      await admin.from("pending_offers").delete().eq("id", offerId)
    })
  })

  // ---------------------------------------------------------------------------
  // resolvePendingOffer — accept, type = "denarius"
  // ---------------------------------------------------------------------------

  describe("resolvePendingOffer — accept denarius", () => {
    it("increments the characters denarius and removes the offer", async () => {
      await admin.from("characters").update({ denarius: 10 }).eq("id", bobCharId)

      const { data: row } = await admin
        .from("pending_offers")
        .insert({ game_id: gameId, character_id: bobCharId, type: "denarius", source_id: null, quantity: 15 })
        .select()
        .single()
      const offerId = (row as { id: string }).id

      _mockClient = bob
      await resolvePendingOffer(offerId, true)

      const { data: char } = await admin
        .from("characters")
        .select("denarius")
        .eq("id", bobCharId)
        .single()
      expect((char as { denarius: number }).denarius).toBe(25)

      const { data: offers } = await admin.from("pending_offers").select("id").eq("id", offerId)
      expect(offers).toHaveLength(0)
    })
  })

  // ---------------------------------------------------------------------------
  // resolvePendingOffer — accept, type = "skill_point"
  // ---------------------------------------------------------------------------

  describe("resolvePendingOffer — accept skill_point", () => {
    it("increments unused_skill_points and removes the offer", async () => {
      await admin.from("characters").update({ unused_skill_points: 2 }).eq("id", bobCharId)

      const { data: row } = await admin
        .from("pending_offers")
        .insert({ game_id: gameId, character_id: bobCharId, type: "skill_point", source_id: null, quantity: 3 })
        .select()
        .single()
      const offerId = (row as { id: string }).id

      _mockClient = bob
      await resolvePendingOffer(offerId, true)

      const { data: char } = await admin
        .from("characters")
        .select("unused_skill_points")
        .eq("id", bobCharId)
        .single()
      expect((char as { unused_skill_points: number }).unused_skill_points).toBe(5)

      const { data: offers } = await admin.from("pending_offers").select("id").eq("id", offerId)
      expect(offers).toHaveLength(0)
    })
  })

  // ---------------------------------------------------------------------------
  // resolvePendingOffer — accept, type = "item"
  // ---------------------------------------------------------------------------

  describe("resolvePendingOffer — accept item", () => {
    it("adds item to character inventory and removes the offer", async () => {
      const { data: row } = await admin
        .from("pending_offers")
        .insert({
          game_id: gameId,
          character_id: bobCharId,
          type: "item",
          source_id: catalogItemId,
          quantity: 1,
          condition: 75,
          giver_inventory_id: null,
        })
        .select()
        .single()
      const offerId = (row as { id: string }).id

      _mockClient = bob
      await resolvePendingOffer(offerId, true)

      const { data: inv } = await admin
        .from("character_inventory")
        .select("item_id, condition")
        .eq("character_id", bobCharId)
        .eq("item_id", catalogItemId)
      expect(inv!.length).toBeGreaterThan(0)
      expect((inv![0] as { condition: number }).condition).toBe(75)

      const { data: offers } = await admin.from("pending_offers").select("id").eq("id", offerId)
      expect(offers).toHaveLength(0)

      await admin.from("character_inventory").delete().eq("character_id", bobCharId).eq("item_id", catalogItemId)
    })

    it("removes givers inventory entry when giver_inventory_id is set (peer transfer)", async () => {
      // Give Alice an inventory item she'll transfer to Bob
      await admin.from("character_inventory").insert({
        character_id: aliceCharId,
        item_id: catalogItemId,
        condition: 90,
        quantity: 1,
      })
      const { data: aliceInv } = await admin
        .from("character_inventory")
        .select("id")
        .eq("character_id", aliceCharId)
        .eq("item_id", catalogItemId)
        .single()
      const giverInvId = (aliceInv as { id: string }).id

      const { data: row } = await admin
        .from("pending_offers")
        .insert({
          game_id: gameId,
          character_id: bobCharId,
          type: "item",
          source_id: catalogItemId,
          quantity: 1,
          condition: 90,
          giver_inventory_id: giverInvId,
        })
        .select()
        .single()
      const offerId = (row as { id: string }).id

      _mockClient = bob
      await resolvePendingOffer(offerId, true)

      // Giver's inventory entry should be gone
      const { data: leftover } = await admin
        .from("character_inventory")
        .select("id")
        .eq("id", giverInvId)
      expect(leftover).toHaveLength(0)

      await admin.from("character_inventory").delete().eq("character_id", bobCharId).eq("item_id", catalogItemId)
    })

    it("throws when source_id is null for an item offer", async () => {
      const { data: row } = await admin
        .from("pending_offers")
        .insert({
          game_id: gameId,
          character_id: bobCharId,
          type: "item",
          source_id: null, // invalid
          quantity: 1,
        })
        .select()
        .single()
      const offerId = (row as { id: string }).id

      _mockClient = bob
      await expect(resolvePendingOffer(offerId, true)).rejects.toThrow("Item offer missing source_id")
      await admin.from("pending_offers").delete().eq("id", offerId)
    })
  })

  // ---------------------------------------------------------------------------
  // resolvePendingOffer — accept, type = "spell"
  // ---------------------------------------------------------------------------

  describe("resolvePendingOffer — accept spell", () => {
    it("inserts into character_spells and removes the offer", async () => {
      const { data: row } = await admin
        .from("pending_offers")
        .insert({
          game_id: gameId,
          character_id: bobCharId,
          type: "spell",
          source_id: String(catalogSpellId),
          quantity: 1,
        })
        .select()
        .single()
      const offerId = (row as { id: string }).id

      _mockClient = bob
      await resolvePendingOffer(offerId, true)

      const { data: spells } = await admin
        .from("character_spells")
        .select("spell_id")
        .eq("character_id", bobCharId)
        .eq("spell_id", catalogSpellId)
      expect(spells!.length).toBeGreaterThan(0)

      const { data: offers } = await admin.from("pending_offers").select("id").eq("id", offerId)
      expect(offers).toHaveLength(0)

      await admin.from("character_spells").delete().eq("character_id", bobCharId).eq("spell_id", catalogSpellId)
    })

    it("throws when source_id is null for a spell offer", async () => {
      const { data: row } = await admin
        .from("pending_offers")
        .insert({
          game_id: gameId,
          character_id: bobCharId,
          type: "spell",
          source_id: null,
          quantity: 1,
        })
        .select()
        .single()
      const offerId = (row as { id: string }).id

      _mockClient = bob
      await expect(resolvePendingOffer(offerId, true)).rejects.toThrow("Spell offer missing source_id")
      await admin.from("pending_offers").delete().eq("id", offerId)
    })

    it("throws for a non-existent offer id", async () => {
      _mockClient = bob
      await expect(
        resolvePendingOffer("00000000-0000-0000-0000-000000000000", true)
      ).rejects.toThrow()
    })
  })
})
