"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Stat {
  current: number;
  max: number;
}

interface InventoryItem {
  id: string;
  name: string;
  type: "weapon" | "armor" | "consumable" | "misc";
  quantity: number;
  description: string;
}

interface PlayerCharacter {
  id: string;
  userId: string;
  username: string;
  name: string;
  status: "active" | "inactive" | "dead";
  background: string;
  essence: Stat;
  power: Stat;
  will: Stat;
  health: Stat;
  denarius: number;
  speed: number;
  inventory: InventoryItem[];
  backstory: string;
  physicalDescription: string;
  activeSkills: string[];
}

interface GameLog {
  id: string;
  timestamp: string;
  type: "system" | "combat" | "item" | "player";
  message: string;
}

interface GameState {
  id: string;
  name: string;
  status: "active" | "paused" | "ended";
  players: PlayerCharacter[];
  logs: GameLog[];
  round: number;
  session: number;
}

type ActivePanel = "characters" | "items" | "logs" | "settings";
type SelectedCharacterId = string | null;

// ─── Mock Data ────────────────────────────────────────────────────────────────
// TODO: replace with real data fetching via useEffect / server component

const router = useRouter();

const MOCK_GAME: GameState = {
  id: "291f4712-6aed-475a-a97e-3b8f893cc3a9",
  name: "The Ember Road",
  status: "active",
  round: 14,
  session: 3,
  logs: [
    {
      id: "l1",
      timestamp: "10:42",
      type: "combat",
      message: "Carl the Unwise attacked Goblin Scout with Boar Spear for 6 damage.",
    },
    {
      id: "l2",
      timestamp: "10:40",
      type: "item",
      message: 'GM granted "Health Potion" to Mira Ashfen.',
    },
    {
      id: "l3",
      timestamp: "10:38",
      type: "system",
      message: "Session 3 started.",
    },
    {
      id: "l4",
      timestamp: "10:35",
      type: "player",
      message: "Katabatak joined the session.",
    },
  ],
  players: [
    {
      id: "p1",
      userId: "u1",
      username: "Katabatak",
      name: "Carl the Unwise",
      status: "active",
      background: "Baker",
      essence: { current: 10, max: 10 },
      power: { current: 10, max: 10 },
      will: { current: 8, max: 10 },
      health: { current: 7, max: 10 },
      denarius: 12,
      speed: 14,
      physicalDescription:
        "Tall and stocky. Built like an inverted strawberry. Black hair, close cut and a quiet smile.",
      backstory:
        "I worked as a baker for a long while, training under my father until I was old enough to work with him.",
      activeSkills: ["Essence", "Arcane Conduit"],
      inventory: [
        {
          id: "i1",
          name: "Boar Spear",
          type: "weapon",
          quantity: 1,
          description: "A heavy thrusting spear designed for hunting.",
        },
        {
          id: "i2",
          name: "Boiled Leather Cuirass",
          type: "armor",
          quantity: 1,
          description: "A solid leather chest piece. Reliable protection without slowing you down.",
        },
      ],
    },
    {
      id: "p2",
      userId: "u2",
      username: "silverveil",
      name: "Mira Ashfen",
      status: "active",
      background: "Scholar",
      essence: { current: 9, max: 12 },
      power: { current: 6, max: 10 },
      will: { current: 12, max: 12 },
      health: { current: 10, max: 10 },
      denarius: 5,
      speed: 11,
      physicalDescription: "Slight frame, ink-stained fingers, and round spectacles.",
      backstory: "Spent years cataloguing ruins until she found something that looked back.",
      activeSkills: ["Will Focus", "Essence Sight"],
      inventory: [
        {
          id: "i3",
          name: "Grimoire of Minor Wards",
          type: "misc",
          quantity: 1,
          description: "A worn tome full of protective glyphs.",
        },
      ],
    },
    {
      id: "p3",
      userId: "u3",
      username: "ironbark",
      name: "Bres the Quiet",
      status: "inactive",
      background: "Hunter",
      essence: { current: 5, max: 8 },
      power: { current: 14, max: 14 },
      will: { current: 7, max: 10 },
      health: { current: 4, max: 12 },
      denarius: 22,
      speed: 16,
      physicalDescription: "Lean and scarred. Moves like he is always being followed.",
      backstory: "Doesn't talk about the north. Anyone who asks gets a stare that ends the question.",
      activeSkills: ["Power Surge"],
      inventory: [],
    },
  ],
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatBar({ stat, color = "#22c55e" }: { stat: Stat; color?: string }) {
  const pct = Math.max(0, Math.min(100, (stat.current / stat.max) * 100));
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
        fontSize: "0.75rem",
      }}
    >
      <div
        style={{
          flex: 1,
          height: 4,
          background: "#1a1a1a",
          borderRadius: 2,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: color,
            borderRadius: 2,
            transition: "width 0.3s",
          }}
        />
      </div>
      <span style={{ color: "#555", minWidth: 36, textAlign: "right" }}>
        {stat.current}/{stat.max}
      </span>
    </div>
  );
}

function StatusBadge({ status }: { status: PlayerCharacter["status"] }) {
  const map: Record<PlayerCharacter["status"], { label: string; color: string }> = {
    active: { label: "ACTIVE", color: "#22c55e" },
    inactive: { label: "AWAY", color: "#888" },
    dead: { label: "DEAD", color: "#e05555" },
  };
  const { label, color } = map[status];
  return (
    <span
      style={{
        fontSize: "0.6rem",
        letterSpacing: "0.1em",
        color,
        border: `1px solid ${color}`,
        borderRadius: 3,
        padding: "0.15rem 0.4rem",
      }}
    >
      {label}
    </span>
  );
}

function CharacterCard({
  character,
  selected,
  onClick,
}: {
  character: PlayerCharacter;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        background: selected ? "#141414" : "#0d0d0d",
        border: `1px solid ${selected ? "#333" : "#1a1a1a"}`,
        borderRadius: 4,
        padding: "1rem",
        cursor: "pointer",
        transition: "border-color 0.15s",
        marginBottom: "0.5rem",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "0.6rem",
        }}
      >
        <div>
          <div style={{ fontWeight: 500, color: "#e8e8e8", marginBottom: 2 }}>
            {character.name}
          </div>
          <div style={{ fontSize: "0.72rem", color: "#555" }}>
            {character.username} · {character.background}
          </div>
        </div>
        <StatusBadge status={character.status} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={statLabelStyle}>HP</span>
          <StatBar stat={character.health} color="#e05555" />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={statLabelStyle}>ES</span>
          <StatBar stat={character.essence} color="#3b82f6" />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={statLabelStyle}>WL</span>
          <StatBar stat={character.will} color="#a78bfa" />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={statLabelStyle}>PW</span>
          <StatBar stat={character.power} color="#f59e0b" />
        </div>
      </div>
    </div>
  );
}

function CharacterDetailPanel({ character }: { character: PlayerCharacter }) {
  const [addItemName, setAddItemName] = useState("");
  const [addItemType, setAddItemType] = useState<InventoryItem["type"]>("misc");

  const handleGrantItem = () => {
    // TODO: call grantItem(character.id, { name: addItemName, type: addItemType })
    setAddItemName("");
  };

  const handleRemoveItem = (itemId: string) => {
    // TODO: call removeItem(character.id, itemId)
  };

  const handleAdjustStat = (
    stat: "health" | "essence" | "power" | "will",
    delta: number
  ) => {
    // TODO: call adjustStat(character.id, stat, delta)
  };

  const handleKnockOut = () => {
    // TODO: call setCharacterStatus(character.id, "inactive")
  };

  const handleKill = () => {
    // TODO: call setCharacterStatus(character.id, "dead")
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

      {/* Identity */}
      <div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "0.75rem",
          }}
        >
          <div>
            <h2 style={{ fontSize: "1.2rem", fontWeight: 400, marginBottom: 2 }}>
              {character.name}
            </h2>
            <span style={{ color: "#555", fontSize: "0.8rem" }}>
              {character.username} · {character.background}
            </span>
          </div>
          <StatusBadge status={character.status} />
        </div>
        <p style={{ color: "#666", fontSize: "0.8rem", lineHeight: 1.5 }}>
          {character.physicalDescription}
        </p>
      </div>

      {/* Stats with GM controls */}
      <div>
        <SectionLabel>Stats</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {(
            [
              { key: "health", label: "Health", color: "#e05555" },
              { key: "essence", label: "Essence", color: "#3b82f6" },
              { key: "will", label: "Will", color: "#a78bfa" },
              { key: "power", label: "Power", color: "#f59e0b" },
            ] as const
          ).map(({ key, label, color }) => (
            <div key={key} style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <span style={{ ...statLabelStyle, minWidth: 52 }}>{label}</span>
              <div style={{ flex: 1 }}>
                <StatBar stat={character[key]} color={color} />
              </div>
              <button
                onClick={() => handleAdjustStat(key, -1)}
                style={tinyBtnStyle}
              >
                −
              </button>
              <button
                onClick={() => handleAdjustStat(key, 1)}
                style={tinyBtnStyle}
              >
                +
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Attributes */}
      <div>
        <SectionLabel>Attributes</SectionLabel>
        <div
          style={{
            background: "#0d0d0d",
            border: "1px solid #1a1a1a",
            borderRadius: 4,
            overflow: "hidden",
          }}
        >
          {[
            ["Speed", character.speed],
            ["Denarius", character.denarius],
          ].map(([label, val]) => (
            <div
              key={label}
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "0.6rem 1rem",
                borderBottom: "1px solid #161616",
              }}
            >
              <span style={{ color: "#888", fontSize: "0.82rem" }}>{label}</span>
              <span style={{ color: "#ddd", fontSize: "0.82rem" }}>{val}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Inventory */}
      <div>
        <SectionLabel>Inventory ({character.inventory.length})</SectionLabel>
        {character.inventory.length === 0 && (
          <p style={{ color: "#444", fontSize: "0.78rem" }}>No items.</p>
        )}
        {character.inventory.map((item) => (
          <div
            key={item.id}
            style={{
              background: "#0d0d0d",
              border: "1px solid #1a1a1a",
              borderRadius: 4,
              padding: "0.65rem 1rem",
              marginBottom: "0.4rem",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <div style={{ color: "#ccc", fontSize: "0.85rem" }}>{item.name}</div>
              <div style={{ color: "#444", fontSize: "0.72rem" }}>{item.description}</div>
            </div>
            <button
              onClick={() => handleRemoveItem(item.id)}
              style={{ ...tinyBtnStyle, color: "#e05555", borderColor: "#4a1a1a" }}
            >
              ✕
            </button>
          </div>
        ))}

        {/* Grant item form */}
        <div
          style={{
            marginTop: "0.75rem",
            display: "flex",
            gap: "0.5rem",
            alignItems: "center",
          }}
        >
          <input
            type="text"
            placeholder="Item name..."
            value={addItemName}
            onChange={(e) => setAddItemName(e.target.value)}
            style={{ ...inputStyle, flex: 1 }}
          />
          <select
            value={addItemType}
            onChange={(e) => setAddItemType(e.target.value as InventoryItem["type"])}
            style={{ ...inputStyle, width: "auto" }}
          >
            <option value="weapon">Weapon</option>
            <option value="armor">Armor</option>
            <option value="consumable">Consumable</option>
            <option value="misc">Misc</option>
          </select>
          <button onClick={handleGrantItem} style={ghostBtnStyle}>
            Grant
          </button>
        </div>
      </div>

      {/* Active Skills */}
      <div>
        <SectionLabel>Active Skills</SectionLabel>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
          {character.activeSkills.map((skill) => (
            <span
              key={skill}
              style={{
                background: "#0f1a1f",
                border: "1px solid #1a3040",
                color: "#5eadd4",
                fontSize: "0.72rem",
                padding: "0.25rem 0.65rem",
                borderRadius: 3,
              }}
            >
              {skill}
            </span>
          ))}
        </div>
      </div>

      {/* GM Actions */}
      <div>
        <SectionLabel>GM Actions</SectionLabel>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button style={ghostBtnStyle} onClick={() => { /* TODO: openNoteModal */ }}>
            Add Note
          </button>
          <button style={ghostBtnStyle} onClick={() => { /* TODO: sendMessage */ }}>
            Send Message
          </button>
          <button style={ghostBtnStyle} onClick={handleKnockOut}>
            Knock Out
          </button>
          <button
            style={{ ...ghostBtnStyle, color: "#e05555", borderColor: "#4a1a1a" }}
            onClick={handleKill}
          >
            Kill Character
          </button>
        </div>
      </div>
    </div>
  );
}

function GameLogPanel({ logs }: { logs: GameLog[] }) {
  const iconMap: Record<GameLog["type"], string> = {
    system: "⚙",
    combat: "⚔",
    item: "◈",
    player: "◉",
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {logs.map((log) => (
        <div
          key={log.id}
          style={{
            display: "flex",
            gap: "0.75rem",
            padding: "0.6rem 0",
            borderBottom: "1px solid #161616",
            fontSize: "0.8rem",
          }}
        >
          <span style={{ color: "#444", flexShrink: 0 }}>{log.timestamp}</span>
          <span style={{ color: "#333", flexShrink: 0 }}>{iconMap[log.type]}</span>
          <span style={{ color: "#888" }}>{log.message}</span>
        </div>
      ))}
    </div>
  );
}

function GameSettingsPanel({ game }: { game: GameState }) {
  const handlePause = () => {
    // TODO: call updateGameStatus(game.id, "paused")
  };
  const handleEnd = () => {
    // TODO: call updateGameStatus(game.id, "ended") with confirmation dialog
  };
  const handleKickPlayer = (playerId: string) => {
    // TODO: call kickPlayer(game.id, playerId) with confirmation
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div>
        <SectionLabel>Session Info</SectionLabel>
        <div style={{ background: "#0d0d0d", border: "1px solid #1a1a1a", borderRadius: 4 }}>
          {[
            ["Game ID", game.id],
            ["Status", game.status.toUpperCase()],
            ["Session", game.session],
            ["Round", game.round],
          ].map(([label, val]) => (
            <div
              key={label}
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "0.6rem 1rem",
                borderBottom: "1px solid #161616",
                fontSize: "0.82rem",
              }}
            >
              <span style={{ color: "#666" }}>{label}</span>
              <span style={{ color: "#aaa" }}>{val}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <SectionLabel>Players</SectionLabel>
        {game.players.map((p) => (
          <div
            key={p.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "0.6rem 0",
              borderBottom: "1px solid #161616",
            }}
          >
            <div>
              <span style={{ color: "#ccc", fontSize: "0.85rem" }}>{p.name}</span>
              <span style={{ color: "#444", fontSize: "0.75rem", marginLeft: "0.5rem" }}>
                ({p.username})
              </span>
            </div>
            <button
              onClick={() => handleKickPlayer(p.id)}
              style={{ ...tinyBtnStyle, color: "#e05555", borderColor: "#4a1a1a" }}
            >
              Kick
            </button>
          </div>
        ))}
      </div>

      <div>
        <SectionLabel>Danger Zone</SectionLabel>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button style={ghostBtnStyle} onClick={handlePause}>
            Pause Game
          </button>
          <button
            style={{ ...ghostBtnStyle, color: "#e05555", borderColor: "#4a1a1a" }}
            onClick={handleEnd}
          >
            End Game
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  background: "#0a0a0a",
  border: "1px solid #2a2a2a",
  borderRadius: 4,
  padding: "0.55rem 0.8rem",
  color: "#ddd",
  fontSize: "0.82rem",
  outline: "none",
};

const ghostBtnStyle: React.CSSProperties = {
  background: "transparent",
  border: "1px solid #333",
  borderRadius: 4,
  padding: "0.35rem 0.85rem",
  color: "#888",
  fontSize: "0.75rem",
  letterSpacing: "0.06em",
  cursor: "pointer",
};

const tinyBtnStyle: React.CSSProperties = {
  background: "transparent",
  border: "1px solid #2a2a2a",
  borderRadius: 3,
  color: "#666",
  width: 24,
  height: 24,
  cursor: "pointer",
  fontSize: "0.85rem",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

const statLabelStyle: React.CSSProperties = {
  fontSize: "0.62rem",
  letterSpacing: "0.1em",
  color: "#555",
  textTransform: "uppercase",
  minWidth: 20,
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: "0.65rem",
        letterSpacing: "0.12em",
        color: "#555",
        textTransform: "uppercase",
        marginBottom: "0.6rem",
      }}
    >
      {children}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function GameDashboardPage({
  params,
}: {
  params: { id: string };
}) {
  // TODO: replace with real data fetch
  // const game = await fetchGame(params.id);
  const game = MOCK_GAME;

  const [activePanel, setActivePanel] = useState<ActivePanel>("characters");
  const [selectedCharacterId, setSelectedCharacterId] = useState<SelectedCharacterId>(
    game.players[0]?.id ?? null
  );

  const selectedCharacter = game.players.find((p) => p.id === selectedCharacterId) ?? null;

  const navItems: { key: ActivePanel; label: string }[] = [
    { key: "characters", label: "Characters" },
    { key: "items", label: "Items" },
    { key: "logs", label: "Log" },
    { key: "settings", label: "Settings" },
  ];

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0a0a0a",
        color: "#e8e8e8",
        fontFamily: "monospace",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "1.25rem 2rem",
          borderBottom: "1px solid #1a1a1a",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
          <a href="/games" style={{ color: "#666", textDecoration: "none", fontSize: "0.85rem" }}>
            ← Back
          </a>
          <span style={{ color: "#222" }}>|</span>
          <h1 style={{ fontSize: "1.1rem", fontWeight: 400, letterSpacing: "0.05em" }}>
            {game.name}
          </h1>
          <span
            style={{
              fontSize: "0.6rem",
              letterSpacing: "0.1em",
              color: "#22c55e",
              border: "1px solid #22c55e",
              borderRadius: 3,
              padding: "0.15rem 0.5rem",
            }}
          >
            {game.status.toUpperCase()}
          </span>
        </div>
        <div style={{ display: "flex", gap: "1.5rem", fontSize: "0.75rem", color: "#555" }}>
          <span>Session {game.session}</span>
          <span>Round {game.round}</span>
          <span>{game.players.length} players</span>
        </div>
      </div>

      {/* Nav tabs */}
      <div
        style={{
          display: "flex",
          gap: 0,
          borderBottom: "1px solid #1a1a1a",
          flexShrink: 0,
        }}
      >
        {navItems.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActivePanel(key)}
            style={{
              background: "transparent",
              border: "none",
              borderBottom: activePanel === key ? "1px solid #666" : "1px solid transparent",
              padding: "0.75rem 1.5rem",
              color: activePanel === key ? "#ddd" : "#555",
              fontSize: "0.72rem",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              cursor: "pointer",
              marginBottom: -1,
              transition: "color 0.15s",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* Characters panel — always a split layout */}
        {activePanel === "characters" && (
          <>
            {/* Left: player list */}
            <div
              style={{
                width: 280,
                borderRight: "1px solid #1a1a1a",
                overflowY: "auto",
                padding: "1.25rem 1rem",
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  fontSize: "0.65rem",
                  letterSpacing: "0.12em",
                  color: "#555",
                  textTransform: "uppercase",
                  marginBottom: "0.75rem",
                }}
              >
                {game.players.length} Players
              </div>
              {game.players.map((character) => (
                <CharacterCard
                  key={character.id}
                  character={character}
                  selected={character.id === selectedCharacterId}
                  onClick={() => setSelectedCharacterId(character.id)}
                />
              ))}
            </div>

            {/* Right: detail panel */}
            <div style={{ flex: 1, overflowY: "auto", padding: "1.5rem 2rem" }}>
              {selectedCharacter ? (
                <CharacterDetailPanel character={selectedCharacter} />
              ) : (
                <p style={{ color: "#444" }}>Select a character to inspect.</p>
              )}
            </div>
          </>
        )}

        {/* Items panel */}
        {activePanel === "items" && (
          <div style={{ flex: 1, overflowY: "auto", padding: "1.5rem 2rem" }}>
            <div
              style={{
                fontSize: "0.65rem",
                letterSpacing: "0.12em",
                color: "#555",
                textTransform: "uppercase",
                marginBottom: "1rem",
              }}
            >
              Item Management
            </div>

            {/* Item catalogue table skeleton */}
            <div
              style={{
                background: "#0d0d0d",
                border: "1px solid #1a1a1a",
                borderRadius: 4,
                overflow: "hidden",
              }}
            >
              {/* Table header */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "2fr 1fr 1fr 1fr auto",
                  gap: "1rem",
                  padding: "0.6rem 1rem",
                  borderBottom: "1px solid #222",
                  fontSize: "0.65rem",
                  letterSpacing: "0.1em",
                  color: "#555",
                  textTransform: "uppercase",
                }}
              >
                <span>Name</span>
                <span>Type</span>
                <span>Held By</span>
                <span>Qty</span>
                <span>Actions</span>
              </div>

              {/* Rows — all player inventory items */}
              {game.players.flatMap((p) =>
                p.inventory.map((item) => (
                  <div
                    key={`${p.id}-${item.id}`}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "2fr 1fr 1fr 1fr auto",
                      gap: "1rem",
                      padding: "0.65rem 1rem",
                      borderBottom: "1px solid #161616",
                      fontSize: "0.82rem",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div style={{ color: "#ccc" }}>{item.name}</div>
                      <div style={{ color: "#444", fontSize: "0.7rem" }}>{item.description}</div>
                    </div>
                    <span style={{ color: "#666", textTransform: "capitalize" }}>
                      {item.type}
                    </span>
                    <span style={{ color: "#888" }}>{p.name}</span>
                    <span style={{ color: "#888" }}>{item.quantity}</span>
                    <div style={{ display: "flex", gap: "0.4rem" }}>
                      <button style={tinyBtnStyle} title="Transfer">⇄</button>
                      <button
                        style={{ ...tinyBtnStyle, color: "#e05555", borderColor: "#4a1a1a" }}
                        title="Remove"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Grant item to player */}
            <div style={{ marginTop: "1.5rem" }}>
              <div
                style={{
                  fontSize: "0.65rem",
                  letterSpacing: "0.12em",
                  color: "#555",
                  textTransform: "uppercase",
                  marginBottom: "0.75rem",
                }}
              >
                Grant Item
              </div>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <input placeholder="Item name..." style={inputStyle} />
                <select style={inputStyle}>
                  <option value="">Select player...</option>
                  {game.players.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <select style={inputStyle}>
                  <option value="weapon">Weapon</option>
                  <option value="armor">Armor</option>
                  <option value="consumable">Consumable</option>
                  <option value="misc">Misc</option>
                </select>
                <button style={ghostBtnStyle}>Grant</button>
              </div>
            </div>
          </div>
        )}

        {/* Log panel */}
        {activePanel === "logs" && (
          <div style={{ flex: 1, overflowY: "auto", padding: "1.5rem 2rem" }}>
            <div
              style={{
                fontSize: "0.65rem",
                letterSpacing: "0.12em",
                color: "#555",
                textTransform: "uppercase",
                marginBottom: "1rem",
              }}
            >
              Game Log
            </div>
            <GameLogPanel logs={game.logs} />
          </div>
        )}

        {/* Settings panel */}
        {activePanel === "settings" && (
          <div style={{ flex: 1, overflowY: "auto", padding: "1.5rem 2rem" }}>
            <GameSettingsPanel game={game} />
          </div>
        )}
      </div>
    </div>
  );
}
