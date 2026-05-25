import { describe, it, expect, vi } from "vitest"
import {
  canInviteProfile,
  invitePlayer,
  acceptInvite,
  declineInvite,
  kickPlayer,
  type MemberRow,
} from "./invite-logic"

// ---------------------------------------------------------------------------
// Supabase client mock
// Each method returns `chain` for chaining; the object is thenable so `await` works.
// ---------------------------------------------------------------------------

function makeDb(resolvedValue: unknown = { data: null, error: null }) {
  const chain: Record<string, ReturnType<typeof vi.fn>> & {
    then: (resolve: (v: unknown) => unknown) => Promise<unknown>
  } = {
    from:   vi.fn(() => chain),
    select: vi.fn(() => chain),
    upsert: vi.fn(() => chain),
    update: vi.fn(() => chain),
    delete: vi.fn(() => chain),
    eq:     vi.fn(() => chain),
    single: vi.fn(() => Promise.resolve(resolvedValue)),
    then:   (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(resolvedValue).then(resolve as never, reject),
  } as any
  return chain
}

// ---------------------------------------------------------------------------
// canInviteProfile — pure function tests
// ---------------------------------------------------------------------------

describe("canInviteProfile", () => {
  it("allows invite when player is not a member at all", () => {
    expect(canInviteProfile("abc", [])).toBe(true)
  })

  it("allows invite when the existing members are someone else", () => {
    const members: MemberRow[] = [{ profile_id: "other", member_status: "active" }]
    expect(canInviteProfile("abc", members)).toBe(true)
  })

  it("blocks invite when player is active", () => {
    const members: MemberRow[] = [{ profile_id: "abc", member_status: "active" }]
    expect(canInviteProfile("abc", members)).toBe(false)
  })

  it("blocks invite when player has a pending invite", () => {
    const members: MemberRow[] = [{ profile_id: "abc", member_status: "invited" }]
    expect(canInviteProfile("abc", members)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Re-invite scenarios (core requirement of the ticket)
// After decline or kick, the game_members row is deleted so the profile no
// longer appears in the members list — canInviteProfile must return true.
// ---------------------------------------------------------------------------

describe("re-invite scenarios", () => {
  it("GM can re-invite after player declines (row deleted, not in members list)", () => {
    // Decline now deletes the row; only other active members remain
    const members: MemberRow[] = [{ profile_id: "active-player", member_status: "active" }]
    expect(canInviteProfile("declined-player", members)).toBe(true)
  })

  it("GM can re-invite after player is kicked (row deleted, not in members list)", () => {
    // Kick now deletes the row; only other active members remain
    const members: MemberRow[] = [{ profile_id: "active-player", member_status: "active" }]
    expect(canInviteProfile("kicked-player", members)).toBe(true)
  })

  it("GM cannot re-invite a player whose invite is still pending", () => {
    const members: MemberRow[] = [{ profile_id: "pending-player", member_status: "invited" }]
    expect(canInviteProfile("pending-player", members)).toBe(false)
  })

  it("GM cannot re-invite a player who already accepted", () => {
    const members: MemberRow[] = [{ profile_id: "active-player", member_status: "active" }]
    expect(canInviteProfile("active-player", members)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// invitePlayer — uses upsert so re-invite doesn't create a duplicate row
// ---------------------------------------------------------------------------

describe("invitePlayer", () => {
  it("upserts with invited status and the correct conflict target", async () => {
    const db = makeDb()
    await invitePlayer(db as any, "game-1", "profile-1")
    expect(db.from).toHaveBeenCalledWith("game_members")
    expect(db.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        game_id: "game-1",
        profile_id: "profile-1",
        member_status: "invited",
        character_id: null,
      }),
      expect.objectContaining({ onConflict: "game_id,profile_id" })
    )
  })

  it("does not use insert (which would duplicate rows)", async () => {
    const db = makeDb()
    await invitePlayer(db as any, "game-1", "profile-1")
    // insert should never be called — only upsert
    expect(db).not.toHaveProperty("insert")
  })
})

// ---------------------------------------------------------------------------
// declineInvite — must DELETE the row, not update to 'declined'
// ---------------------------------------------------------------------------

describe("declineInvite", () => {
  it("deletes the row by id", async () => {
    const db = makeDb()
    await declineInvite(db as any, "invite-1")
    expect(db.from).toHaveBeenCalledWith("game_members")
    expect(db.delete).toHaveBeenCalled()
    expect(db.eq).toHaveBeenCalledWith("id", "invite-1")
  })

  it("does not call update (old approach that left bloat)", async () => {
    const db = makeDb()
    await declineInvite(db as any, "invite-1")
    expect(db.update).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// kickPlayer — must DELETE game_members row (not null character_id)
// ---------------------------------------------------------------------------

describe("kickPlayer", () => {
  it("marks the character as not in game", async () => {
    const db = makeDb()
    await kickPlayer(db as any, "game-1", "char-1")
    expect(db.update).toHaveBeenCalledWith({ in_game: false })
  })

  it("deletes the game_members row so the player can be re-invited", async () => {
    const db = makeDb()
    await kickPlayer(db as any, "game-1", "char-1")
    expect(db.from).toHaveBeenCalledWith("game_members")
    expect(db.delete).toHaveBeenCalled()
    expect(db.eq).toHaveBeenCalledWith("game_id", "game-1")
    expect(db.eq).toHaveBeenCalledWith("character_id", "char-1")
  })
})

// ---------------------------------------------------------------------------
// acceptInvite
// ---------------------------------------------------------------------------

describe("acceptInvite", () => {
  it("marks membership active and links the character", async () => {
    const db = makeDb()
    await acceptInvite(db as any, "invite-1", "char-1", 5, 3)
    expect(db.update).toHaveBeenCalledWith(
      expect.objectContaining({ character_id: "char-1", member_status: "active" })
    )
  })

  it("adds starting level to existing skill points", async () => {
    const db = makeDb()
    await acceptInvite(db as any, "invite-1", "char-1", 5, 3)
    expect(db.update).toHaveBeenCalledWith(
      expect.objectContaining({ in_game: true, unused_skill_points: 8 })
    )
  })

  it("works when starting level is 0 (no bonus points)", async () => {
    const db = makeDb()
    await acceptInvite(db as any, "invite-1", "char-1", 2, 0)
    expect(db.update).toHaveBeenCalledWith(
      expect.objectContaining({ unused_skill_points: 2 })
    )
  })
})
