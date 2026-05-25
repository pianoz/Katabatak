# KatabataK

A full-stack digital companion for the KatabataK tabletop RPG system. Replaces pen-and-paper character sheets with live stat tracking, a visual skill tree, inventory management, and an AI-powered virtual GM.

## Features

- **Character creation & dashboard** — manage health, essence, power, will, speed, carry weight, currency, and backstory across sessions
- **Skill tree** — visual, node-based skill progression with unlock prerequisites and multi-rank skills; too complex to track on paper
- **Inventory system** — items with condition/durability tracking, consumables, equipped state, and weight management
- **Spell system** — spells with cast times, cooldowns, AOE, range, and attribute-scaled damage
- **Game sessions** — GM creates a game with a join code; players join and link their characters; supports live combat with turn order tracking and a combat log
- **Virtual DM** — AI game master assistant (in development)
- **Skill tree editor** — dev-only tool for managing the world's skill and item database
- **Auth** — email magic link via Supabase; role-based access (GM vs. player) per game

## Tech Stack

| Layer | Technology |
| --- | --- |
| Framework | Next.js 16 (App Router) + React 19 |
| Language | TypeScript |
| Styling | Tailwind CSS v4 + shadcn/ui (Radix UI) |
| Auth & DB | Supabase (PostgreSQL + SSR auth) |
| Forms | React Hook Form + Zod |
| Animation | Framer Motion |
| Analytics | Vercel Analytics |
| Package manager | pnpm (monorepo) |
| AI GM server | Separate Node server, proxied via Next.js API routes |

## Project Structure

```text
packages/
  web/          # Next.js app
    app/        # App Router pages and API routes
    components/ # UI components and feature components
    lib/        # Supabase client/server helpers
    hooks/      # Shared React hooks
```

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm
- A Supabase project

### Setup

```bash
# Install dependencies
pnpm install

# Set environment variables
cp packages/web/.env.example packages/web/.env.local
# Fill in NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY

# Run the dev server
pnpm --filter web dev
```

Open [http://localhost:3000](http://localhost:3000).

### Virtual DM (optional)

The AI GM feature requires a separate server running on port 3001. Set `GM_SERVER_URL` in your env to point to it.

## Screenshots

![GM screen](packages/web/public/GM%20combat%20page.JPG)

![Character screen](packages/web/public/Character%20sheet.JPG)

## License

MIT
