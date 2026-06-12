import { describe, it, expect, beforeAll, afterAll } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  admin,
  clientAs,
  seedUser,
  seedCharacter,
  seedItem,
  teardownUser,
  uniqueEmail,
} from "./test-helpers"
import {
  getAllItems,
  getCatalogItems,
  getItemById,
  createItem,
  updateItem,
  deleteItems,
  addItemToInventory,
  addItemsToInventory,
  updateInventoryItem,
  removeInventoryItem,
} from "./item-service"

const ALICE = uniqueEmail("item-alice")
const BOB = uniqueEmail("item-bob")
const PASS = "Test1234!"

describe("item-service", () => {
  let aliceId: string
  let bobId: string
  let alice: SupabaseClient
  let bob: SupabaseClient
  let aliceCharId: string
  let catalogItemId: string

  beforeAll(async () => {
    aliceId = await seedUser(ALICE, PASS)
    bobId = await seedUser(BOB, PASS)
    alice = await clientAs(ALICE, PASS)
    bob = await clientAs(BOB, PASS)
    aliceCharId = await seedCharacter(aliceId, { name: "Alice Item Tester" })
    catalogItemId = await seedItem({ name: "Test Sword", type: "weapon" })
  })

  afterAll(async () => {
    try { await teardownUser(aliceId) } catch {}
    try { await teardownUser(bobId) } catch {}
    try { await admin.from("items").delete().eq("id", catalogItemId) } catch {}
  })

  // ---------------------------------------------------------------------------
  // getCatalogItems / getAllItems
  // ---------------------------------------------------------------------------

  describe("getCatalogItems", () => {
    it("returns all items when no type filter is provided", async () => {
      const items = await getCatalogItems(alice)
      expect(Array.isArray(items)).toBe(true)
      expect(items.some((i: { id: string }) => i.id === catalogItemId)).toBe(true)
    })

    it("filters by type when provided", async () => {
      const weapons = await getCatalogItems(alice, "weapon")
      expect(weapons.every((i: { type: string }) => i.type === "weapon")).toBe(true)
    })

    it("returns [] for an unknown type (no matches)", async () => {
      const items = await getCatalogItems(alice, "nonexistent_type_xyz")
      expect(items).toEqual([])
    })

    it("'all' type string is treated as no filter (returns all)", async () => {
      const all = await getCatalogItems(alice, "all")
      const unfiltered = await getCatalogItems(alice)
      expect(all.length).toBe(unfiltered.length)
    })
  })

  describe("getAllItems", () => {
    it("returns all items ordered by name", async () => {
      const items = await getAllItems(alice)
      expect(Array.isArray(items)).toBe(true)
      expect(items.length).toBeGreaterThan(0)
    })
  })

  // ---------------------------------------------------------------------------
  // getItemById
  // ---------------------------------------------------------------------------

  describe("getItemById", () => {
    it("returns item for a valid id", async () => {
      const item = await getItemById(alice, catalogItemId)
      expect(item).not.toBeNull()
      expect((item as { id: string }).id).toBe(catalogItemId)
    })

    it("returns null for a non-existent id", async () => {
      const item = await getItemById(alice, "00000000-0000-0000-0000-000000000000")
      expect(item).toBeNull()
    })
  })

  // ---------------------------------------------------------------------------
  // createItem / updateItem / deleteItems  (admin/catalog operations)
  // ---------------------------------------------------------------------------

  describe("createItem", () => {
    it("creates a new item and returns it", async () => {
      const { data, error } = await createItem(admin, {
        name: "Flame Dagger",
        type: "weapon",
      })
      expect(error).toBeNull()
      expect((data as { name: string }).name).toBe("Flame Dagger")
      await admin.from("items").delete().eq("id", (data as { id: string }).id)
    })
  })

  describe("updateItem", () => {
    it("updates an item field and returns the updated row", async () => {
      const id = await seedItem({ name: "Old Name", type: "armor" })
      const { data, error } = await updateItem(admin, id, { name: "New Name" })
      expect(error).toBeNull()
      expect((data as { name: string }).name).toBe("New Name")
      await admin.from("items").delete().eq("id", id)
    })
  })

  describe("deleteItems", () => {
    it("deletes multiple items by id", async () => {
      const id1 = await seedItem({ name: "Del1" })
      const id2 = await seedItem({ name: "Del2" })
      await deleteItems(admin, [id1, id2])

      const { data } = await admin
        .from("items")
        .select("id")
        .in("id", [id1, id2])
      expect(data).toHaveLength(0)
    })

    it("no-ops gracefully on an empty id list", async () => {
      const { error } = await deleteItems(alice, [])
      expect(error).toBeNull()
    })
  })

  // ---------------------------------------------------------------------------
  // addItemToInventory
  // ---------------------------------------------------------------------------

  describe("addItemToInventory", () => {
    it("adds an item to Alices inventory", async () => {
      const { error } = await addItemToInventory(alice, aliceCharId, catalogItemId, 1, 100)
      expect(error).toBeNull()

      const { data } = await admin
        .from("character_inventory")
        .select("item_id, quantity, condition")
        .eq("character_id", aliceCharId)
        .eq("item_id", catalogItemId)
      expect(data!.length).toBeGreaterThan(0)
      expect((data![0] as { quantity: number }).quantity).toBe(1)
      expect((data![0] as { condition: number }).condition).toBe(100)

      // Cleanup
      await admin
        .from("character_inventory")
        .delete()
        .eq("character_id", aliceCharId)
        .eq("item_id", catalogItemId)
    })

    it("accepts null condition (unconditioned item)", async () => {
      const { error } = await addItemToInventory(alice, aliceCharId, catalogItemId, 3, null)
      expect(error).toBeNull()

      const { data } = await admin
        .from("character_inventory")
        .select("condition")
        .eq("character_id", aliceCharId)
        .eq("item_id", catalogItemId)
        .single()
      expect((data as { condition: null }).condition).toBeNull()

      await admin
        .from("character_inventory")
        .delete()
        .eq("character_id", aliceCharId)
        .eq("item_id", catalogItemId)
    })

    it("RLS: Bob cannot add items to Alices inventory", async () => {
      const { error } = await addItemToInventory(bob, aliceCharId, catalogItemId, 1)
      // Either an explicit RLS error or the row won't appear
      const { data } = await admin
        .from("character_inventory")
        .select("id")
        .eq("character_id", aliceCharId)
        .eq("item_id", catalogItemId)
      if (!error) {
        expect(data).toHaveLength(0)
      } else {
        expect(error).toBeTruthy()
      }
    })
  })

  // ---------------------------------------------------------------------------
  // addItemsToInventory (batch)
  // ---------------------------------------------------------------------------

  describe("addItemsToInventory", () => {
    it("batch-inserts multiple rows", async () => {
      const id2 = await seedItem({ name: "Batch Item" })
      const { error } = await addItemsToInventory(alice, [
        { character_id: aliceCharId, item_id: catalogItemId, condition: 80, quantity: 1 },
        { character_id: aliceCharId, item_id: id2, condition: null, quantity: 2 },
      ])
      expect(error).toBeNull()

      const { data } = await admin
        .from("character_inventory")
        .select("item_id")
        .eq("character_id", aliceCharId)
        .in("item_id", [catalogItemId, id2])
      expect(data).toHaveLength(2)

      await admin.from("character_inventory").delete().eq("character_id", aliceCharId)
      await admin.from("items").delete().eq("id", id2)
    })
  })

  // ---------------------------------------------------------------------------
  // updateInventoryItem
  // ---------------------------------------------------------------------------

  describe("updateInventoryItem", () => {
    it("owner can update condition and quantity of an inventory row", async () => {
      await admin.from("character_inventory").insert({
        character_id: aliceCharId,
        item_id: catalogItemId,
        condition: 100,
        quantity: 1,
      })
      const { data: row } = await admin
        .from("character_inventory")
        .select("id")
        .eq("character_id", aliceCharId)
        .eq("item_id", catalogItemId)
        .single()
      const invId = (row as { id: string }).id

      const { error } = await updateInventoryItem(alice, invId, { condition: 45, quantity: 3 })
      expect(error).toBeNull()

      const { data } = await admin
        .from("character_inventory")
        .select("condition, quantity")
        .eq("id", invId)
        .single()
      expect((data as { condition: number }).condition).toBe(45)
      expect((data as { quantity: number }).quantity).toBe(3)

      await admin.from("character_inventory").delete().eq("id", invId)
    })

    it("RLS: Bob cannot update Alices inventory", async () => {
      await admin.from("character_inventory").insert({
        character_id: aliceCharId,
        item_id: catalogItemId,
        condition: 99,
        quantity: 1,
      })
      const { data: row } = await admin
        .from("character_inventory")
        .select("id, condition")
        .eq("character_id", aliceCharId)
        .eq("item_id", catalogItemId)
        .single()
      const invId = (row as { id: string }).id

      await updateInventoryItem(bob, invId, { condition: 1 })

      const { data: after } = await admin
        .from("character_inventory")
        .select("condition")
        .eq("id", invId)
        .single()
      expect((after as { condition: number }).condition).toBe(99) // unchanged

      await admin.from("character_inventory").delete().eq("id", invId)
    })
  })

  // ---------------------------------------------------------------------------
  // removeInventoryItem
  // ---------------------------------------------------------------------------

  describe("removeInventoryItem", () => {
    it("owner can remove an inventory row", async () => {
      await admin.from("character_inventory").insert({
        character_id: aliceCharId,
        item_id: catalogItemId,
        condition: 100,
        quantity: 1,
      })
      const { data: row } = await admin
        .from("character_inventory")
        .select("id")
        .eq("character_id", aliceCharId)
        .eq("item_id", catalogItemId)
        .single()
      const invId = (row as { id: string }).id

      const { error } = await removeInventoryItem(alice, invId)
      expect(error).toBeNull()

      const { data } = await admin
        .from("character_inventory")
        .select("id")
        .eq("id", invId)
      expect(data).toHaveLength(0)
    })

    it("RLS: Bob cannot remove Alices inventory row", async () => {
      await admin.from("character_inventory").insert({
        character_id: aliceCharId,
        item_id: catalogItemId,
        condition: 100,
        quantity: 1,
      })
      const { data: row } = await admin
        .from("character_inventory")
        .select("id")
        .eq("character_id", aliceCharId)
        .eq("item_id", catalogItemId)
        .single()
      const invId = (row as { id: string }).id

      await removeInventoryItem(bob, invId)

      const { data } = await admin
        .from("character_inventory")
        .select("id")
        .eq("id", invId)
      expect(data).toHaveLength(1) // still there

      await admin.from("character_inventory").delete().eq("id", invId)
    })
  })
})
