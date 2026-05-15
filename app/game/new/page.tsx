"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlayerSearchResult {
  id: string;
  username: string;
  avatarUrl?: string;
}

interface GameSetting {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
}

interface NewGameFormState {
  name: string;
  description: string;
  maxPlayers: number;
  startingEssence: number;
  startingPower: number;
  startingWill: number;
  startingHealth: number;
  startingDenarius: number;
  allowedBackgrounds: string[];
  settings: GameSetting[];
  invitedPlayers: PlayerSearchResult[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const router = useRouter();

const BACKGROUNDS = [
  "Baker",
  "Soldier",
  "Merchant",
  "Scholar",
  "Thief",
  "Priest",
  "Farmer",
  "Noble",
  "Sailor",
  "Hunter",
];

const DEFAULT_SETTINGS: GameSetting[] = [
  {
    id: "permadeath",
    label: "Permadeath",
    description: "Characters that reach 0 Health are permanently removed.",
    enabled: false,
  },
  {
    id: "fog_of_war",
    label: "Fog of War",
    description: "Players only see what their character can perceive.",
    enabled: true,
  },
  {
    id: "shared_inventory",
    label: "Shared Party Inventory",
    description: "All players share a common item pool.",
    enabled: false,
  },
  {
    id: "open_skill_tree",
    label: "Open Skill Tree",
    description: "All skill tree paths are visible from the start.",
    enabled: true,
  },
  {
    id: "pvp",
    label: "Player vs Player",
    description: "Players may attack one another.",
    enabled: false,
  },
  {
    id: "auto_level",
    label: "Auto Level NPCs",
    description: "NPC difficulty scales with average party level.",
    enabled: true,
  },
];

const INITIAL_FORM: NewGameFormState = {
  name: "",
  description: "",
  maxPlayers: 4,
  startingEssence: 10,
  startingPower: 10,
  startingWill: 10,
  startingHealth: 10,
  startingDenarius: 12,
  allowedBackgrounds: [...BACKGROUNDS],
  settings: DEFAULT_SETTINGS,
  invitedPlayers: [],
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        fontSize: "0.7rem",
        letterSpacing: "0.15em",
        color: "#888",
        textTransform: "uppercase",
        marginBottom: "1rem",
        fontWeight: 400,
      }}
    >
      {children}
    </h2>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        background: "#111",
        border: "1px solid #222",
        borderRadius: 4,
        padding: "1.5rem",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function StatInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (val: number) => void;
}) {
  return (
    <Card style={{ textAlign: "center", flex: 1 }}>
      <div
        style={{
          fontSize: "0.65rem",
          letterSpacing: "0.12em",
          color: "#888",
          textTransform: "uppercase",
          marginBottom: "0.75rem",
        }}
      >
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "1rem" }}>
        <button
          onClick={() => onChange(Math.max(1, value - 1))}
          style={iconBtnStyle}
        >
          −
        </button>
        <span style={{ fontSize: "2rem", fontWeight: 300, color: "#fff", minWidth: 40 }}>
          {value}
        </span>
        <button
          onClick={() => onChange(value + 1)}
          style={iconBtnStyle}
        >
          +
        </button>
      </div>
    </Card>
  );
}

function ToggleSetting({
  setting,
  onToggle,
}: {
  setting: GameSetting;
  onToggle: (id: string) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "0.85rem 0",
        borderBottom: "1px solid #1a1a1a",
      }}
    >
      <div>
        <div style={{ color: "#e8e8e8", fontSize: "0.9rem", marginBottom: 2 }}>{setting.label}</div>
        <div style={{ color: "#555", fontSize: "0.75rem" }}>{setting.description}</div>
      </div>
      <button
        onClick={() => onToggle(setting.id)}
        style={{
          width: 42,
          height: 22,
          borderRadius: 11,
          border: "none",
          background: setting.enabled ? "#22c55e" : "#333",
          cursor: "pointer",
          position: "relative",
          flexShrink: 0,
          marginLeft: "1.5rem",
          transition: "background 0.2s",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 3,
            left: setting.enabled ? 22 : 3,
            width: 16,
            height: 16,
            borderRadius: "50%",
            background: "#fff",
            transition: "left 0.2s",
          }}
        />
      </button>
    </div>
  );
}

function PlayerSearchBar({
  onAdd,
}: {
  onAdd: (player: PlayerSearchResult) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlayerSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setIsSearching(true);
    // TODO: replace with real API call
    // const data = await searchUsers(query);
    // setResults(data);
    setIsSearching(false);
  };

  return (
    <div>
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem" }}>
        <input
          type="text"
          placeholder="Search by username..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          style={inputStyle}
        />
        <button onClick={handleSearch} style={primaryBtnStyle} disabled={isSearching}>
          {isSearching ? "..." : "Search"}
        </button>
      </div>

      {/* Search results dropdown */}
      {results.length > 0 && (
        <div style={{ background: "#0a0a0a", border: "1px solid #222", borderRadius: 4 }}>
          {results.map((player) => (
            <div
              key={player.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "0.65rem 1rem",
                borderBottom: "1px solid #1a1a1a",
              }}
            >
              <span style={{ color: "#ccc" }}>{player.username}</span>
              <button onClick={() => onAdd(player)} style={ghostBtnStyle}>
                Add
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function InvitedPlayerRow({
  player,
  onRemove,
}: {
  player: PlayerSearchResult;
  onRemove: (id: string) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "0.65rem 1rem",
        background: "#0f0f0f",
        border: "1px solid #1e1e1e",
        borderRadius: 4,
        marginBottom: "0.5rem",
      }}
    >
      <span style={{ color: "#ccc" }}>{player.username}</span>
      <button onClick={() => onRemove(player.id)} style={{ ...ghostBtnStyle, color: "#e05555" }}>
        Remove
      </button>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  flex: 1,
  background: "#0a0a0a",
  border: "1px solid #2a2a2a",
  borderRadius: 4,
  padding: "0.6rem 0.85rem",
  color: "#ddd",
  fontSize: "0.875rem",
  outline: "none",
};

const primaryBtnStyle: React.CSSProperties = {
  background: "transparent",
  border: "1px solid #444",
  borderRadius: 4,
  padding: "0.6rem 1.25rem",
  color: "#ccc",
  fontSize: "0.8rem",
  letterSpacing: "0.08em",
  cursor: "pointer",
  textTransform: "uppercase",
};

const ghostBtnStyle: React.CSSProperties = {
  background: "transparent",
  border: "1px solid #333",
  borderRadius: 4,
  padding: "0.3rem 0.75rem",
  color: "#888",
  fontSize: "0.75rem",
  letterSpacing: "0.06em",
  cursor: "pointer",
};

const iconBtnStyle: React.CSSProperties = {
  background: "transparent",
  border: "1px solid #333",
  borderRadius: 4,
  color: "#888",
  width: 28,
  height: 28,
  cursor: "pointer",
  fontSize: "1rem",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NewGamePage() {
  const [form, setForm] = useState<NewGameFormState>(INITIAL_FORM);

  const updateStat = (key: keyof NewGameFormState, val: number) => {
    setForm((prev) => ({ ...prev, [key]: val }));
  };

  const toggleSetting = (id: string) => {
    setForm((prev) => ({
      ...prev,
      settings: prev.settings.map((s) =>
        s.id === id ? { ...s, enabled: !s.enabled } : s
      ),
    }));
  };

  const toggleBackground = (bg: string) => {
    setForm((prev) => ({
      ...prev,
      allowedBackgrounds: prev.allowedBackgrounds.includes(bg)
        ? prev.allowedBackgrounds.filter((b) => b !== bg)
        : [...prev.allowedBackgrounds, bg],
    }));
  };

  const addPlayer = (player: PlayerSearchResult) => {
    if (form.invitedPlayers.find((p) => p.id === player.id)) return;
    setForm((prev) => ({ ...prev, invitedPlayers: [...prev.invitedPlayers, player] }));
  };

  const removePlayer = (id: string) => {
    setForm((prev) => ({
      ...prev,
      invitedPlayers: prev.invitedPlayers.filter((p) => p.id !== id),
    }));
  };

  const handleCreate = async () => {
    // TODO: validate form
    const newGame = await createGame(form);
    router.push(`/game/${newGame.id}`);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0a0a0a",
        color: "#e8e8e8",
        fontFamily: "monospace",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "1.5rem",
          padding: "1.25rem 2rem",
          borderBottom: "1px solid #1a1a1a",
        }}
      >
        <a href="/" style={{ color: "#666", textDecoration: "none", fontSize: "0.85rem" }}>
          ← Back
        </a>
        <span style={{ color: "#333" }}>|</span>
        <h1 style={{ fontSize: "1.1rem", fontWeight: 400, letterSpacing: "0.05em" }}>
          New Game
        </h1>
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
                <div>
                  <label style={labelStyle}>Description</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                    placeholder="Brief description of the campaign..."
                    rows={3}
                    style={{
                      ...inputStyle,
                      width: "100%",
                      boxSizing: "border-box",
                      resize: "vertical",
                    }}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Max Players</label>
                  <input
                    type="number"
                    min={1}
                    max={8}
                    value={form.maxPlayers}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, maxPlayers: Number(e.target.value) }))
                    }
                    style={{ ...inputStyle, width: 80 }}
                  />
                </div>
              </Card>
            </div>

            {/* Starting Stats */}
            <div>
              <SectionHeader>Starting Stats</SectionHeader>
              <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                <StatInput
                  label="Essence"
                  value={form.startingEssence}
                  onChange={(v) => updateStat("startingEssence", v)}
                />
                <StatInput
                  label="Power"
                  value={form.startingPower}
                  onChange={(v) => updateStat("startingPower", v)}
                />
                <StatInput
                  label="Will"
                  value={form.startingWill}
                  onChange={(v) => updateStat("startingWill", v)}
                />
                <StatInput
                  label="Health"
                  value={form.startingHealth}
                  onChange={(v) => updateStat("startingHealth", v)}
                />
              </div>
              <Card style={{ marginTop: "0.75rem" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span
                    style={{
                      fontSize: "0.65rem",
                      letterSpacing: "0.12em",
                      color: "#888",
                      textTransform: "uppercase",
                    }}
                  >
                    Starting Denarius
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <button
                      onClick={() => updateStat("startingDenarius", Math.max(0, form.startingDenarius - 1))}
                      style={iconBtnStyle}
                    >
                      −
                    </button>
                    <span style={{ color: "#fff", minWidth: 30, textAlign: "center" }}>
                      {form.startingDenarius}
                    </span>
                    <button
                      onClick={() => updateStat("startingDenarius", form.startingDenarius + 1)}
                      style={iconBtnStyle}
                    >
                      +
                    </button>
                  </div>
                </div>
              </Card>
            </div>

            {/* Allowed Backgrounds */}
            <div>
              <SectionHeader>Allowed Backgrounds</SectionHeader>
              <Card>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                  {BACKGROUNDS.map((bg) => {
                    const active = form.allowedBackgrounds.includes(bg);
                    return (
                      <button
                        key={bg}
                        onClick={() => toggleBackground(bg)}
                        style={{
                          background: active ? "#1a1a1a" : "transparent",
                          border: `1px solid ${active ? "#444" : "#222"}`,
                          borderRadius: 4,
                          padding: "0.35rem 0.85rem",
                          color: active ? "#ccc" : "#444",
                          fontSize: "0.78rem",
                          letterSpacing: "0.06em",
                          cursor: "pointer",
                          transition: "all 0.15s",
                        }}
                      >
                        {bg}
                      </button>
                    );
                  })}
                </div>
              </Card>
            </div>
          </div>

          {/* ── Right Column ─────────────────────────────────────────── */}
          <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>

            {/* Game Settings */}
            <div>
              <SectionHeader>Game Settings</SectionHeader>
              <Card>
                {form.settings.map((setting) => (
                  <ToggleSetting
                    key={setting.id}
                    setting={setting}
                    onToggle={toggleSetting}
                  />
                ))}
              </Card>
            </div>

            {/* Invite Players */}
            <div>
              <SectionHeader>Invite Players</SectionHeader>
              <Card>
                <PlayerSearchBar onAdd={addPlayer} />
                {form.invitedPlayers.length > 0 && (
                  <div style={{ marginTop: "1rem" }}>
                    <div
                      style={{
                        fontSize: "0.7rem",
                        color: "#555",
                        letterSpacing: "0.08em",
                        marginBottom: "0.5rem",
                      }}
                    >
                      {form.invitedPlayers.length} player
                      {form.invitedPlayers.length !== 1 ? "s" : ""} invited
                    </div>
                    {form.invitedPlayers.map((p) => (
                      <InvitedPlayerRow key={p.id} player={p} onRemove={removePlayer} />
                    ))}
                  </div>
                )}
                {form.invitedPlayers.length === 0 && (
                  <p style={{ color: "#444", fontSize: "0.8rem", marginTop: "0.75rem" }}>
                    No players invited yet. Search above to add players to your game.
                  </p>
                )}
              </Card>
            </div>

            {/* Create button */}
            <button
              onClick={handleCreate}
              style={{
                width: "100%",
                padding: "0.9rem",
                background: "transparent",
                border: "1px solid #555",
                borderRadius: 4,
                color: "#ddd",
                fontSize: "0.8rem",
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                cursor: "pointer",
              }}
            >
              Create Game
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.65rem",
  letterSpacing: "0.1em",
  color: "#666",
  textTransform: "uppercase",
  marginBottom: "0.4rem",
};
