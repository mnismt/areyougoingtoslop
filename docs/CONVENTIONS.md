# Conventions & Engineering Reference

Detailed engineering conventions for the areyougoingslop project. For the concise agent guide, see `AGENTS.md` at the repo root.

## Package Manager

Always use **bun** (`bun install`, `bun add`, `bun run`). Never npm/yarn/pnpm.

## Scripts

| Command | Purpose |
|---------|---------|
| `bun run dev` | Local dev server |
| `bun run build` | Production build |
| `bun run lint` | Biome check |
| `bun run typecheck` | TypeScript check |
| `bun run test` | Run tests |
| `bun run format` | Auto-format |

## Naming Conventions

- **Files:** kebab-case (e.g., `username-form.tsx`, `slop-gauge.tsx`).
- **Exceptions:** Next.js special files (`page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`, `not-found.tsx`, `route.ts`).

## Project Structure

```
src/
  app/
    api/*            # API route handlers
    components/      # Shared UI (site-footer, slop-gauge, username-form)
    u/[username]/*   # Score result page (investigation view → results)
    leaderboard/     # Wall of Shame
    fine-print/      # Consolidated terms, privacy, removal, feedback
  server/
    github/*         # GitHub data ingestion
    scoring/*        # Scoring engine
    cache/*          # Caching layer
    leaderboard/*    # Leaderboard storage
    rate-limit/*     # Rate limiting
    api/*            # Server-side API utilities
    queue/*          # Redis Stream queue for GitHub requests
```

## Scoring: Recency Decay

Scores are weighted by recency so current behavior matters most:

| Window | Weight |
|--------|--------|
| 0–30 days | 1.0 |
| 31–90 days | 0.6 |
| 91–180 days | 0.3 |
| >180 days | excluded |

## Definition of Done

- `bun run build` passes
- `bun run lint` and `bun run typecheck` pass
- Tests pass (or new tests added with rationale)
- Mark completed items as `[x]` in `docs/roadmap/epic-*.md`
- Docs updated if behavior/contract changed
- UI changes adhere to `docs/DESIGN.md` guidelines

## Folder Conventions

- `src/server` — Server-only modules (GitHub ingestion, scoring, caching).
- `src/app/components` — Shared UI components.
- `src/app/api` — Next.js API routes.
