# AGENTS.md — areyougoingslop

A humorous heuristic app that scores how AI-assisted a GitHub user's public contributions appear.

## Key References

- **PRD:** `docs/PRD.md`
- **Architecture:** `docs/ARCHITECTURE.md` (ingestion → scoring → caching → leaderboard)
- **Roadmap:** `docs/roadmap/README.md` + `docs/roadmap/epic-*.md`
- **Conventions:** `docs/CONVENTIONS.md` (structure, naming, scripts, DoD)

## Rules

1. Use **bun** exclusively — never npm/yarn/pnpm.
2. Keep changes scoped to the requested task/epic.
3. Add/update tests when touching scoring logic or API contracts.
4. Keep scorer output deterministic for unit tests.
5. Never weaken disclaimers — this is satire, not a factual detector.
6. Files use **kebab-case**; Next.js special files are exempt.
7. Tone: witty and thoughtful, never mean-spirited. Roast behavior, not people.
