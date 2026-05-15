"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Matches the `profiles` table row shape — extend as needed */
interface Profile {
  id: string;           // profiles.id (uuid)
  username: string;     // profiles.username
  avatar_url?: string;  // profiles.avatar_url
}

interface GameSetting {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
}

/**
 * Local form state — intentionally separate from the DB shape so we can hold
 * UI-only fields (starting stats, backgrounds, settings) that may live in a
 * different table or be stored as JSONB later.
 */
interface NewGameFormState {
  name: string;
  is_private: boolean;
  // Starting-stat defaults (not in `games` schema yet — store as JSONB or a
  // separate table; passed through for future use)
  startingEssence: number;
  startingPower: number;
  startingWill: number;
  startingHealth: number;
  startingDenarius: number;
  allowedBackgrounds: string[];
  settings: GameSetting[];
  /** Profiles the GM wants to invite */
  invitedPlayers: Profile[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const BACKGROUNDS = [
  "Baker", "Soldier", "Merchant", "Scholar", "Thief",
  "Priest", "Farmer", "Noble", "Sailor", "Hunter",
];

const DEFAULT_SETTINGS: GameSetting[] = [
  { id: "permadeath",     label: "Permadeath",           description: "Characters that reach 0 Health are permanently removed.", enabled: false },
  { id: "fog_of_war",     label: "Fog of War",           description: "Players only see what their character can perceive.",      enabled: true  },
  { id: "shared_inventory",label: "Shared Party Inventory",description: "All players share a common item pool.",                  enabled: false },
  { id: "open_skill_tree",label: "Open Skill Tree",      description: "All skill tree paths are visible from the start.",         enabled: true  },
  { id: "pvp",            label: "Player vs Player",     description: "Players may attack one another.",                          enabled: false },
  { id: "auto_level",     label: "Auto Level NPCs",      description: "NPC difficulty scales with average party level.",          enabled: true  },
];

const INITIAL_FORM: NewGameFormState = {
  name: "",
  is_private: false,
  startingEssence: 10,
  startingPower: 10,
  startingWill: 10,
  startingHealth: 10,
  startingDenarius: 12,
  allowedBackgrounds: [...BACKGROUNDS],
  settings: DEFAULT_SETTINGS,
  invitedPlayers: [],
};

/** Generates a random 6-character alphanumeric join code */
function generateJoinCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ fontSize: "0.7rem", letterSpacing: "0.15em", color: "#888", textTransform: "uppercase", marginBottom: "1rem", fontWeight: 400 }}>
      {children}
    </h2>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: "#111", border: "1px solid #222", borderRadius: 4, padding: "1.5rem", ...style }}>
      {children}
    </div>
  );
}

function StatInput({ label, value, onChange }: { label: string; value: number; onChange: (val: number) => void }) {
  return (
    <Card style={{ textAlign: "center", flex: 1 }}>
      <div style={{ fontSize: "0.65rem", letterSpacing: "0.12em", color: "#888", textTransform: "uppercase", marginBottom: "0.75rem" }}>
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "1rem" }}>
        <button onClick={() => onChange(Math.max(1, value - 1))} style={iconBtnStyle}>−</button>
        <span style={{ fontSize: "2rem", fontWeight: 300, color: "#fff", minWidth: 40 }}>{value}</span>
        <button onClick={() => onChange(value + 1)} style={iconBtnStyle}>+</button>
      </div>
    </Card>
  );
}

function ToggleSetting({ setting, onToggle }: { setting: GameSetting; onToggle: (id: string) => void }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.85rem 0", borderBottom: "1px solid #1a1a1a" }}>
      <div>
        <div style={{ color: "#e8e8e8", fontSize: "0.9rem", marginBottom: 2 }}>{setting.label}</div>
        <div style={{ color: "#555", fontSize: "0.75rem" }}>{setting.description}</div>
      </div>
      <button
        onClick={() => onToggle(setting.id)}
        style={{ width: 42, height: 22, borderRadius: 11, border: "none", background: setting.enabled ? "#22c55e" : "#333", cursor: "pointer", position: "relative", flexShrink: 0, marginLeft: "1.5rem", transition: "background 0.2s" }}
      >
        <span style={{ position: "absolute", top: 3, left: setting.enabled ? 22 : 3, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
      </button>
    </div>
  );
}

/**
 * PlayerDropdown — loads all profiles from Supabase, lets the GM pick one.
 * Excludes already-invited players from the list.
 */
function PlayerDropdown({ invitedIds, onAdd }: { invitedIds: Set<string>; onAdd: (profile: Profile) => void }) {
  const supabase = createClient();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string>("");

  useEffect(() => {
    async function fetchProfiles() {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, avatar_url")
        .order("username");

      if (!error && data) setProfiles(data as Profile[]);
      setLoading(false);
    }
    fetchProfiles();
  }, []);

  const available = profiles.filter((p) => !invitedIds.has(p.id));

  const handleAdd = () => {
    const profile = available.find((p) => p.id === selectedId);
    if (!profile) return;
    onAdd(profile);
    setSelectedId("");
  };

  return (
    <div style={{ display: "flex", gap: "0.5rem" }}>
      <select
        value={selectedId}
        onChange={(e) => setSelectedId(e.target.value)}
        style={{ ...inputStyle, flex: 1 }}
        disabled={loading}
      >
        <option value="">{loading ? "Loading players..." : "Select a player..."}</option>
        {available.map((p) => (
          <option key={p.id} value={p.id}>{p.username}</option>
        ))}
      </select>
      <button onClick={handleAdd} disabled={!selectedId} style={primaryBtnStyle}>
        Invite
      </button>
    </div>
  );
}

function InvitedPlayerRow({ player, onRemove }: { player: Profile; onRemove: (id: string) => void }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.65rem 1rem", background: "#0f0f0f", border: "1px solid #1e1e1e", borderRadius: 4, marginBottom: "0.5rem" }}>
      <span style={{ color: "#ccc" }}>{player.username}</span>
      <button onClick={() => onRemove(player.id)} style={{ ...ghostBtnStyle, color: "#e05555" }}>
        Remove
      </button>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NewGamePage() {
  const router = useRouter();
  const supabase = createClient();
  const [form, setForm] = useState<NewGameFormState>(INITIAL_FORM);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const updateStat = (key: keyof NewGameFormState, val: number) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  const toggleSetting = (id: string) =>
    setForm((prev) => ({ ...prev, settings: prev.settings.map((s) => s.id === id ? { ...s, enabled: !s.enabled } : s) }));

  const toggleBackground = (bg: string) =>
    setForm((prev) => ({
      ...prev,
      allowedBackgrounds: prev.allowedBackgrounds.includes(bg)
        ? prev.allowedBackgrounds.filter((b) => b !== bg)
        : [...prev.allowedBackgrounds, bg],
    }));

  const addPlayer = (profile: Profile) => {
    if (form.invitedPlayers.find((p) => p.id === profile.id)) return;
    setForm((prev) => ({ ...prev, invitedPlayers: [...prev.invitedPlayers, profile] }));
  };

  const removePlayer = (id: string) =>
    setForm((prev) => ({ ...prev, invitedPlayers: prev.invitedPlayers.filter((p) => p.id !== id) }));

  const handleCreate = async () => {
    setError(null);

    if (!form.name.trim()) {
      setError("Game name is required.");
      return;
    }

    setIsCreating(true);
    try {
      // 1. Get the current user (the GM)
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error("You must be logged in to create a game.");

      // 2. Fetch the GM's profile so we can populate gm_profile_id
      const { data: gmProfile, error: profileError } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", user.id) // assumes profiles.id === auth.users.id
        .single();
      if (profileError) throw new Error("Could not find your profile.");

      // 3. Insert the game row
      const { data: game, error: gameError } = await supabase
        .from("games")
        .insert({
          gm_id: user.id,
          gm_profile_id: gmProfile.id,
          name: form.name.trim(),
          join_code: generateJoinCode(),
          is_private: form.is_private,
          archived: false,
          session_number: 0,
          is_in_session: false,
          is_in_combat: false,
          current_turn_order: [],
          active_turn_index: 0,
          combat_log: [],
        })
        .select()
        .single();

      if (gameError || !game) throw new Error(gameError?.message ?? "Failed to create game.");

      // 4. Insert the GM as a game_member with role="gm"
      const { error: gmMemberError } = await supabase
        .from("game_members")
        .insert({
          game_id: game.id,
          profile_id: gmProfile.id,
          character_id: null,
          role: "gm",
          member_status: "active",
        });

      if (gmMemberError) throw new Error(gmMemberError.message);

      // 5. Insert each invited player as a game_member with status="invited"
      if (form.invitedPlayers.length > 0) {
        const invites = form.invitedPlayers.map((p) => ({
          game_id: game.id,
          profile_id: p.id,
          character_id: null,
          role: "player" as const,
          member_status: "invited" as const,
        }));

        const { error: inviteError } = await supabase.from("game_members").insert(invites);
        if (inviteError) throw new Error(inviteError.message);
      }

      router.push(`/game/${game.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setIsCreating(false);
    }
  };

  const invitedIds = new Set(form.invitedPlayers.map((p) => p.id));

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#e8e8e8", fontFamily: "monospace" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "1.5rem", padding: "1.25rem 2rem", borderBottom: "1px solid #1a1a1a" }}>
        <a href="/" style={{ color: "#666", textDecoration: "none", fontSize: "0.85rem" }}>← Back</a>
        <span style={{ color: "#333" }}>|</span>
        <h1 style={{ fontSize: "1.1rem", fontWeight: 400, letterSpacing: "0.05em" }}>New Game</h1>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "2rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem" }}>

          {/* ── Left Column ─────────────────────────────────────────── */}
          <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>

            {/* Game Details */}
            <div>
              <SectionHeader>Game Details</SectionHeader>
              <Card style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div>
                  <label style={labelStyle}>Game Name</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                    placeholder="e.g. The Ember Road"
                    style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }}
                  />
                </div>

                {/* Visibility toggle */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ color: "#e8e8e8", fontSize: "0.9rem", marginBottom: 2 }}>Private Game</div>
                    <div style={{ color: "#555", fontSize: "0.75rem" }}>Only invited players can find this game.</div>
                  </div>
                  <button
                    onClick={() => setForm((p) => ({ ...p, is_private: !p.is_private }))}
                    style={{ width: 42, height: 22, borderRadius: 11, border: "none", background: form.is_private ? "#22c55e" : "#333", cursor: "pointer", position: "relative", flexShrink: 0, marginLeft: "1.5rem", transition: "background 0.2s" }}
                  >
                    <span style={{ position: "absolute", top: 3, left: form.is_private ? 22 : 3, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
                  </button>
                </div>
              </Card>
            </div>
          </div>

          {/* ── Right Column ─────────────────────────────────────────── */}
          <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
            {/* Invite Players */}
            <div>
              <SectionHeader>Invite Players</SectionHeader>
              <Card>
                <PlayerDropdown invitedIds={invitedIds} onAdd={addPlayer} />
                {form.invitedPlayers.length > 0 ? (
                  <div style={{ marginTop: "1rem" }}>
                    <div style={{ fontSize: "0.7rem", color: "#555", letterSpacing: "0.08em", marginBottom: "0.5rem" }}>
                      {form.invitedPlayers.length} player{form.invitedPlayers.length !== 1 ? "s" : ""} invited
                    </div>
                    {form.invitedPlayers.map((p) => (
                      <InvitedPlayerRow key={p.id} player={p} onRemove={removePlayer} />
                    ))}
                  </div>
                ) : (
                  <p style={{ color: "#444", fontSize: "0.8rem", marginTop: "0.75rem" }}>
                    No players invited yet. Select a player above to invite them.
                  </p>
                )}
              </Card>
            </div>

            {/* Error message */}
            {error && (
              <div style={{ background: "#1a0a0a", border: "1px solid #5a1a1a", borderRadius: 4, padding: "0.75rem 1rem", color: "#e05555", fontSize: "0.8rem" }}>
                {error}
              </div>
            )}

            {/* Create button */}
            <button
              onClick={handleCreate}
              disabled={isCreating}
              style={{ width: "100%", padding: "0.9rem", background: "transparent", border: "1px solid #555", borderRadius: 4, color: isCreating ? "#555" : "#ddd", fontSize: "0.8rem", letterSpacing: "0.15em", textTransform: "uppercase", cursor: isCreating ? "not-allowed" : "pointer" }}
            >
              {isCreating ? "Creating..." : "Create Game"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  display: "block", fontSize: "0.65rem", letterSpacing: "0.1em", color: "#666",
  textTransform: "uppercase", marginBottom: "0.4rem",
};

const inputStyle: React.CSSProperties = {
  flex: 1, background: "#0a0a0a", border: "1px solid #2a2a2a", borderRadius: 4,
  padding: "0.6rem 0.85rem", color: "#ddd", fontSize: "0.875rem", outline: "none",
};

const primaryBtnStyle: React.CSSProperties = {
  background: "transparent", border: "1px solid #444", borderRadius: 4,
  padding: "0.6rem 1.25rem", color: "#ccc", fontSize: "0.8rem",
  letterSpacing: "0.08em", cursor: "pointer", textTransform: "uppercase",
};

const ghostBtnStyle: React.CSSProperties = {
  background: "transparent", border: "1px solid #333", borderRadius: 4,
  padding: "0.3rem 0.75rem", color: "#888", fontSize: "0.75rem",
  letterSpacing: "0.06em", cursor: "pointer",
};

const iconBtnStyle: React.CSSProperties = {
  background: "transparent", border: "1px solid #333", borderRadius: 4,
  color: "#888", width: 28, height: 28, cursor: "pointer", fontSize: "1rem",
  display: "flex", alignItems: "center", justifyContent: "center",
};