import { describe, it, expect, beforeAll, afterAll } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  admin,
  clientAs,
  seedUser,
  seedCharacter,
  seedGame,
  seedGameMember,
  seedFriendship,
  teardownUser,
  uniqueEmail,
} from "./test-helpers"
import {
  getDashboardGames,
  getGameInvites,
  getGameWithMembers,
  archiveGame,
  deleteGame,
  getGameMemberProfileId,
  getFriendProfiles,
  getCharacterActiveGameId,
  getGameAllyCharacters,
} from "./game-service"

const ALICE = uniqueEmail("game-alice")
const BOB = uniqueEmail("game-bob")
const CHARLIE = uniqueEmail("game-charlie")
const PASS = "Test1234!"

describe("game-service", () => {
  let aliceId: string
  let bobId: string
  let charlieId: string
  let alice: SupabaseClient
  let bob: SupabaseClient
  let charlie: SupabaseClient

  // Game where Alice is GM, Bob is an active member
  let sharedGameId: string
  let bobMemberId: string
  let bobCharId: string
  let aliceCharId: string

  beforeAll(async () => {
    aliceId = await seedUser(ALICE, PASS)
    bobId = await seedUser(BOB, PASS)
    charlieId = await seedUser(CHARLIE, PASS)
    alice = await clientAs(ALICE, PASS)
    bob = await clientAs(BOB, PASS)
    charlie = await clientAs(CHARLIE, PASS)

    aliceCharId = await seedCharacter(aliceId, { name: "Alice PC", in_game: true })
    bobCharId = await seedCharacter(bobId, { name: "Bob PC", in_game: true })

    sharedGameId = await seedGame(aliceId, { name: "Shared Game" })
    bobMemberId = await seedGameMember(sharedGameId, bobId, "active", bobCharId)
  })

  afterAll(async () => {
    await teardownUser(aliceId)
    await teardownUser(bobId)
    await teardownUser(charlieId)
  })

  // ---------------------------------------------------------------------------
  // getDashboardGames
  // ---------------------------------------------------------------------------

  describe("getDashboardGames", () => {
    it("GM sees their own game", async () => {
      const games = await getDashboardGames(alice, aliceId)
      expect(games.some((g: { id: string }) => g.id === sharedGameId)).toBe(true)
    })

    it("active member sees games they belong to (not GM)", async () => {
      const games = await getDashboardGames(bob, bobId)
      expect(games.some((g: { id: string }) => g.id === sharedGameId)).toBe(true)
    })

    it("deduplicates when user is both GM and member of the same game", async () => {
      // Make Alice also a member of her own game
      const membId = await seedGameMember(sharedGameId, aliceId, "active", aliceCharId)
      const games = await getDashboardGames(alice, aliceId)
      const hits = games.filter((g: { id: string }) => g.id === sharedGameId)
      expect(hits).toHaveLength(1)
      await admin.from("game_members").delete().eq("id", membId)
    })

    it("returns [] when user is in no games", async () => {
      const games = await getDashboardGames(charlie, charlieId)
      expect(games).toEqual([])
    })

    it("RLS: Charlie cannot see the Shared Game", async () => {
      const games = await getDashboardGames(charlie, charlieId)
      expect(games.some((g: { id: string }) => g.id === sharedGameId)).toBe(false)
    })
  })

  // ---------------------------------------------------------------------------
  // getGameInvites
  // ---------------------------------------------------------------------------

  describe("getGameInvites", () => {
    it("returns pending invites for the current user", async () => {
      const invMembId = await seedGameMember(sharedGameId, charlieId, "invited")
      const invites = await getGameInvites(charlie, charlieId)
      expect(invites.some((i) => i.id === invMembId)).toBe(true)
      const inv = invites.find((i) => i.id === invMembId)!
      expect(inv.game_id).toBe(sharedGameId)
      expect(typeof inv.game_name).toBe("string")
      await admin.from("game_members").delete().eq("id", invMembId)
    })

    it("does not include active memberships", async () => {
      const invites = await getGameInvites(bob, bobId)
      expect(invites.some((i) => i.id === bobMemberId)).toBe(false)
    })

    it("returns [] when user has no pending invites", async () => {
      const invites = await getGameInvites(alice, aliceId)
      expect(invites).toEqual([])
    })

    it("RLS: Bob cannot fetch Charlies invites by passing her userId", async () => {
      const invMembId = await seedGameMember(sharedGameId, charlieId, "invited")
      const invites = await getGameInvites(bob, charlieId)
      // RLS filters to rows where profile_id = auth.uid() (bob), so Charlie's invite won't appear
      expect(invites.some((i) => i.id === invMembId)).toBe(false)
      await admin.from("game_members").delete().eq("id", invMembId)
    })
  })

  // ---------------------------------------------------------------------------
  // getGameWithMembers
  // ---------------------------------------------------------------------------

  describe("getGameWithMembers", () => {
    it("GM can fetch game and member list", async () => {
      const { game, members } = await getGameWithMembers(alice, sharedGameId)
      expect(game).not.toBeNull()
      expect((game as { id: string }).id).toBe(sharedGameId)
      expect(Array.isArray(members)).toBe(true)
      expect(members!.some((m: { profile_id: string }) => m.profile_id === bobId)).toBe(true)
    })

    it("active member can also fetch game and member list", async () => {
      const { game } = await getGameWithMembers(bob, sharedGameId)
      expect(game).not.toBeNull()
    })

    it("RLS: non-member gets null/empty result", async () => {
      const { game } = await getGameWithMembers(charlie, sharedGameId)
      // Charlie is not in the game — RLS should block the read
      expect(game).toBeNull()
    })
  })

  // ---------------------------------------------------------------------------
  // archiveGame
  // ---------------------------------------------------------------------------

  describe("archiveGame", () => {
    it("GM can archive the game", async () => {
      const gameId = await seedGame(aliceId, { name: "Archive Me", archived: false })
      const { error } = await archiveGame(alice, gameId)
      expect(error).toBeNull()

      const { data } = await admin
        .from("games")
        .select("archived")
        .eq("id", gameId)
        .single()
      expect((data as { archived: boolean }).archived).toBe(true)
      await admin.from("games").delete().eq("id", gameId)
    })

    it("RLS: Bob (player) cannot archive the game", async () => {
      const gameId = await seedGame(aliceId, { name: "No Archive", archived: false })
      await archiveGame(bob, gameId)

      const { data } = await admin
        .from("games")
        .select("archived")
        .eq("id", gameId)
        .single()
      expect((data as { archived: boolean }).archived).toBe(false)
      await admin.from("games").delete().eq("id", gameId)
    })
  })

  // ---------------------------------------------------------------------------
  // deleteGame
  // ---------------------------------------------------------------------------

  describe("deleteGame", () => {
    it("GM can delete their game", async () => {
      const gameId = await seedGame(aliceId, { name: "Delete Me" })
      const { error } = await deleteGame(alice, gameId)
      expect(error).toBeNull()

      const { data } = await admin.from("games").select("id").eq("id", gameId)
      expect(data).toHaveLength(0)
    })

    it("RLS: Bob cannot delete Alices game", async () => {
      const gameId = await seedGame(aliceId, { name: "Survive" })
      await deleteGame(bob, gameId)

      const { data } = await admin.from("games").select("id").eq("id", gameId)
      expect(data).toHaveLength(1)
      await admin.from("games").delete().eq("id", gameId)
    })
  })

  // ---------------------------------------------------------------------------
  // getGameMemberProfileId
  // ---------------------------------------------------------------------------

  describe("getGameMemberProfileId", () => {
    it("returns the profile_id for a given character in a game", async () => {
      const profileId = await getGameMemberProfileId(alice, sharedGameId, bobCharId)
      expect(profileId).toBe(bobId)
    })

    it("returns undefined for a character not in the game", async () => {
      const profileId = await getGameMemberProfileId(
        alice,
        sharedGameId,
        "00000000-0000-0000-0000-000000000000"
      )
      expect(profileId).toBeUndefined()
    })
  })

  // ---------------------------------------------------------------------------
  // getFriendProfiles
  // ---------------------------------------------------------------------------

  describe("getFriendProfiles", () => {
    it("returns confirmed friends with username", async () => {
      const rowId = await seedFriendship(aliceId, charlieId, "friend")
      const profiles = await getFriendProfiles(alice, aliceId)
      expect(profiles.some((p) => p.id === charlieId)).toBe(true)
      await admin.from("friends").delete().eq("id", rowId)
    })

    it("excludes pending friends", async () => {
      const rowId = await seedFriendship(aliceId, charlieId, "pending")
      const profiles = await getFriendProfiles(alice, aliceId)
      expect(profiles.some((p) => p.id === charlieId)).toBe(false)
      await admin.from("friends").delete().eq("id", rowId)
    })

    it("returns [] when user has no friends", async () => {
      await admin
        .from("friends")
        .delete()
        .or(`friend_1.eq.${charlieId},friend_2.eq.${charlieId}`)
      const profiles = await getFriendProfiles(charlie, charlieId)
      expect(profiles).toEqual([])
    })
  })

  // ---------------------------------------------------------------------------
  // getCharacterActiveGameId
  // ---------------------------------------------------------------------------

  describe("getCharacterActiveGameId", () => {
    it("returns the game_id for an active character", async () => {
      const gameId = await getCharacterActiveGameId(bob, bobCharId)
      expect(gameId).toBe(sharedGameId)
    })

    it("returns null for a character not in any game", async () => {
      const lonelyCharId = await seedCharacter(aliceId, { name: "Loner", in_game: false })
      const gameId = await getCharacterActiveGameId(alice, lonelyCharId)
      expect(gameId).toBeNull()
      await admin.from("characters").delete().eq("id", lonelyCharId)
    })
  })

  // ---------------------------------------------------------------------------
  // getGameAllyCharacters
  // ---------------------------------------------------------------------------

  describe("getGameAllyCharacters", () => {
    it("returns other active characters in the game, excluding the requesting character", async () => {
      // Seed a third character as member
      const charlieCharId = await seedCharacter(charlieId, { name: "Charlie PC", in_game: true })
      const charlieMembId = await seedGameMember(
        sharedGameId,
        charlieId,
        "active",
        charlieCharId
      )

      const allies = await getGameAllyCharacters(alice, sharedGameId, bobCharId)
      // Should include Charlie's char but NOT Bob's (excluded by neq)
      expect(allies.some((a) => a.id === charlieCharId)).toBe(true)
      expect(allies.some((a) => a.id === bobCharId)).toBe(false)

      await admin.from("game_members").delete().eq("id", charlieMembId)
      await admin.from("characters").delete().eq("id", charlieCharId)
    })

    it("returns [] when the character is alone in the game", async () => {
      const soloGameId = await seedGame(aliceId, { name: "Solo Game" })
      const aliceMembId = await seedGameMember(soloGameId, aliceId, "active", aliceCharId)

      const allies = await getGameAllyCharacters(alice, soloGameId, aliceCharId)
      expect(allies).toEqual([])

      await admin.from("game_members").delete().eq("id", aliceMembId)
      await admin.from("games").delete().eq("id", soloGameId)
    })

    it("each ally entry has id and name", async () => {
      const allies = await getGameAllyCharacters(alice, sharedGameId, aliceCharId)
      for (const ally of allies) {
        expect(ally).toHaveProperty("id")
        expect(ally).toHaveProperty("name")
      }
    })
  })
})
