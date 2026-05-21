"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Profile {
  id: string;
  username: string;
  avatar_url?: string;
}

interface GameSetting {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
}

interface NewGameFormState {
  name: string;
  is_private: boolean;
  startingLevel: number;
  startingEssence: number;
  startingPower: number;
  startingWill: number;
  startingHealth: number;
  startingDenarius: number;
  allowedBackgrounds: string[];
  settings: GameSetting[];
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
  startingLevel: 0,
  startingEssence: 10,
  startingPower: 10,
  startingWill: 10,
  startingHealth: 10,
  startingDenarius: 12,
  allowedBackgrounds: [...BACKGROUNDS],
  settings: DEFAULT_SETTINGS,
  invitedPlayers: [],
};

function generateJoinCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    /* Analytical label uses your theme's sans font */
    <h2 style={{ fontFamily: "var(--font-sans)", fontSize: "0.8rem", letterSpacing: "0.15em", color: "var(--color-muted-foreground)", textTransform: "uppercase", marginBottom: "1rem", fontWeight: 600 }}>
      {children}
    </h2>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", padding: "1.5rem", ...style }}>
      {children}
    </div>
  );
}

function StatInput({ label, value, onChange, min = 1 }: { label: string; value: number; onChange: (val: number) => void; min?: number }) {
  return (
    <Card style={{ textAlign: "center", flex: 1 }}>
      <div style={{ fontFamily: "var(--font-sans)", fontSize: "0.75rem", letterSpacing: "0.12em", color: "var(--color-muted-foreground)", textTransform: "uppercase", marginBottom: "0.75rem" }}>
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "1rem" }}>
        <button onClick={() => onChange(Math.max(min, value - 1))} style={iconBtnStyle}>−</button>
        <span style={{ fontFamily: "var(--font-sans)", fontSize: "2rem", fontWeight: 300, color: "var(--color-foreground)", minWidth: 40 }}>{value}</span>
        <button onClick={() => onChange(value + 1)} style={iconBtnStyle}>+</button>
      </div>
    </Card>
  );
}

function ToggleSetting({ setting, onToggle }: { setting: GameSetting; onToggle: (id: string) => void }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.85rem 0", borderBottom: "1px solid var(--color-border)" }}>
      <div>
        {/* Setting Titles stand out as UI metadata -> Analytical Sans */}
        <div style={{ fontFamily: "var(--font-sans)", color: "var(--color-foreground)", fontSize: "0.95rem", fontWeight: 500, marginBottom: 2 }}>{setting.label}</div>
        {/* Setting Rules/Descriptions setup context -> Narrative Serif */}
        <div style={{ fontFamily: "var(--font-serif)", color: "var(--color-muted-foreground)", fontSize: "0.85rem", fontStyle: "italic" }}>{setting.description}</div>
      </div>
      <button
        onClick={() => onToggle(setting.id)}
        style={{ width: 42, height: 22, borderRadius: 11, border: "none", background: setting.enabled ? "var(--color-primary)" : "var(--color-muted)", cursor: "pointer", position: "relative", flexShrink: 0, marginLeft: "1.5rem", transition: "background 0.2s" }}
      >
        <span style={{ position: "absolute", top: 3, left: setting.enabled ? 22 : 3, width: 16, height: 16, borderRadius: "50%", background: "var(--color-background)", transition: "left 0.2s" }} />
      </button>
    </div>
  );
}

function PlayerDropdown({ invitedIds, onAdd }: { invitedIds: Set<string>; onAdd: (profile: Profile) => void }) {
  const supabase = createClient();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string>("");

  useEffect(() => {
    async function fetchFriendProfiles() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data: friendRows } = await (supabase as any)
        .from("friends")
        .select("friend_1, friend_2")
        .or(`friend_1.eq.${user.id},friend_2.eq.${user.id}`)
        .eq("status", "friend");

      const friendIds = (friendRows ?? []).map((row: { friend_1: string; friend_2: string }) =>
        row.friend_1 === user.id ? row.friend_2 : row.friend_1
      );

      if (friendIds.length > 0) {
        const { data } = await supabase
          .from("profiles")
          .select("id, username, avatar_url")
          .in("id", friendIds)
          .order("username");
        if (data) setProfiles(data as Profile[]);
      }
      setLoading(false);
    }
    fetchFriendProfiles();
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
        <option value="">{loading ? "Loading friends..." : available.length === 0 ? "No friends to invite" : "Select a friend..."}</option>
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
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.65rem 1rem", background: "var(--color-background)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", marginBottom: "0.5rem" }}>
      <span style={{ fontFamily: "var(--font-sans)", color: "var(--color-foreground)" }}>{player.username}</span>
      <button onClick={() => onRemove(player.id)} style={{ ...ghostBtnStyle, color: "var(--color-destructive)" }}>
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

  const toggleSetting = (id: string) =>
    setForm((prev) => ({ ...prev, settings: prev.settings.map((s) => s.id === id ? { ...s, enabled: !s.enabled } : s) }));

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
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error("You must be logged in to create a game.");

      const { data: gmProfile, error: profileError } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .single();
      if (profileError) throw new Error("Could not find your profile.");

      const { data: game, error: gameError } = await supabase
        .from("games")
        .insert({
          gm_id: user.id,
          gm_profile_id: gmProfile.id,
          name: form.name.trim(),
          join_code: generateJoinCode(),
          is_private: form.is_private,
          starting_level: form.startingLevel,
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
    <div style={{ minHeight: "100vh", background: "var(--color-background)", color: "var(--color-foreground)", fontFamily: "var(--font-sans)" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "1.5rem", padding: "1.25rem 2rem", borderBottom: "1px solid var(--color-border)" }}>
        <a href="/" style={{ color: "var(--color-muted-foreground)", textDecoration: "none", fontSize: "0.85rem" }}>← Back</a>
        <span style={{ color: "var(--color-border)" }}>|</span>
        {/* Campaign Title -> Narrative Serif */}
        <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "1.4rem", fontWeight: 400, letterSpacing: "0.02em" }}>New Game</h1>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "2rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem" }}>

          {/* Left Column */}
          <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
            <div>
              <SectionHeader>Game Details</SectionHeader>
              <Card style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div>
                  <label style={labelStyle}>Game Name</label>
                  {/* Campaign title configuration -> Narrative Serif */}
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                    placeholder="e.g. The Ember Road"
                    style={{ ...inputStyle, fontFamily: "var(--font-serif)", fontSize: "1rem" }}
                  />
                </div>

                {/* Visibility toggle */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ color: "var(--color-foreground)", fontSize: "0.95rem", marginBottom: 2 }}>Private Game</div>
                    <div style={{ fontFamily: "var(--font-serif)", color: "var(--color-muted-foreground)", fontSize: "0.85rem", fontStyle: "italic" }}>
                      Only invited players can find this game.
                    </div>
                  </div>
                  <button
                    onClick={() => setForm((p) => ({ ...p, is_private: !p.is_private }))}
                    style={{ width: 42, height: 22, borderRadius: 11, border: "none", background: form.is_private ? "var(--color-primary)" : "var(--color-muted)", cursor: "pointer", position: "relative", flexShrink: 0, marginLeft: "1.5rem", transition: "background 0.2s" }}
                  >
                    <span style={{ position: "absolute", top: 3, left: form.is_private ? 22 : 3, width: 16, height: 16, borderRadius: "50%", background: "var(--color-background)", transition: "left 0.2s" }} />
                  </button>
                </div>
              </Card>
            </div>

            <div>
              <SectionHeader>Starting Level</SectionHeader>
              <StatInput
                label="Skill Points on Join"
                value={form.startingLevel}
                onChange={(val) => setForm((p) => ({ ...p, startingLevel: val }))}
                min={0}
              />
              <p style={{ fontFamily: "var(--font-serif)", color: "var(--color-muted-foreground)", fontSize: "0.8rem", fontStyle: "italic", marginTop: "0.75rem" }}>
                Each player who joins will receive this many skill points to spend.
              </p>
            </div>
          </div>

          {/* Right Column */}
          <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
            <div>
              <SectionHeader>Invite Players</SectionHeader>
              <Card>
                <PlayerDropdown invitedIds={invitedIds} onAdd={addPlayer} />
                {form.invitedPlayers.length > 0 ? (
                  <div style={{ marginTop: "1rem" }}>
                    <div style={{ fontSize: "0.75rem", color: "var(--color-muted-foreground)", letterSpacing: "0.08em", marginBottom: "0.5rem" }}>
                      {form.invitedPlayers.length} player{form.invitedPlayers.length !== 1 ? "s" : ""} invited
                    </div>
                    {form.invitedPlayers.map((p) => (
                      <InvitedPlayerRow key={p.id} player={p} onRemove={removePlayer} />
                    ))}
                  </div>
                ) : (
                  <p style={{ fontFamily: "var(--font-serif)", color: "var(--color-muted-foreground)", fontSize: "0.9rem", fontStyle: "italic", marginTop: "0.75rem" }}>
                    No players invited yet. Select a player above to invite them.
                  </p>
                )}
              </Card>
            </div>

            {error && (
              <div style={{ background: "var(--color-destructive)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", padding: "0.75rem 1rem", color: "var(--color-destructive-foreground)", fontSize: "0.85rem" }}>
                {error}
              </div>
            )}

            <button
              onClick={handleCreate}
              disabled={isCreating}
              style={{ ...primaryBtnStyle, width: "100%", padding: "0.9rem", color: isCreating ? "var(--color-muted-foreground)" : "var(--color-foreground)", fontSize: "0.85rem", letterSpacing: "0.15em" }}
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
  display: "block", fontFamily: "var(--font-sans)", fontSize: "0.75rem", letterSpacing: "0.1em", color: "var(--color-muted-foreground)",
  textTransform: "uppercase", marginBottom: "0.4rem", fontWeight: 600
};

const inputStyle: React.CSSProperties = {
  fontFamily: "var(--font-sans)", flex: 1, background: "var(--color-background)", border: "1px solid var(--color-input)", borderRadius: "var(--radius-sm)",
  padding: "0.6rem 0.85rem", color: "var(--color-foreground)", fontSize: "0.875rem", outline: "none",
};

const primaryBtnStyle: React.CSSProperties = {
  fontFamily: "var(--font-sans)", background: "transparent", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)",
  padding: "0.6rem 1.25rem", color: "var(--color-foreground)", fontSize: "0.8rem",
  letterSpacing: "0.08em", cursor: "pointer", textTransform: "uppercase", fontWeight: 600
};

const ghostBtnStyle: React.CSSProperties = {
  fontFamily: "var(--font-sans)", background: "transparent", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)",
  padding: "0.3rem 0.75rem", color: "var(--color-muted-foreground)", fontSize: "0.75rem",
  letterSpacing: "0.06em", cursor: "pointer",
};

const iconBtnStyle: React.CSSProperties = {
  background: "transparent", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)",
  color: "var(--color-muted-foreground)", width: 28, height: 28, cursor: "pointer", fontSize: "1rem",
  display: "flex", alignItems: "center", justifyContent: "center",
};