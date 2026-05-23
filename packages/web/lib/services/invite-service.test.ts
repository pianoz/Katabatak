/**
 * invite-service integration tests — focus on RLS.
 *
 * Pure-logic tests for canInviteProfile / acceptInvite / declineInvite / kickPlayer
 * already live in invite-logic.test.ts (mock-based). These tests verify the same
 * operations actually enforce RLS on the real DB.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  admin,
  clientAs,
  seedUser,
  seedCharacter,
  seedGame,
  seedGameMember,
  teardownUser,
  uniqueEmail,
} from "./test-helpers"
import {
  invitePlayer,
  acceptInvite,
  declineInvite,
  kickPlayer,
} from "./invite-service"

const ALICE = uniqueEmail("inv-alice")  // GM
const BOB = uniqueEmail("inv-bob")      // invited player
const CHARLIE = uniqueEmail("inv-charlie") // stranger
const PASS = "Test1234!"

describe("invite-service (RLS)", () => {
  let aliceId: string
  let bobId: string
  let charlieId: string
  let alice: SupabaseClient
  let bob: SupabaseClient
  let charlie: SupabaseClient
  let gameId: string
  let bobCharId: string

  beforeAll(async () => {
    aliceId = await seedUser(ALICE, PASS)
    bobId = await seedUser(BOB, PASS)
    charlieId = await seedUser(CHARLIE, PASS)
    alice = await clientAs(ALICE, PASS)
    bob = await clientAs(BOB, PASS)
    charlie = await clientAs(CHARLIE, PASS)

    gameId = await seedGame(aliceId, { name: "Invite Test Game", starting_level: 2 })
    bobCharId = await seedCharacter(bobId, {
      name: "Bob Fighter",
      in_game: false,
      unused_skill_points: 0,
    })
  })

  afterAll(async () => {
    await teardownUser(aliceId)
    await teardownUser(bobId)
    await teardownUser(charlieId)
  })

  // ---------------------------------------------------------------------------
  // invitePlayer
  // ---------------------------------------------------------------------------

  describe("invitePlayer", () => {
    it("GM can invite a player", async () => {
      const { error } = await invitePlayer(alice, gameId, bobId)
      expect(error).toBeNull()

      const { data } = await admin
        .from("game_members")
        .select("member_status")
        .eq("game_id", gameId)
        .eq("profile_id", bobId)
        .single()
      expect((data as { member_status: string }).member_status).toBe("invited")
    })

    it("upserts without error when re-inviting (idempotent)", async () => {
      // Bob is already invited — upsert should succeed without duplicate
      const { error } = await invitePlayer(alice, gameId, bobId)
      expect(error).toBeNull()

      const { data } = await admin
        .from("game_members")
        .select("id")
        .eq("game_id", gameId)
        .eq("profile_id", bobId)
      expect(data).toHaveLength(1) // still only one row
    })

    it("RLS: Bob (player) cannot invite Charlie", async () => {
      const { error } = await invitePlayer(bob, gameId, charlieId)
      // Insert into game_members without being the GM should be blocked
      // error may be an RLS violation or the row simply won't appear
      const { data } = await admin
        .from("game_members")
        .select("id")
        .eq("game_id", gameId)
        .eq("profile_id", charlieId)
      if (error) {
        expect(error).toBeTruthy()
      } else {
        expect(data).toHaveLength(0)
      }
    })

    it("RLS: Charlie (stranger) cannot invite himself", async () => {
      await invitePlayer(charlie, gameId, charlieId)
      const { data } = await admin
        .from("game_members")
        .select("id")
        .eq("game_id", gameId)
        .eq("profile_id", charlieId)
      expect(data).toHaveLength(0)
    })
  })

  // ---------------------------------------------------------------------------
  // acceptInvite
  // ---------------------------------------------------------------------------

  describe("acceptInvite", () => {
    it("invited player can accept their own invite", async () => {
      const { data: memberRow } = await admin
        .from("game_members")
        .select("id")
        .eq("game_id", gameId)
        .eq("profile_id", bobId)
        .single()
      const inviteId = (memberRow as { id: string }).id

      const [memberResult, charResult] = await acceptInvite(
        bob,
        inviteId,
        bobCharId,
        0,
        2 // startingLevel = 2
      )

      expect(memberResult.error).toBeNull()
      expect(charResult.error).toBeNull()

      const { data: member } = await admin
        .from("game_members")
        .select("member_status, character_id")
        .eq("id", inviteId)
        .single()
      expect((member as { member_status: string }).member_status).toBe("active")
      expect((member as { character_id: string }).character_id).toBe(bobCharId)

      const { data: char } = await admin
        .from("characters")
        .select("in_game, unused_skill_points")
        .eq("id", bobCharId)
        .single()
      expect((char as { in_game: boolean }).in_game).toBe(true)
      expect((char as { unused_skill_points: number }).unused_skill_points).toBe(2) // 0 + 2
    })

    it("RLS: Charlie cannot accept Bobs invite", async () => {
      // Re-invite Bob so the row is back in 'invited' state
      await admin
        .from("game_members")
        .update({ member_status: "invited", character_id: null })
        .eq("game_id", gameId)
        .eq("profile_id", bobId)
      await admin.from("characters").update({ in_game: false }).eq("id", bobCharId)

      const { data: memberRow } = await admin
        .from("game_members")
        .select("id")
        .eq("game_id", gameId)
        .eq("profile_id", bobId)
        .single()
      const inviteId = (memberRow as { id: string }).id

      await acceptInvite(charlie, inviteId, bobCharId, 0, 2)

      // Row should still be 'invited', not 'active'
      const { data } = await admin
        .from("game_members")
        .select("member_status")
        .eq("id", inviteId)
        .single()
      expect((data as { member_status: string }).member_status).toBe("invited")
    })
  })

  // ---------------------------------------------------------------------------
  // declineInvite
  // ---------------------------------------------------------------------------

  describe("declineInvite", () => {
    it("invited player can decline and the row is deleted", async () => {
      // Bob's row from acceptInvite tests exists with 'invited' status — reuse it
      const { data: existingRow } = await admin
        .from("game_members")
        .select("id")
        .eq("game_id", gameId)
        .eq("profile_id", bobId)
        .single()
      const membId = (existingRow as { id: string }).id

      await declineInvite(bob, membId)

      const { data } = await admin
        .from("game_members")
        .select("id")
        .eq("id", membId)
      expect(data).toHaveLength(0)
    })

    it("RLS: Charlie cannot decline Bobs invite", async () => {
      const membId = await seedGameMember(gameId, bobId, "invited")
      await declineInvite(charlie, membId)

      const { data } = await admin
        .from("game_members")
        .select("id")
        .eq("id", membId)
      expect(data).toHaveLength(1)
      await admin.from("game_members").delete().eq("id", membId)
    })
  })

  // ---------------------------------------------------------------------------
  // kickPlayer
  // ---------------------------------------------------------------------------

  describe("kickPlayer", () => {
    it("GM can kick an active player", async () => {
      // Delete any stale Bob row, then insert fresh to guarantee character_id is set
      await admin.from("game_members").delete().eq("game_id", gameId).eq("profile_id", bobId)
      await admin.from("game_members").insert({
        game_id: gameId, profile_id: bobId, character_id: bobCharId, role: "player", member_status: "active",
      })
      await admin.from("characters").update({ in_game: true }).eq("id", bobCharId)

      await kickPlayer(alice, gameId, bobCharId)

      const { data: memberRows } = await admin
        .from("game_members")
        .select("id")
        .eq("game_id", gameId)
        .eq("character_id", bobCharId)
      expect(memberRows).toHaveLength(0)

      const { data: char } = await admin
        .from("characters")
        .select("in_game")
        .eq("id", bobCharId)
        .single()
      expect((char as { in_game: boolean }).in_game).toBe(false)
    })

    it("RLS: Bob (player) cannot kick Charlie from a game", async () => {
      const charlieCharId = await seedCharacter(charlieId, { name: "Charlie PC", in_game: true })
      const charlieMembId = await seedGameMember(gameId, charlieId, "active", charlieCharId)

      await kickPlayer(bob, gameId, charlieCharId)

      const { data } = await admin
        .from("game_members")
        .select("id")
        .eq("id", charlieMembId)
      expect(data).toHaveLength(1) // still present

      await admin.from("game_members").delete().eq("id", charlieMembId)
      await admin.from("characters").delete().eq("id", charlieCharId)
    })
  })
})
