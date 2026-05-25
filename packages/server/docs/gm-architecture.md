# AI Game Master — Architecture Reference

> Last meaningful update: 2026-05-24 — initial doc

---

## Overview

The GM server is an Express app (port 3001) that wraps Claude Opus via the Anthropic SDK. It uses Claude's native tool use to let the AI read game state and mutate character data in Supabase during a conversation.

The web app never calls Claude directly — it proxies all GM traffic through `POST /api/gm` → `POST /gm` on this server. The server holds the Anthropic API key and the Supabase service role key.

---

## Request Flow

```
Player message
  → POST /api/gm (Next.js proxy)
    → POST /gm (Express server)
      → handleGMMessage()
        → buildSystemPrompt()        // character context injected here
        → Claude Opus (tool_use loop)
          ├ resolve_difficulty  → Haiku instance (DIFFICULTY_SYSTEM prompt)
          ├ get_npc_response    → Haiku instance (NPC SYSTEM prompt)
          └ update_stat / update_level / restore_pools → Supabase mutation
        → Return final text block
```

The loop runs until Claude's `stop_reason` is `"end_turn"` (no more tool calls). All tool calls within a single round execute in parallel via `Promise.all`.

---

## Models Used

| Role | Model | max_tokens |
|------|-------|-----------|
| Main GM narrator | `claude-opus-4-7` | 1024 |
| Difficulty arbiter | `claude-haiku-4-5-20251001` | 80 |
| NPC dialogue | `claude-haiku-4-5-20251001` | 200 |
| Session summarizer | `claude-sonnet-4-6` | 1000 |
| Generic eval | `claude-sonnet-4-6` | configurable |

---

## Tools

All five tools are defined in `gm/tools/index.ts` and exported to the GM Opus model. Claude never passes a `character_id` — it is injected automatically by `executeTool()`.

### `update_stat`
Adjust any character stat by a signed integer delta.

| Param | Type | Notes |
|-------|------|-------|
| `stat` | string | Canonical names: `health`, `essence`, `power`, `will`, `denarius`, `speed`, `skill_points`. Aliases: `hp` → `current_health`, `mana` → `current_essence`, `gold` → `denarius` |
| `delta` | integer | Negative = damage/cost. Positive = heal/restore/gain |

Pool stats (health, essence, power, will) are clamped to `[0, max]`. Scalar stats (denarius, speed, skill_points) clamp to `[0, ∞)`.

**Handler:** `gm/tools/character.ts` → `update_stat()`

---

### `restore_pools`
Sets all four pools (health, essence, power, will) to their max values. No parameters. Use after full rest or major healing.

**Handler:** `gm/tools/character.ts` → `restore_pools()`

---

### `update_level`
Set character level and optionally award skill points.

| Param | Type | Notes |
|-------|------|-------|
| `new_level` | integer | Minimum 1 |
| `skill_points_to_award` | integer | Optional, default 0. Added to existing `unused_skill_points`. |

**Handler:** `gm/tools/character.ts` → `update_level()`

---

### `resolve_difficulty`
Call when a player attempts something that might fail. Delegates to a Haiku sub-agent that returns difficulty and which pool is sacrificed.

| Param | Type | Notes |
|-------|------|-------|
| `action` | string | What the player is attempting (e.g., "dodge a falling stone") |
| `context` | string | Location and situational conditions |

**Response:**
```json
{ "difficulty": 12, "pool": "power", "reason": "brute force needed to push the boulder" }
```

Pool assignments by theme:
- `health` — physical endurance, pain tolerance
- `power` — brute force, raw martial effort
- `essence` — perception, focus, magic or mental tasks
- `will` — resisting fear, temptation, social pressure

After this tool resolves, the GM presents the player with three options: (1) sacrifice full difficulty from that pool to auto-succeed, (2) sacrifice some + roll d10, or (3) roll d10 alone.

**Handler:** `gm/agents/interaction.ts` → `resolveCheckDifficulty()`

---

### `get_npc_response`
Returns dialogue and mood for a named NPC. The response should be woven into narration, not quoted as a block.

| Param | Type | Notes |
|-------|------|-------|
| `npc_name` | string | Name of the NPC |
| `personality` | string | Brief traits (e.g., "greedy, suspicious, verbose") |
| `situation` | string | What's happening around this NPC |
| `player_input` | string | What the player said or did |

**Response:**
```json
{ "dialogue": "...", "mood": "suspicious" }
```

Valid moods: `suspicious`, `warm`, `fearful`, `cold`, `evasive`, `hostile`, `amused`.

**Handler:** `gm/agents/npc.ts` → `getNpcResponse()`

---

## Agents

### Interaction Agent (`gm/agents/interaction.ts`)
Handles `resolve_difficulty` and is a pass-through for character mutations. When `resolve_difficulty` fires, this agent calls a Haiku instance with the `DIFFICULTY_SYSTEM` prompt.

### NPC Agent (`gm/agents/npc.ts`)
Called by `get_npc_response`. Spins up a Haiku instance with a strict dialogue-only system prompt. Returns JSON only — no markdown, no narration.

### Summary Agent (`gm/agents/summary.ts`)
Separate from the tool loop. Called by `POST /gm/summarize` to produce a narrative summary of a session. Accepts `history[]` and an optional `existingSummary` to merge into. Uses Sonnet, max 1000 tokens. Output is past-tense prose, never bullet points. Meta-game details (dice numbers, tool calls) are stripped.

---

## System Prompt

Built by `buildSystemPrompt()` in `gm/handler.ts`. Structure:

**Base persona** (always included):
```
You are the spirit guiding a player through a medieval world named Kataba.
The world is quiet, rural, developing, steeped in natural beauty.
Responses will be short. Ground in the senses and natural beauty.
You write like John Steinbeck. the mood is wistful melancholy. Ghibli or Faulkner.
Do not end your response with an open-ended question. Restrict the player.
Say no to the player occasionally. Make them work to succeed.
```

**Tool usage rules** (always included): Instructions for each tool — when to call, which params, what not to pass.

**Character context block** (injected when `character.name` is present):
```
Player Character:
- Name / Level / Class/Archetype
- Health, Essence, Power, Will (current / max)
- Location (current_location_text)
- Condition (condition_text)
```

**Debug mode** (`DEBUG_MODE = true` in handler.ts): Replaces entire prompt with "Return all character info passed to you verbatim." Toggle this to verify character context injection.

---

## Conversation State

The server is **stateless** — it does not hold session memory between HTTP requests. The caller (the web app's `virtual-gm-component.tsx`) maintains `conversationHistory` in React state and passes it with every request as:

```typescript
{ role: 'player' | 'assistant', content: string }[]
```

The handler converts `player` → `user` before sending to the Anthropic API.

**Implication:** If the web client loses its React state (page refresh, navigation away), the conversation history is gone. The `/gm/summarize` endpoint exists precisely to checkpoint history into a compact summary before that happens.

---

## Server Endpoints

| Method | Path | Handler | Notes |
|--------|------|---------|-------|
| `POST` | `/gm` | `handleGMMessage()` | Main conversation loop |
| `POST` | `/gm/summarize` | Summary agent | Compress history into a narrative summary |
| `POST` | `/eval` | Claude eval service | Single-shot call, no tools — used by dev prompt tools |
| `GET` | `/health` | — | `{ status: 'ok' }` |

---

## Adding a New Tool

1. **Define the tool** in `gm/tools/index.ts` — add to the `tools` array with a JSON schema.
2. **Write the handler** in `gm/tools/character.ts` (for character mutations) or a new file under `gm/agents/` (for sub-agent calls).
3. **Wire it in `executeTool()`** in `gm/tools/index.ts` — add a case to the switch.
4. **Update the system prompt** in `gm/handler.ts` — add a usage rule in the `## Tools` block so the GM knows when to call it.
5. **Test via CLI**: `node --env-file=.env.local packages/server/chat.ts <character_id>` — the REPL logs every tool call and result.
6. **Update this doc** — add the tool to the Tools section above.

---

## Failure Modes

- **Tool call returns `{ error: string }`** — `executeTool()` wraps all errors this way. Claude receives the error text as the tool result and typically narrates around it.
- **Supabase update fails** — `updateCharacter()` returns `{ error }`. The stat is not mutated; the error is passed back to Claude.
- **Sub-agent times out or returns bad JSON** — `resolve_difficulty` and `get_npc_response` both parse JSON responses. If Haiku returns malformed JSON, the tool result is an error string and Claude recovers narratively.
- **Infinite tool loop** — Anthropic SDK has no built-in loop cap here. The `stop_reason === 'tool_use'` loop will run until Claude stops calling tools. If a tool keeps erroring, Claude may retry. Monitor `stdout` for repeated tool call logs.
