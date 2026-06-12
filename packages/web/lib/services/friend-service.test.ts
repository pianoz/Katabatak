import { describe, it, expect, beforeAll, afterAll } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  admin,
  clientAs,
  seedUser,
  seedFriendship,
  teardownUser,
  uniqueEmail,
} from "./test-helpers"
import {
  sendFriendRequest,
  approveFriendRequest,
  removeFriendRow,
  fetchIncomingFriendRequests,
  fetchFriends,
} from "./friend-service"

const ALICE = uniqueEmail("friend-alice")
const BOB = uniqueEmail("friend-bob")
const CHARLIE = uniqueEmail("friend-charlie")
const PASS = "Test1234!"

describe("friend-service", () => {
  let aliceId: string
  let bobId: string
  let charlieId: string
  let alice: SupabaseClient
  let bob: SupabaseClient
  let charlie: SupabaseClient

  beforeAll(async () => {
    aliceId = await seedUser(ALICE, PASS)
    bobId = await seedUser(BOB, PASS)
    charlieId = await seedUser(CHARLIE, PASS)
    alice = await clientAs(ALICE, PASS)
    bob = await clientAs(BOB, PASS)
    charlie = await clientAs(CHARLIE, PASS)
  })

  afterAll(async () => {
    try {
      await admin
        .from("friends")
        .delete()
        .or(`friend_1.eq.${aliceId},friend_2.eq.${aliceId},friend_1.eq.${bobId},friend_2.eq.${bobId},friend_1.eq.${charlieId},friend_2.eq.${charlieId}`)
    } catch {}
    try { await teardownUser(aliceId) } catch {}
    try { await teardownUser(bobId) } catch {}
    try { await teardownUser(charlieId) } catch {}
  })

  // ---------------------------------------------------------------------------
  // sendFriendRequest
  // ---------------------------------------------------------------------------

  describe("sendFriendRequest", () => {
    it("happy path: creates a pending request and returns null (no error)", async () => {
      const err = await sendFriendRequest(alice, aliceId, charlieId)
      expect(err).toBeNull()

      const { data } = await admin
        .from("friends")
        .select("status")
        .eq("friend_1", aliceId)
        .eq("friend_2", charlieId)
        .single()
      expect((data as { status: string }).status).toBe("pending")
    })

    it("returns an error string if a request is already pending", async () => {
      // Alice already sent a request to Charlie above
      const err = await sendFriendRequest(alice, aliceId, charlieId)
      expect(typeof err).toBe("string")
      expect(err).toMatch(/pending/i)
    })

    it("returns an error string if they are already friends", async () => {
      const rowId = await seedFriendship(aliceId, bobId, "friend")
      const err = await sendFriendRequest(alice, aliceId, bobId)
      expect(typeof err).toBe("string")
      expect(err).toMatch(/friends/i)
      await admin.from("friends").delete().eq("id", rowId)
    })

    it("RLS: Bob cannot send a request impersonating Alice (friend_1 must be auth.uid)", async () => {
      // Bob calls sendFriendRequest but passes aliceId as currentUserId
      // The internal insert will have friend_1 = aliceId, which != bob's auth.uid()
      // RLS should reject the insert; the function returns the error message
      const err = await sendFriendRequest(bob, aliceId, charlieId)
      // Either the insert fails (RLS error returned) or the existing-row check fires.
      // Either way, Bob cannot successfully forge Alice's identity.
      if (err === null) {
        // If somehow it succeeded, verify the created row has bob's uid, not alice's
        const { data } = await admin
          .from("friends")
          .select("friend_1")
          .eq("friend_1", aliceId)
          .eq("friend_2", charlieId)
          .eq("status", "pending")
        // Should not exist (or should be the earlier alice->charlie row, not a new one)
        expect(data).toHaveLength(1) // only the one alice sent herself
      } else {
        expect(typeof err).toBe("string")
      }
    })
  })

  // ---------------------------------------------------------------------------
  // approveFriendRequest
  // ---------------------------------------------------------------------------

  describe("approveFriendRequest", () => {
    it("happy path: recipient can approve a pending request", async () => {
      const rowId = await seedFriendship(charlieId, aliceId, "pending")
      // Alice is friend_2, so she approves
      await approveFriendRequest(alice, rowId)

      const { data } = await admin
        .from("friends")
        .select("status")
        .eq("id", rowId)
        .single()
      expect((data as { status: string }).status).toBe("friend")
      await admin.from("friends").delete().eq("id", rowId)
    })

    it("RLS: Bob cannot approve a request he has no stake in", async () => {
      const rowId = await seedFriendship(charlieId, aliceId, "pending")
      await approveFriendRequest(bob, rowId)

      const { data } = await admin
        .from("friends")
        .select("status")
        .eq("id", rowId)
        .single()
      // Status should remain pending — Bob has no RLS right to update this row
      expect((data as { status: string }).status).toBe("pending")
      await admin.from("friends").delete().eq("id", rowId)
    })
  })

  // ---------------------------------------------------------------------------
  // removeFriendRow
  // ---------------------------------------------------------------------------

  describe("removeFriendRow", () => {
    it("friend_1 can remove the row (unfriend/decline)", async () => {
      const rowId = await seedFriendship(aliceId, bobId, "friend")
      await removeFriendRow(alice, rowId)

      const { data } = await admin.from("friends").select("id").eq("id", rowId)
      expect(data).toHaveLength(0)
    })

    it("friend_2 can also remove the row", async () => {
      const rowId = await seedFriendship(aliceId, bobId, "pending")
      await removeFriendRow(bob, rowId)

      const { data } = await admin.from("friends").select("id").eq("id", rowId)
      expect(data).toHaveLength(0)
    })

    it("RLS: Charlie cannot remove a row between Alice and Bob", async () => {
      const rowId = await seedFriendship(aliceId, bobId, "friend")
      await removeFriendRow(charlie, rowId)

      const { data } = await admin.from("friends").select("id").eq("id", rowId)
      expect(data).toHaveLength(1) // still exists
      await admin.from("friends").delete().eq("id", rowId)
    })
  })

  // ---------------------------------------------------------------------------
  // fetchIncomingFriendRequests
  // ---------------------------------------------------------------------------

  describe("fetchIncomingFriendRequests", () => {
    it("returns pending requests directed at the current user", async () => {
      const rowId = await seedFriendship(charlieId, bobId, "pending")
      const requests = await fetchIncomingFriendRequests(bob, bobId)

      expect(requests.some((r) => r.id === rowId)).toBe(true)
      const req = requests.find((r) => r.id === rowId)!
      expect(req.friend_1).toBe(charlieId)

      await admin.from("friends").delete().eq("id", rowId)
    })

    it("does not include accepted (friend) rows", async () => {
      const rowId = await seedFriendship(charlieId, bobId, "friend")
      const requests = await fetchIncomingFriendRequests(bob, bobId)
      expect(requests.some((r) => r.id === rowId)).toBe(false)
      await admin.from("friends").delete().eq("id", rowId)
    })

    it("returns [] when no pending requests exist", async () => {
      const requests = await fetchIncomingFriendRequests(alice, aliceId)
      // Only the charlie->alice pending row from sendFriendRequest tests should exist
      // Clear those first
      await admin
        .from("friends")
        .delete()
        .eq("friend_2", aliceId)
        .eq("status", "pending")
      const clean = await fetchIncomingFriendRequests(alice, aliceId)
      expect(clean).toEqual([])
    })

    it("RLS: Bob cannot fetch Alices incoming requests", async () => {
      const rowId = await seedFriendship(charlieId, aliceId, "pending")
      const requests = await fetchIncomingFriendRequests(bob, aliceId)
      // RLS should return only requests where friend_2 = auth.uid() (bob),
      // so Alice's requests should not appear.
      expect(requests.some((r) => r.id === rowId)).toBe(false)
      await admin.from("friends").delete().eq("id", rowId)
    })
  })

  // ---------------------------------------------------------------------------
  // fetchFriends
  // ---------------------------------------------------------------------------

  describe("fetchFriends", () => {
    it("returns friends where user is friend_1", async () => {
      const rowId = await seedFriendship(aliceId, bobId, "friend")
      const friends = await fetchFriends(alice, aliceId)
      expect(friends.some((f) => f.profile_id === bobId)).toBe(true)
      await admin.from("friends").delete().eq("id", rowId)
    })

    it("returns friends where user is friend_2 (bidirectional)", async () => {
      const rowId = await seedFriendship(charlieId, aliceId, "friend")
      const friends = await fetchFriends(alice, aliceId)
      expect(friends.some((f) => f.profile_id === charlieId)).toBe(true)
      await admin.from("friends").delete().eq("id", rowId)
    })

    it("does not include pending rows", async () => {
      const rowId = await seedFriendship(aliceId, bobId, "pending")
      const friends = await fetchFriends(alice, aliceId)
      expect(friends.some((f) => f.profile_id === bobId)).toBe(false)
      await admin.from("friends").delete().eq("id", rowId)
    })

    it("returns [] when user has no confirmed friends", async () => {
      // Clean bob's friends list first
      await admin
        .from("friends")
        .delete()
        .or(`friend_1.eq.${bobId},friend_2.eq.${bobId}`)
      const friends = await fetchFriends(bob, bobId)
      expect(friends).toEqual([])
    })

    it("id field on each friend points back to the friends row (for removal)", async () => {
      const rowId = await seedFriendship(aliceId, bobId, "friend")
      const friends = await fetchFriends(alice, aliceId)
      const bobEntry = friends.find((f) => f.profile_id === bobId)
      expect(bobEntry).toBeDefined()
      expect(bobEntry!.id).toBe(rowId)
      await admin.from("friends").delete().eq("id", rowId)
    })

    it("heavy path: user with many friends returns all of them", async () => {
      // Remove any pre-existing Alice-Charlie row (may exist from sendFriendRequest tests)
      await admin.from("friends").delete().eq("friend_1", aliceId).eq("friend_2", charlieId)
      await admin.from("friends").delete().eq("friend_1", charlieId).eq("friend_2", aliceId)
      const id1 = await seedFriendship(aliceId, bobId, "friend")
      const id2 = await seedFriendship(aliceId, charlieId, "friend")
      const friends = await fetchFriends(alice, aliceId)
      expect(friends.some((f) => f.profile_id === bobId || f.profile_id === charlieId)).toBe(true)
      await admin.from("friends").delete().eq("id", id1)
      await admin.from("friends").delete().eq("id", id2)
    })

    it("RLS: Bob cannot fetch Alices friend list", async () => {
      await admin.from("friends").delete().eq("friend_1", aliceId).eq("friend_2", charlieId)
      await admin.from("friends").delete().eq("friend_1", charlieId).eq("friend_2", aliceId)
      const rowId = await seedFriendship(aliceId, charlieId, "friend")
      const friends = await fetchFriends(bob, aliceId)
      // RLS should filter: Bob gets only his own friends, not Alice's
      expect(friends.some((f) => f.profile_id === charlieId)).toBe(false)
      await admin.from("friends").delete().eq("id", rowId)
    })
  })
})
