# Bring Your Own Key (BYOK)

Katabatak lets you play using your own Anthropic API key. This document explains exactly what happens to your key and what gets stored.

## Key lifecycle

```
Browser localStorage
  → X-Anthropic-Key HTTP header (HTTPS only)
    → Next.js /api/gm proxy (in-memory, not logged)
      → GM server (in-memory, not logged)
        → Anthropic SDK per-request client
          → Discarded after the request completes
```

**Your key never touches the database.** It is not written to Supabase, not written to log files, and not included in any structured request logs.

## What IS stored

| Data | Table | Purpose |
|------|-------|---------|
| Token counts (integers) | `token_usage` | Power the spend dashboard |
| Budget cap (integer) | `profiles.token_budget` | Block requests that exceed your limit |

The key itself is never a column in any table.

## What is NOT stored

- Your API key, or any fragment or hash of it
- The key in server logs (the `logRequest` call in `index.ts` records only endpoint, characterId, duration, and status)
- The key in Next.js request logs (the `/api/gm` route does not log headers)

## Code audit trail

Three files govern the entire BYOK flow:

- [`packages/server/gm/claude-client.ts`](../gm/claude-client.ts) — constructs an Anthropic client from the key. The key is used in one line: `new Anthropic({ apiKey })`. No storage.
- [`packages/server/gm/record-token-usage.ts`](../gm/record-token-usage.ts) — writes token counts (integers only) to `token_usage`. The key is not a parameter to this function.
- [`packages/server/gm/budget-guard.ts`](../gm/budget-guard.ts) — reads your budget cap and current usage totals before each pipeline run. Blocks the request if you are over cap.

The key is extracted from the HTTP header in [`packages/server/index.ts`](../index.ts) and passed as a local variable through [`packages/server/gm/handler.ts`](../gm/handler.ts) to each agent. It is scoped to a single request and garbage-collected when the request completes.

## HTTPS requirement

The `X-Anthropic-Key` header is transmitted in plaintext inside an HTTPS-encrypted connection. In production (Vercel / Cloud Run) HTTPS is enforced at the edge. In local development over `http://localhost` the key is in plaintext on the loopback interface — this is acceptable for a trusted local environment.

## Budget cap

Set a token budget cap in the account settings. Requests are blocked when your cumulative token count (input + output, all agents) exceeds the cap. The minimum cap is 1,000 tokens to prevent accidental self-lockout. Set to blank/null to remove the cap entirely.

Token counts are approximate — they reflect what the Anthropic API reports in `response.usage` for each agent call. The Architect uses `stream.finalMessage().usage` since it streams.
